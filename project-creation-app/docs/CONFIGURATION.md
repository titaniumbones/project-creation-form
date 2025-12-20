# Configuration Guide

The Project Creation Helper uses TOML configuration files to define form fields, Airtable schema mappings, and integration settings. This makes the application flexible and maintainable without code changes.

## Configuration Files

| File | Purpose |
|------|---------|
| `src/config/fields.toml` | Form fields, validation, and data mappings |
| `src/config/integrations.toml` | Service endpoints and environment variable references |

## fields.toml

This file defines the project creation form structure and how data flows between the form, Airtable, Asana, and Google Docs.

### Structure

```toml
[metadata]
version = "1.0"
last_updated = "2025-12-19"

[fields.field_name]
type = "text"           # Field type (see types below)
label = "Display Label" # Shown in the form
required = true         # Validation
placeholder = "..."     # Input placeholder
help_file = "help.md"   # Markdown help content
section = "basics"      # Form section grouping
# Integration mappings
airtable_field = "..."  # Airtable field name
asana_field = "..."     # Asana property name
google_placeholder = "{{TOKEN}}"  # Google Doc placeholder
```

### Field Types

| Type | Description | Additional Options |
|------|-------------|-------------------|
| `text` | Single-line text input | `max_length`, `placeholder` |
| `textarea` | Multi-line text input | `min_length`, `placeholder` |
| `richtext` | Rich text editor | `min_length`, `placeholder` |
| `date` | Date picker | - |
| `role_assignment` | Team member role picker | `role_types` (see below) |
| `repeatable` | Repeating field group | `min_items`, `max_items`, `subfields` |

### Adding a New Basic Field

1. Add a new `[fields.field_name]` section:

```toml
[fields.budget]
type = "text"
label = "Budget"
required = false
placeholder = "e.g., $50,000"
section = "basics"
airtable_field = "Budget"
google_placeholder = "{{BUDGET}}"
```

2. The field will automatically appear in the form based on its `section` value.

### Configuring Role Types

Role assignments let users pick team members for different roles:

```toml
[fields.roles.role_types.project_owner]
label = "Project Owner"
required = true
max = 1                                    # Maximum assignees
description = "Primary decision maker"     # Tooltip text
```

### Configuring Repeatable Fields (Milestones/Outcomes)

Repeatable fields allow users to add multiple items:

```toml
[fields.outcomes]
type = "repeatable"
label = "Outcomes & Milestones"
min_items = 1
max_items = 20
airtable_table = "Milestones"  # Creates linked records

[fields.outcomes.subfields.name]
type = "text"
label = "Outcome Name"
required = true
airtable_field = "Milestone"

[fields.outcomes.subfields.due_date]
type = "date"
label = "Due Date"
required = false
airtable_field = "Due Date"
```

### Airtable Schema Mappings

The `[airtable]` section maps form data to Airtable:

```toml
[airtable.tables]
projects = "Projects"           # Main project records
milestones = "Milestones"       # Linked milestone records
assignments = "Assignments"     # Role assignment junction table
team_members = "Data Team Members"  # Team member lookup

[airtable.project_fields]
name = "Project"               # Field name in Airtable
acronym = "Project Acronym"
start_date = "Start Date"
# etc.

[airtable.project_defaults]
status = "Active"              # Default value for new projects
```

### Google Doc Placeholders

Placeholders in Google Doc/Slides templates get replaced with project data:

```toml
[google.placeholders]
project_name = "{{PROJECT_TITLE}}"
start_date = "{{START_DATE}}"
milestones = "{{MILESTONES}}"      # Replaced with formatted table
staff_table = "{{STAFF_TABLE}}"    # Replaced with formatted table
```

**Template Setup:**
1. Create a Google Doc or Slides template
2. Add placeholder tokens (e.g., `{{PROJECT_TITLE}}`)
3. Set the template ID in environment variables
4. The app will copy the template and replace placeholders

### Draft Workflow Configuration

The draft/approval system uses its own table and field mappings:

```toml
[airtable.draft_fields]
project_name = "Project Name"
draft_data = "Draft Data"      # JSON blob of form data
status = "Status"
approver = "Approver"
share_token = "Share Token"

[airtable.draft_status_values]
draft = "Draft"
pending = "Pending Approval"
approved = "Approved"
changes_requested = "Changes Requested"
```

## integrations.toml

This file defines service configuration and environment variable references:

```toml
[oauth]
relay_url_env = "VITE_OAUTH_RELAY_URL"

[airtable]
base_id_env = "VITE_AIRTABLE_BASE_ID"
projects_table = "Projects"

[asana]
team_gid_env = "VITE_ASANA_TEAM_GID"
template_project_gid = "1209652649504377"  # Hardcoded template ID

[google]
scoping_template_id_env = "VITE_GOOGLE_SCOPING_TEMPLATE_ID"
shared_drive_id_env = "VITE_GOOGLE_SHARED_DRIVE_ID"
```

### Environment Variable References

Values ending in `_env` reference environment variables:

```toml
base_id_env = "VITE_AIRTABLE_BASE_ID"
# → reads process.env.VITE_AIRTABLE_BASE_ID at runtime
```

This keeps secrets out of the configuration files.

## Common Tasks

### Renaming an Airtable Field

If you rename a field in Airtable, update the mapping in `fields.toml`:

```toml
# Before
airtable_field = "Project"

# After
airtable_field = "Project Name"
```

### Adding a New Form Section

Form sections are defined by the `section` property on fields:

```toml
[fields.new_field]
section = "budget"  # Creates new section if it doesn't exist
```

Update the form renderer to display the new section appropriately.

### Changing Google Doc Placeholders

1. Update the template document with new placeholder tokens
2. Update `fields.toml`:

```toml
[google.placeholders]
new_field = "{{NEW_FIELD_TOKEN}}"
```

3. Ensure the field has `google_placeholder` set:

```toml
[fields.new_field]
google_placeholder = "{{NEW_FIELD_TOKEN}}"
```

### Adding a New Role Type

Add a new role under `[fields.roles.role_types]`:

```toml
[fields.roles.role_types.finance]
label = "Finance Lead"
required = false
max = 1
description = "Budget and financial oversight"
```

Then add the Airtable mapping:

```toml
[airtable.role_values]
finance = "Finance"  # Must match Airtable dropdown option
```

## Validation

The config loader validates:
- Required fields have all necessary properties
- Field types are recognized
- Airtable mappings reference existing fields
- Environment variables are defined (at runtime)

Errors appear in the browser console with details about what's missing.

## Related Documentation

- [Main README](../README.md)
- [Setup Guide](../../SETUP.md)
