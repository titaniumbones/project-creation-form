// Airtable API client
import { getValidToken } from './oauth';
import {
  airtableTables,
  airtableProjectFields,
  airtableMilestoneFields,
  airtableAssignmentFields,
  airtableTeamMembersFields,
  airtableProjectDefaults,
  airtableRoleValues,
} from '../config';

const BASE_ID = import.meta.env.VITE_AIRTABLE_BASE_ID;
const API_URL = 'https://api.airtable.com/v0';

async function getAccessToken() {
  const token = await getValidToken('airtable');
  if (!token) {
    throw new Error('Not connected to Airtable. Please connect in Settings.');
  }
  return token;
}

async function airtableRequest(endpoint, options = {}) {
  const token = await getAccessToken();

  const response = await fetch(`${API_URL}/${BASE_ID}/${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || `Airtable request failed: ${response.status}`);
  }

  return response.json();
}

// Get records from a table
export async function getRecords(tableName, options = {}) {
  const params = new URLSearchParams();

  if (options.fields) {
    options.fields.forEach(f => params.append('fields[]', f));
  }
  if (options.filterByFormula) {
    params.set('filterByFormula', options.filterByFormula);
  }
  if (options.sort) {
    options.sort.forEach((s, i) => {
      params.set(`sort[${i}][field]`, s.field);
      params.set(`sort[${i}][direction]`, s.direction || 'asc');
    });
  }
  if (options.maxRecords) {
    params.set('maxRecords', options.maxRecords);
  }

  const queryString = params.toString();
  const endpoint = `${encodeURIComponent(tableName)}${queryString ? `?${queryString}` : ''}`;

  const data = await airtableRequest(endpoint);
  return data.records || [];
}

// Get team members for role assignment
export async function getTeamMembers() {
  const tableName = airtableTables.team_members || 'Data Team Members';
  const nameField = airtableTeamMembersFields.name || 'Full Name';

  const records = await getRecords(tableName, {
    fields: [nameField],
    sort: [{ field: nameField, direction: 'asc' }],
  });

  return records.map(r => ({
    id: r.id,
    name: r.fields[nameField],
  }));
}

// Create a project record
export async function createProject(projectData) {
  const tableName = airtableTables.projects || 'Projects';
  const f = airtableProjectFields;
  const defaults = airtableProjectDefaults;

  const data = await airtableRequest(encodeURIComponent(tableName), {
    method: 'POST',
    body: JSON.stringify({
      fields: {
        [f.name || 'Project']: projectData.name,
        [f.acronym || 'Project Acronym']: projectData.acronym || '',
        [f.description || 'Project Description']: projectData.description || '',
        [f.objectives || 'Objectives']: projectData.objectives || '',
        [f.start_date || 'Start Date']: projectData.startDate || null,
        [f.end_date || 'End Date']: projectData.endDate || null,
        [f.status || 'Status']: defaults.status || 'In Ideation',
      },
    }),
  });

  return data;
}

// Create milestone records linked to a project
export async function createMilestones(projectId, milestones) {
  if (!milestones || milestones.length === 0) return [];

  const tableName = airtableTables.milestones || 'Milestones';
  const f = airtableMilestoneFields;

  // Airtable batch create (max 10 per request)
  const batches = [];
  for (let i = 0; i < milestones.length; i += 10) {
    batches.push(milestones.slice(i, i + 10));
  }

  const results = [];
  for (const batch of batches) {
    const records = batch.map(m => ({
      fields: {
        [f.name || 'Milestone']: m.name,
        [f.description || 'Description']: m.description || '',
        [f.due_date || 'Due Date']: m.dueDate || null,
        [f.project_link || 'Project']: [projectId],
      },
    }));

    const data = await airtableRequest(encodeURIComponent(tableName), {
      method: 'POST',
      body: JSON.stringify({ records }),
    });

    results.push(...(data.records || []));
  }

  return results;
}

// Create assignment records (role -> team member -> project)
// roleAssignments: { role: { memberId, fte } } or { role: [{ memberId, fte }] }
export async function createAssignments(projectId, roleAssignments) {
  if (!roleAssignments || Object.keys(roleAssignments).length === 0) return [];

  const tableName = airtableTables.assignments || 'Assignments';
  const f = airtableAssignmentFields;
  const roleValues = airtableRoleValues;

  // Flatten role assignments into individual records
  const records = [];
  for (const [roleKey, assignment] of Object.entries(roleAssignments)) {
    // Map form role key to Airtable Role field value using config
    const role = roleValues[roleKey] || 'Other';
    if (!assignment) continue;

    // Handle both single assignment and array of assignments
    const assignments = Array.isArray(assignment) ? assignment : [assignment];

    for (const { memberId, fte } of assignments) {
      if (!memberId) continue;

      const fields = {
        [f.role || 'Role']: role,
        [f.team_member_link || 'Data Team Member']: [memberId],
        [f.project_link || 'Project']: [projectId],
      };

      if (fte !== undefined && fte !== null && fte !== '') {
        fields[f.fte || 'FTE'] = parseFloat(fte);
      }

      records.push({ fields });
    }
  }

  if (records.length === 0) return [];

  // Batch create (max 10 per request)
  const batches = [];
  for (let i = 0; i < records.length; i += 10) {
    batches.push(records.slice(i, i + 10));
  }

  const results = [];
  for (const batch of batches) {
    const data = await airtableRequest(encodeURIComponent(tableName), {
      method: 'POST',
      body: JSON.stringify({ records: batch }),
    });

    results.push(...(data.records || []));
  }

  return results;
}

// Update a record
export async function updateRecord(tableName, recordId, fields) {
  const data = await airtableRequest(`${encodeURIComponent(tableName)}/${recordId}`, {
    method: 'PATCH',
    body: JSON.stringify({ fields }),
  });

  return data;
}

// Export config for use in other modules
export { airtableProjectFields, airtableTables };

export default {
  getRecords,
  getTeamMembers,
  createProject,
  createMilestones,
  createAssignments,
  updateRecord,
};
