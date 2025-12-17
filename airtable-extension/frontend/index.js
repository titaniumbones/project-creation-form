import {
    initializeBlock,
    useBase,
    useRecords,
    useGlobalConfig,
    Box,
    Button,
    Heading,
    Text,
    Select,
    FormField,
    Input,
    Loader,
    Icon,
    colors,
} from '@airtable/blocks/ui';
import React, { useState } from 'react';

// Asana template URL - update this to your template
const ASANA_TEMPLATE_URL = 'https://app.asana.com/0/projects/new/project-template/1204221248144075';

// Generate Asana create task URL with prefilled name (undocumented feature)
function getAsanaCreateTaskUrl(taskName, projectName) {
    const encodedName = encodeURIComponent(taskName);
    const encodedNotes = encodeURIComponent(`Milestone for: ${projectName}`);
    return `https://app.asana.com/0/-/create_task?name=${encodedName}&notes=${encodedNotes}`;
}

function ScopeOfWorkGenerator() {
    const base = useBase();
    const [selectedRecordId, setSelectedRecordId] = useState(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isSavingUrl, setIsSavingUrl] = useState(false);
    const [status, setStatus] = useState(null);
    const [error, setError] = useState(null);
    const [asanaBoardUrl, setAsanaBoardUrl] = useState('');

    // Get the Projects table
    const projectsTable = base.getTableByNameIfExists('Projects');

    // Get all project records
    const records = useRecords(projectsTable, {
        fields: [
            'Project',
            'Project Acronym',
            'Project Description',
            'Start Date',
            'End Date',
            'Status',
            'Roles Summary',
            'Milestone Rollup (from Milestones)',
            'Scope of Work - Generated',
            'Asana Board',
        ],
    });

    if (!projectsTable) {
        return (
            <Box padding={3}>
                <Text textColor="red">Projects table not found!</Text>
            </Box>
        );
    }

    // Format date for display
    function formatDate(dateStr) {
        if (!dateStr || dateStr === 'TBD') return 'TBD';
        try {
            const date = new Date(dateStr);
            return date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
            });
        } catch {
            return dateStr || 'TBD';
        }
    }

    // Parse milestones into checklist
    function parseMilestonesToChecklist(milestoneSummaryText) {
        if (!milestoneSummaryText || milestoneSummaryText.trim() === '') {
            return '- [ ] Add milestones in Airtable (link records to this project)\n- [ ] Then create corresponding tasks in Asana';
        }
        const lines = milestoneSummaryText
            .split(/[\n\r,]+/)
            .map((line) => line.trim())
            .filter((line) => line.length > 0);
        if (lines.length === 0) {
            return '- [ ] Add milestones in Airtable (link records to this project)\n- [ ] Then create corresponding tasks in Asana';
        }
        return lines.map((line) => `- [ ] Create Asana milestone: "${line}"`).join('\n');
    }

    // Parse roles into checklist
    function parseRolesToChecklist(rolesSummaryText) {
        if (!rolesSummaryText || rolesSummaryText.trim() === '') {
            return '- [ ] Create assignments for this project in Airtable\n- [ ] Assign team members to roles';
        }
        const lines = rolesSummaryText
            .split(/[\n\r,]+/)
            .map((line) => line.trim())
            .filter((line) => line.length > 0);
        if (lines.length === 0) {
            return '- [ ] Create assignments for this project in Airtable\n- [ ] Assign team members to roles';
        }
        return lines.map((line) => `- [x] ${line}`).join('\n');
    }

    // Generate the scoping document
    function generateScopingDocument(record) {
        const projectTitle = record.getCellValueAsString('Project') || 'Untitled Project';
        const projectAcronym = record.getCellValueAsString('Project Acronym') || '';
        const projectDescription = record.getCellValueAsString('Project Description') || '_No description provided_';
        const startDate = record.getCellValue('Start Date');
        const endDate = record.getCellValue('End Date');
        const status = record.getCellValueAsString('Status') || 'In Ideation';
        const rolesSummary = record.getCellValueAsString('Roles Summary') || '';
        const milestoneSummary = record.getCellValueAsString('Milestone Rollup (from Milestones)') || '';

        const displayTitle = projectAcronym ? `${projectTitle} (${projectAcronym})` : projectTitle;

        const formattedDate = new Date().toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });

        const milestoneChecklist = parseMilestonesToChecklist(milestoneSummary);
        const roleChecklist = parseRolesToChecklist(rolesSummary);

        return `# Project Scoping Document

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
| ${formattedDate} | Document created | Extension |

---

*This document was automatically generated from the Scope of Work Generator extension.*
*Last updated: ${formattedDate}*
`;
    }

    // Handle generate button click
    async function handleGenerate() {
        if (!selectedRecordId) {
            setError('Please select a project first');
            return;
        }

        setIsGenerating(true);
        setError(null);
        setStatus('Generating document...');

        try {
            const record = records.find((r) => r.id === selectedRecordId);
            if (!record) {
                throw new Error('Record not found');
            }

            const projectName = record.getCellValueAsString('Project');
            setStatus(`Generating document for: ${projectName}`);

            const scopingDocument = generateScopingDocument(record);

            setStatus('Updating record...');

            // Get the field for Scope of Work - Generated
            const sowField = projectsTable.getFieldByNameIfExists('Scope of Work - Generated');
            if (!sowField) {
                throw new Error('Field "Scope of Work - Generated" not found in Projects table');
            }

            await projectsTable.updateRecordAsync(record, {
                'Scope of Work - Generated': scopingDocument,
            });

            setStatus(`✓ Document generated for "${projectName}"`);
            setIsGenerating(false);
        } catch (err) {
            setError(`Error: ${err.message}`);
            setStatus(null);
            setIsGenerating(false);
        }
    }

    // Save Asana Board URL to record
    async function handleSaveAsanaUrl() {
        if (!asanaBoardUrl || !selectedRecordId) return;

        // Validate URL format - accept various Asana URL patterns
        if (!asanaBoardUrl.match(/^https:\/\/app\.asana\.com\/\d+\//)) {
            setError('Invalid Asana URL format. Expected: https://app.asana.com/...');
            return;
        }

        setIsSavingUrl(true);
        setError(null);

        try {
            const record = records.find((r) => r.id === selectedRecordId);
            if (!record) throw new Error('Record not found');

            const projectName = record.getCellValueAsString('Project');

            await projectsTable.updateRecordAsync(record, {
                'Asana Board': asanaBoardUrl,
            });

            setStatus(`✓ Asana Board URL saved for "${projectName}"`);
            setAsanaBoardUrl(''); // Clear input after save
            setIsSavingUrl(false);
        } catch (err) {
            setError(`Error saving URL: ${err.message}`);
            setIsSavingUrl(false);
        }
    }

    // Build record options for select
    const recordOptions = records
        ? records.map((record) => ({
              value: record.id,
              label: record.getCellValueAsString('Project') || '(unnamed)',
          }))
        : [];

    // Get the currently selected record and its Asana Board value
    const selectedRecord = selectedRecordId ? records?.find((r) => r.id === selectedRecordId) : null;
    const existingAsanaBoard = selectedRecord?.getCellValueAsString('Asana Board') || '';
    const selectedProjectName = selectedRecord?.getCellValueAsString('Project') || '';
    const selectedMilestones = selectedRecord
        ? (selectedRecord.getCellValueAsString('Milestone Rollup (from Milestones)') || '')
              .split(/[\n\r,]+/)
              .map((m) => m.trim())
              .filter((m) => m.length > 0)
        : [];

    return (
        <Box padding={3}>
            <Heading size="large" marginBottom={2}>
                Scope of Work Generator
            </Heading>

            <Text marginBottom={3} textColor="light">
                Select a project to link its Asana board and generate Scope of Work documentation.
            </Text>

            <FormField label="Select Project" marginBottom={3}>
                <Select
                    options={recordOptions}
                    value={selectedRecordId}
                    onChange={(value) => {
                        setSelectedRecordId(value);
                        setStatus(null);
                        setError(null);
                        setAsanaBoardUrl('');
                    }}
                    placeholder="Choose a project..."
                    width="100%"
                />
            </FormField>

            <Button
                onClick={handleGenerate}
                disabled={isGenerating || !selectedRecordId}
                icon={isGenerating ? <Loader scale={0.2} /> : 'edit'}
                variant="primary"
                marginBottom={3}
            >
                {isGenerating ? 'Generating...' : 'Generate Scope of Work'}
            </Button>

            {status && (
                <Box
                    padding={2}
                    borderRadius={3}
                    backgroundColor={colors.GREEN_LIGHT_2}
                    marginBottom={2}
                >
                    <Text textColor="green">{status}</Text>
                </Box>
            )}

            {error && (
                <Box
                    padding={2}
                    borderRadius={3}
                    backgroundColor={colors.RED_LIGHT_2}
                    marginBottom={2}
                >
                    <Text textColor="red">{error}</Text>
                </Box>
            )}

            {/* Asana Board Section - shows when a project is selected */}
            {selectedRecordId && (
                <Box
                    padding={3}
                    borderRadius={3}
                    backgroundColor={colors.BLUE_LIGHT_2}
                    marginBottom={3}
                    border="thick"
                    borderColor={colors.BLUE}
                >
                    <Heading size="small" marginBottom={2}>
                        {existingAsanaBoard ? 'Asana Board Connected' : 'Link Asana Board'}
                    </Heading>

                    {/* Steps 1 & 2: Only show if Asana Board not already set */}
                    {!existingAsanaBoard && (
                        <>
                            {/* Step 1: Open template */}
                            <Box marginBottom={3}>
                                <Text marginBottom={2}>
                                    <strong>Step 1:</strong> Create an Asana project for "{selectedProjectName}":
                                </Text>
                                <Button
                                    onClick={() => window.open(ASANA_TEMPLATE_URL, '_blank')}
                                    icon="share1"
                                    variant="primary"
                                    size="small"
                                >
                                    Open Asana Template
                                </Button>
                            </Box>

                            {/* Step 2: Paste URL */}
                            <Box marginBottom={3}>
                                <Text marginBottom={2}>
                                    <strong>Step 2:</strong> Paste the new Asana board URL here:
                                </Text>
                                <Box display="flex" alignItems="center">
                                    <Input
                                        value={asanaBoardUrl}
                                        onChange={(e) => {
                                            setAsanaBoardUrl(e.target.value);
                                        }}
                                        placeholder="https://app.asana.com/..."
                                        width="100%"
                                    />
                                    <Button
                                        onClick={handleSaveAsanaUrl}
                                        disabled={!asanaBoardUrl || isSavingUrl}
                                        icon={isSavingUrl ? undefined : 'upload'}
                                        variant="primary"
                                        marginLeft={2}
                                        size="small"
                                    >
                                        {isSavingUrl ? 'Saving...' : 'Save'}
                                    </Button>
                                </Box>
                            </Box>
                        </>
                    )}

                    {/* Show linked board info when already connected */}
                    {existingAsanaBoard && (
                        <Box marginBottom={3} display="flex" alignItems="center">
                            <Text marginRight={2}>Board:</Text>
                            <Button
                                onClick={() => window.open(existingAsanaBoard, '_blank')}
                                icon="share1"
                                size="small"
                                variant="secondary"
                            >
                                Open in Asana
                            </Button>
                        </Box>
                    )}

                    {/* Milestones section - show when there are milestones */}
                    {selectedMilestones.length > 0 && (
                        <Box marginBottom={2}>
                            <Text marginBottom={2}>
                                <strong>Milestones:</strong> Create tasks for these milestones:
                            </Text>
                            <Box
                                padding={2}
                                backgroundColor={colors.WHITE}
                                borderRadius={2}
                            >
                                {selectedMilestones.map((milestone, index) => (
                                    <Box
                                        key={index}
                                        display="flex"
                                        alignItems="center"
                                        justifyContent="space-between"
                                        paddingY={1}
                                        borderBottom={index < selectedMilestones.length - 1 ? 'default' : 'none'}
                                    >
                                        <Text>{milestone}</Text>
                                        <Button
                                            onClick={() => window.open(getAsanaCreateTaskUrl(milestone, selectedProjectName), '_blank')}
                                            icon="plus"
                                            size="small"
                                            variant="secondary"
                                        >
                                            Create Task
                                        </Button>
                                    </Box>
                                ))}
                            </Box>
                            <Text size="small" textColor="light" marginTop={1}>
                                Tasks open in "My Tasks" — assign them to your project after creation.
                            </Text>
                        </Box>
                    )}

                    {selectedMilestones.length === 0 && (
                        <Box padding={2} backgroundColor={colors.YELLOW_LIGHT_2} borderRadius={2}>
                            <Text size="small">
                                No milestones linked yet. Add milestones to this project in Airtable.
                            </Text>
                        </Box>
                    )}
                </Box>
            )}

            <Box marginTop={4} padding={2} backgroundColor={colors.GRAY_LIGHT_2} borderRadius={3}>
                <Heading size="small" marginBottom={1}>
                    How it works:
                </Heading>
                <Text size="small" textColor="light">
                    1. Select a project from the dropdown{'\n'}
                    2. Link the Asana board (create from template or paste existing URL){'\n'}
                    3. Optionally generate Scope of Work document{'\n'}
                    4. Add milestones from Airtable to your Asana board
                </Text>
            </Box>
        </Box>
    );
}

initializeBlock(() => <ScopeOfWorkGenerator />);
