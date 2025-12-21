// =============================================================================
// Form Data Types
// =============================================================================

export interface RoleAssignment {
  memberId: string;
  fte: string;
}

export interface Outcome {
  name: string;
  description: string;
  dueDate: string;
}

export interface FormData {
  projectName: string;
  projectAcronym: string;
  startDate: string;
  endDate: string;
  description: string;
  objectives: string;
  roles: Record<string, RoleAssignment>;
  outcomes: Outcome[];
}

// =============================================================================
// Team & User Types
// =============================================================================

export interface TeamMember {
  id: string;
  name: string;
}

export interface UserInfo {
  email?: string;
  teamMemberId?: string;
  [key: string]: unknown;
}

// =============================================================================
// OAuth Types
// =============================================================================

export interface TokenData {
  access_token: string;
  refresh_token?: string;
  expiresAt?: number;
  savedAt: number;
  [key: string]: unknown;
}

export interface ConnectionStatus {
  airtable: boolean;
  asana: boolean;
  google: boolean;
}

// =============================================================================
// Draft Types
// =============================================================================

export type DraftStatus = 'Draft' | 'Pending Approval' | 'Approved' | 'Changes Requested';

export interface Draft {
  id: string;
  projectName: string;
  formData: FormData;
  status: DraftStatus;
  shareToken: string;
  createdBy?: string;
  createdByMemberId?: string;
  approverNotes?: string;
  createdAt?: string;
  updatedAt?: string;
}

// =============================================================================
// Created Resources Types
// =============================================================================

export interface CreatedResources {
  airtableProjectId?: string;
  airtableUrl?: string;
  asanaProjectGid?: string;
  asanaUrl?: string;
  asanaMilestonesCreated?: boolean;
  googleFolderId?: string;
  folderUrl?: string;
  scopingDocId?: string;
  scopingDocUrl?: string;
  kickoffDeckId?: string;
  kickoffDeckUrl?: string;
}

// =============================================================================
// Airtable Types
// =============================================================================

export interface AirtableRecord {
  id: string;
  fields: Record<string, unknown>;
  createdTime?: string;
}

export interface AirtableResponse {
  records: AirtableRecord[];
  offset?: string;
}

// =============================================================================
// Asana Types
// =============================================================================

export interface AsanaWorkspace {
  gid: string;
  name: string;
}

export interface AsanaUser {
  gid: string;
  name: string;
  email?: string;
  workspaces?: AsanaWorkspace[];
}

export interface AsanaProject {
  gid: string;
  name: string;
  permalink_url?: string;
}

export interface AsanaTask {
  gid: string;
  name: string;
  notes?: string;
  due_on?: string;
  assignee?: { gid: string };
}

export interface AsanaUserMatch {
  user: AsanaUser;
  score: number;
}

// =============================================================================
// Google Types
// =============================================================================

export interface GoogleFile {
  id: string;
  name: string;
  webViewLink?: string;
  mimeType?: string;
}

export interface GoogleSearchResults {
  files: GoogleFile[];
}

// =============================================================================
// Debug Logger Types
// =============================================================================

export type DebugCategory = 'form' | 'airtable' | 'asana' | 'google' | 'transform' | 'error' | 'session';

export interface DebugLog {
  timestamp: number;
  elapsed: number;
  category: DebugCategory;
  message: string;
  data?: unknown;
}

// =============================================================================
// Configuration Types
// =============================================================================

export interface FieldConfig {
  type: string;
  label: string;
  required?: boolean;
  placeholder?: string;
  help_file?: string;
  section?: string;
  airtable_field?: string;
  asana_field?: string;
  google_placeholder?: string;
  min_length?: number;
  max_length?: number;
  [key: string]: unknown;
}

export interface AirtableConfig {
  tables: Record<string, string>;
  project_fields: Record<string, string>;
  milestone_fields: Record<string, string>;
  assignment_fields: Record<string, string>;
  team_members_fields: Record<string, string>;
  project_defaults: Record<string, string>;
  role_values: Record<string, string>;
  draft_fields: Record<string, string>;
  draft_status_values: Record<string, string>;
}

export interface GooglePlaceholdersConfig {
  placeholders: Record<string, string>;
}

export interface Config {
  fields: Record<string, FieldConfig>;
  airtable: AirtableConfig;
  google: GooglePlaceholdersConfig;
  metadata?: {
    version: string;
    last_updated: string;
  };
}

// =============================================================================
// Component Props Types
// =============================================================================

export interface FormSectionProps {
  id: string;
  title: string;
  children: React.ReactNode;
  helpFile?: string;
}

export interface FormFieldProps {
  label: string;
  required?: boolean;
  helpFile?: string;
  error?: string;
  children: React.ReactNode;
}

export interface ActionButtonProps {
  label: string;
  onClick: () => void | Promise<void>;
  isLoading: boolean;
  isComplete: boolean;
  url?: string;
  disabled?: boolean;
  error?: string;
}

export interface ShareDraftModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { approverId: string; approverEmail: string; notes: string }) => Promise<void>;
  teamMembers: TeamMember[];
  isLoading: boolean;
}

export interface HelpTooltipProps {
  helpFile: string;
}
