# OAuth Relay Service

A Netlify Functions-based OAuth 2.0 relay that handles authentication for Airtable, Asana, and Google Workspace. This service keeps OAuth client secrets server-side for security while providing the web application with access tokens.

## Purpose

The Project Creation Helper web application needs to authenticate with three external services. Since the web app runs entirely in the browser, OAuth client secrets cannot be safely stored there. This relay service:

1. Stores client secrets securely as environment variables on Netlify
2. Initiates OAuth flows by redirecting to provider authorization pages
3. Exchanges authorization codes for access tokens
4. Refreshes expired tokens using refresh tokens

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   Web Application (Browser)                  │
│                                                              │
│  1. User clicks "Connect"                                    │
│  2. Redirect to relay → /.netlify/functions/{service}-auth  │
│  3. After auth, receives tokens in URL fragment             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                 OAuth Relay (Netlify Functions)              │
│                                                              │
│   ┌───────────────┐  ┌───────────────┐  ┌───────────────┐  │
│   │   Airtable    │  │     Asana     │  │    Google     │  │
│   │   (PKCE)      │  │               │  │               │  │
│   ├───────────────┤  ├───────────────┤  ├───────────────┤  │
│   │ -auth.js      │  │ -auth.js      │  │ -auth.js      │  │
│   │ -callback.js  │  │ -callback.js  │  │ -callback.js  │  │
│   │ -refresh.js   │  │ -refresh.js   │  │ -refresh.js   │  │
│   └───────────────┘  └───────────────┘  └───────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
   │  Airtable   │    │    Asana    │    │   Google    │
   │  OAuth API  │    │  OAuth API  │    │  OAuth API  │
   └─────────────┘    └─────────────┘    └─────────────┘
```

## Functions

Each service has three functions:

| Function | Endpoint | Purpose |
|----------|----------|---------|
| `airtable-auth` | `/.netlify/functions/airtable-auth` | Initiates Airtable OAuth flow (with PKCE) |
| `airtable-callback` | `/.netlify/functions/airtable-callback` | Exchanges auth code for tokens |
| `airtable-refresh` | `/.netlify/functions/airtable-refresh` | Refreshes expired Airtable tokens |
| `asana-auth` | `/.netlify/functions/asana-auth` | Initiates Asana OAuth flow |
| `asana-callback` | `/.netlify/functions/asana-callback` | Exchanges auth code for tokens |
| `asana-refresh` | `/.netlify/functions/asana-refresh` | Refreshes expired Asana tokens |
| `google-auth` | `/.netlify/functions/google-auth` | Initiates Google OAuth flow |
| `google-callback` | `/.netlify/functions/google-callback` | Exchanges auth code for tokens |
| `google-refresh` | `/.netlify/functions/google-refresh` | Refreshes expired Google tokens |

## OAuth Flow

### Initial Authorization

1. User clicks "Connect to [Service]" in the web app
2. Browser navigates to `/.netlify/functions/{service}-auth`
3. Function redirects to provider's authorization page
4. User grants permission
5. Provider redirects to `/.netlify/functions/{service}-callback` with auth code
6. Callback function exchanges code for tokens
7. Function redirects back to app with tokens in URL fragment

### Token Refresh

1. Web app detects expired access token
2. POST to `/.netlify/functions/{service}-refresh` with refresh token
3. Function exchanges refresh token for new access token
4. Returns new tokens to web app

## Local Development

### Prerequisites

- Node.js v18+
- Netlify CLI (`npm install -g netlify-cli`)
- OAuth credentials for each service (see [../SETUP.md](../SETUP.md))

### Setup

```bash
# Navigate to relay directory
cd asana-oauth-relay

# Install dependencies (minimal, mostly for development)
npm install

# Copy environment template
cp .env.example .env

# Edit .env with your OAuth credentials
```

### Environment Variables

| Variable | Service | Description |
|----------|---------|-------------|
| `ASANA_CLIENT_ID` | Asana | OAuth app client ID |
| `ASANA_CLIENT_SECRET` | Asana | OAuth app client secret |
| `REDIRECT_URI` | Asana | Callback URL for Asana |
| `GOOGLE_CLIENT_ID` | Google | OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google | OAuth client secret |
| `GOOGLE_REDIRECT_URI` | Google | Callback URL for Google |
| `AIRTABLE_CLIENT_ID` | Airtable | OAuth integration client ID |
| `AIRTABLE_CLIENT_SECRET` | Airtable | OAuth integration client secret |
| `AIRTABLE_REDIRECT_URI` | Airtable | Callback URL for Airtable |

### Running Locally

```bash
# Start the Netlify dev server
netlify dev
```

This runs the relay on `http://localhost:8888`. The web application should set `VITE_OAUTH_RELAY_URL=http://localhost:8888` to use the local relay.

## Deployment

### Initial Setup

```bash
# Login to Netlify
netlify login

# Initialize the site (first time only)
netlify init
```

### Deploy

```bash
# Deploy to production
npm run deploy
# or
netlify deploy --prod
```

### Environment Variables on Netlify

Set all environment variables in the Netlify dashboard:
1. Go to Site settings > Environment variables
2. Add each variable from `.env.example`
3. Use production redirect URIs (e.g., `https://YOUR-SITE.netlify.app/.netlify/functions/...`)

## Security Notes

- **Client secrets** are stored only on Netlify, never in the browser
- **PKCE** is used for Airtable OAuth for additional security
- **Refresh tokens** are passed to the browser and stored in localStorage (acceptable for this use case)
- **State parameter** is used to prevent CSRF attacks

## Troubleshooting

### "OAuth callback failed"

- Check that redirect URIs in OAuth provider settings match exactly (including protocol and trailing slashes)
- Verify all environment variables are set on Netlify
- Check Netlify function logs for errors

### "Invalid redirect_uri"

- The redirect URI in the auth request must match one registered in the OAuth app
- For local dev: `http://localhost:8888/.netlify/functions/{service}-callback`
- For production: `https://YOUR-SITE.netlify.app/.netlify/functions/{service}-callback`

### "Token refresh failed"

- Refresh tokens may expire if unused for extended periods
- User may need to re-authenticate by clicking "Connect" again
- Check that the refresh endpoint has the correct client credentials

## Related Documentation

- [Main Project README](../README.md)
- [Setup Guide](../SETUP.md)
- [ADR-001: OAuth Migration](../docs/architecture/ADR-001-oauth-migration.md)
