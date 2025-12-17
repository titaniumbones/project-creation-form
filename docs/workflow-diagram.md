# Project Creation Workflow

## Overview

This document describes the end-to-end workflow for creating a new GivingTuesday project using the Airtable-native system with manual Asana board creation.

## Workflow Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        USER SUBMITS FORM                                │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  AIRTABLE FORM                                                          │
│  ─────────────────────────────────────────────────────────────────────  │
│  • Project Title (required)                                             │
│  • Project Acronym                                                      │
│  • Project Description (required)                                       │
│  • Start Date / End Date                                                │
│  • Project Roles                                                        │
│  • Milestones                                                           │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Record Created
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  AUTOMATION 1: GENERATE SCOPING DOCUMENT                                │
│  ─────────────────────────────────────────────────────────────────────  │
│  Trigger: When record is created                                        │
│                                                                         │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐     │
│  │ Read Project    │───▶│ Generate        │───▶│ Update Record   │     │
│  │ Details         │    │ Scoping Doc +   │    │ with Document   │     │
│  │                 │    │ Setup Guidance  │    │                 │     │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘     │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Document includes:
                                    │ • Template link
                                    │ • Setup checklist
                                    │ • Milestone tasks
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  USER ACTION: CREATE ASANA PROJECT                                      │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  1. User opens scoping document in Airtable                             │
│  2. Clicks "Create Asana Project from Template" link                    │
│  3. Asana opens with template instantiation page                        │
│  4. User names project and creates it                                   │
│  5. User follows checklist to set up milestones/roles                   │
│  6. User copies Asana project URL                                       │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ User pastes URL
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  AUTOMATION 2: VALIDATE & LINK (Optional)                               │
│  ─────────────────────────────────────────────────────────────────────  │
│  Trigger: When "Asana Project URL" is not empty                         │
│                                                                         │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐     │
│  │ Read URL        │───▶│ Validate        │───▶│ Update Status   │     │
│  │                 │    │ Format          │    │ to "Active"     │     │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘     │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  RESULT: COMPLETE PROJECT RECORD                                        │
│  ─────────────────────────────────────────────────────────────────────  │
│  • All form data stored                                                 │
│  • Scoping document with setup guidance                                 │
│  • Asana project linked                                                 │
│  • Status: Active                                                       │
│  • Ready for team assignment and work to begin                          │
└─────────────────────────────────────────────────────────────────────────┘
```

## Automation Details

### Automation 1: Generate Scoping Document

**Trigger Configuration:**
- Type: When record is created
- Table: Projects (or Project Intake)

**Script Input Variables:**

| Variable | Type | Source | Description |
|----------|------|--------|-------------|
| `recordId` | Text | Trigger record | Airtable record ID |
| `projectTitle` | Text | Project field | Project name |
| `projectAcronym` | Text | Project Acronym | Short code |
| `projectDescription` | Text | Project Description | Project details |
| `startDate` | Text | Start Date | Planned start |
| `endDate` | Text | End Date | Planned end |
| `status` | Text | Status | Current status |
| `projectRoles` | Text | Project Roles | Team roles needed |
| `milestones` | Text | Milestones | Key milestones |

**Script Output Variables:**

| Variable | Description |
|----------|-------------|
| `scopingDocument` | Generated markdown with setup guidance |
| `recordId` | Original record ID (pass-through) |
| `success` | Boolean indicating success/failure |

**Follow-up Action:**
- Update record: Set "Scoping Document" = `scopingDocument`

### Automation 2: Validate Asana URL (Optional)

**Trigger Configuration:**
- Type: When record updated
- Condition: "Asana Project URL" is not empty
- Table: Projects (or Project Intake)

**Script Input Variables:**

| Variable | Type | Source |
|----------|------|--------|
| `recordId` | Text | Record ID |
| `asanaUrl` | Text | Asana Project URL field |
| `currentStatus` | Text | Status field |

**Script Output Variables:**

| Variable | Description |
|----------|-------------|
| `recordId` | Original record ID (pass-through) |
| `isValid` | Boolean - URL format is valid |
| `projectGid` | Extracted Asana project GID |
| `newStatus` | Updated status (Active if was In Ideation) |
| `message` | Validation result message |

**Follow-up Action (Optional):**
- Update record: Set "Status" = `newStatus`

## Generated Scoping Document Contents

The scoping document includes:

1. **Project Overview**
   - Title, dates, status
   - Full description

2. **Asana Setup Guide**
   - Direct link to template
   - Step-by-step instructions
   - Project-specific checklists

3. **Milestone Checklist**
   - Tasks to create based on form input
   - Formatted as actionable items

4. **Role Assignments**
   - Team members to assign
   - Tasks for each role

5. **Link Back Instructions**
   - Reminder to paste Asana URL

## User Experience

### For Project Creators

1. **Submit Form** (2 min)
   - Fill out project details
   - Click submit

2. **Review & Create Asana** (5 min)
   - Open record in Airtable
   - Read scoping document
   - Click template link
   - Create Asana project
   - Follow setup checklist

3. **Link Back** (30 sec)
   - Copy Asana URL
   - Paste into Airtable field

### For Administrators

- No API credentials to manage
- Automations are self-contained
- Easy to modify template or guidance

## Benefits of This Approach

| Aspect | Benefit |
|--------|---------|
| Security | No PAT or API keys stored |
| Control | User creates their own Asana project |
| Flexibility | Template can change without code updates |
| Simplicity | Two simple automations |
| Reliability | No external API calls to fail |

## Comparison with API Approach

| Feature | Manual (Current) | API (Alternative) |
|---------|------------------|-------------------|
| PAT Required | No | Yes |
| User Action | Create board, paste URL | None |
| Fully Automated | No | Yes |
| Setup Complexity | Low | Medium |
| Maintenance | Low | Medium |
| Error Handling | User sees errors | Script handles |

## Future Enhancements

If full automation is needed later:
1. Obtain Asana Personal Access Token
2. Add API script as Automation 1.5
3. Remove manual step from workflow
4. Keep scoping doc generation

See `create-asana-project.js.example` for API implementation reference.
