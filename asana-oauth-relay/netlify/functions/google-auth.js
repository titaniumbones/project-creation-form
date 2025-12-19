exports.handler = async (event) => {
  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');

  authUrl.searchParams.set('client_id', process.env.GOOGLE_CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', process.env.GOOGLE_REDIRECT_URI);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', [
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/documents',
    'https://www.googleapis.com/auth/presentations',
  ].join(' '));
  authUrl.searchParams.set('access_type', 'offline'); // Required for refresh token
  authUrl.searchParams.set('prompt', 'consent'); // Force consent to always get refresh token
  authUrl.searchParams.set('state', event.queryStringParameters?.state || '');

  return {
    statusCode: 302,
    headers: { Location: authUrl.toString() },
  };
};
