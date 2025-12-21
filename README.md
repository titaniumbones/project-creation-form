# Project Creation Helper

A tool for streamlining GivingTuesday project creation across Airtable, Asana, and Google Workspace. Fill out one form to create project records, task boards, and scoping documents automatically.

## Overview

The Project Creation Helper allows project coordinators to:
- Create project records in Airtable with milestones and team assignments
- Generate Asana boards from templates with milestone tasks
- Create Google Drive folders with scoping documents and kickoff decks
- Save drafts and share them for approval before creating resources

## Repository Structure

```
project-creation-form/
├── project-creation-app/      # React web application (ACTIVE)
├── asana-oauth-relay/         # OAuth token relay service (Netlify Functions)
├── airtable-extension/        # Airtable custom extension (LEGACY)
├── airtable/                   # Automation scripts (LEGACY)
├── docs/                       # Architecture decision records
│   └── architecture/
│       ├── ADR-001-oauth-migration.md
│       ├── ADR-003-standalone-web-app.md
│       └── ADR-004-draft-approval-workflow.md
├── templates/                  # Document templates
├── SETUP.md                    # Local development guide
└── README.md                   # This file
```

## Components

| Component | Status | Description |
|-----------|--------|-------------|
| **project-creation-app** | Active | Modern React + Vite web application with OAuth integration |
| **asana-oauth-relay** | Active | Netlify Functions handling OAuth flows for all services |
| **airtable-extension** | Legacy | Original Airtable Block UI (still functional) |
| **airtable/** | Legacy | Automation scripts for Airtable-only workflow |

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Web Application                           │
│           (React + Vite, Tailwind CSS)                       │
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ Project  │  │  Drafts  │  │ Settings │  │  Review  │   │
│  │   Form   │  │   List   │  │   Page   │  │   Page   │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              OAuth Relay (Netlify Functions)                 │
│                                                              │
│   Handles OAuth 2.0 flows for Airtable, Asana, and Google   │
│   Keeps client secrets server-side for security             │
└─────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
   │  Airtable   │    │    Asana    │    │   Google    │
   │             │    │             │    │  Workspace  │
   │ - Projects  │    │ - Boards    │    │ - Drive     │
   │ - Milestones│    │ - Tasks     │    │ - Docs      │
   │ - Team      │    │             │    │ - Slides    │
   │ - Drafts    │    │             │    │             │
   └─────────────┘    └─────────────┘    └─────────────┘
```

## Getting Started

**For local development setup**, see [SETUP.md](SETUP.md).

### Quick Start

```bash
# Clone and enter project
git clone https://github.com/YOUR_ORG/project-creation-form.git
cd project-creation-form/project-creation-app

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your values

# Start development server
npm run dev
```

Visit `http://localhost:5173` and connect your services in Settings.

## Features

### Form-Based Project Creation
- Config-driven form fields (defined in TOML)
- Role assignment with team member lookup
- Repeatable milestones/outcomes section
- Rich text editing for descriptions

### Draft & Approval Workflow
- Save work-in-progress as drafts
- Share drafts via unique links
- Approvers can review, edit, and approve
- Create resources after approval

### Integration with External Services
- **Airtable**: Store project data, milestones, assignments, and drafts
- **Asana**: Create boards from templates, add milestone tasks
- **Google**: Create folders, documents, and presentations from templates

### Debug Mode
- Enable in the Create Resources section
- Logs all API requests and responses
- Download debug logs for troubleshooting

## Configuration

The web app uses TOML configuration files:

- `src/config/fields.toml` - Form fields, Airtable mappings, Google placeholders
- `src/config/integrations.toml` - Service endpoints and settings

See [project-creation-app/docs/CONFIGURATION.md](project-creation-app/docs/CONFIGURATION.md) for details.

## Documentation

| Document | Description |
|----------|-------------|
| [SETUP.md](SETUP.md) | Local development setup guide |
| [ADR-001](docs/architecture/ADR-001-oauth-migration.md) | OAuth implementation decision |
| [ADR-003](docs/architecture/ADR-003-standalone-web-app.md) | Web app architecture |
| [ADR-004](docs/architecture/ADR-004-draft-approval-workflow.md) | Draft approval workflow |

## Technology Stack

**Web App (project-creation-app):**
- React 19 with Vite
- Tailwind CSS 4
- React Hook Form
- TanStack Query (React Query)
- TOML configuration

**OAuth Relay (asana-oauth-relay):**
- Netlify Functions
- Node.js

## Contributing

1. Create a feature branch from `main`
2. Make changes and test locally
3. Submit a pull request with description of changes

## License

Internal GivingTuesday project.
