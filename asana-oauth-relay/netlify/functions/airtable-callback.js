// Airtable OAuth 2.0 Callback
// Exchanges authorization code for access token

exports.handler = async (event) => {
  const code = event.queryStringParameters?.code;
  const error = event.queryStringParameters?.error;
  const state = event.queryStringParameters?.state || '';

  if (error) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/html' },
      body: `<!DOCTYPE html>
<html>
<head><title>OAuth Error</title></head>
<body>
<script>
  window.opener.postMessage({type: 'airtable-oauth-callback', error: "${error}"}, '*');
  window.close();
</script>
<p>OAuth error: ${error}. This window should close automatically.</p>
</body>
</html>`,
    };
  }

  if (!code) {
    return { statusCode: 400, body: 'Missing code parameter' };
  }

  try {
    // Extract code_verifier from state (for PKCE)
    let codeVerifier = '';
    try {
      const stateData = JSON.parse(Buffer.from(state, 'base64url').toString());
      codeVerifier = stateData.verifier || '';
    } catch (e) {
      console.warn('Could not parse state for PKCE verifier');
    }

    // Exchange code for tokens
    // Airtable requires Basic auth with client_id:client_secret
    const credentials = Buffer.from(
      `${process.env.AIRTABLE_CLIENT_ID}:${process.env.AIRTABLE_CLIENT_SECRET}`
    ).toString('base64');

    const tokenParams = {
      grant_type: 'authorization_code',
      code,
      redirect_uri: process.env.AIRTABLE_REDIRECT_URI,
    };

    // Include code_verifier for PKCE
    if (codeVerifier) {
      tokenParams.code_verifier = codeVerifier;
    }

    const response = await fetch('https://airtable.com/oauth2/v1/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${credentials}`,
      },
      body: new URLSearchParams(tokenParams),
    });

    const tokens = await response.json();

    if (tokens.error) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'text/html' },
        body: `<!DOCTYPE html>
<html>
<head><title>OAuth Error</title></head>
<body>
<script>
  window.opener.postMessage({type: 'airtable-oauth-callback', error: "${tokens.error_description || tokens.error}"}, '*');
  window.close();
</script>
<p>OAuth error: ${tokens.error_description || tokens.error}. This window should close automatically.</p>
</body>
</html>`,
      };
    }

    // Return tokens to the opener window
    const tokenData = JSON.stringify({
      type: 'airtable-oauth-callback',
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || '',
      expires_in: tokens.expires_in,
      state: state,
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/html' },
      body: `<!DOCTYPE html>
<html>
<head><title>OAuth Success</title></head>
<body>
<script>
  window.opener.postMessage(${tokenData}, '*');
  window.close();
</script>
<p>Success! This window should close automatically.</p>
</body>
</html>`,
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'text/html' },
      body: `<!DOCTYPE html>
<html>
<head><title>OAuth Error</title></head>
<body>
<script>
  window.opener.postMessage({type: 'airtable-oauth-callback', error: "Server error during token exchange"}, '*');
  window.close();
</script>
<p>Server error. This window should close automatically.</p>
</body>
</html>`,
    };
  }
};
