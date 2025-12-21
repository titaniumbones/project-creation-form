// Draft management service for save/share approval workflow
import { getValidToken } from './oauth';
import { debugLogger } from './debugLogger';
import {
  airtableTables,
  airtableDraftFields,
  airtableDraftStatusValues,
} from '../config';
import type { FormData, Draft, DraftStatus } from '../types';

const BASE_ID = import.meta.env.VITE_AIRTABLE_BASE_ID;
const API_URL = 'https://api.airtable.com/v0';

interface DraftRequestOptions {
  method?: string;
  body?: string;
  headers?: Record<string, string>;
}

interface AirtableDraftRecord {
  id: string;
  fields: Record<string, unknown>;
  createdTime?: string;
}

interface AirtableDraftResponse {
  records?: AirtableDraftRecord[];
  id?: string;
  fields?: Record<string, unknown>;
}

interface CreateDraftResult {
  id: string;
  shareToken: string;
  [key: string]: unknown;
}

interface DraftListItem {
  id: string;
  projectName: string;
  status: DraftStatus;
  createdAt?: string;
  approverNotes?: string;
  shareToken: string;
}

interface PendingDraftItem {
  id: string;
  projectName: string;
  status: DraftStatus;
  createdBy?: string;
  createdAt?: string;
  shareToken: string;
}

async function getAccessToken(): Promise<string> {
  const token = await getValidToken('airtable');
  if (!token) {
    throw new Error('Not connected to Airtable. Please connect in Settings.');
  }
  return token;
}

async function draftRequest(endpoint: string, options: DraftRequestOptions = {}): Promise<AirtableDraftResponse> {
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
    const errorMsg = error.error?.message || `Draft request failed: ${response.status}`;
    debugLogger.logApiResponse('airtable', endpoint, error, new Error(errorMsg));
    throw new Error(errorMsg);
  }

  const result = await response.json();
  debugLogger.logApiResponse('airtable', endpoint, result);
  return result;
}

// Generate a unique share token (UUID v4)
function generateShareToken(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Create a new draft
export async function createDraft(formData: FormData, creatorMemberId?: string): Promise<CreateDraftResult> {
  const tableName = airtableTables.drafts || 'Project Drafts';
  const f = airtableDraftFields;
  const statusValues = airtableDraftStatusValues;

  const shareToken = generateShareToken();

  const fields: Record<string, unknown> = {
    [f.project_name || 'Project Name']: formData.projectName || 'Untitled Draft',
    [f.draft_data || 'Draft Data']: JSON.stringify(formData),
    [f.status || 'Status']: statusValues.draft || 'Draft',
    [f.share_token || 'Share Token']: shareToken,
  };

  // Link to team member if provided
  if (creatorMemberId) {
    fields[f.created_by_member || 'Created By Member'] = [creatorMemberId];
  }

  debugLogger.log('airtable', 'Creating new draft', {
    projectName: formData.projectName,
    creatorMemberId,
    shareToken,
  });

  const data = await draftRequest(encodeURIComponent(tableName), {
    method: 'POST',
    body: JSON.stringify({ fields }),
  });

  return {
    id: data.id!,
    shareToken,
    ...data.fields,
  };
}

// Update an existing draft
export async function updateDraft(recordId: string, formData: FormData): Promise<{ id: string; [key: string]: unknown }> {
  const tableName = airtableTables.drafts || 'Project Drafts';
  const f = airtableDraftFields;

  const fields: Record<string, unknown> = {
    [f.project_name || 'Project Name']: formData.projectName || 'Untitled Draft',
    [f.draft_data || 'Draft Data']: JSON.stringify(formData),
  };

  debugLogger.log('airtable', 'Updating draft', {
    recordId,
    projectName: formData.projectName,
  });

  const data = await draftRequest(`${encodeURIComponent(tableName)}/${recordId}`, {
    method: 'PATCH',
    body: JSON.stringify({ fields }),
  });

  return {
    id: data.id!,
    ...data.fields,
  };
}

// Get a draft by its share token
export async function getDraftByToken(shareToken: string): Promise<Draft> {
  const tableName = airtableTables.drafts || 'Project Drafts';
  const f = airtableDraftFields;

  const tokenField = f.share_token || 'Share Token';
  const filterFormula = `{${tokenField}} = "${shareToken}"`;

  const params = new URLSearchParams({
    filterByFormula: filterFormula,
    maxRecords: '1',
  });

  debugLogger.log('airtable', 'Looking up draft by token', { shareToken });

  const data = await draftRequest(`${encodeURIComponent(tableName)}?${params}`);

  if (!data.records || data.records.length === 0) {
    throw new Error('Draft not found or link has expired');
  }

  const record = data.records[0];
  const draftDataField = f.draft_data || 'Draft Data';

  return {
    id: record.id,
    formData: JSON.parse((record.fields[draftDataField] as string) || '{}'),
    status: record.fields[f.status || 'Status'] as DraftStatus,
    createdBy: record.fields[f.created_by || 'Created By'] as string | undefined,
    approverNotes: record.fields[f.approver_notes || 'Approver Notes'] as string | undefined,
    shareToken: record.fields[f.share_token || 'Share Token'] as string,
    projectName: record.fields[f.project_name || 'Project Name'] as string,
  };
}

// Submit a draft for approval
export async function submitForApproval(
  recordId: string,
  approverMemberId?: string,
  approverEmail?: string
): Promise<{ id: string; [key: string]: unknown }> {
  const tableName = airtableTables.drafts || 'Project Drafts';
  const f = airtableDraftFields;
  const statusValues = airtableDraftStatusValues;

  const fields: Record<string, unknown> = {
    [f.status || 'Status']: statusValues.pending || 'Pending Approval',
    [f.approver_email || 'Approver Email']: approverEmail,
  };

  // Link to team member if we have the field and ID
  if (approverMemberId && f.approver) {
    fields[f.approver || 'Approver'] = [approverMemberId];
  }

  debugLogger.log('airtable', 'Submitting draft for approval', {
    recordId,
    approverMemberId,
    approverEmail,
  });

  const data = await draftRequest(`${encodeURIComponent(tableName)}/${recordId}`, {
    method: 'PATCH',
    body: JSON.stringify({ fields }),
  });

  return {
    id: data.id!,
    ...data.fields,
  };
}

// Approve a draft
export async function approveDraft(recordId: string, notes: string = ''): Promise<{ id: string; [key: string]: unknown }> {
  const tableName = airtableTables.drafts || 'Project Drafts';
  const f = airtableDraftFields;
  const statusValues = airtableDraftStatusValues;

  const fields: Record<string, unknown> = {
    [f.status || 'Status']: statusValues.approved || 'Approved',
    [f.decision_at || 'Decision At']: new Date().toISOString().split('T')[0],
  };

  if (notes) {
    fields[f.approver_notes || 'Approver Notes'] = notes;
  }

  debugLogger.log('airtable', 'Approving draft', { recordId, notes: !!notes });

  const data = await draftRequest(`${encodeURIComponent(tableName)}/${recordId}`, {
    method: 'PATCH',
    body: JSON.stringify({ fields }),
  });

  return {
    id: data.id!,
    ...data.fields,
  };
}

// Request changes on a draft
export async function requestChanges(recordId: string, notes: string): Promise<{ id: string; [key: string]: unknown }> {
  const tableName = airtableTables.drafts || 'Project Drafts';
  const f = airtableDraftFields;
  const statusValues = airtableDraftStatusValues;

  const fields: Record<string, unknown> = {
    [f.status || 'Status']: statusValues.changes_requested || 'Changes Requested',
    [f.approver_notes || 'Approver Notes']: notes,
    [f.decision_at || 'Decision At']: new Date().toISOString().split('T')[0],
  };

  debugLogger.log('airtable', 'Requesting changes on draft', { recordId });

  const data = await draftRequest(`${encodeURIComponent(tableName)}/${recordId}`, {
    method: 'PATCH',
    body: JSON.stringify({ fields }),
  });

  return {
    id: data.id!,
    ...data.fields,
  };
}

// Get all drafts for a user (by team member ID)
export async function getUserDrafts(teamMemberId: string): Promise<DraftListItem[]> {
  const tableName = airtableTables.drafts || 'Project Drafts';
  const f = airtableDraftFields;

  // Filter by linked team member record
  const createdByField = f.created_by_member || 'Created By Member';
  const filterFormula = `FIND("${teamMemberId}", ARRAYJOIN(RECORD_ID({${createdByField}})))`;

  const sortParams = new URLSearchParams();
  sortParams.set('filterByFormula', filterFormula);
  sortParams.set('sort[0][field]', 'Created');  // Airtable auto-created timestamp
  sortParams.set('sort[0][direction]', 'desc');

  debugLogger.log('airtable', 'Fetching user drafts', { teamMemberId });

  const data = await draftRequest(`${encodeURIComponent(tableName)}?${sortParams}`);

  return (data.records || []).map((record) => ({
    id: record.id,
    projectName: record.fields[f.project_name || 'Project Name'] as string,
    status: record.fields[f.status || 'Status'] as DraftStatus,
    createdAt: record.createdTime,
    approverNotes: record.fields[f.approver_notes || 'Approver Notes'] as string | undefined,
    shareToken: record.fields[f.share_token || 'Share Token'] as string,
  }));
}

// Get drafts pending user's approval
export async function getDraftsPendingApproval(userEmail: string): Promise<PendingDraftItem[]> {
  const tableName = airtableTables.drafts || 'Project Drafts';
  const f = airtableDraftFields;
  const statusValues = airtableDraftStatusValues;

  const approverEmailField = f.approver_email || 'Approver Email';
  const statusField = f.status || 'Status';
  const pendingStatus = statusValues.pending || 'Pending Approval';

  const filterFormula = `AND({${approverEmailField}} = "${userEmail.replace(/"/g, '\\"')}", {${statusField}} = "${pendingStatus}")`;

  const sortParams = new URLSearchParams();
  sortParams.set('filterByFormula', filterFormula);
  sortParams.set('sort[0][field]', f.created_at || 'Created At');
  sortParams.set('sort[0][direction]', 'desc');

  debugLogger.log('airtable', 'Fetching drafts pending approval', { userEmail });

  const data = await draftRequest(`${encodeURIComponent(tableName)}?${sortParams}`);

  return (data.records || []).map((record) => ({
    id: record.id,
    projectName: record.fields[f.project_name || 'Project Name'] as string,
    status: record.fields[f.status || 'Status'] as DraftStatus,
    createdBy: record.fields[f.created_by || 'Created By'] as string | undefined,
    createdAt: record.fields[f.created_at || 'Created At'] as string | undefined,
    shareToken: record.fields[f.share_token || 'Share Token'] as string,
  }));
}

// Delete a draft
export async function deleteDraft(recordId: string): Promise<boolean> {
  const tableName = airtableTables.drafts || 'Project Drafts';

  debugLogger.log('airtable', 'Deleting draft', { recordId });

  await draftRequest(`${encodeURIComponent(tableName)}/${recordId}`, {
    method: 'DELETE',
  });

  return true;
}

// Update draft form data (for approver edits)
export async function updateDraftFormData(recordId: string, formData: FormData): Promise<{ id: string; [key: string]: unknown }> {
  const tableName = airtableTables.drafts || 'Project Drafts';
  const f = airtableDraftFields;

  const fields: Record<string, unknown> = {
    [f.project_name || 'Project Name']: formData.projectName || 'Untitled Draft',
    [f.draft_data || 'Draft Data']: JSON.stringify(formData),
  };

  debugLogger.log('airtable', 'Updating draft form data', {
    recordId,
    projectName: formData.projectName,
  });

  const data = await draftRequest(`${encodeURIComponent(tableName)}/${recordId}`, {
    method: 'PATCH',
    body: JSON.stringify({ fields }),
  });

  return {
    id: data.id!,
    ...data.fields,
  };
}

export default {
  createDraft,
  updateDraft,
  getDraftByToken,
  submitForApproval,
  approveDraft,
  requestChanges,
  getUserDrafts,
  getDraftsPendingApproval,
  deleteDraft,
  updateDraftFormData,
};
