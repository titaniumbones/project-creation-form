// Synchronous config loader for service modules
// Parses TOML config at module load time
import toml from 'toml';
import fieldsConfigRaw from './fields.toml?raw';
import type { Config, AirtableConfig } from '../types';

interface ParsedConfig extends Config {
  airtable: AirtableConfig & {
    tables: Record<string, string>;
    project_fields: Record<string, string>;
    milestone_fields: Record<string, string>;
    assignment_fields: Record<string, string>;
    team_members_fields: Record<string, string>;
    project_defaults: Record<string, string>;
    role_values: Record<string, string>;
    draft_fields: Record<string, string>;
    draft_status_values: Record<string, string>;
    funder_fields: Record<string, string>;
    parent_initiative_fields: Record<string, string>;
  };
  google: {
    placeholders: Record<string, string>;
  };
}

let parsedConfig: ParsedConfig;

try {
  parsedConfig = toml.parse(fieldsConfigRaw) as ParsedConfig;
} catch (err) {
  console.error('Failed to parse fields.toml:', err);
  parsedConfig = {
    fields: {},
    airtable: {
      tables: {},
      project_fields: {},
      milestone_fields: {},
      assignment_fields: {},
      team_members_fields: {},
      project_defaults: {},
      role_values: {},
      draft_fields: {},
      draft_status_values: {},
    },
    google: {
      placeholders: {},
    },
  };
}

// Airtable configuration
export const airtableConfig = parsedConfig.airtable || {};
export const airtableTables = airtableConfig.tables || {};
export const airtableProjectFields = airtableConfig.project_fields || {};
export const airtableMilestoneFields = airtableConfig.milestone_fields || {};
export const airtableAssignmentFields = airtableConfig.assignment_fields || {};
export const airtableTeamMembersFields = airtableConfig.team_members_fields || {};
export const airtableProjectDefaults = airtableConfig.project_defaults || {};
export const airtableRoleValues = airtableConfig.role_values || {};
export const airtableDraftFields = airtableConfig.draft_fields || {};
export const airtableDraftStatusValues = airtableConfig.draft_status_values || {};
export const airtableFunderFields = airtableConfig.funder_fields || {};
export const airtableParentInitiativeFields = airtableConfig.parent_initiative_fields || {};

// Google configuration
export const googleConfig = parsedConfig.google || {};
export const googlePlaceholders = googleConfig.placeholders || {};

// Full config export for components that need it
export const fieldsConfig = parsedConfig;

export default parsedConfig;
