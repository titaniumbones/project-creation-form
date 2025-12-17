# Project Creation Form

An Airtable-native workflow for initiating new GivingTuesday projects. When a project intake form is submitted, this system generates a Project Scoping Document (SOW) with Asana setup guidance.

## Architecture

```
┌─────────────────┐     ┌──────────────────────┐     ┌─────────────────┐
│  Airtable Form  │────▶│  Generate SOW        │────▶│  User Creates   │
│  (Project Info) │     │  + Setup Guidance    │     │  Asana Board    │
└─────────────────┘     └──────────────────────┘     └─────────────────┘
                                                              │
                        ┌──────────────────────┐              │
                        │  Record Complete     │◀─────────────┘
                        │  (Asana linked)      │
                        └──────────────────────┘
```

## What Already Exists

The Projects table already has:
- Project, Project Acronym, Start Date, End Date, Status
- **Asana Board** (URL field)
- **SOW** (Long text field)

## Setup Instructions

### Step 1: Create Milestones Table

Create a new **Milestones** table:

| Field | Type | Notes |
|-------|------|-------|
| Milestone Name | Single line text | Primary field |
| Project | Linked records | Links to Projects |
| Due Date | Date | |
| Status | Single select | Not Started, In Progress, Complete |

### Step 2: Add Fields to Projects Table

| Field | Type | Configuration |
|-------|------|---------------|
| Project Description | Long text | For form input |
| Milestones | Linked records | Link to Milestones table |
| Milestone Summary | Rollup | ARRAYJOIN of Milestone Name |
| Roles Summary | Rollup | ARRAYJOIN of Role Display from Assignments |

### Step 3: Add Formula to Assignments Table

Add a formula field to **Assignments**:
- **Name**: `Role Display`
- **Formula**: `{Role} & ": " & {Data Team Member}`

### Step 4: Create the Form

1. Go to Projects table → Create form
2. Include: Project, Project Acronym, Project Description, Start Date, End Date
3. Do NOT include: Status, Milestones, Asana Board, SOW

### Step 5: Create Automation

1. **Trigger**: When record is created
2. **Action**: Run script
3. **Input variables**:
   - `recordId` → Record ID
   - `projectTitle` → Project
   - `projectAcronym` → Project Acronym
   - `projectDescription` → Project Description
   - `startDate` → Start Date
   - `endDate` → End Date
   - `status` → Status
   - `rolesSummary` → Roles Summary
   - `milestoneSummary` → Milestone Summary
4. Copy script from `airtable/automation-scripts/generate-scoping-doc.js`
5. Update `ASANA_TEMPLATE_URL` in script to your template
6. **Update record** action: SOW = `sow` output

### Step 6: (Optional) URL Validation Automation

1. **Trigger**: When record updated, condition "Asana Board is not empty"
2. **Action**: Run script from `validate-asana-url.js`
3. **Update record**: Status = `newStatus` output

## User Workflow

1. **Submit form** with project details
2. **Open record**, add milestones (linked records)
3. **Review SOW** with Asana setup guidance
4. **Click template link** to create Asana board
5. **Paste Asana URL** into "Asana Board" field

## File Structure

```
project-creation-form/
├── README.md
├── airtable/
│   ├── form-config.md                  # Field specifications
│   └── automation-scripts/
│       ├── generate-scoping-doc.js     # SOW generation
│       └── validate-asana-url.js       # URL validation
├── templates/
│   └── scoping-doc-template.md
└── docs/
    └── workflow-diagram.md
```

## Summary of Changes Needed

| Location | Action |
|----------|--------|
| **Milestones table** | Create new table |
| **Projects table** | Add 4 fields (Description, Milestones link, 2 rollups) |
| **Assignments table** | Add 1 formula field (Role Display) |
| **Automation** | Create 1-2 automations |
