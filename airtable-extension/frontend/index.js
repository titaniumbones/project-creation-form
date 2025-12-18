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
import React, { useState, useEffect, useMemo, useCallback } from 'react';

// Asana template URL and GID - update this to your template
const ASANA_TEMPLATE_URL = 'https://app.asana.com/0/projects/new/project-template/1204221248144075';
const ASANA_TEMPLATE_GID = '1204221248144075';

// GlobalConfig keys for Asana settings storage
const ASANA_PAT_KEY = 'asanaPat';
const ASANA_TEAM_GID_KEY = 'asanaTeamGid';

// Parse Asana project GID from board URL
// Supports: /0/PROJECT_GID/... and /1/WORKSPACE/project/PROJECT_GID/...
function parseAsanaProjectGid(url) {
    if (!url) return null;
    // Format 1: https://app.asana.com/0/PROJECT_GID/...
    const format1 = url.match(/app\.asana\.com\/0\/(\d+)/);
    if (format1) return format1[1];
    // Format 2: https://app.asana.com/1/WORKSPACE/project/PROJECT_GID/...
    const format2 = url.match(/app\.asana\.com\/1\/\d+\/project\/(\d+)/);
    if (format2) return format2[1];
    return null;
}

// Validate Asana PAT by calling /users/me
async function validateAsanaPat(pat) {
    const response = await fetch('https://app.asana.com/api/1.0/users/me', {
        headers: {
            'Authorization': `Bearer ${pat}`,
            'Content-Type': 'application/json',
        },
    });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.errors?.[0]?.message || 'Invalid or expired PAT');
    }
    const data = await response.json();
    return data.data; // { gid, email, name, workspaces }
}

// Search Asana workspace users
async function searchAsanaUsers(pat, workspaceGid) {
    const response = await fetch(
        `https://app.asana.com/api/1.0/workspaces/${workspaceGid}/users?opt_fields=name,email`,
        {
            headers: {
                'Authorization': `Bearer ${pat}`,
                'Content-Type': 'application/json',
            },
        }
    );
    if (!response.ok) {
        throw new Error('Failed to fetch Asana users');
    }
    const data = await response.json();
    return data.data; // Array of { gid, name, email }
}

// Fuzzy match a name against Asana users
function findBestUserMatch(searchName, asanaUsers) {
    if (!searchName || !asanaUsers?.length) return null;

    const searchLower = searchName.toLowerCase().trim();
    const searchParts = searchLower.split(/\s+/);

    let bestMatch = null;
    let bestScore = 0;

    for (const user of asanaUsers) {
        const userName = user.name?.toLowerCase() || '';
        const userParts = userName.split(/\s+/);

        // Exact match
        if (userName === searchLower) {
            return { user, score: 100, matchType: 'exact' };
        }

        // Check if all search parts are contained in user name
        const allPartsMatch = searchParts.every((part) => userName.includes(part));
        if (allPartsMatch) {
            const score = 80 + (searchParts.length / userParts.length) * 10;
            if (score > bestScore) {
                bestScore = score;
                bestMatch = { user, score, matchType: 'contains_all' };
            }
        }

        // Check first + last name match
        if (searchParts.length >= 2 && userParts.length >= 2) {
            const firstMatch = userParts[0].startsWith(searchParts[0]) || searchParts[0].startsWith(userParts[0]);
            const lastMatch = userParts[userParts.length - 1] === searchParts[searchParts.length - 1];
            if (firstMatch && lastMatch) {
                const score = 70;
                if (score > bestScore) {
                    bestScore = score;
                    bestMatch = { user, score, matchType: 'first_last' };
                }
            }
        }

        // Partial match - any part matches
        const anyPartMatch = searchParts.some((part) => userName.includes(part) && part.length > 2);
        if (anyPartMatch && bestScore < 50) {
            bestScore = 50;
            bestMatch = { user, score: 50, matchType: 'partial' };
        }
    }

    // Only return if score is reasonable
    return bestScore >= 50 ? bestMatch : null;
}

// Create Asana task via API
async function createAsanaTask(pat, projectGid, milestone, assigneeGid = null) {
    const taskData = {
        name: milestone.name,
        notes: milestone.description || '',
        due_on: milestone.dueDate || null, // Format: "YYYY-MM-DD"
        projects: [projectGid],
    };

    // Add assignee if provided
    if (assigneeGid) {
        taskData.assignee = assigneeGid;
    }

    const response = await fetch('https://app.asana.com/api/1.0/tasks', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${pat}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ data: taskData }),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.errors?.[0]?.message || 'Failed to create task');
    }

    const data = await response.json();
    const taskGid = data.data.gid;
    const taskUrl = `https://app.asana.com/0/${projectGid}/${taskGid}`;

    return { taskGid, taskUrl };
}

// Generate Asana create task URL with prefilled name (fallback for when no PAT)
function getAsanaCreateTaskUrl(taskName, projectName) {
    const encodedName = encodeURIComponent(taskName);
    const encodedNotes = encodeURIComponent(`Milestone for: ${projectName}`);
    return `https://app.asana.com/0/-/create_task?name=${encodedName}&notes=${encodedNotes}`;
}

// Fetch project template details to get required dates and roles
async function getProjectTemplate(pat, templateGid) {
    const response = await fetch(
        `https://app.asana.com/api/1.0/project_templates/${templateGid}?opt_fields=name,requested_dates,requested_roles`,
        {
            headers: {
                'Authorization': `Bearer ${pat}`,
                'Content-Type': 'application/json',
            },
        }
    );

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.errors?.[0]?.message || 'Failed to fetch project template');
    }

    const data = await response.json();
    return data.data;
}

// Format a date to YYYY-MM-DD for Asana API
function formatDateForAsana(dateValue) {
    if (!dateValue) return null;
    // If it's already a string in YYYY-MM-DD format, use it
    if (typeof dateValue === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
        return dateValue;
    }
    // Otherwise parse and format
    const date = new Date(dateValue);
    if (isNaN(date.getTime())) return null;
    return date.toISOString().split('T')[0];
}

// Create Asana project from template
// roleAssignments: array of { roleName: string, userGid: string } to map template roles to users
async function createProjectFromTemplate(pat, templateGid, name, teamGid, startDate = null, roleAssignments = []) {
    // First, get the template to see what dates and roles are required
    const template = await getProjectTemplate(pat, templateGid);

    // Build requested_dates array with today's date (or provided start date) for each required date
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    const formattedStartDate = formatDateForAsana(startDate);
    const dateValue = formattedStartDate || today;

    const requestedDates = (template.requested_dates || []).map((dateField) => ({
        gid: dateField.gid,
        value: dateValue,
    }));

    // Build requested_roles array by matching template roles to our role assignments
    // Template roles have: { gid, name }
    // We match by name (case-insensitive, partial match)
    const requestedRoles = [];
    for (const templateRole of (template.requested_roles || [])) {
        const templateRoleName = templateRole.name?.toLowerCase() || '';

        // Find matching role assignment
        const match = roleAssignments.find((ra) => {
            const assignmentName = ra.roleName?.toLowerCase() || '';
            // Match if template role contains our role name or vice versa
            return templateRoleName.includes(assignmentName) ||
                   assignmentName.includes(templateRoleName) ||
                   // Also try common variations
                   (assignmentName.includes('coordinator') && templateRoleName.includes('coordinator')) ||
                   (assignmentName.includes('owner') && templateRoleName.includes('owner')) ||
                   (assignmentName.includes('owner') && templateRoleName.includes('lead')) ||
                   (assignmentName.includes('lead') && templateRoleName.includes('lead'));
        });

        if (match) {
            requestedRoles.push({
                gid: templateRole.gid,
                value: match.userGid,
            });
        }
    }

    const requestBody = {
        data: {
            name: name,
            team: teamGid,
            public: false,
        },
    };

    // Only add requested_dates if there are any
    if (requestedDates.length > 0) {
        requestBody.data.requested_dates = requestedDates;
    }

    // Only add requested_roles if there are any matches
    if (requestedRoles.length > 0) {
        requestBody.data.requested_roles = requestedRoles;
    }

    console.log('[Asana API] Template roles:', template.requested_roles);
    console.log('[Asana API] Role assignments:', roleAssignments);
    console.log('[Asana API] Matched requested_roles:', requestedRoles);

    const response = await fetch(
        `https://app.asana.com/api/1.0/project_templates/${templateGid}/instantiateProject`,
        {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${pat}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
        }
    );

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.errors?.[0]?.message || 'Failed to create project from template');
    }

    const data = await response.json();
    // The response contains a job with new_project info
    const projectGid = data.data?.new_project?.gid;
    if (!projectGid) {
        throw new Error('Project creation did not return a project GID');
    }
    return projectGid;
}

// Add members to an Asana project
async function addProjectMembers(pat, projectGid, memberGids) {
    if (!memberGids || memberGids.length === 0) return true;

    const response = await fetch(
        `https://app.asana.com/api/1.0/projects/${projectGid}/addMembers`,
        {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${pat}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                data: {
                    members: memberGids,
                },
            }),
        }
    );

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.errors?.[0]?.message || 'Failed to add members to project');
    }

    return true;
}

function ScopeOfWorkGenerator() {
    const base = useBase();
    const globalConfig = useGlobalConfig();
    const [selectedRecordId, setSelectedRecordId] = useState(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isSavingUrl, setIsSavingUrl] = useState(false);
    const [status, setStatus] = useState(null);
    const [error, setError] = useState(null);
    const [asanaBoardUrl, setAsanaBoardUrl] = useState('');

    // Settings state
    const [showSettings, setShowSettings] = useState(false);
    const [patInput, setPatInput] = useState('');
    const [isTestingPat, setIsTestingPat] = useState(false);
    const [patStatus, setPatStatus] = useState(null);

    // Milestone creation state
    const [milestoneStatuses, setMilestoneStatuses] = useState({});
    // { milestoneId: { status: 'pending'|'creating'|'success'|'error', error: '...' } }

    // Asana workspace and users cache (for role lookups)
    const [workspaceGid, setWorkspaceGid] = useState(null);
    const [asanaUsers, setAsanaUsers] = useState([]);
    const [coordinatorMatch, setCoordinatorMatch] = useState(null);
    const [ownerMatch, setOwnerMatch] = useState(null);

    // Project creation state
    const [creatingProject, setCreatingProject] = useState(false);
    const [teamGidInput, setTeamGidInput] = useState('');

    // Get stored settings from globalConfig
    const storedPat = globalConfig.get(ASANA_PAT_KEY);
    const storedTeamGid = globalConfig.get(ASANA_TEAM_GID_KEY);
    const hasAsanaConfig = !!storedPat;
    const hasFullAsanaConfig = !!storedPat && !!storedTeamGid;

    // Get the Projects table
    const projectsTable = base.getTableByNameIfExists('Projects');

    // Get the Milestones table
    const milestonesTable = base.getTableByNameIfExists('Milestones');
    const asanaUrlField = milestonesTable?.getFieldByNameIfExists('Asana URL');

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
            'Milestones', // Linked records
            'Project Owners', // Linked to Data Team Members
        ],
    });

    // Get all milestone records (to access full details)
    const allMilestones = useRecords(milestonesTable, {
        fields: ['Milestone', 'Description', 'Due Date', 'Status', 'Project', 'Asana URL'],
    });

    // Get Assignments table for coordinator lookup
    const assignmentsTable = base.getTableByNameIfExists('Assignments');
    const allAssignments = useRecords(assignmentsTable, {
        fields: ['Role', 'Data Team Member', 'Project'],
    });

    // Get Data Team Members table to resolve names
    const dataTeamMembersTable = base.getTableByNameIfExists('Data Team Members');
    const allDataTeamMembers = useRecords(dataTeamMembersTable, {
        fields: ['Full Name'],
    });

    // Memoize record IDs to create stable dependency references
    // (useRecords returns new array refs on every render)
    const projectIds = useMemo(
        () => records?.map((r) => r.id).join(',') || '',
        [records]
    );
    const assignmentIds = useMemo(
        () => allAssignments?.map((a) => a.id).join(',') || '',
        [allAssignments]
    );
    const teamMemberIds = useMemo(
        () => allDataTeamMembers?.map((m) => m.id).join(',') || '',
        [allDataTeamMembers]
    );

    // Validate PAT on initial load to get workspace GID
    useEffect(() => {
        async function initializeAsanaConnection() {
            if (storedPat && !workspaceGid) {
                try {
                    const userData = await validateAsanaPat(storedPat);
                    if (userData.workspaces?.length > 0) {
                        setWorkspaceGid(userData.workspaces[0].gid);
                    }
                } catch {
                    // PAT might be invalid/expired, user will need to reconfigure
                }
            }
        }
        initializeAsanaConnection();
    }, [storedPat, workspaceGid]);

    // Fetch Asana users when PAT and workspace are available
    useEffect(() => {
        async function fetchAsanaUsers() {
            if (storedPat && workspaceGid && asanaUsers.length === 0) {
                try {
                    const users = await searchAsanaUsers(storedPat, workspaceGid);
                    setAsanaUsers(users);
                } catch {
                    // Failed to fetch users, coordinator lookup won't work
                }
            }
        }
        fetchAsanaUsers();
    }, [storedPat, workspaceGid, asanaUsers.length]);

    // Find Project Coordinator for selected project
    // NOTE: Using stable ID strings in deps instead of array refs to prevent infinite re-renders
    useEffect(() => {
        if (!selectedRecordId || !allAssignments || !allDataTeamMembers || asanaUsers.length === 0) {
            setCoordinatorMatch(null);
            return;
        }

        // Find assignments linked to this project with "Project Coordinator" role
        const projectAssignments = allAssignments.filter((assignment) => {
            const linkedProjects = assignment.getCellValue('Project') || [];
            const role = assignment.getCellValueAsString('Role');
            return (
                linkedProjects.some((p) => p.id === selectedRecordId) &&
                role?.toLowerCase().includes('project coordinator')
            );
        });

        if (projectAssignments.length === 0) {
            setCoordinatorMatch(null);
            return;
        }

        // Get the coordinator's name from Data Team Member link
        const coordinatorAssignment = projectAssignments[0];
        const linkedMembers = coordinatorAssignment.getCellValue('Data Team Member') || [];
        if (linkedMembers.length === 0) {
            setCoordinatorMatch(null);
            return;
        }

        // Look up the actual name from Data Team Members table
        const memberRecord = allDataTeamMembers.find((m) => m.id === linkedMembers[0].id);
        const coordinatorName = memberRecord?.getCellValueAsString('Full Name');

        if (!coordinatorName) {
            setCoordinatorMatch(null);
            return;
        }

        // Find matching Asana user
        const match = findBestUserMatch(coordinatorName, asanaUsers);
        setCoordinatorMatch(
            match
                ? { name: coordinatorName, asanaUser: match.user, score: match.score, matchType: match.matchType }
                : { name: coordinatorName, asanaUser: null, score: 0, matchType: 'no_match' }
        );
    }, [selectedRecordId, assignmentIds, teamMemberIds, asanaUsers.length]);

    // Find Project Owner for selected project (from Project Owners field in Projects table)
    // NOTE: Using stable ID strings in deps instead of array refs to prevent infinite re-renders
    useEffect(() => {
        if (!selectedRecordId || !records || !allDataTeamMembers || asanaUsers.length === 0) {
            setOwnerMatch(null);
            return;
        }

        // Find the selected project record
        const selectedProject = records.find((r) => r.id === selectedRecordId);
        if (!selectedProject) {
            setOwnerMatch(null);
            return;
        }

        // Get Project Owners from the linked field
        const projectOwners = selectedProject.getCellValue('Project Owners') || [];
        if (projectOwners.length === 0) {
            setOwnerMatch(null);
            return;
        }

        // Get the first owner's name from Data Team Members table
        const ownerRecord = allDataTeamMembers.find((m) => m.id === projectOwners[0].id);
        const ownerName = ownerRecord?.getCellValueAsString('Full Name');

        if (!ownerName) {
            setOwnerMatch(null);
            return;
        }

        // Find matching Asana user
        const match = findBestUserMatch(ownerName, asanaUsers);
        setOwnerMatch(
            match
                ? { name: ownerName, asanaUser: match.user, score: match.score, matchType: match.matchType }
                : { name: ownerName, asanaUser: null, score: 0, matchType: 'no_match' }
        );
    }, [selectedRecordId, projectIds, teamMemberIds, asanaUsers.length]);

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

    // Test and save Asana PAT
    async function handleTestAndSavePat() {
        if (!patInput.trim()) {
            setPatStatus({ type: 'error', message: 'Please enter a PAT' });
            return;
        }

        setIsTestingPat(true);
        setPatStatus(null);

        try {
            const userData = await validateAsanaPat(patInput.trim());
            await globalConfig.setAsync(ASANA_PAT_KEY, patInput.trim());

            // Store workspace GID for user lookups
            if (userData.workspaces?.length > 0) {
                setWorkspaceGid(userData.workspaces[0].gid);
            }

            setPatStatus({ type: 'success', message: `Connected as ${userData.name} (${userData.email})` });
            setPatInput(''); // Clear input after save
        } catch (err) {
            setPatStatus({ type: 'error', message: err.message });
        } finally {
            setIsTestingPat(false);
        }
    }

    // Clear stored PAT
    async function handleClearPat() {
        await globalConfig.setAsync(ASANA_PAT_KEY, undefined);
        setWorkspaceGid(null);
        setAsanaUsers([]);
        setCoordinatorMatch(null);
        setOwnerMatch(null);
        setPatStatus({ type: 'success', message: 'PAT removed' });
    }

    // Track member addition status
    const [memberAddStatus, setMemberAddStatus] = useState(null);
    // { attempted: boolean, succeeded: string[], failed: string[], projectGid: string }

    // Create Asana project from template with team members
    async function handleCreateAsanaProject() {
        if (!storedPat || !storedTeamGid) {
            setError('Asana PAT and Team GID must be configured in Settings');
            return;
        }

        setCreatingProject(true);
        setError(null);
        setStatus(null);
        setMemberAddStatus(null);

        try {
            // Get project start date if available
            const projectStartDate = selectedRecord?.getCellValue('Start Date') || null;

            // Build role assignments for template roles
            const roleAssignments = [];
            if (coordinatorMatch?.asanaUser?.gid) {
                roleAssignments.push({
                    roleName: 'coordinator',
                    userGid: coordinatorMatch.asanaUser.gid,
                });
            }
            if (ownerMatch?.asanaUser?.gid) {
                roleAssignments.push({
                    roleName: 'owner',
                    userGid: ownerMatch.asanaUser.gid,
                });
                // Also try "lead" mapping for owner
                roleAssignments.push({
                    roleName: 'lead',
                    userGid: ownerMatch.asanaUser.gid,
                });
            }

            // 1. Create project from template with role assignments
            const projectGid = await createProjectFromTemplate(
                storedPat,
                ASANA_TEMPLATE_GID,
                selectedProjectName,
                storedTeamGid,
                projectStartDate,
                roleAssignments
            );

            // 2. Save project URL to Airtable first (so we don't lose it if member add fails)
            const projectUrl = `https://app.asana.com/0/${projectGid}/list`;
            await projectsTable.updateRecordAsync(selectedRecordId, {
                'Asana Board': projectUrl,
            });

            // 3. Collect members to add (coordinator + owner)
            const membersToAdd = [
                coordinatorMatch?.asanaUser ? { name: coordinatorMatch.asanaUser.name, gid: coordinatorMatch.asanaUser.gid, role: 'Coordinator' } : null,
                ownerMatch?.asanaUser ? { name: ownerMatch.asanaUser.name, gid: ownerMatch.asanaUser.gid, role: 'Owner' } : null,
            ].filter(Boolean);

            // Remove duplicates by GID
            const uniqueMembers = membersToAdd.filter((m, i, arr) =>
                arr.findIndex(x => x.gid === m.gid) === i
            );

            // 4. Try to add members (gracefully handle failure)
            const succeeded = [];
            const failed = [];

            if (uniqueMembers.length > 0) {
                try {
                    await addProjectMembers(storedPat, projectGid, uniqueMembers.map(m => m.gid));
                    succeeded.push(...uniqueMembers);
                } catch (memberErr) {
                    console.error('[Asana API] Failed to add members:', memberErr);
                    failed.push(...uniqueMembers.map(m => ({ ...m, error: memberErr.message })));
                }
            }

            setMemberAddStatus({
                attempted: uniqueMembers.length > 0,
                succeeded: succeeded.map(m => `${m.name} (${m.role})`),
                failed: failed.map(m => `${m.name} (${m.role})`),
                projectGid,
            });

            // Build status message
            let statusMsg = `✓ Created Asana project "${selectedProjectName}"`;
            if (succeeded.length > 0) {
                statusMsg += ` with members: ${succeeded.map(m => m.name).join(', ')}`;
            }
            setStatus(statusMsg);

            if (failed.length > 0) {
                setError(`Note: Failed to add some members: ${failed.map(m => m.name).join(', ')}. You can retry below.`);
            }
        } catch (err) {
            setError(`Failed to create project: ${err.message}`);
        } finally {
            setCreatingProject(false);
        }
    }

    // Retry adding members to an existing project
    async function handleRetryAddMembers() {
        if (!storedPat || !asanaProjectGid) return;

        const membersToAdd = [
            coordinatorMatch?.asanaUser ? { name: coordinatorMatch.asanaUser.name, gid: coordinatorMatch.asanaUser.gid, role: 'Coordinator' } : null,
            ownerMatch?.asanaUser ? { name: ownerMatch.asanaUser.name, gid: ownerMatch.asanaUser.gid, role: 'Owner' } : null,
        ].filter(Boolean);

        const uniqueMembers = membersToAdd.filter((m, i, arr) =>
            arr.findIndex(x => x.gid === m.gid) === i
        );

        if (uniqueMembers.length === 0) {
            setError('No matched Asana users to add. Ensure Project Coordinator and/or Owner are set and matched.');
            return;
        }

        setError(null);
        setStatus(null);

        try {
            await addProjectMembers(storedPat, asanaProjectGid, uniqueMembers.map(m => m.gid));
            setMemberAddStatus({
                attempted: true,
                succeeded: uniqueMembers.map(m => `${m.name} (${m.role})`),
                failed: [],
                projectGid: asanaProjectGid,
            });
            setStatus(`✓ Added members: ${uniqueMembers.map(m => m.name).join(', ')}`);
        } catch (err) {
            setError(`Failed to add members: ${err.message}`);
        }
    }

    // Create Asana task for a milestone
    async function handleCreateMilestoneTask(milestone, projectGid) {
        const milestoneId = milestone.id;

        setMilestoneStatuses((prev) => ({
            ...prev,
            [milestoneId]: { status: 'creating' },
        }));

        try {
            const milestoneData = {
                name: milestone.getCellValueAsString('Milestone'),
                description: milestone.getCellValueAsString('Description') || '',
                dueDate: milestone.getCellValue('Due Date') || null,
            };

            // Use coordinator's Asana GID if we have a match
            const assigneeGid = coordinatorMatch?.asanaUser?.gid || null;

            const { taskUrl } = await createAsanaTask(storedPat, projectGid, milestoneData, assigneeGid);

            // Write task URL back to milestone record if field exists
            if (asanaUrlField && milestonesTable) {
                await milestonesTable.updateRecordAsync(milestone.id, {
                    'Asana URL': taskUrl,
                });
            }

            setMilestoneStatuses((prev) => ({
                ...prev,
                [milestoneId]: { status: 'success', taskUrl },
            }));

            const assigneeNote = assigneeGid ? ` (assigned to ${coordinatorMatch.asanaUser.name})` : '';
            setStatus(`✓ Created Asana task for "${milestoneData.name}"${assigneeNote}`);
        } catch (err) {
            setMilestoneStatuses((prev) => ({
                ...prev,
                [milestoneId]: { status: 'error', error: err.message },
            }));
            setError(`Failed to create task: ${err.message}`);
        }
    }

    // Build record options for select (memoized)
    const recordOptions = useMemo(
        () =>
            records?.map((record) => ({
                value: record.id,
                label: record.getCellValueAsString('Project') || '(unnamed)',
            })) || [],
        [records]
    );

    // Get the currently selected record and its Asana Board value
    const selectedRecord = useMemo(
        () => (selectedRecordId ? records?.find((r) => r.id === selectedRecordId) : null),
        [selectedRecordId, records]
    );
    const existingAsanaBoard = selectedRecord?.getCellValueAsString('Asana Board') || '';
    const asanaProjectGid = parseAsanaProjectGid(existingAsanaBoard);
    const selectedProjectName = selectedRecord?.getCellValueAsString('Project') || '';

    // Get linked milestone records for the selected project (memoized)
    const linkedMilestoneIds = useMemo(
        () => selectedRecord?.getCellValue('Milestones')?.map((link) => link.id) || [],
        [selectedRecord]
    );
    const projectMilestones = useMemo(
        () => allMilestones?.filter((m) => linkedMilestoneIds.includes(m.id)) || [],
        [allMilestones, linkedMilestoneIds]
    );

    // Legacy: names from rollup (fallback)
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

            {/* Settings Section */}
            <Box marginBottom={3}>
                <Button
                    onClick={() => setShowSettings(!showSettings)}
                    icon={showSettings ? 'chevronUp' : 'cog'}
                    variant="secondary"
                    size="small"
                >
                    {showSettings ? 'Hide Settings' : 'Asana Settings'}
                    {hasAsanaConfig && !showSettings && ' ✓'}
                </Button>

                {showSettings && (
                    <Box
                        marginTop={2}
                        padding={3}
                        backgroundColor={colors.GRAY_LIGHT_2}
                        borderRadius={3}
                    >
                        <Heading size="xsmall" marginBottom={2}>
                            Asana API Configuration
                        </Heading>

                        {hasAsanaConfig ? (
                            <Box>
                                <Text marginBottom={2} textColor="green">
                                    ✓ Asana PAT configured
                                </Text>
                                <Button
                                    onClick={handleClearPat}
                                    icon="x"
                                    variant="danger"
                                    size="small"
                                >
                                    Remove PAT
                                </Button>
                            </Box>
                        ) : (
                            <Box>
                                <Text size="small" marginBottom={2}>
                                    Enter your Asana Personal Access Token to enable direct task creation.
                                </Text>
                                <Text size="small" textColor="light" marginBottom={2}>
                                    Get a PAT from{' '}
                                    <a
                                        href="https://app.asana.com/0/developer-console"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        Asana Developer Console
                                    </a>
                                </Text>
                                <Box display="flex" alignItems="center" marginBottom={2}>
                                    <Input
                                        type="password"
                                        value={patInput}
                                        onChange={(e) => setPatInput(e.target.value)}
                                        placeholder="Enter PAT..."
                                        width="100%"
                                    />
                                    <Button
                                        onClick={handleTestAndSavePat}
                                        disabled={!patInput || isTestingPat}
                                        variant="primary"
                                        marginLeft={2}
                                        size="small"
                                    >
                                        {isTestingPat ? 'Testing...' : 'Save'}
                                    </Button>
                                </Box>
                                <Text size="small" textColor="orange">
                                    ⚠️ Note: PAT is stored in base config and visible to all collaborators.
                                </Text>
                            </Box>
                        )}

                        {patStatus && (
                            <Box
                                marginTop={2}
                                padding={2}
                                backgroundColor={patStatus.type === 'error' ? colors.RED_LIGHT_2 : colors.GREEN_LIGHT_2}
                                borderRadius={2}
                            >
                                <Text textColor={patStatus.type === 'error' ? 'red' : 'green'}>
                                    {patStatus.message}
                                </Text>
                            </Box>
                        )}

                        {/* Team GID Configuration */}
                        {hasAsanaConfig && (
                            <Box marginTop={3}>
                                <Text size="small" fontWeight="strong" marginBottom={1}>
                                    Asana Team GID
                                </Text>
                                {storedTeamGid ? (
                                    <Box display="flex" alignItems="center">
                                        <Text size="small" textColor="green" marginRight={2}>
                                            ✓ Team GID: {storedTeamGid}
                                        </Text>
                                        <Button
                                            onClick={async () => {
                                                await globalConfig.setAsync(ASANA_TEAM_GID_KEY, undefined);
                                            }}
                                            icon="x"
                                            variant="secondary"
                                            size="small"
                                        >
                                            Clear
                                        </Button>
                                    </Box>
                                ) : (
                                    <Box>
                                        <Box display="flex" alignItems="center" marginBottom={1}>
                                            <Input
                                                value={teamGidInput}
                                                onChange={(e) => setTeamGidInput(e.target.value)}
                                                placeholder="Enter Team GID..."
                                                width="100%"
                                            />
                                            <Button
                                                onClick={async () => {
                                                    if (teamGidInput.trim()) {
                                                        await globalConfig.setAsync(ASANA_TEAM_GID_KEY, teamGidInput.trim());
                                                        setTeamGidInput('');
                                                    }
                                                }}
                                                disabled={!teamGidInput.trim()}
                                                variant="primary"
                                                marginLeft={2}
                                                size="small"
                                            >
                                                Save
                                            </Button>
                                        </Box>
                                        <Text size="small" textColor="light">
                                            Find your team GID in the URL: app.asana.com/0/TEAM_GID/...
                                        </Text>
                                    </Box>
                                )}
                            </Box>
                        )}

                        {!asanaUrlField && milestonesTable && (
                            <Box
                                marginTop={2}
                                padding={2}
                                backgroundColor={colors.YELLOW_LIGHT_2}
                                borderRadius={2}
                            >
                                <Text size="small">
                                    ⚠️ Add an "Asana URL" field (type: URL) to the Milestones table to save task links.
                                </Text>
                            </Box>
                        )}
                    </Box>
                )}
            </Box>

            <FormField label="Select Project" marginBottom={3}>
                <Select
                    options={recordOptions}
                    value={selectedRecordId}
                    onChange={(value) => {
                        setSelectedRecordId(value);
                        setStatus(null);
                        setError(null);
                        setAsanaBoardUrl('');
                        setMilestoneStatuses({});
                        setCoordinatorMatch(null);
                        setOwnerMatch(null);
                        setMemberAddStatus(null);
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
                            {/* Step 1: Create project - via API if configured, otherwise open template */}
                            <Box marginBottom={3}>
                                <Text marginBottom={2}>
                                    {hasFullAsanaConfig
                                        ? `Create an Asana project for "${selectedProjectName}":`
                                        : <><strong>Step 1:</strong> Create an Asana project for "{selectedProjectName}":</>
                                    }
                                </Text>
                                {hasFullAsanaConfig ? (
                                    <Button
                                        onClick={handleCreateAsanaProject}
                                        disabled={creatingProject}
                                        icon={creatingProject ? undefined : 'plus'}
                                        variant="primary"
                                        size="small"
                                    >
                                        {creatingProject ? 'Creating Project...' : 'Create Asana Project'}
                                    </Button>
                                ) : (
                                    <Button
                                        onClick={() => window.open(ASANA_TEMPLATE_URL, '_blank')}
                                        icon="share1"
                                        variant="primary"
                                        size="small"
                                    >
                                        Open Asana Template
                                    </Button>
                                )}
                                {hasAsanaConfig && !storedTeamGid && (
                                    <Text size="small" textColor="orange" marginTop={1}>
                                        Configure Team GID in Settings to enable one-click project creation
                                    </Text>
                                )}
                            </Box>

                            {/* Step 2: Paste URL - only show if not using API */}
                            {!hasFullAsanaConfig && (
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
                            )}
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

                    {/* Role assignment status - show coordinator and/or owner */}
                    {hasAsanaConfig && (coordinatorMatch || ownerMatch) && (
                        <Box
                            marginBottom={2}
                            padding={2}
                            backgroundColor={
                                (coordinatorMatch?.asanaUser || ownerMatch?.asanaUser)
                                    ? colors.GREEN_LIGHT_2
                                    : colors.YELLOW_LIGHT_2
                            }
                            borderRadius={2}
                        >
                            {coordinatorMatch && (
                                <Text size="small" marginBottom={ownerMatch ? 1 : 0}>
                                    <strong>Project Coordinator:</strong> {coordinatorMatch.name}
                                    {coordinatorMatch.asanaUser ? (
                                        <span style={{ color: colors.GREEN }}>
                                            {' '}→ {coordinatorMatch.asanaUser.name} in Asana
                                            {coordinatorMatch.matchType !== 'exact' && ` (${coordinatorMatch.matchType} match)`}
                                        </span>
                                    ) : (
                                        <span style={{ color: colors.ORANGE }}>
                                            {' '}(no matching Asana user found)
                                        </span>
                                    )}
                                </Text>
                            )}
                            {ownerMatch && (
                                <Text size="small">
                                    <strong>Project Owner:</strong> {ownerMatch.name}
                                    {ownerMatch.asanaUser ? (
                                        <span style={{ color: colors.GREEN }}>
                                            {' '}→ {ownerMatch.asanaUser.name} in Asana
                                            {ownerMatch.matchType !== 'exact' && ` (${ownerMatch.matchType} match)`}
                                        </span>
                                    ) : (
                                        <span style={{ color: colors.ORANGE }}>
                                            {' '}(no matching Asana user found)
                                        </span>
                                    )}
                                </Text>
                            )}
                            {coordinatorMatch?.asanaUser && (
                                <Text size="small" textColor="light" marginTop={1}>
                                    Tasks will be auto-assigned to Project Coordinator
                                </Text>
                            )}

                            {/* Add members button - show when board exists and users are matched */}
                            {existingAsanaBoard && asanaProjectGid && (coordinatorMatch?.asanaUser || ownerMatch?.asanaUser) && (
                                <Box marginTop={2}>
                                    <Button
                                        onClick={handleRetryAddMembers}
                                        icon="user"
                                        size="small"
                                        variant="secondary"
                                    >
                                        Add/Update Project Members
                                    </Button>
                                </Box>
                            )}
                        </Box>
                    )}

                    {/* Show message when roles are missing */}
                    {hasAsanaConfig && existingAsanaBoard && !coordinatorMatch && !ownerMatch && (
                        <Box
                            marginBottom={2}
                            padding={2}
                            backgroundColor={colors.YELLOW_LIGHT_2}
                            borderRadius={2}
                        >
                            <Text size="small" textColor="orange">
                                No Project Coordinator or Owner found for this project.
                                Add them in Airtable to enable automatic Asana member assignment.
                            </Text>
                        </Box>
                    )}

                    {/* Milestones section - show when there are milestones */}
                    {projectMilestones.length > 0 && (
                        <Box marginBottom={2}>
                            <Text marginBottom={2}>
                                <strong>Milestones:</strong> Create Asana tasks for these milestones:
                            </Text>
                            <Box
                                padding={2}
                                backgroundColor={colors.WHITE}
                                borderRadius={2}
                            >
                                {projectMilestones.map((milestone, index) => {
                                    const milestoneName = milestone.getCellValueAsString('Milestone');
                                    const milestoneAsanaUrl = milestone.getCellValueAsString('Asana URL');
                                    const milestoneStatus = milestoneStatuses[milestone.id];
                                    const dueDate = milestone.getCellValue('Due Date');

                                    // Determine effective URL (from record or from creation status)
                                    const effectiveUrl = milestoneAsanaUrl || milestoneStatus?.taskUrl;

                                    return (
                                        <Box
                                            key={milestone.id}
                                            display="flex"
                                            alignItems="center"
                                            justifyContent="space-between"
                                            paddingY={1}
                                            borderBottom={index < projectMilestones.length - 1 ? 'default' : 'none'}
                                        >
                                            <Box>
                                                <Text>{milestoneName}</Text>
                                                {dueDate && (
                                                    <Text size="small" textColor="light">
                                                        Due: {formatDate(dueDate)}
                                                    </Text>
                                                )}
                                            </Box>
                                            <Box display="flex" alignItems="center">
                                                {milestoneStatus?.status === 'error' && (
                                                    <Text size="small" textColor="red" marginRight={2}>
                                                        {milestoneStatus.error}
                                                    </Text>
                                                )}
                                                {effectiveUrl ? (
                                                    <Button
                                                        onClick={() => window.open(effectiveUrl, '_blank')}
                                                        icon="share1"
                                                        size="small"
                                                        variant="secondary"
                                                    >
                                                        View in Asana
                                                    </Button>
                                                ) : hasAsanaConfig && asanaProjectGid ? (
                                                    <Button
                                                        onClick={() => handleCreateMilestoneTask(milestone, asanaProjectGid)}
                                                        disabled={milestoneStatus?.status === 'creating'}
                                                        icon={milestoneStatus?.status === 'creating' ? undefined : 'plus'}
                                                        size="small"
                                                        variant="primary"
                                                    >
                                                        {milestoneStatus?.status === 'creating' ? 'Creating...' : 'Create in Asana'}
                                                    </Button>
                                                ) : (
                                                    <Button
                                                        onClick={() => window.open(getAsanaCreateTaskUrl(milestoneName, selectedProjectName), '_blank')}
                                                        icon="plus"
                                                        size="small"
                                                        variant="secondary"
                                                    >
                                                        Create Task
                                                    </Button>
                                                )}
                                            </Box>
                                        </Box>
                                    );
                                })}
                            </Box>
                            {!hasAsanaConfig && (
                                <Text size="small" textColor="light" marginTop={1}>
                                    Configure Asana PAT in Settings for direct task creation.
                                </Text>
                            )}
                            {hasAsanaConfig && !asanaProjectGid && existingAsanaBoard && (
                                <Text size="small" textColor="orange" marginTop={1}>
                                    Could not parse project ID from Asana Board URL.
                                </Text>
                            )}
                        </Box>
                    )}

                    {projectMilestones.length === 0 && (
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
                    1. Configure Asana PAT in Settings (optional, enables direct task creation){'\n'}
                    2. Select a project from the dropdown{'\n'}
                    3. Link the Asana board (create from template or paste existing URL){'\n'}
                    4. Create Asana tasks for milestones (auto-saves task URL to Airtable){'\n'}
                    5. Optionally generate Scope of Work document
                </Text>
            </Box>
        </Box>
    );
}

initializeBlock(() => <ScopeOfWorkGenerator />);
