# Project Creation Helper - Web Application

The main web interface for the Project Creation Helper. A React application that provides a form-based workflow for creating projects across Airtable, Asana, and Google Workspace.

## Quick Start

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env
# Edit .env with your values

# Start development server
npm run dev
```

Visit `http://localhost:5173`

For complete setup instructions including OAuth configuration, see [../SETUP.md](../SETUP.md).

## Project Structure

```
src/
├── main.jsx                    # Application entry point
├── App.jsx                     # Root component with routing
├── config/
│   ├── fields.toml             # Form field definitions & mappings
│   ├── integrations.toml       # Service configuration
│   └── index.js                # Config loader
├── pages/
│   ├── ProjectForm.jsx         # Main project creation form
│   ├── ReviewDraft.jsx         # Draft review/approval page
│   ├── MyDrafts.jsx            # List of user's drafts
│   ├── Settings.jsx            # OAuth connection settings
│   └── Success.jsx             # Post-creation confirmation
├── components/
│   ├── form/
│   │   └── FormComponents.jsx  # Reusable form elements
│   ├── ui/
│   │   ├── HelpTooltip.jsx     # Help icon with markdown content
│   │   └── ShareDraftModal.jsx # Approver selection modal
│   └── layout/
│       └── Header.jsx          # Page header
├── services/
│   ├── airtable.js             # Airtable API client
│   ├── asana.js                # Asana API client
│   ├── google.js               # Google Drive/Docs client
│   ├── drafts.js               # Draft management
│   ├── oauth.js                # OAuth token management
│   └── debugLogger.js          # Debug logging utility
├── hooks/
│   ├── useTeamMembers.js       # Fetch team members from Airtable
│   └── ...
└── content/help/               # Markdown help files
    ├── project-name.md
    ├── project-description.md
    └── ...
```

## Configuration

The application uses TOML files for configuration:

### `src/config/fields.toml`

Defines form fields, Airtable schema mappings, and Google Doc placeholders.

```toml
[fields.project_name]
type = "text"
label = "Project Name"
required = true
airtable_field = "Project"
google_placeholder = "{{PROJECT_NAME}}"
```

### `src/config/integrations.toml`

Service-specific settings (if needed beyond environment variables).

For detailed configuration documentation, see [docs/CONFIGURATION.md](docs/CONFIGURATION.md).

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_OAUTH_RELAY_URL` | Yes | OAuth relay service URL |
| `VITE_AIRTABLE_BASE_ID` | Yes | Airtable base ID |
| `VITE_ASANA_TEMPLATE_GID` | No | Asana project template GID |
| `VITE_ASANA_TEAM_GID` | No | Asana team GID |
| `VITE_GOOGLE_SHARED_DRIVE_ID` | No | Google Shared Drive ID |
| `VITE_GOOGLE_PROJECTS_FOLDER_ID` | No | Folder for project documents |
| `VITE_GOOGLE_SCOPING_DOC_TEMPLATE_ID` | No | Google Doc template ID |
| `VITE_GOOGLE_KICKOFF_DECK_TEMPLATE_ID` | No | Google Slides template ID |

## Scripts

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run preview  # Preview production build
npm run lint     # Run ESLint
```

## Technology Stack

- **React 19** - UI framework
- **Vite** - Build tool
- **Tailwind CSS 4** - Styling
- **React Hook Form** - Form state management
- **TanStack Query** - Server state management
- **React Router** - Client-side routing
- **Headless UI** - Accessible UI components
- **Heroicons** - Icons

## Pages

| Route | Page | Description |
|-------|------|-------------|
| `/` | ProjectForm | Main project creation form |
| `/settings` | Settings | OAuth service connections |
| `/drafts` | MyDrafts | List of saved drafts |
| `/review/:token` | ReviewDraft | Review and approve shared drafts |
| `/success` | Success | Post-creation confirmation |

## Features

- **Config-driven form** - Fields defined in TOML, not hardcoded
- **OAuth integration** - Secure token-based auth for all services
- **Draft workflow** - Save, share, and approve before creating
- **Debug mode** - Log and download API activity
- **Help tooltips** - Markdown-powered contextual help
