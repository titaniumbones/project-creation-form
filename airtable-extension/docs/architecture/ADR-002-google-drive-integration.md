# ADR-002: Google Drive Integration for Document Generation

**Status:** Proposed
**Date:** 2025-12-18
**Deciders:** Matt Price
**Technical Story:** Integrate Google Drive and Google Docs/Slides APIs to automatically create and populate project documentation from Airtable data

---

## Context and Problem Statement

The extension currently generates markdown content for project scoping documents. Users must manually:
1. Find/create folders in Google Drive
2. Copy template documents
3. Paste generated content into documents
4. Create additional supporting documents

We want to automate this workflow by:
1. Creating/locating project folders in a shared Google Drive
2. Generating documents from templates with auto-populated content
3. (Stretch) Creating slide decks and supporting documents

---

## Proposed Workflow

```
┌─────────────────────────────────────────────────────────────────────┐
│  1. User enters project data in Airtable record                      │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│  2. User clicks "Generate Scope" → Markdown generated (existing)     │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│  3. Extension searches Shared Drive for folder matching Project Name │
│     - If found → Use existing folder                                 │
│     - If not found → Prompt user to create                          │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│  4. Copy template doc → Populate with markdown/field content         │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│  5. (Stretch) Create additional docs/slides from templates           │
│     → Name: "[Project Name] - [Document Type]"                       │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Feasibility Assessment

### Feature 1: Search Shared Drive for Project Folder
**Feasibility: ✅ HIGH (Straightforward)**

- **API:** `drive.files.list` with query `name='Project Name' and mimeType='application/vnd.google-apps.folder'`
- **Scope Required:** `https://www.googleapis.com/auth/drive.readonly` (or `drive` for full access)
- **Shared Drive Consideration:** Must use `supportsAllDrives=true` and `includeItemsFromAllDrives=true`
- **Limitation:** User must have access to the Shared Drive
- **Complexity:** Low

### Feature 2: Create Project Folder (with user permission)
**Feasibility: ✅ HIGH (Straightforward)**

- **API:** `drive.files.create` with `mimeType='application/vnd.google-apps.folder'`
- **Scope Required:** `https://www.googleapis.com/auth/drive` (write access)
- **Shared Drive Consideration:** Must specify `parents: ['SHARED_DRIVE_ID']` and `supportsAllDrives=true`
- **Complexity:** Low

### Feature 3: Copy Template Document and Populate Content
**Feasibility: ⚠️ MEDIUM (Achievable with caveats)**

- **APIs Required:**
  - `drive.files.copy` - Copy template document
  - `docs.documents.batchUpdate` - Modify document content
- **Scope Required:** `https://www.googleapis.com/auth/documents` + `drive`
- **Template Approach:** Use placeholder tokens (e.g., `{{PROJECT_NAME}}`, `{{DESCRIPTION}}`)
- **Content Insertion Methods:**
  - **Option A (Recommended):** Find/replace placeholders with `replaceAllText` request
  - **Option B:** Insert at specific locations using `location.index` (fragile)
  - **Option C:** Append to end of document (limited formatting)
- **Markdown Limitation:** Google Docs API does NOT support markdown directly. Must either:
  1. Convert markdown to Google Docs JSON requests (complex)
  2. Insert as plain text
  3. Use HTML import (via Drive API upload with conversion)
- **Complexity:** Medium-High

#### Markdown-to-Docs Conversion Options

| Approach | Pros | Cons |
|----------|------|------|
| **Plain text insertion** | Simple, reliable | Loses formatting |
| **HTML upload with conversion** | Preserves most formatting | Requires file upload, limited control |
| **JSON batch requests** | Full formatting control | Complex to build, error-prone |
| **Use Google Docs templates directly** | Best formatting | Can't reuse existing markdown generation |

**Recommended:** Use placeholder replacement in templates for structured content. For markdown sections, insert as plain text or pre-format in template.

### Feature 4: Create Multiple Documents from Templates
**Feasibility: ✅ HIGH (Same as Feature 3)**

- **API:** Same as Feature 3, loop over template list
- **Naming:** Use `drive.files.update` to set name after copy, or set during copy
- **Complexity:** Low (once Feature 3 is working)

### Feature 5: Populate Slide Decks from Templates
**Feasibility: ⚠️ MEDIUM (Similar challenges to Docs)**

- **APIs Required:**
  - `drive.files.copy` - Copy template presentation
  - `slides.presentations.batchUpdate` - Modify slides
- **Scope Required:** `https://www.googleapis.com/auth/presentations` + `drive`
- **Template Approach:** Same placeholder strategy (`{{VARIABLE}}`)
- **Replacement Method:** `replaceAllText` works on slides too
- **Image Insertion:** Possible with `createImage` request (if needed)
- **Complexity:** Medium

### Feature 6: Populate Content Based on Airtable Fields
**Feasibility: ✅ HIGH (Data already available)**

- Extension already has access to all Airtable fields via `useRecords`
- Map field names to placeholder tokens
- Build replacement dictionary: `{ '{{PROJECT_NAME}}': record.getCellValue('Project'), ... }`
- **Complexity:** Low

---

## Required Google OAuth Scopes

```javascript
const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/drive',           // Full Drive access
  'https://www.googleapis.com/auth/documents',       // Google Docs read/write
  'https://www.googleapis.com/auth/presentations',   // Google Slides read/write (stretch)
];
```

**Scope Justification:**
- `drive` - Required for file search, copy, create in Shared Drives
- `documents` - Required for modifying Google Docs content
- `presentations` - Only needed for stretch goal (slide decks)

**Minimal Scope Option (Phase 1):**
```javascript
const GOOGLE_SCOPES_PHASE1 = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/documents',
];
```

---

## OAuth Implementation Plan

### Option A: Extend Existing Netlify Service (Recommended)

Add Google OAuth functions alongside existing Asana functions:

```
asana-oauth-relay/              → rename to: oauth-relay/
├── netlify/
│   └── functions/
│       ├── asana-auth.js       # Existing
│       ├── asana-callback.js   # Existing
│       ├── asana-refresh.js    # Existing
│       ├── google-auth.js      # NEW
│       ├── google-callback.js  # NEW
│       └── google-refresh.js   # NEW
├── netlify.toml
└── package.json
```

**Pros:**
- Single deployment/domain
- Shared infrastructure
- Consistent token handling pattern

**Cons:**
- More environment variables to manage
- Larger single-responsibility surface

### Option B: Separate Netlify Service

Create a new `google-oauth-relay/` directory with its own deployment.

**Pros:**
- Separation of concerns
- Independent deployment/scaling

**Cons:**
- Two deployments to manage
- CORS configuration for two domains

---

## Detailed OAuth Setup Instructions

### Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create new project: "Airtable Project Helper" (or similar)
3. Note the Project ID

### Step 2: Enable Required APIs

In Google Cloud Console → APIs & Services → Enable APIs:

```
Google Drive API
Google Docs API
Google Slides API (for stretch goal)
```

### Step 3: Configure OAuth Consent Screen

1. Go to APIs & Services → OAuth consent screen
2. Choose **Internal** (if using Google Workspace) or **External**
3. Fill in required fields:
   - App name: "Project Creation Helper"
   - User support email: your email
   - Developer contact: your email
4. Add scopes:
   - `https://www.googleapis.com/auth/drive`
   - `https://www.googleapis.com/auth/documents`
   - `https://www.googleapis.com/auth/presentations` (optional)
5. For External apps: Submit for verification (required for sensitive scopes)

**Important:** The `drive` scope is classified as "sensitive" by Google. For:
- **Internal apps (Workspace):** No verification needed
- **External apps:** Requires verification process (can take weeks)

### Step 4: Create OAuth Credentials

1. Go to APIs & Services → Credentials
2. Create Credentials → OAuth Client ID
3. Application type: **Web application**
4. Name: "Airtable Extension OAuth"
5. Authorized redirect URIs:
   ```
   https://your-site.netlify.app/.netlify/functions/google-callback
   http://localhost:8888/.netlify/functions/google-callback  (for local dev)
   ```
6. Copy **Client ID** and **Client Secret**

### Step 5: Implement Netlify Functions

#### google-auth.js
```javascript
exports.handler = async (event) => {
  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');

  authUrl.searchParams.set('client_id', process.env.GOOGLE_CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', process.env.GOOGLE_REDIRECT_URI);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', [
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/documents',
  ].join(' '));
  authUrl.searchParams.set('access_type', 'offline');  // Required for refresh token
  authUrl.searchParams.set('prompt', 'consent');       // Force consent to get refresh token
  authUrl.searchParams.set('state', event.queryStringParameters?.state || '');

  return {
    statusCode: 302,
    headers: { Location: authUrl.toString() },
  };
};
```

#### google-callback.js
```javascript
exports.handler = async (event) => {
  const { code, error, state } = event.queryStringParameters || {};

  if (error) {
    return errorResponse(error);
  }

  // Exchange code for tokens
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
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

  const tokens = await tokenResponse.json();

  if (tokens.error) {
    return errorResponse(tokens.error_description);
  }

  // Return HTML that posts tokens back to opener
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'text/html' },
    body: `
      <!DOCTYPE html>
      <html>
      <body>
        <script>
          if (window.opener) {
            window.opener.postMessage({
              type: 'google-oauth-callback',
              access_token: '${tokens.access_token}',
              refresh_token: '${tokens.refresh_token || ''}',
              expires_in: ${tokens.expires_in},
              state: '${state}'
            }, '*');
            window.close();
          }
        </script>
        <p>Authentication successful. You may close this window.</p>
      </body>
      </html>
    `,
  };
};

function errorResponse(error) {
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'text/html' },
    body: `
      <!DOCTYPE html>
      <html>
      <body>
        <script>
          if (window.opener) {
            window.opener.postMessage({ type: 'google-oauth-callback', error: '${error}' }, '*');
            window.close();
          }
        </script>
        <p>Authentication failed: ${error}</p>
      </body>
      </html>
    `,
  };
}
```

#### google-refresh.js
```javascript
exports.handler = async (event) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const { refresh_token } = JSON.parse(event.body || '{}');

  if (!refresh_token) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'refresh_token required' }),
    };
  }

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token,
      grant_type: 'refresh_token',
    }),
  });

  const tokens = await response.json();

  return {
    statusCode: response.ok ? 200 : 400,
    headers,
    body: JSON.stringify(tokens),
  };
};
```

### Step 6: Configure Netlify Environment Variables

```bash
# Navigate to your relay service
cd oauth-relay  # or asana-oauth-relay

# Set Google OAuth credentials
netlify env:set GOOGLE_CLIENT_ID "your-client-id.apps.googleusercontent.com"
netlify env:set GOOGLE_CLIENT_SECRET "your-client-secret"
netlify env:set GOOGLE_REDIRECT_URI "https://your-site.netlify.app/.netlify/functions/google-callback"

# Deploy
netlify deploy --prod
```

### Step 6b: Local Development with .env File

For local development, store secrets in a `.env` file instead of setting them via the Netlify CLI. This file should be gitignored.

**Create `.env` file in the oauth-relay directory:**

```bash
# oauth-relay/.env (DO NOT COMMIT)

# Asana OAuth (existing)
ASANA_CLIENT_ID=your-asana-client-id
ASANA_CLIENT_SECRET=your-asana-client-secret
REDIRECT_URI=http://localhost:8888/.netlify/functions/asana-callback

# Google OAuth (new)
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:8888/.netlify/functions/google-callback
```

**Ensure `.env` is in `.gitignore`:**

```bash
# In oauth-relay/.gitignore
.env
.env.*
!.env.example
```

**Create `.env.example` for documentation:**

```bash
# oauth-relay/.env.example (safe to commit)

# Asana OAuth
ASANA_CLIENT_ID=
ASANA_CLIENT_SECRET=
REDIRECT_URI=http://localhost:8888/.netlify/functions/asana-callback

# Google OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:8888/.netlify/functions/google-callback
```

**How it works:**
- `netlify dev` automatically loads variables from `.env`
- Production uses variables set via `netlify env:set` (stored in Netlify dashboard)
- The `.env` file never leaves your machine

**Running locally:**

```bash
cd oauth-relay
netlify dev  # Starts local server at http://localhost:8888
             # Automatically loads .env variables
```

**Important:** When testing locally, ensure your Google OAuth credentials include `http://localhost:8888/.netlify/functions/google-callback` as an authorized redirect URI (Step 4).

### Step 7: Configure Shared Drive Location

The extension will need to know which Shared Drive (and optionally subfolder) to search/create folders in:

```javascript
// Store in globalConfig
const GOOGLE_SHARED_DRIVE_ID_KEY = 'googleSharedDriveId';
const GOOGLE_PARENT_FOLDER_ID_KEY = 'googleParentFolderId';  // Optional subfolder
```

Users will configure this in settings by either:
1. Pasting a Shared Drive ID directly
2. Using a folder picker (more complex, requires additional API calls)

---

## Extension Integration Architecture

### New globalConfig Keys

```javascript
// OAuth tokens
const GOOGLE_ACCESS_TOKEN_KEY = 'googleAccessToken';
const GOOGLE_REFRESH_TOKEN_KEY = 'googleRefreshToken';
const GOOGLE_TOKEN_EXPIRY_KEY = 'googleTokenExpiry';

// Configuration
const GOOGLE_SHARED_DRIVE_ID_KEY = 'googleSharedDriveId';
const GOOGLE_PARENT_FOLDER_ID_KEY = 'googleParentFolderId';
const GOOGLE_SCOPING_TEMPLATE_ID_KEY = 'googleScopingTemplateId';
```

### New Functions Required

```javascript
// OAuth management (mirrors Asana pattern)
async function getValidGoogleAccessToken(globalConfig) { ... }
async function handleGoogleOAuthLogin() { ... }
function handleGoogleLogout() { ... }

// Drive operations
async function searchForProjectFolder(accessToken, projectName, sharedDriveId) { ... }
async function createProjectFolder(accessToken, projectName, parentId, sharedDriveId) { ... }

// Document operations
async function copyTemplate(accessToken, templateId, destinationFolderId, newName) { ... }
async function populateDocument(accessToken, documentId, replacements) { ... }

// Orchestration
async function generateDriveDocuments(record, accessToken) { ... }
```

### UI Additions

1. **Settings Section:**
   - Google OAuth connect/disconnect button
   - Shared Drive ID input
   - Template Document ID input

2. **Generation Section:**
   - "Generate to Google Drive" button
   - Folder search status indicator
   - "Create folder?" confirmation dialog
   - Document generation progress

---

## Template Document Strategy

### Option A: Placeholder-Based Template (Recommended)

Create a Google Doc template with placeholders:

```
{{PROJECT_NAME}} - Scoping Document
=======================================

Project: {{PROJECT_NAME}}
Acronym: {{PROJECT_ACRONYM}}
Status: {{STATUS}}
Start Date: {{START_DATE}}
End Date: {{END_DATE}}

PROJECT DESCRIPTION
-------------------
{{PROJECT_DESCRIPTION}}

TEAM ASSIGNMENTS
----------------
{{ROLES_SUMMARY}}

MILESTONES & DELIVERABLES
-------------------------
{{MILESTONE_ROLLUP}}
```

**Replacement Code:**
```javascript
async function populateDocument(accessToken, documentId, record) {
  const replacements = {
    '{{PROJECT_NAME}}': record.getCellValueAsString('Project'),
    '{{PROJECT_ACRONYM}}': record.getCellValueAsString('Project Acronym'),
    '{{STATUS}}': record.getCellValueAsString('Status'),
    '{{START_DATE}}': formatDate(record.getCellValue('Start Date')),
    '{{END_DATE}}': formatDate(record.getCellValue('End Date')),
    '{{PROJECT_DESCRIPTION}}': record.getCellValueAsString('Project Description'),
    '{{ROLES_SUMMARY}}': record.getCellValueAsString('Roles Summary'),
    '{{MILESTONE_ROLLUP}}': record.getCellValueAsString('Milestone Rollup'),
  };

  const requests = Object.entries(replacements).map(([placeholder, value]) => ({
    replaceAllText: {
      containsText: { text: placeholder, matchCase: true },
      replaceText: value || '',
    },
  }));

  await fetch(`https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ requests }),
  });
}
```

### Option B: Append Markdown Content

If you want to preserve existing markdown generation and append to a simpler template:

```javascript
async function appendMarkdownToDocument(accessToken, documentId, markdownContent) {
  // Get document to find end index
  const docResponse = await fetch(
    `https://docs.googleapis.com/v1/documents/${documentId}`,
    { headers: { 'Authorization': `Bearer ${accessToken}` } }
  );
  const doc = await docResponse.json();
  const endIndex = doc.body.content[doc.body.content.length - 1].endIndex - 1;

  // Insert markdown as plain text
  await fetch(`https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      requests: [{
        insertText: {
          location: { index: endIndex },
          text: markdownContent,
        },
      }],
    }),
  });
}
```

**Limitation:** Markdown will appear as plain text, not formatted.

---

## Implementation Phases

### Phase 1: Core Integration (MVP)
- [ ] Implement Google OAuth flow (parallel to Asana)
- [ ] Add settings UI for Google connection
- [ ] Implement folder search in Shared Drive
- [ ] Implement folder creation with user confirmation
- [ ] Copy template document to project folder
- [ ] Populate document with placeholder replacements

**Estimated Complexity:** Medium
**Risk:** Low (well-documented APIs, proven OAuth pattern)

### Phase 2: Enhanced Document Population
- [ ] Handle rich text formatting from Airtable
- [ ] Add support for multiple template documents
- [ ] Implement document naming convention
- [ ] Add progress indicators for multi-document creation

**Estimated Complexity:** Medium
**Risk:** Low

### Phase 3: Stretch Goals
- [ ] Add Google Slides template support
- [ ] Implement slide content population
- [ ] Add image insertion from Airtable attachments
- [ ] Create document index/manifest

**Estimated Complexity:** High
**Risk:** Medium (Slides API more complex, image handling)

---

## Security Considerations

1. **Client Secret Protection:** Same as Asana - stored only in Netlify env vars
2. **Token Storage:** Use Airtable globalConfig (base-level access)
3. **Shared Drive Access:** User's OAuth scope limited to drives they can access
4. **Refresh Token Handling:** Store securely, never expose to client
5. **Template Protection:** Templates should be read-only except for admin

---

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Google OAuth verification delays | Medium | High | Use Internal app type if Workspace available |
| Markdown formatting loss | High | Medium | Use placeholder templates instead |
| Shared Drive permission issues | Medium | Medium | Clear error messages, setup documentation |
| API rate limits | Low | Low | Batch requests where possible |
| Template document changes break integration | Medium | Medium | Version templates, validate placeholders |

---

## Alternatives Considered

### Alternative 1: Google Apps Script Add-on
**Rejected** because:
- Separate codebase and deployment
- Different authentication model
- Can't share state with Airtable extension

### Alternative 2: Direct Google Service Account
**Rejected** because:
- Requires domain-wide delegation (complex setup)
- Less transparent to users
- Service accounts can't access user's Shared Drives easily

### Alternative 3: Zapier/Make Integration
**Rejected** because:
- Additional cost
- Less control over workflow
- Can't integrate into existing extension UI

---

## Decision

**Proceed with implementation** following the phased approach:

1. **Phase 1 is fully feasible** with proven patterns from Asana integration
2. **Phase 2 is feasible** with careful template design
3. **Phase 3 (stretch goals) are feasible** but add complexity

**Recommendation:** Start with Phase 1, evaluate before proceeding to stretch goals.

---

## References

- [Google Drive API Documentation](https://developers.google.com/drive/api/v3/reference)
- [Google Docs API Documentation](https://developers.google.com/docs/api/reference/rest)
- [Google Slides API Documentation](https://developers.google.com/slides/api/reference/rest)
- [Google OAuth 2.0 for Web Server Applications](https://developers.google.com/identity/protocols/oauth2/web-server)
- [Shared Drives (Team Drives) Guide](https://developers.google.com/drive/api/v3/about-shareddrives)
- [ADR-001: OAuth Migration](./ADR-001-oauth-migration.md)
