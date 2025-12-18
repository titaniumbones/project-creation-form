exports.handler = async (event) => {
  const authUrl = new URL('https://app.asana.com/-/oauth_authorize');
  authUrl.searchParams.set('client_id', process.env.ASANA_CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', process.env.REDIRECT_URI);
  authUrl.searchParams.set('response_type', 'code');
  // Don't specify scope - Asana will use app's configured permissions
  authUrl.searchParams.set('state', event.queryStringParameters?.state || '');

  return {
    statusCode: 302,
    headers: { Location: authUrl.toString() },
  };
};
