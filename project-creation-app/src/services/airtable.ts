// Airtable API client
import { getValidToken } from './oauth';
import { debugLogger } from './debugLogger';
import {
  airtableTables,
  airtableProjectFields,
  airtableMilestoneFields,
  airtableAssignmentFields,
  airtableTeamMembersFields,
  airtableProjectDefaults,
  airtableRoleValues,
} from '../config';
import type { AirtableRecord, TeamMember, RoleAssignment } from '../types';

const BASE_ID = import.meta.env.VITE_AIRTABLE_BASE_ID;
const API_URL = 'https://api.airtable.com/v0';

interface GetRecordsOptions {
  fields?: string[];
  filterByFormula?: string;
  sort?: Array<{ field: string; direction?: 'asc' | 'desc' }>;
  maxRecords?: number;
}

interface AirtableRequestOptions {
  method?: string;
  body?: string;
  headers?: Record<string, string>;
}

interface ProjectData {
  name: string;
  acronym?: string;
  description?: string;
  objectives?: string;
  startDate?: string;
  endDate?: string;
}

interface MilestoneData {
  name: string;
  description?: string;
  dueDate?: string;
}

interface ProjectExistsResult {
  exists: boolean;
  existingRecord: AirtableRecord | null;
  url: string | null;
}

async function getAccessToken(): Promise<string> {
  const token = await getValidToken('airtable');
  if (!token) {
    throw new Error('Not connected to Airtable. Please connect in Settings.');
  }
  return token;
}

async function airtableRequest(endpoint: string, options: AirtableRequestOptions = {}): Promise<unknown> {
  const token = await getAccessToken();
  const method = options.method || 'GET';
  const payload = options.body ? JSON.parse(options.body) : null;

  debugLogger.logApiRequest('airtable', endpoint, method, payload);

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
    const errorMsg = error.error?.message || `Airtable request failed: ${response.status}`;
    debugLogger.logApiResponse('airtable', endpoint, error, new Error(errorMsg));
    throw new Error(errorMsg);
  }

  const result = await response.json();
  debugLogger.logApiResponse('airtable', endpoint, result);
  return result;
}

// Get records from a table
export async function getRecords(tableName: string, options: GetRecordsOptions = {}): Promise<AirtableRecord[]> {
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
    params.set('maxRecords', String(options.maxRecords));
  }

  const queryString = params.toString();
  const endpoint = `${encodeURIComponent(tableName)}${queryString ? `?${queryString}` : ''}`;

  const data = await airtableRequest(endpoint) as { records?: AirtableRecord[] };
  return data.records || [];
}

// Get team members for role assignment
export async function getTeamMembers(): Promise<TeamMember[]> {
  const tableName = airtableTables.team_members || 'Data Team Members';
  const nameField = airtableTeamMembersFields.name || 'Full Name';

  const records = await getRecords(tableName, {
    fields: [nameField],
    sort: [{ field: nameField, direction: 'asc' }],
  });

  return records.map(r => ({
    id: r.id,
    name: r.fields[nameField] as string,
  }));
}

// Create a project record
export async function createProject(projectData: ProjectData): Promise<AirtableRecord> {
  const tableName = airtableTables.projects || 'Projects';
  const f = airtableProjectFields;
  const defaults = airtableProjectDefaults;

  // Log incoming data and field mappings
  debugLogger.logTransform('projectData', 'airtableFields', projectData, {
    tableName,
    fieldMappings: f,
    defaults,
  });

  const fields: Record<string, unknown> = {
    [f.name || 'Project']: projectData.name,
    [f.acronym || 'Project Acronym']: projectData.acronym || '',
    [f.description || 'Project Description']: projectData.description || '',
    [f.objectives || 'Objectives']: projectData.objectives || '',
    [f.start_date || 'Start Date']: projectData.startDate || null,
    [f.end_date || 'End Date']: projectData.endDate || null,
    [f.status || 'Status']: defaults.status || 'In Ideation',
  };

  // Log the exact fields being sent
  debugLogger.log('airtable', 'Creating project with fields', {
    tableName,
    fields,
    fieldDetails: Object.entries(fields).map(([key, value]) => ({
      fieldName: key,
      value: typeof value === 'string' && value.length > 100 ? value.substring(0, 100) + '...' : value,
      valueType: typeof value,
      valueLength: typeof value === 'string' ? value.length : null,
    })),
  });

  const data = await airtableRequest(encodeURIComponent(tableName), {
    method: 'POST',
    body: JSON.stringify({ fields }),
  });

  return data as AirtableRecord;
}

// Create milestone records linked to a project
export async function createMilestones(projectId: string, milestones: MilestoneData[]): Promise<AirtableRecord[]> {
  if (!milestones || milestones.length === 0) return [];

  const tableName = airtableTables.milestones || 'Milestones';
  const f = airtableMilestoneFields;

  // Airtable batch create (max 10 per request)
  const batches: MilestoneData[][] = [];
  for (let i = 0; i < milestones.length; i += 10) {
    batches.push(milestones.slice(i, i + 10));
  }

  const results: AirtableRecord[] = [];
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
    }) as { records?: AirtableRecord[] };

    results.push(...(data.records || []));
  }

  return results;
}

// Create assignment records (role -> team member -> project)
// roleAssignments: { role: { memberId, fte } } or { role: [{ memberId, fte }] }
export async function createAssignments(
  projectId: string,
  roleAssignments: Record<string, RoleAssignment | RoleAssignment[]>
): Promise<AirtableRecord[]> {
  if (!roleAssignments || Object.keys(roleAssignments).length === 0) return [];

  const tableName = airtableTables.assignments || 'Assignments';
  const f = airtableAssignmentFields;
  const roleValues = airtableRoleValues;

  // Flatten role assignments into individual records
  const records: Array<{ fields: Record<string, unknown> }> = [];
  for (const [roleKey, assignment] of Object.entries(roleAssignments)) {
    // Map form role key to Airtable Role field value using config
    const role = roleValues[roleKey] || 'Other';
    if (!assignment) continue;

    // Handle both single assignment and array of assignments
    const assignments = Array.isArray(assignment) ? assignment : [assignment];

    for (const { memberId, fte } of assignments) {
      if (!memberId) continue;

      const fields: Record<string, unknown> = {
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
  const batches: Array<Array<{ fields: Record<string, unknown> }>> = [];
  for (let i = 0; i < records.length; i += 10) {
    batches.push(records.slice(i, i + 10));
  }

  const results: AirtableRecord[] = [];
  for (const batch of batches) {
    const data = await airtableRequest(encodeURIComponent(tableName), {
      method: 'POST',
      body: JSON.stringify({ records: batch }),
    }) as { records?: AirtableRecord[] };

    results.push(...(data.records || []));
  }

  return results;
}

// Update a record
export async function updateRecord(
  tableName: string,
  recordId: string,
  fields: Record<string, unknown>
): Promise<AirtableRecord> {
  const data = await airtableRequest(`${encodeURIComponent(tableName)}/${recordId}`, {
    method: 'PATCH',
    body: JSON.stringify({ fields }),
  });

  return data as AirtableRecord;
}

// Check if a project with this name already exists
export async function checkProjectExists(projectName: string): Promise<ProjectExistsResult> {
  const tableName = airtableTables.projects || 'Projects';
  const nameField = airtableProjectFields.name || 'Project';

  debugLogger.log('airtable', 'Checking for existing project', { projectName });

  const records = await getRecords(tableName, {
    filterByFormula: `{${nameField}} = "${projectName.replace(/"/g, '\\"')}"`,
    maxRecords: 1,
  });

  const result: ProjectExistsResult = {
    exists: records.length > 0,
    existingRecord: records[0] || null,
    url: records[0] ? `https://airtable.com/${BASE_ID}/${records[0].id}` : null,
  };

  debugLogger.log('airtable', 'Duplicate check result', result);
  return result;
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
  checkProjectExists,
};
