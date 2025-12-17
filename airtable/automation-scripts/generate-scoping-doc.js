/**
 * Airtable Automation Script: Generate Project Scoping Document with Asana Setup Guidance
 *
 * This script generates a markdown-formatted Project Scoping Document
 * that includes specific guidance for setting up the Asana board.
 *
 * SETUP INSTRUCTIONS:
 *
 * 1. In Airtable, go to Automations > Create automation
 * 2. Trigger: "When record is created"
 * 3. Action: "Run script"
 * 4. Configure Input Variables (in the left panel):
 *
 *    Variable Name        | Type | Source
 *    ---------------------|------|----------------------------------
 *    recordId             | Text | Record ID (from trigger)
 *    projectTitle         | Text | Project field
 *    projectAcronym       | Text | Project Acronym field
 *    projectDescription   | Text | Project Description field
 *    startDate            | Text | Start Date field
 *    endDate              | Text | End Date field
 *    status               | Text | Status field
 *    rolesSummary         | Text | Roles Summary (rollup from linked Assignments)
 *    milestoneSummary     | Text | Milestone Summary (rollup from linked Milestones)
 *
 * 5. Copy this entire script into the script editor
 * 6. Add "Update record" action after script:
 *    - Record ID: use recordId from script output
 *    - SOW: use sow from script output
 */

// Get input variables from automation configuration
const inputConfig = input.config();

// Asana template URL (update this to your template)
const ASANA_TEMPLATE_URL = 'https://app.asana.com/0/projects/new/project-template/1204221248144075';

// Extract all project fields
const recordId = inputConfig.recordId;
const projectTitle = inputConfig.projectTitle || 'Untitled Project';
const projectAcronym = inputConfig.projectAcronym || '';
const projectDescription = inputConfig.projectDescription || '_No description provided_';
const startDate = inputConfig.startDate || 'TBD';
const endDate = inputConfig.endDate || 'TBD';
const status = inputConfig.status || 'In Ideation';
const rolesSummary = inputConfig.rolesSummary || ''; // From rollup of linked Assignments
const milestoneSummary = inputConfig.milestoneSummary || ''; // From rollup of linked Milestones

// Format today's date
const today = new Date();
const formattedDate = today.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
});

// Format dates for display
function formatDate(dateStr) {
    if (!dateStr || dateStr === 'TBD') return 'TBD';
    try {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    } catch {
        return dateStr;
    }
}

// Build the title with optional acronym
const displayTitle = projectAcronym
    ? `${projectTitle} (${projectAcronym})`
    : projectTitle;

// Parse milestones into checklist items
// Input is from Milestone Summary rollup field (newline-separated milestone names)
function parseMilestonesToChecklist(milestoneSummaryText) {
    if (!milestoneSummaryText || milestoneSummaryText.trim() === '') {
        return '- [ ] Add milestones in Airtable (link records to this project)\n- [ ] Then create corresponding tasks in Asana';
    }

    // Split by newlines or commas (depending on ARRAYJOIN separator)
    const lines = milestoneSummaryText
        .split(/[\n\r,]+/)
        .map(line => line.trim())
        .filter(line => line.length > 0);

    if (lines.length === 0) {
        return '- [ ] Add milestones in Airtable (link records to this project)\n- [ ] Then create corresponding tasks in Asana';
    }

    return lines.map(line => `- [ ] Create Asana milestone: "${line}"`).join('\n');
}

// Parse roles summary (from Assignments rollup) into checklist
// Format from rollup: "Role: Member Name\nRole: Member Name"
function parseRolesToChecklist(rolesSummaryText) {
    if (!rolesSummaryText || rolesSummaryText.trim() === '') {
        return '- [ ] Create assignments for this project in Airtable\n- [ ] Assign team members to roles';
    }

    const lines = rolesSummaryText
        .split(/[\n\r,]+/)
        .map(line => line.trim())
        .filter(line => line.length > 0);

    if (lines.length === 0) {
        return '- [ ] Create assignments for this project in Airtable\n- [ ] Assign team members to roles';
    }

    // Roles from Assignments are already assigned, so mark as complete
    return lines.map(line => `- [x] ${line}`).join('\n');
}

// Generate milestone checklist from rollup (or show placeholder if milestones not yet added)
const milestoneChecklist = parseMilestonesToChecklist(milestoneSummary);

// Generate role checklist from Assignments rollup
const roleChecklist = parseRolesToChecklist(rolesSummary);

// Generate the markdown document
const scopingDocument = `# Project Scoping Document

## ${displayTitle}

---

| | |
|---|---|
| **Created** | ${formattedDate} |
| **Status** | ${status} |
| **Start Date** | ${formatDate(startDate)} |
| **End Date** | ${formatDate(endDate)} |

---

## Project Description

${projectDescription}

---

## Asana Board Setup Guide

### Step 1: Create the Asana Project

Click the link below to create a new project from the template:

**[Create Asana Project from Template](${ASANA_TEMPLATE_URL})**

When creating the project:
- **Project Name**: \`${displayTitle}\`
- **Team**: Select the appropriate team
- **Privacy**: Set based on project needs

---

### Step 2: Update Project Details

Once the project is created, update these fields in Asana:

- [ ] Set project name to: **${displayTitle}**
- [ ] Add project description (copy from above)
- [ ] Set project start date: **${formatDate(startDate)}**
- [ ] Set project due date: **${formatDate(endDate)}**

---

### Step 3: Create Milestones

Add these milestones to your Asana project:

${milestoneChecklist}

---

### Step 4: Assign Team Roles

Create tasks or sections for team assignments:

${roleChecklist}

---

### Step 5: Link Back to Airtable

**Important**: After creating the Asana project, copy the project URL and paste it into the "Asana Board" field in Airtable.

The Asana URL looks like: \`https://app.asana.com/0/1234567890/list\`

---

## Team Assignments

${rolesSummary || '_No assignments linked yet. Create assignments in Airtable to populate this section._'}

---

## Milestones & Deliverables

${milestoneSummary || '_No milestones linked yet. Add milestones in Airtable, then regenerate this document._'}

---

## Links & Resources

- **Asana Board**: _Paste URL after creation_
- **Project Tracker**: _Link to this Airtable record_

---

## Appendix

### Change Log

| Date | Change | Author |
|------|--------|--------|
| ${formattedDate} | Document created | Automation |

---

*This document was automatically generated from the Project Intake Form.*
*Last updated: ${formattedDate}*
`;

console.log(`Generated scoping document for: ${displayTitle}`);

// Output values for subsequent automation actions
// Note: Map 'sow' output to the "SOW" field in Projects table
output.set('sow', scopingDocument);
output.set('recordId', recordId);
output.set('success', true);

console.log('Scoping document generation completed successfully!');
