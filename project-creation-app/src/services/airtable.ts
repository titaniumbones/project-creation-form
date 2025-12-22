// Airtable API client
import { getValidToken } from './oauth';
import { debugLogger } from './debugLogger';
import {
  airtableTables,
  airtableTableIds,
  airtableViewIds,
  airtableProjectFields,
  airtableMilestoneFields,
  airtableAssignmentFields,
  airtableTeamMembersFields,
  airtableProjectDefaults,
  airtableRoleValues,
  airtableFunderFields,
  airtableParentInitiativeFields,
} from '../config';
import type { AirtableRecord, TeamMember, RoleAssignment, Funder, ParentInitiative } from '../types';

const BASE_ID = import.meta.env.VITE_AIRTABLE_BASE_ID;
const API_URL = 'https://api.airtable.com/v0';

/**
 * Build an Airtable record URL.
 * Format: https://airtable.com/{baseId}/{tableId}/{viewId}/{recordId}
 * Falls back gracefully if table/view IDs aren't configured.
 */
export function getRecordUrl(recordId: string, tableKey: string = 'projects'): string {
  const tableId = airtableTableIds[tableKey];
  const viewId = airtableViewIds[tableKey];

  // Table ID is required for working URLs
  if (!tableId) {
    console.warn(`[Airtable] No table ID configured for "${tableKey}". URL may not work.`);
    const tableName = airtableTables[tableKey] || 'Projects';
    return `https://airtable.com/${BASE_ID}/${tableName}/${recordId}`;
  }

  // Build URL with view ID if available
  if (viewId) {
    return `https://airtable.com/${BASE_ID}/${tableId}/${viewId}/${recordId}`;
  }

  // Without view ID, Airtable will use the default view
  return `https://airtable.com/${BASE_ID}/${tableId}/${recordId}`;
}

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
  funder?: string;
  parentInitiative?: string;
  projectType?: string;
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

// Get funders for project assignment
export async function getFunders(): Promise<Funder[]> {
  const tableName = airtableTables.funders || 'Funders';
  const nameField = airtableFunderFields.name || 'Name';

  debugLogger.log('airtable', 'Fetching funders', { tableName, nameField });

  const records = await getRecords(tableName, {
    fields: [nameField],
    sort: [{ field: nameField, direction: 'asc' }],
  });

  debugLogger.log('airtable', 'Funders fetched', { count: records.length });

  return records.map(r => ({
    id: r.id,
    name: r.fields[nameField] as string,
  }));
}

// Get parent initiatives for project assignment
export async function getParentInitiatives(): Promise<ParentInitiative[]> {
  const tableName = airtableTables.parent_initiatives || 'Parent Initiatives';
  const nameField = airtableParentInitiativeFields.name || 'Name';

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

  // Add optional linked record fields (Airtable expects array for linked records)
  if (projectData.funder) {
    fields[f.funder || 'Funder'] = [projectData.funder];
  }
  if (projectData.parentInitiative) {
    fields[f.parent_initiative || 'Parent Initiative'] = [projectData.parentInitiative];
  }
  // Add optional single-select field
  if (projectData.projectType) {
    fields[f.project_type || 'Project Type'] = projectData.projectType;
  }

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

// Check if a project with this name already exists (substring match)
export async function checkProjectExists(projectName: string): Promise<ProjectExistsResult> {
  const tableName = airtableTables.projects || 'Projects';
  const nameField = airtableProjectFields.name || 'Project';

  // Escape special characters for Airtable formula
  const escapedName = projectName.replace(/"/g, '\\"').replace(/\\/g, '\\\\');

  // Use FIND for case-insensitive substring match
  // FIND returns 0 if not found, >0 if found
  const filterFormula = `OR(FIND(LOWER("${escapedName}"), LOWER({${nameField}})) > 0, FIND(LOWER({${nameField}}), LOWER("${escapedName}")) > 0)`;
  console.log('[Airtable Search] Filter formula (substring):', filterFormula);

  debugLogger.log('airtable', 'Checking for existing project', { projectName, filterFormula });

  const records = await getRecords(tableName, {
    filterByFormula: filterFormula,
    maxRecords: 5, // Get up to 5 matches for substring
  });

  console.log('[Airtable Search] Results:', {
    recordsFound: records.length,
    records: records.map(r => ({
      id: r.id,
      name: r.fields[nameField],
    })),
  });

  const result: ProjectExistsResult = {
    exists: records.length > 0,
    existingRecord: records[0] || null,
    url: records[0] ? getRecordUrl(records[0].id, 'projects') : null,
  };

  debugLogger.log('airtable', 'Duplicate check result', result);
  return result;
}

// Search projects by name (substring match) - returns multiple results for selection
export interface ProjectSearchResult {
  id: string;
  name: string;
  acronym?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
  url: string;
}

export async function searchProjects(searchTerm: string, maxResults: number = 10): Promise<ProjectSearchResult[]> {
  const tableName = airtableTables.projects || 'Projects';
  const f = airtableProjectFields;
  const nameField = f.name || 'Project';

  // Escape special characters for Airtable formula
  const escapedTerm = searchTerm.replace(/"/g, '\\"').replace(/\\/g, '\\\\');

  // Use FIND for case-insensitive substring match
  const filterFormula = `OR(FIND(LOWER("${escapedTerm}"), LOWER({${nameField}})) > 0, FIND(LOWER({${nameField}}), LOWER("${escapedTerm}")) > 0)`;

  debugLogger.log('airtable', 'Searching projects', { searchTerm, filterFormula });

  const records = await getRecords(tableName, {
    fields: [
      nameField,
      f.acronym || 'Project Acronym',
      f.start_date || 'Start Date',
      f.end_date || 'End Date',
      f.status || 'Status',
    ],
    filterByFormula: filterFormula,
    maxRecords: maxResults,
    sort: [{ field: nameField, direction: 'asc' }],
  });

  return records.map(r => ({
    id: r.id,
    name: r.fields[nameField] as string,
    acronym: r.fields[f.acronym || 'Project Acronym'] as string | undefined,
    startDate: r.fields[f.start_date || 'Start Date'] as string | undefined,
    endDate: r.fields[f.end_date || 'End Date'] as string | undefined,
    status: r.fields[f.status || 'Status'] as string | undefined,
    url: getRecordUrl(r.id, 'projects'),
  }));
}

// Get a single project record by ID with full details
export interface FullProjectData {
  id: string;
  name: string;
  acronym?: string;
  description?: string;
  objectives?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
  funder?: string[];
  parentInitiative?: string[];
  projectType?: string;
  asanaUrl?: string;
  scopingDocUrl?: string;
  folderUrl?: string;
  url: string;
}

export async function getProjectById(projectId: string): Promise<FullProjectData | null> {
  const tableName = airtableTables.projects || 'Projects';
  const f = airtableProjectFields;

  try {
    const data = await airtableRequest(`${encodeURIComponent(tableName)}/${projectId}`) as AirtableRecord;

    return {
      id: data.id,
      name: data.fields[f.name || 'Project'] as string,
      acronym: data.fields[f.acronym || 'Project Acronym'] as string | undefined,
      description: data.fields[f.description || 'Project Description'] as string | undefined,
      objectives: data.fields[f.objectives || 'Objectives'] as string | undefined,
      startDate: data.fields[f.start_date || 'Start Date'] as string | undefined,
      endDate: data.fields[f.end_date || 'End Date'] as string | undefined,
      status: data.fields[f.status || 'Status'] as string | undefined,
      funder: data.fields[f.funder || 'Funder'] as string[] | undefined,
      parentInitiative: data.fields[f.parent_initiative || 'Parent Initiative'] as string[] | undefined,
      projectType: data.fields[f.project_type || 'Project Type'] as string | undefined,
      asanaUrl: data.fields[f.asana_url || 'Asana Board'] as string | undefined,
      scopingDocUrl: data.fields[f.scoping_doc_url || 'Project Scope'] as string | undefined,
      folderUrl: data.fields[f.folder_url || 'Project Folder'] as string | undefined,
      url: getRecordUrl(data.id, 'projects'),
    };
  } catch (error) {
    debugLogger.log('error', 'Failed to fetch project by ID', { projectId, error });
    return null;
  }
}

// Get milestones for a project
export interface MilestoneRecord {
  id: string;
  name: string;
  description?: string;
  dueDate?: string;
}

export async function getProjectMilestones(projectId: string): Promise<MilestoneRecord[]> {
  const tableName = airtableTables.milestones || 'Milestones';
  const f = airtableMilestoneFields;
  const projectLinkField = f.project_link || 'Project';

  // Filter by project link
  const filterFormula = `FIND("${projectId}", ARRAYJOIN({${projectLinkField}})) > 0`;

  const records = await getRecords(tableName, {
    fields: [
      f.name || 'Milestone',
      f.description || 'Description',
      f.due_date || 'Due Date',
    ],
    filterByFormula: filterFormula,
    sort: [{ field: f.due_date || 'Due Date', direction: 'asc' }],
  });

  return records.map(r => ({
    id: r.id,
    name: r.fields[f.name || 'Milestone'] as string,
    description: r.fields[f.description || 'Description'] as string | undefined,
    dueDate: r.fields[f.due_date || 'Due Date'] as string | undefined,
  }));
}

// Get assignments for a project
export interface AssignmentRecord {
  id: string;
  role: string;
  teamMemberId: string;
  fte?: number;
}

export async function getProjectAssignments(projectId: string): Promise<AssignmentRecord[]> {
  const tableName = airtableTables.assignments || 'Assignments';
  const f = airtableAssignmentFields;
  const projectLinkField = f.project_link || 'Project';

  // Filter by project link
  const filterFormula = `FIND("${projectId}", ARRAYJOIN({${projectLinkField}})) > 0`;

  const records = await getRecords(tableName, {
    fields: [
      f.role || 'Role',
      f.team_member_link || 'Data Team Member',
      f.fte || 'FTE',
    ],
    filterByFormula: filterFormula,
  });

  return records.map(r => ({
    id: r.id,
    role: r.fields[f.role || 'Role'] as string,
    teamMemberId: (r.fields[f.team_member_link || 'Data Team Member'] as string[])?.[0] || '',
    fte: r.fields[f.fte || 'FTE'] as number | undefined,
  }));
}

// Parse Airtable URL to extract record ID
export function parseAirtableUrl(url: string): { recordId: string | null; baseId: string | null } {
  // Airtable URLs: https://airtable.com/{baseId}/{tableId}/{viewId?}/{recordId}
  // or: https://airtable.com/{baseId}/{tableId}/{recordId}
  const match = url.match(/airtable\.com\/([^/]+)\/[^/]+(?:\/[^/]+)?\/([^/?]+)/);
  if (match) {
    return { baseId: match[1], recordId: match[2] };
  }
  return { baseId: null, recordId: null };
}

// Get field options for single-select fields from Airtable metadata API
export interface FieldOption {
  id: string;
  name: string;
  color?: string;
}

export async function getFieldOptions(tableName: string, fieldName: string): Promise<FieldOption[]> {
  const token = await getAccessToken();

  debugLogger.log('airtable', 'Fetching field options', { tableName, fieldName });

  // Use the metadata API to get table schema
  const response = await fetch(`https://api.airtable.com/v0/meta/bases/${BASE_ID}/tables`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    const errorMsg = error.error?.message || `Failed to fetch metadata: ${response.status}`;
    debugLogger.logApiResponse('airtable', 'meta/tables', error, new Error(errorMsg));
    throw new Error(errorMsg);
  }

  const data = await response.json();
  const tables = data.tables as Array<{ name: string; fields: Array<{ name: string; type: string; options?: { choices?: FieldOption[] } }> }>;

  // Find the table
  const table = tables.find(t => t.name === tableName);
  if (!table) {
    debugLogger.log('airtable', 'Table not found', { tableName, availableTables: tables.map(t => t.name) });
    return [];
  }

  // Find the field
  const field = table.fields.find(f => f.name === fieldName);
  if (!field) {
    debugLogger.log('airtable', 'Field not found', { fieldName, availableFields: table.fields.map(f => f.name) });
    return [];
  }

  // Check if it's a single/multi-select field with choices
  if (field.type !== 'singleSelect' && field.type !== 'multipleSelects') {
    debugLogger.log('airtable', 'Field is not a select type', { fieldName, fieldType: field.type });
    return [];
  }

  const choices = field.options?.choices || [];
  debugLogger.log('airtable', 'Field options fetched', { fieldName, count: choices.length, choices });

  return choices;
}

// Get project type options specifically
export async function getProjectTypeOptions(): Promise<string[]> {
  const tableName = airtableTables.projects || 'Projects';
  const fieldName = airtableProjectFields.project_type || 'Project Type';

  const options = await getFieldOptions(tableName, fieldName);
  return options.map(opt => opt.name);
}

// Export config for use in other modules
export { airtableProjectFields, airtableTables };

export default {
  getRecords,
  getTeamMembers,
  getFunders,
  getParentInitiatives,
  createProject,
  createMilestones,
  createAssignments,
  updateRecord,
  checkProjectExists,
  searchProjects,
  getProjectById,
  getProjectMilestones,
  getProjectAssignments,
  parseAirtableUrl,
  getFieldOptions,
  getProjectTypeOptions,
};
