# Local Development Setup Guide

This guide will help you set up the Project Creation Helper for local development. Follow the steps in order.

## Prerequisites

Before starting, ensure you have:

- [ ] **Node.js** v18 or higher (`node --version`)
- [ ] **npm** v9 or higher (`npm --version`)
- [ ] **Git** installed
- [ ] **Netlify CLI** (`npm install -g netlify-cli`)
- [ ] Access to the GivingTuesday Airtable base
- [ ] (Optional) Access to Asana workspace for project creation
- [ ] (Optional) Access to Google Workspace for document generation

---

## Quick Start (Web App Only)

If you just want to run the web application and use the existing OAuth relay:

```bash
# 1. Clone the repository
git clone https://github.com/YOUR_ORG/project-creation-form.git
cd project-creation-form/project-creation-app

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env
# Edit .env with your values (see Environment Variables section below)

# 4. Start the development server
npm run dev
```

The app will be available at `http://localhost:5173`

---

## Full Local Development Setup

To run all components locally (web app + OAuth relay):

### Step 1: Clone and Install

```bash
# Clone the repository
git clone https://github.com/YOUR_ORG/project-creation-form.git
cd project-creation-form

# Install web app dependencies
cd project-creation-app
npm install
cd ..

# Install OAuth relay dependencies (minimal)
cd asana-oauth-relay
npm install
cd ..
```

### Step 2: Set Up OAuth Relay

The OAuth relay handles authentication with Airtable, Asana, and Google.

```bash
cd asana-oauth-relay

# Copy environment template
cp .env.example .env

# Edit .env with your OAuth credentials (see OAuth Setup section below)
```

Start the OAuth relay:
```bash
netlify dev
```

This runs on `http://localhost:8888`

### Step 3: Set Up Web App

In a new terminal:

```bash
cd project-creation-app

# Copy environment template
cp .env.example .env

# Edit .env - for local development, set:
# VITE_OAUTH_RELAY_URL=http://localhost:8888
```

Start the web app:
```bash
npm run dev
```

This runs on `http://localhost:5173`

---

## OAuth Credential Setup

### Airtable OAuth

1. Go to [Airtable OAuth Integrations](https://airtable.com/create/oauth)
2. Click **"Create new OAuth integration"**
3. Configure:
   - **Name**: Project Creation Helper (Local Dev)
   - **Redirect URIs**:
     - `http://localhost:8888/.netlify/functions/airtable-callback`
     - `https://YOUR-PRODUCTION-SITE.netlify.app/.netlify/functions/airtable-callback`
   - **Scopes**: Select:
     - `data.records:read`
     - `data.records:write`
     - `schema.bases:read`
4. Copy the **Client ID** and **Client Secret** to your `.env` file

### Asana OAuth

1. Go to [Asana Developer Console](https://app.asana.com/0/developer-console)
2. Click **"Create new app"**
3. Configure:
   - **App name**: Project Creation Helper
   - **Redirect URLs**:
     - `http://localhost:8888/.netlify/functions/asana-callback`
     - `https://YOUR-PRODUCTION-SITE.netlify.app/.netlify/functions/asana-callback`
4. Copy the **Client ID** and **Client Secret** to your `.env` file

### Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable APIs:
   - Go to **APIs & Services > Library**
   - Enable: **Google Drive API**, **Google Docs API**, **Google Slides API**
4. Configure OAuth consent screen:
   - Go to **APIs & Services > OAuth consent screen**
   - User Type: Internal (for organization) or External
   - Add scopes: `drive.file`, `documents`, `presentations`
5. Create credentials:
   - Go to **APIs & Services > Credentials**
   - Click **Create Credentials > OAuth client ID**
   - Application type: **Web application**
   - Authorized redirect URIs:
     - `http://localhost:8888/.netlify/functions/google-callback`
     - `https://YOUR-PRODUCTION-SITE.netlify.app/.netlify/functions/google-callback`
6. Copy the **Client ID** and **Client Secret** to your `.env` file

---

## Environment Variables Reference

### OAuth Relay (`asana-oauth-relay/.env`)

| Variable | Description | Example |
|----------|-------------|---------|
| `ASANA_CLIENT_ID` | Asana OAuth app client ID | `12345678901234` |
| `ASANA_CLIENT_SECRET` | Asana OAuth app client secret | `abc123...` |
| `REDIRECT_URI` | Asana callback URL | `http://localhost:8888/.netlify/functions/asana-callback` |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | `123456789.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | `GOCSPX-...` |
| `GOOGLE_REDIRECT_URI` | Google callback URL | `http://localhost:8888/.netlify/functions/google-callback` |
| `AIRTABLE_CLIENT_ID` | Airtable OAuth client ID | `abc123...` |
| `AIRTABLE_CLIENT_SECRET` | Airtable OAuth client secret | `xyz789...` |
| `AIRTABLE_REDIRECT_URI` | Airtable callback URL | `http://localhost:8888/.netlify/functions/airtable-callback` |

### Web App (`project-creation-app/.env`)

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_OAUTH_RELAY_URL` | OAuth relay base URL | `http://localhost:8888` (local) or `https://airtable-asana-integration-oauth.netlify.app` (production) |
| `VITE_AIRTABLE_BASE_ID` | Airtable base ID | `appXXXXXXXXXXXXXX` |
| `VITE_ASANA_TEMPLATE_GID` | Asana project template GID | `1234567890123456` |
| `VITE_ASANA_TEAM_GID` | Asana team GID | `1234567890123456` |
| `VITE_GOOGLE_SHARED_DRIVE_ID` | Google Shared Drive ID | `0AEntYWns1C1WUk9PVA` |
| `VITE_GOOGLE_PROJECTS_FOLDER_ID` | Folder for project documents | `1ABC...` |
| `VITE_GOOGLE_SCOPING_DOC_TEMPLATE_ID` | Google Doc template ID | `1DEF...` |
| `VITE_GOOGLE_KICKOFF_DECK_TEMPLATE_ID` | Google Slides template ID | `1GHI...` |

---

## Finding IDs

### Airtable Base ID
- Open your Airtable base
- Look at the URL: `https://airtable.com/appXXXXXXXXXXXXXX/...`
- The `appXXXXXXXXXXXXXX` part is your base ID

### Asana Template GID
- Open your Asana project template
- Look at the URL: `https://app.asana.com/0/1234567890123456/...`
- The number after `/0/` is your template GID

### Asana Team GID
- Go to your team's page in Asana
- Look at the URL: `https://app.asana.com/0/team/1234567890123456`
- The last number is your team GID

### Google Drive/Docs IDs
- Open the folder or document in Google Drive
- Look at the URL: `https://drive.google.com/drive/folders/FOLDER_ID`
- Or for docs: `https://docs.google.com/document/d/DOC_ID/edit`

---

## Troubleshooting

### "Not connected to Airtable"
- Ensure the OAuth relay is running (`netlify dev` in `asana-oauth-relay/`)
- Check `VITE_OAUTH_RELAY_URL` points to the relay (localhost:8888 for local dev)
- Verify your Airtable OAuth credentials are correct

### "OAuth callback failed"
- Check redirect URIs in your OAuth app match exactly (including trailing slashes)
- Ensure all environment variables are set in the OAuth relay

### "Failed to load team members"
- Verify `VITE_AIRTABLE_BASE_ID` is correct
- Ensure you've connected to Airtable in the Settings page
- Check that the "Data Team Members" table exists in your base

### CORS errors
- Make sure the OAuth relay is running on port 8888
- Check browser console for specific error messages

### Port already in use
- Kill existing processes: `lsof -ti:5173 | xargs kill` (web app) or `lsof -ti:8888 | xargs kill` (relay)

---

## Component Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     User's Browser                           │
│  ┌─────────────────────────────────────────────────────┐   │
│  │         Project Creation Helper (React App)          │   │
│  │                 localhost:5173                        │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              OAuth Relay (Netlify Functions)                 │
│                    localhost:8888                            │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐               │
│  │  Airtable │  │   Asana   │  │  Google   │               │
│  │   Auth    │  │   Auth    │  │   Auth    │               │
│  └───────────┘  └───────────┘  └───────────┘               │
└─────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
   │  Airtable   │    │    Asana    │    │   Google    │
   │    API      │    │    API      │    │  Drive/Docs │
   └─────────────┘    └─────────────┘    └─────────────┘
```

---

## Next Steps

After setup, you can:

1. **Connect services**: Go to Settings page and connect Airtable, Asana, and Google
2. **Create a project**: Fill out the form and create resources
3. **Test drafts**: Save a draft and share it for approval
4. **Check debug mode**: Enable debug mode to see API calls and troubleshoot issues

For architecture decisions, see the [ADR documents](docs/architecture/).
