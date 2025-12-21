// Airtable OAuth 2.0 Authorization with PKCE
// Docs: https://airtable.com/developers/web/api/oauth-reference
const crypto = require('crypto');

// Generate a secure random string for code_verifier
function generateCodeVerifier() {
  return crypto.randomBytes(32).toString('base64url');
}

// Create code_challenge from verifier using SHA256
function generateCodeChallenge(verifier) {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

exports.handler = async (event) => {
  const authUrl = new URL('https://airtable.com/oauth2/v1/authorize');

  // Generate PKCE values
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);

  // Store verifier in state (will be passed back in callback)
  const stateData = {
    verifier: codeVerifier,
    random: crypto.randomBytes(8).toString('hex'),
  };
  const state = Buffer.from(JSON.stringify(stateData)).toString('base64url');

  // Required scopes for project creation app
  // Note: whoami endpoint works without special scope
  // Refresh tokens are automatically provided with PKCE flow
  const scopes = [
    'data.records:read',
    'data.records:write',
    'schema.bases:read',
  ];

  authUrl.searchParams.set('client_id', process.env.AIRTABLE_CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', process.env.AIRTABLE_REDIRECT_URI);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', scopes.join(' '));
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('code_challenge', codeChallenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');

  return {
    statusCode: 302,
    headers: { Location: authUrl.toString() },
  };
};
