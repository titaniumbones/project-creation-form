# Project Creation Helper - Airtable Extension (LEGACY)

> **Note**: This extension is **legacy** and no longer actively developed. The [Project Creation Helper web application](../project-creation-app/) provides a more complete solution with full Asana and Google Workspace integration.

A custom Airtable extension that provides a form-based interface for creating project records directly within Airtable.

## Status: Legacy

This extension was the original implementation of the Project Creation Helper. While it remains functional for basic use, the standalone web application now provides:

- Full Asana board creation from templates
- Google Drive folder and document generation
- Draft approval workflow
- OAuth-based authentication (no PAT required)

**For new development**, use the [web application](../project-creation-app/) instead.

## Features

- Dropdown to select any project from the Projects table
- One-click document generation
- Visual feedback during generation
- Saves directly to "Scope of Work - Generated" field

## Installation

### Prerequisites

- Node.js 14+ installed
- Airtable account with the target base
- Airtable Blocks CLI v2

### Setup

1. **Install the Airtable Blocks CLI globally:**

```bash
npm install -g @airtable/blocks-cli
```

2. **Navigate to the extension directory:**

```bash
cd airtable-extension
```

3. **Install dependencies:**

```bash
npm install
```

4. **Create the extension in Airtable:**

   - Go to your base in Airtable
   - Click "Extensions" in the top right
   - Click "Add an extension"
   - Choose "Build a custom extension"
   - Select "Remix from GitHub" or "Start from scratch"
   - Copy the Block ID provided

5. **Initialize the extension:**

```bash
npx block init
```

   When prompted, enter the Block ID from Airtable.

6. **Run the extension in development mode:**

```bash
npm run start
```

   This will open a browser window. In Airtable, click "Edit extension" and enter the URL shown in the terminal (usually `https://localhost:9000`).

## Usage

1. Open the extension panel in Airtable
2. Select a project from the dropdown
3. Click "Generate Scope of Work"
4. The document is saved to the record's "Scope of Work - Generated" field
5. Open the record to view and follow the Asana setup guide

## Required Fields

The extension expects these fields in the **Projects** table:

| Field Name | Type |
|------------|------|
| Project | Single line text |
| Project Acronym | Single line text |
| Project Description | Rich text |
| Start Date | Date |
| End Date | Date |
| Status | Single select |
| Roles Summary | Rollup |
| Milestone Rollup | Rollup |
| Scope of Work - Generated | Long text |

## Customization

### Changing the Asana Template URL

Edit `frontend/index.js` line 17:

```javascript
const ASANA_TEMPLATE_URL = 'https://app.asana.com/0/projects/new/project-template/YOUR_TEMPLATE_ID';
```

### Modifying the Document Template

The document is generated in the `generateScopingDocument()` function. Edit the template literal to customize sections.

## Deployment

To deploy the extension so all base users can access it:

```bash
npm run release
```

This builds the extension and uploads it to Airtable.

## Troubleshooting

### "Field not found" error

Ensure all required fields exist in your Projects table with exact names as listed above.

### Extension not loading

- Check that you're running `npm run start` in the terminal
- Verify the development URL matches what's in Airtable
- Try refreshing the Airtable page

### Permission errors

The extension needs write access to update records. Ensure you have Editor or Creator permissions on the base.

## Related Documentation

- [Main Project README](../README.md)
- [Web Application](../project-creation-app/) (recommended)
- [Setup Guide](../SETUP.md)
