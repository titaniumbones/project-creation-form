# Airtable Automation Scripts (LEGACY)

> **Note**: These automation scripts are **legacy** and no longer actively developed. The [Project Creation Helper web application](../project-creation-app/) provides a more complete solution with full Asana and Google Workspace integration.

This directory contains Airtable automation scripts that run inside Airtable's automation feature. These were the original approach before the custom extension and web application were developed.

## Status: Legacy

These scripts predate both the Airtable extension and the web application. While they may still function, they are not maintained and lack the features of the modern web app:

- No Asana board creation
- No Google Drive integration
- No draft/approval workflow
- No OAuth (requires manual Airtable automation setup)

**For new development**, use the [web application](../project-creation-app/) instead.

## Contents

### automation-scripts/

| Script | Purpose |
|--------|---------|
| `generate-scoping-doc.js` | Generates a markdown scoping document when a record is created |
| `validate-asana-url.js` | Validates Asana URLs in project records |

### form-config.md

Documentation of the original Airtable form field configuration and automation input mappings.

## Usage (Historical)

These scripts were designed to be pasted into Airtable's "Run script" automation action:

1. Create an automation in Airtable
2. Set trigger (e.g., "When record is created")
3. Add "Run script" action
4. Configure input variables as documented in the script header
5. Paste the script content
6. Add output actions (e.g., "Update record")

## Related Documentation

- [Main Project README](../README.md)
- [Web Application](../project-creation-app/) (recommended)
- [Airtable Extension](../airtable-extension/) (also legacy)
