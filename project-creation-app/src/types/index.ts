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
  funder?: string;
  parentInitiative?: string;
  projectType?: string;
  // Existing resource URLs (optional - skip creation if provided)
  existingScopingDocUrl?: string;
  existingAsanaUrl?: string;
}

// =============================================================================
// Team & User Types
// =============================================================================

export interface TeamMember {
  id: string;
  name: string;
}

export interface Funder {
  id: string;
  name: string;
}

export interface ParentInitiative {
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
  funder_fields?: Record<string, string>;
  parent_initiative_fields?: Record<string, string>;
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

// =============================================================================
// Duplicate Detection Types
// =============================================================================

/**
 * Result of checking for an existing project in Airtable
 */
export interface AirtableDuplicateResult {
  found: boolean;
  record?: AirtableRecord;
  url?: string;
  /** Project name from the found record */
  projectName?: string;
  /** Created date of the found record */
  createdTime?: string;
}

/**
 * Result of searching for an existing project in Asana
 */
export interface AsanaDuplicateResult {
  found: boolean;
  project?: AsanaProject;
  url?: string;
  /** Other projects with similar names (for fuzzy matching future enhancement) */
  searchResults?: Array<{ name: string; gid: string }>;
  /** True if the user provided this URL via the form (not detected) */
  userProvided?: boolean;
  /** True if the check was skipped (e.g., no workspace GID) */
  skipped?: boolean;
}

/**
 * Result of searching for an existing folder in Google Drive
 */
export interface GoogleDuplicateResult {
  found: boolean;
  folderId?: string;
  url?: string;
  folderName?: string;
  /** Documents found within the folder */
  documents?: Array<{ name: string; id: string; mimeType?: string }>;
  /** True if the user provided this URL via the form (not detected) */
  userProvided?: boolean;
}

/**
 * Combined result of checking all platforms for duplicates
 */
export interface DuplicateCheckResult {
  airtable: AirtableDuplicateResult;
  asana: AsanaDuplicateResult;
  google: GoogleDuplicateResult;
  /** True if any platform found a potential duplicate */
  hasDuplicates: boolean;
  /** Timestamp of when the check was performed */
  checkedAt: number;
}

/**
 * User's resolution choice for Airtable duplicates
 * - update: Update the existing record with new data
 * - create_new: Create a new record regardless of existing
 * - skip: Skip Airtable creation entirely
 */
export type AirtableResolution = 'update' | 'create_new' | 'skip';

/**
 * User's resolution choice for Asana duplicates
 * - use_existing: Add/update milestones in existing project
 * - create_new: Create a new Asana project from template
 * - skip: Skip Asana creation entirely
 */
export type AsanaResolution = 'use_existing' | 'create_new' | 'skip';

/**
 * User's resolution choice for Google Drive duplicates
 * - keep: Leave existing folder/documents as-is, skip creation
 * - skip: Explicitly skip Google Drive creation
 * - recreate: Delete existing and recreate (future, hidden for now)
 */
export type GoogleResolution = 'keep' | 'skip' | 'recreate';

/**
 * User's resolution choices for all platforms
 */
export interface DuplicateResolution {
  airtable: AirtableResolution;
  asana: AsanaResolution;
  google: GoogleResolution;
}

/**
 * Default resolution strategies (configurable)
 */
export interface DuplicateDefaults {
  airtable: AirtableResolution;
  asana: AsanaResolution;
  google: GoogleResolution;
}

/**
 * Props for the DuplicateResolutionModal component
 */
export interface DuplicateResolutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (resolution: DuplicateResolution) => void;
  checkResult: DuplicateCheckResult;
  defaults: DuplicateDefaults;
  isLoading?: boolean;
}
