// Synchronous config loader for service modules
// Parses TOML config at module load time
import toml from 'toml';
import fieldsConfigRaw from './fields.toml?raw';

let parsedConfig = null;

try {
  parsedConfig = toml.parse(fieldsConfigRaw);
} catch (err) {
  console.error('Failed to parse fields.toml:', err);
  parsedConfig = {};
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

// Google configuration
export const googleConfig = parsedConfig.google || {};
export const googlePlaceholders = googleConfig.placeholders || {};

// Full config export for components that need it
export const fieldsConfig = parsedConfig;

export default parsedConfig;
