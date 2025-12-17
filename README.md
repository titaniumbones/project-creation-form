# Project Creation Form

An Airtable-native workflow for initiating new GivingTuesday projects. When a project intake form is submitted, this system generates a Scope of Work document with Asana setup guidance.

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

## All Fields Already Exist

No schema changes needed. The required fields are in place:

**Projects:** Project, Project Acronym, Project Description, Start Date, End Date, Status, Asana Board, Scope of Work - Generated, Milestones (link), Milestone Rollup, Roles Summary

**Milestones:** Milestone, Project, Due Date, Description, Status

**Assignments:** Role Display (formula)

## Setup Instructions

### Step 1: Create the Form

1. Go to Projects table → Create form
2. Include: Project, Project Acronym, Project Description, Start Date, End Date
3. Do NOT include: Status, Milestones, Asana Board, Scope of Work - Generated

### Step 2: Create Automation

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
   - `milestoneSummary` → Milestone Rollup
4. Copy script from `airtable/automation-scripts/generate-scoping-doc.js`
5. Update `ASANA_TEMPLATE_URL` in script to your template
6. **Update record** action: Scope of Work - Generated = `scopeOfWork` output

### Step 3: (Optional) URL Validation Automation

1. **Trigger**: When record updated, condition "Asana Board is not empty"
2. **Action**: Run script from `validate-asana-url.js`
3. **Update record**: Status = `newStatus` output

## User Workflow

1. **Submit form** with project details
2. **Open record**, add milestones (linked records)
3. **Review Scope of Work** with Asana setup guidance
4. **Click template link** to create Asana board
5. **Paste Asana URL** into "Asana Board" field

## File Structure

```
project-creation-form/
├── README.md
├── airtable/
│   ├── form-config.md                  # Field specifications
│   └── automation-scripts/
│       ├── generate-scoping-doc.js     # SOW generation (for automations)
│       └── validate-asana-url.js       # URL validation
├── airtable-extension/                 # Custom extension (alternative to automations)
│   ├── README.md                       # Extension setup instructions
│   ├── package.json
│   ├── block.json
│   └── frontend/
│       └── index.js                    # React component
├── templates/
│   └── scoping-doc-template.md
└── docs/
    └── workflow-diagram.md
```

## Two Implementation Options

### Option A: Automation (automatic)
- Triggers on record creation
- Requires setting up automation script with input variables
- See `airtable/automation-scripts/`

### Option B: Extension (manual trigger)
- User clicks button to generate document
- Better visibility and error handling
- See `airtable-extension/README.md` for setup

## Remaining Setup

| Task | Status |
|------|--------|
| Create form | Pending |
| Create automation | Pending |
| Test workflow | Pending |
