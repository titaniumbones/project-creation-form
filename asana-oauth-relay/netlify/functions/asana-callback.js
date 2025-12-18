exports.handler = async (event) => {
  const code = event.queryStringParameters?.code;
  const error = event.queryStringParameters?.error;

  if (error) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/html' },
      body: `<!DOCTYPE html>
<html>
<head><title>OAuth Error</title></head>
<body>
<script>
  window.opener.postMessage({error: "${error}"}, '*');
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
    const response = await fetch('https://app.asana.com/-/oauth_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: process.env.ASANA_CLIENT_ID,
        client_secret: process.env.ASANA_CLIENT_SECRET,
        redirect_uri: process.env.REDIRECT_URI,
        code,
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
  window.opener.postMessage({error: "${tokens.error_description || tokens.error}"}, '*');
  window.close();
</script>
<p>OAuth error: ${tokens.error_description || tokens.error}. This window should close automatically.</p>
</body>
</html>`,
      };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/html' },
      body: `<!DOCTYPE html>
<html>
<head><title>OAuth Success</title></head>
<body>
<script>
  window.opener.postMessage(${JSON.stringify(tokens)}, '*');
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
  window.opener.postMessage({error: "Server error during token exchange"}, '*');
  window.close();
</script>
<p>Server error. This window should close automatically.</p>
</body>
</html>`,
    };
  }
};
