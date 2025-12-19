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
  window.opener.postMessage({type: 'google-oauth-callback', error: "${error}"}, '*');
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
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
        redirect_uri: process.env.GOOGLE_REDIRECT_URI,
      }),
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
  window.opener.postMessage({type: 'google-oauth-callback', error: "${tokens.error_description || tokens.error}"}, '*');
  window.close();
</script>
<p>OAuth error: ${tokens.error_description || tokens.error}. This window should close automatically.</p>
</body>
</html>`,
      };
    }

    // Return tokens to the opener window
    const tokenData = JSON.stringify({
      type: 'google-oauth-callback',
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
  window.opener.postMessage({type: 'google-oauth-callback', error: "Server error during token exchange"}, '*');
  window.close();
</script>
<p>Server error. This window should close automatically.</p>
</body>
</html>`,
    };
  }
};
