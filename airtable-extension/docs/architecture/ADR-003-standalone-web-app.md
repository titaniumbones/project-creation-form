# ADR-003: Standalone Web Application for Project Creation

**Status:** Proposed
**Date:** 2025-12-19
**Deciders:** Matt Price
**Technical Story:** Replace Airtable extension UI with a standalone web application that provides a better user experience for project scoping and integrates with Airtable, Asana, and Google Workspace.

---

## Context and Problem Statement

The current Airtable extension has limitations:
1. Constrained UI space within the Airtable panel
2. Dependent on Airtable's block runtime environment
3. Limited ability to create sophisticated text editing experiences
4. Form fields are hardcoded in React components

We want a standalone web application that:
1. Provides a focused, distraction-free form experience
2. Makes it easy for users to compose detailed project descriptions
3. Centralizes project creation across Airtable, Asana, and Google Drive
4. Uses configuration files for field mappings (easy to modify without code changes)
5. Includes helpful, editable instructions for each field

---

## Proposed Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Project Creation Web App                          │
│                         (React + Vite SPA)                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐              │
│  │  Form State  │    │   Config     │    │  Help Text   │              │
│  │  (React)     │    │  (TOML)      │    │  (Markdown)  │              │
│  └──────────────┘    └──────────────┘    └──────────────┘              │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │                    Integration Services                         │    │
│  │  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐     │    │
│  │  │Airtable │    │  Asana  │    │ Google  │    │ Google  │     │    │
│  │  │  API    │    │   API   │    │  Drive  │    │  Docs   │     │    │
│  │  └─────────┘    └─────────┘    └─────────┘    └─────────┘     │    │
│  └────────────────────────────────────────────────────────────────┘    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      OAuth Relay (Netlify Functions)                     │
│           (Existing - extended for Airtable OAuth if needed)            │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Technology Stack

### Frontend
| Technology | Purpose | Rationale |
|------------|---------|-----------|
| **Vite** | Build tool | Fast, simple, excellent React support |
| **React 18** | UI framework | Requested, team familiarity |
| **React Router** | Routing | Simple SPA navigation |
| **Tailwind CSS** | Styling | Rapid UI development, good defaults |
| **react-markdown** | Help text rendering | Render markdown instructions inline |
| **@uiw/react-md-editor** | Rich text fields | Markdown editing for descriptions |
| **react-hook-form** | Form management | Performant, flexible form handling |
| **@tanstack/react-query** | Data fetching | Caching team members, API state |
| **toml** | Config parsing | Parse TOML configuration files |

### Why Vite over Astro?
- **Simpler for SPA**: Astro is optimized for content sites with islands; this is a pure SPA
- **Better React DX**: Vite's React plugin has excellent HMR and dev experience
- **Less abstraction**: Fewer concepts to learn, easier to debug
- **Can migrate to Astro later** if we want SSR/static generation

---

## Project Structure

```
project-creation-app/
├── public/
│   └── favicon.svg
├── src/
│   ├── main.jsx                    # App entry point
│   ├── App.jsx                     # Root component with routing
│   ├── index.css                   # Tailwind imports
│   │
│   ├── config/
│   │   ├── fields.toml             # Field definitions and mappings
│   │   └── integrations.toml       # API endpoints and settings
│   │
│   ├── content/
│   │   └── help/                   # Markdown help files
│   │       ├── project-name.md
│   │       ├── project-description.md
│   │       ├── objectives.md
│   │       ├── roles.md
│   │       └── outcomes.md
│   │
│   ├── components/
│   │   ├── ui/                     # Reusable UI components
│   │   │   ├── Button.jsx
│   │   │   ├── Input.jsx
│   │   │   ├── TextArea.jsx
│   │   │   ├── DatePicker.jsx
│   │   │   ├── Select.jsx
│   │   │   ├── MultiSelect.jsx
│   │   │   └── HelpTooltip.jsx
│   │   │
│   │   ├── form/                   # Form section components
│   │   │   ├── ProjectBasics.jsx   # Name, dates
│   │   │   ├── ProjectDescription.jsx  # Rich text description
│   │   │   ├── Objectives.jsx      # Objectives field
│   │   │   ├── RolesSection.jsx    # Role assignments
│   │   │   ├── OutcomesSection.jsx # Dynamic outcomes list
│   │   │   └── FormProgress.jsx    # Progress indicator
│   │   │
│   │   └── layout/
│   │       ├── Header.jsx
│   │       ├── Sidebar.jsx         # Navigation/progress
│   │       └── MainContent.jsx
│   │
│   ├── services/
│   │   ├── airtable.js             # Airtable API client
│   │   ├── asana.js                # Asana API client (from extension)
│   │   ├── googleDrive.js          # Google Drive API (from extension)
│   │   ├── googleDocs.js           # Google Docs API (from extension)
│   │   ├── googleSlides.js         # Google Slides API (from extension)
│   │   └── oauth.js                # OAuth token management
│   │
│   ├── hooks/
│   │   ├── useConfig.js            # Load and parse TOML config
│   │   ├── useHelpText.js          # Load markdown help files
│   │   ├── useTeamMembers.js       # Fetch team members from Airtable
│   │   ├── useOAuth.js             # OAuth state management
│   │   └── useProjectSubmit.js     # Submit to all integrations
│   │
│   ├── pages/
│   │   ├── ProjectForm.jsx         # Main form page
│   │   ├── Settings.jsx            # OAuth connections, config
│   │   └── Success.jsx             # Post-submission success page
│   │
│   └── utils/
│       ├── fieldMappings.js        # Map form data to API formats
│       └── validation.js           # Form validation rules
│
├── index.html
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── package.json
└── README.md
```

---

## Configuration System

### fields.toml - Field Definitions

```toml
# Field configuration for the project creation form
# Edit this file to add/remove/modify form fields

[metadata]
version = "1.0"
last_updated = "2025-12-19"

# =============================================================================
# TEXT FIELDS
# =============================================================================

[fields.project_name]
type = "text"
label = "Project Name"
required = true
placeholder = "Enter a descriptive project name"
help_file = "project-name.md"
# Integration mappings
airtable_field = "Project"
asana_field = "name"
google_placeholder = "{{PROJECT_NAME}}"

[fields.project_acronym]
type = "text"
label = "Project Acronym"
required = false
placeholder = "e.g., PROJ-2025"
max_length = 20
airtable_field = "Project Acronym"
google_placeholder = "{{PROJECT_ACRONYM}}"

[fields.start_date]
type = "date"
label = "Start Date"
required = true
help_file = "dates.md"
airtable_field = "Start Date"
asana_field = "start_on"
google_placeholder = "{{START_DATE}}"

[fields.end_date]
type = "date"
label = "End Date"
required = true
airtable_field = "End Date"
asana_field = "due_on"
google_placeholder = "{{END_DATE}}"

[fields.project_description]
type = "richtext"
label = "Project Description"
required = true
placeholder = "Describe the project scope, context, and approach..."
help_file = "project-description.md"
min_length = 100
airtable_field = "Project Description"
google_placeholder = "{{PROJECT_DESCRIPTION}}"

[fields.objectives]
type = "richtext"
label = "Objectives"
required = true
placeholder = "List the key objectives this project aims to achieve..."
help_file = "objectives.md"
airtable_field = "Objectives"
google_placeholder = "{{OBJECTIVES}}"

# =============================================================================
# STRUCTURED DATA: ROLES
# =============================================================================

[fields.roles]
type = "role_assignment"
label = "Project Team"
required = true
help_file = "roles.md"
# Team members populated from Airtable "Data Team Members" table
team_members_table = "Data Team Members"
team_members_field = "Full Name"

[fields.roles.role_types]
# Define available roles - each maps to Airtable Assignments table
project_owner = { label = "Project Owner", required = true, max = 1 }
project_coordinator = { label = "Project Coordinator", required = true, max = 1 }
technical_support = { label = "Technical Support", required = false, max = 3 }
comms_support = { label = "Communications Support", required = false, max = 2 }
oversight = { label = "Oversight", required = false, max = 2 }
other = { label = "Other", required = false, max = 5 }

# =============================================================================
# STRUCTURED DATA: OUTCOMES/MILESTONES
# =============================================================================

[fields.outcomes]
type = "repeatable"
label = "Outcomes & Milestones"
required = true
min_items = 1
max_items = 20
help_file = "outcomes.md"
# Maps to Airtable Milestones table
airtable_table = "Milestones"

[fields.outcomes.subfields]
name = { type = "text", label = "Outcome Name", required = true, airtable_field = "Milestone" }
description = { type = "textarea", label = "Description", required = false, airtable_field = "Description" }
due_date = { type = "date", label = "Due Date", required = false, airtable_field = "Due Date" }
```

### integrations.toml - Integration Settings

```toml
# Integration configuration
# API keys and secrets should be in environment variables, not here

[airtable]
base_id_env = "AIRTABLE_BASE_ID"
# OAuth or Personal Access Token
auth_type = "pat"  # or "oauth"
pat_env = "AIRTABLE_PAT"
# Tables
projects_table = "Projects"
milestones_table = "Milestones"
assignments_table = "Assignments"
team_members_table = "Data Team Members"

[asana]
oauth_relay_url_env = "OAUTH_RELAY_URL"
team_gid_env = "ASANA_TEAM_GID"
template_project_gid = "1209652649504377"  # Your Asana template

[google]
oauth_relay_url_env = "OAUTH_RELAY_URL"
# Template document/presentation IDs - can also be set via UI
scoping_template_id_env = "GOOGLE_SCOPING_TEMPLATE_ID"
kickoff_deck_template_id_env = "GOOGLE_KICKOFF_DECK_TEMPLATE_ID"
# Shared Drive location
shared_drive_id_env = "GOOGLE_SHARED_DRIVE_ID"
parent_folder_id_env = "GOOGLE_PARENT_FOLDER_ID"
```

---

## Markdown Help System

Help text is stored as markdown files that can be edited without touching code.

### Example: content/help/project-description.md

```markdown
## Project Description

The project description should provide a comprehensive overview that helps
stakeholders understand:

### What to Include

- **Context**: Why is this project needed? What problem does it solve?
- **Scope**: What is included and excluded from this project?
- **Approach**: How will the work be conducted?
- **Dependencies**: What does this project depend on? What depends on it?

### Tips for Writing

- Write for someone unfamiliar with the project
- Be specific about deliverables
- Avoid jargon or define terms when necessary
- Consider both technical and non-technical readers

### Example

> This project will develop a data pipeline to automate the monthly
> reporting process for the Finance team. Currently, reports are
> generated manually from three separate systems, taking approximately
> 20 hours per month. The new pipeline will reduce this to under 2 hours
> and eliminate common data entry errors.
```

### Rendering Help Text

```jsx
// components/ui/HelpTooltip.jsx
import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { useHelpText } from '../../hooks/useHelpText';

export function HelpTooltip({ helpFile }) {
  const [isOpen, setIsOpen] = useState(false);
  const { content, isLoading } = useHelpText(helpFile);

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="text-blue-500 hover:text-blue-700 ml-2"
        aria-label="Help"
      >
        <QuestionMarkIcon className="w-4 h-4" />
      </button>

      {isOpen && (
        <div className="absolute z-50 w-96 p-4 bg-white rounded-lg shadow-xl border">
          <button
            onClick={() => setIsOpen(false)}
            className="absolute top-2 right-2"
          >
            ✕
          </button>
          {isLoading ? (
            <p>Loading...</p>
          ) : (
            <ReactMarkdown className="prose prose-sm">
              {content}
            </ReactMarkdown>
          )}
        </div>
      )}
    </div>
  );
}
```

---

## UI Design Principles

### 1. Focused Writing Experience
- Large, comfortable text areas for descriptions
- Minimal visual clutter
- Optional markdown formatting toolbar
- Auto-save drafts to localStorage

### 2. Progressive Disclosure
- Show one section at a time, or allow scrolling through all
- Collapsible sections with completion indicators
- Clear progress indicator

### 3. Helpful Guidance
- Help icons next to each field
- Example text where appropriate
- Validation feedback in real-time

### 4. Dynamic Sections
- Add/remove outcomes with smooth animations
- Role selection with team member search/filter
- Date pickers with sensible defaults

### Wireframe Concept

```
┌─────────────────────────────────────────────────────────────────────────┐
│  [Logo] Project Creation                           [Settings] [Help]    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────┐  ┌────────────────────────────────────────────────┐  │
│  │ Progress     │  │                                                 │  │
│  │              │  │  Project Name *                            [?]  │  │
│  │ ○ Basics     │  │  ┌─────────────────────────────────────────┐   │  │
│  │ ○ Description│  │  │ Climate Data Analysis Initiative        │   │  │
│  │ ○ Objectives │  │  └─────────────────────────────────────────┘   │  │
│  │ ○ Team       │  │                                                 │  │
│  │ ○ Outcomes   │  │  Start Date *              End Date *           │  │
│  │ ○ Review     │  │  ┌──────────────┐         ┌──────────────┐     │  │
│  │              │  │  │ 2025-01-15   │         │ 2025-06-30   │     │  │
│  │ ───────────  │  │  └──────────────┘         └──────────────┘     │  │
│  │              │  │                                                 │  │
│  │ Integrations │  │  Project Description *                     [?]  │  │
│  │ ✓ Airtable   │  │  ┌─────────────────────────────────────────┐   │  │
│  │ ✓ Asana      │  │  │                                         │   │  │
│  │ ✓ Google     │  │  │ This project will analyze climate data  │   │  │
│  │              │  │  │ from multiple sources to identify...    │   │  │
│  │              │  │  │                                         │   │  │
│  │              │  │  │                                         │   │  │
│  │              │  │  └─────────────────────────────────────────┘   │  │
│  │              │  │                                                 │  │
│  └──────────────┘  │  ┌─────────────────────────────────────────┐   │  │
│                    │  │           [ Next: Objectives → ]         │   │  │
│                    │  └─────────────────────────────────────────┘   │  │
│                    └────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow

### 1. Form Submission Flow

```
User completes form
        │
        ▼
┌─────────────────┐
│ Validate form   │
│ data            │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│ Create Airtable │────▶│ Get Project     │
│ Project record  │     │ record ID       │
└────────┬────────┘     └────────┬────────┘
         │                       │
         ▼                       │
┌─────────────────┐              │
│ Create Airtable │◀─────────────┘
│ Milestones      │ (link to project)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Create Airtable │
│ Assignments     │ (link to project + team members)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Create Asana    │
│ Project         │ (from template)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Create Asana    │
│ Milestone tasks │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Create Google   │
│ Drive folder    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Generate Docs & │
│ Slides          │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Show success    │
│ with links      │
└─────────────────┘
```

### 2. Loading Team Members

```jsx
// hooks/useTeamMembers.js
import { useQuery } from '@tanstack/react-query';
import { airtableClient } from '../services/airtable';

export function useTeamMembers() {
  return useQuery({
    queryKey: ['teamMembers'],
    queryFn: async () => {
      const records = await airtableClient.getRecords('Data Team Members', {
        fields: ['Full Name'],
        sort: [{ field: 'Full Name', direction: 'asc' }],
      });
      return records.map(r => ({
        id: r.id,
        name: r.fields['Full Name'],
      }));
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
}
```

---

## OAuth Strategy

### Current State (Extension)
- Asana: OAuth via Netlify relay ✓
- Google: OAuth via Netlify relay ✓
- Airtable: Uses extension's built-in auth (globalConfig)

### New App Strategy: Full OAuth for All Services

All three services will use OAuth via the Netlify relay:

```
┌─────────────────────────────────────────────────────────────┐
│                    Netlify Functions                         │
├─────────────────────────────────────────────────────────────┤
│  asana-auth.js      asana-callback.js      asana-refresh.js │
│  google-auth.js     google-callback.js     google-refresh.js│
│  airtable-auth.js   airtable-callback.js   airtable-refresh.js │ ← NEW
└─────────────────────────────────────────────────────────────┘
```

### Airtable OAuth Setup Requirements

1. **Register OAuth App**: https://airtable.com/create/oauth
2. **Scopes needed**:
   - `data.records:read` - Read team members
   - `data.records:write` - Create projects, milestones, assignments
   - `schema.bases:read` - Read table/field structure
3. **Redirect URI**: `https://airtable-asana-integration-oauth.netlify.app/.netlify/functions/airtable-callback`
4. **Environment variables**:
   - `AIRTABLE_CLIENT_ID`
   - `AIRTABLE_CLIENT_SECRET`
   - `AIRTABLE_REDIRECT_URI`

### Token Storage in Web App

```javascript
// services/oauth.js
const TOKEN_STORAGE_KEY = 'project_creator_tokens';

export const tokenManager = {
  getTokens() {
    const stored = localStorage.getItem(TOKEN_STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  },

  setToken(service, tokenData) {
    const tokens = this.getTokens();
    tokens[service] = {
      ...tokenData,
      savedAt: Date.now(),
    };
    localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(tokens));
  },

  clearToken(service) {
    const tokens = this.getTokens();
    delete tokens[service];
    localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(tokens));
  },

  isTokenValid(service) {
    const tokens = this.getTokens();
    const token = tokens[service];
    if (!token) return false;
    if (token.expiresAt && Date.now() > token.expiresAt - 60000) return false;
    return true;
  },
};
```

---

## Implementation Phases

### Phase 1: Project Setup & Basic Form
- [ ] Initialize Vite + React project
- [ ] Set up Tailwind CSS
- [ ] Create project structure
- [ ] Implement TOML config loading
- [ ] Build basic form components (Input, TextArea, DatePicker)
- [ ] Create ProjectBasics section
- [ ] Add localStorage draft saving

### Phase 2: Rich Text & Help System
- [ ] Integrate markdown editor for description fields
- [ ] Implement help text loading from markdown files
- [ ] Create HelpTooltip component
- [ ] Style help popups

### Phase 3: Dynamic Form Sections
- [ ] Build RolesSection with team member selection
- [ ] Build OutcomesSection with add/remove functionality
- [ ] Add form validation
- [ ] Create progress indicator

### Phase 4: Airtable Integration
- [ ] Port Airtable API client
- [ ] Implement team members fetching
- [ ] Implement project record creation
- [ ] Implement milestones creation
- [ ] Implement assignments creation

### Phase 5: Asana Integration
- [ ] Port Asana API functions from extension
- [ ] Implement OAuth flow (reuse Netlify functions)
- [ ] Project creation from template
- [ ] Task creation for milestones

### Phase 6: Google Integration
- [ ] Port Google Drive/Docs/Slides functions
- [ ] Implement OAuth flow (reuse Netlify functions)
- [ ] Folder creation
- [ ] Document generation
- [ ] Slides generation

### Phase 7: Polish & Testing
- [ ] Error handling and user feedback
- [ ] Loading states
- [ ] Success page with links
- [ ] Cross-browser testing
- [ ] Accessibility review

---

## Local Development Setup

### Prerequisites
- Node.js 18+
- npm or pnpm
- Airtable account with base access
- (Optional) Asana account with OAuth app
- (Optional) Google Cloud project with OAuth credentials

### Installation

```bash
# Clone and navigate to new app directory
cd /path/to/project-creation-form
mkdir project-creation-app
cd project-creation-app

# Initialize project
npm create vite@latest . -- --template react
npm install

# Install dependencies
npm install \
  react-router-dom \
  react-hook-form \
  @tanstack/react-query \
  react-markdown \
  @uiw/react-md-editor \
  toml \
  tailwindcss postcss autoprefixer \
  @headlessui/react \
  @heroicons/react \
  date-fns

# Initialize Tailwind
npx tailwindcss init -p
```

### Environment Variables

Create `.env.local`:

```bash
# Airtable
VITE_AIRTABLE_PAT=pat_xxxxxxxxxxxxx
VITE_AIRTABLE_BASE_ID=appXXXXXXXXXXXXXX

# OAuth Relay (existing Netlify deployment)
VITE_OAUTH_RELAY_URL=https://airtable-asana-integration-oauth.netlify.app

# Asana (optional - can configure in UI)
VITE_ASANA_TEAM_GID=1234567890

# Google (optional - can configure in UI)
VITE_GOOGLE_SHARED_DRIVE_ID=xxxxx
VITE_GOOGLE_PARENT_FOLDER_ID=xxxxx
VITE_GOOGLE_SCOPING_TEMPLATE_ID=xxxxx
VITE_GOOGLE_KICKOFF_DECK_TEMPLATE_ID=xxxxx
```

### Running Locally

```bash
# Start development server
npm run dev

# App available at http://localhost:5173
```

### Project Scripts

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "lint": "eslint src --ext js,jsx"
  }
}
```

---

## Migration Strategy

### What to Keep from Extension
- Google Drive API functions (search, create folder)
- Google Docs API functions (copy, populate)
- Google Slides API functions (copy, populate)
- Asana API functions (create project, add members, create tasks)
- OAuth token refresh logic
- User matching algorithm

### What to Rewrite
- All UI components (new React components with Tailwind)
- State management (react-hook-form instead of useState)
- Configuration (TOML files instead of hardcoded values)
- Help text (markdown files instead of inline strings)

### Extension Disposition
- Keep extension functional for now
- Eventually deprecate once web app is stable
- Extension code serves as reference implementation

---

## Security Considerations

1. **Token Storage**: localStorage is not ideal for tokens
   - Consider: HttpOnly cookies via backend, or session-only storage
   - For MVP: localStorage with clear warnings about shared computers

2. **API Keys**: Never commit to git
   - Use `.env.local` (gitignored)
   - Document required variables in README

3. **CORS**: Airtable API requires server-side proxy or their official client
   - May need simple backend proxy for Airtable calls
   - Or use Airtable's official browser SDK

4. **OAuth Relay**: Continue using Netlify functions
   - Client secrets stay server-side
   - Existing infrastructure works

---

## Decisions Made

1. **Airtable Auth**: OAuth (add to existing Netlify relay alongside Asana/Google)

2. **Form UX**: Single scrollable page with section anchors and progress indicator

3. **Backend Proxy**: Test direct API calls first; add Netlify function proxies if CORS issues arise

4. **Offline Support**: localStorage drafts (already planned)

---

## Decision

**Proceed with implementation** following the phased approach outlined above.

**Key decisions:**
- Use Vite + React (simpler than Astro for this use case)
- Use TOML for configuration (human-readable, easy to edit)
- Use Markdown files for help text (non-developers can edit)
- Start with Airtable PAT auth, add OAuth later if needed
- Reuse existing Netlify OAuth relay for Asana/Google

---

## References

- [Vite Documentation](https://vitejs.dev/)
- [React Hook Form](https://react-hook-form.com/)
- [TanStack Query](https://tanstack.com/query)
- [Tailwind CSS](https://tailwindcss.com/)
- [Airtable API](https://airtable.com/developers/web/api/introduction)
- [TOML Specification](https://toml.io/)
- [ADR-002: Google Drive Integration](./ADR-002-google-drive-integration.md)
