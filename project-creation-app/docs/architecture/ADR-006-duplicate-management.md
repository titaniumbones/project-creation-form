# ADR-006: Duplicate Management and Resource Creation Flow

## Status
**In Progress** - Phase 1-3 complete, Phase 4 pending

## Context

The Project Creation Helper creates resources across three platforms: Airtable, Asana, and Google Drive. Without proper duplicate detection, users can accidentally create duplicate projects, leading to:
- Confusion about which project record is authoritative
- Orphaned resources across platforms
- Manual cleanup work

Additionally, the current form flow makes it too easy to create new resources when the user may want to work with existing ones.

## Decision

Implement a multi-phase duplicate management system:

### Phase 1: Add Existing Resource URL Fields (Current)
Add optional URL input fields to the form allowing users to link existing resources:
- **Scoping Doc URL** - Link to existing Google Doc
- **Asana Board URL** - Link to existing Asana project

These fields allow users to indicate that resources already exist, preventing unnecessary recreation.

### Phase 2: Populate from Existing Record
Add ability to populate the form from an existing Airtable project record:
- Search box at top of form: "Start from existing project?"
- User can enter Airtable URL or search by name (substring match)
- Preview modal shows project details before populating
- Track editing vs creating new

### Phase 3: Restructure Submission Flow
Move all resource creation behind a confirmation modal:
- Rename "Check For Duplicates" → "Submit and Check"
- Remove individual "Create" buttons from main form
- Modal shows each resource with options: Create / Update / Link Existing / Skip
- Validate any provided URLs point to real resources

### Phase 4: Post-Submission Resource Management
After submission, provide resource management at bottom of page:
- Link existing resources
- Recreate resources if needed

## Duplicate Detection Algorithm

### Matching Strategy: Substring Match (Case-Insensitive)
We use substring matching rather than exact matching because:
- Project names often have slight variations (trailing spaces, prefixes)
- Users may search with partial names like "FEP" or "Day Of"
- Better to show potential matches than miss real duplicates

**Airtable:**
```
OR(
  FIND(LOWER(search), LOWER({Project})) > 0,
  FIND(LOWER({Project}), LOWER(search)) > 0
)
```

**Asana:**
- Use typeahead API for initial search
- Filter results: `projectName.includes(searchTerm) || searchTerm.includes(projectName)`

**Google Drive:**
- Search by exact folder name (Google's API limitation)
- Case-insensitive comparison on results

### Resolution Options

| Platform | Options |
|----------|---------|
| Airtable | Update existing / Create new / Skip |
| Asana | Use existing / Create new / Skip |
| Google Drive | Keep existing / Create new / Skip |

## Implementation Details

### Phase 1 Implementation (Complete)

#### New Form Fields

Added to `fields.toml`:
```toml
[fields.existing_scoping_doc_url]
type = "url"
label = "Existing Scoping Doc URL"
required = false
placeholder = "https://docs.google.com/document/d/..."
section = "basics"
help_text = "If a scoping document already exists, paste its URL here to skip creation"
validation_pattern = "docs\\.google\\.com/document/d/"

[fields.existing_asana_url]
type = "url"
label = "Existing Asana Board URL"
required = false
placeholder = "https://app.asana.com/..."
section = "basics"
help_text = "If an Asana project already exists, paste its URL here to skip creation"
validation_pattern = "app\\.asana\\.com/"
```

#### Type Updates (`types/index.ts`)

Added fields to `FormData`:
```typescript
existingScopingDocUrl?: string;
existingAsanaUrl?: string;
```

Added `userProvided` flag to duplicate result types:
```typescript
interface AsanaDuplicateResult {
  // ... existing fields
  userProvided?: boolean;  // True if user provided URL via form
  skipped?: boolean;       // True if check was skipped
}

interface GoogleDuplicateResult {
  // ... existing fields
  userProvided?: boolean;
}
```

#### Duplicate Check Integration (`duplicates.ts`)

Extended `CheckAllDuplicatesParams` to accept existing URLs:
```typescript
existingUrls?: {
  asanaUrl?: string;
  scopingDocUrl?: string;
};
```

When existing URLs are provided:
1. Skip the duplicate check for that platform
2. Return `found: true` with `userProvided: true` flag
3. Include the user-provided URL in the result

#### Resource Creation Flow (`ProjectForm.tsx`)

Updated `executeCreateAll()` to:
1. Check for existing URLs before creating resources
2. Use existing URLs directly instead of creating new resources
3. Skip Asana creation if `existingAsanaUrl` provided
4. Skip Google Drive folder/doc creation if `existingScopingDocUrl` provided
5. Still include the URLs when creating Airtable record

#### UI Changes

Added "Link Existing Resources (Optional)" section in the Basics form section with:
- Scoping Doc URL input with Google Docs pattern validation
- Asana Board URL input with Asana URL pattern validation
- Helper text explaining the skip-creation behavior

### URL Validation
- Google Docs: Must match `docs\.google\.com/document/d/`
- Asana: Must match `app\.asana\.com/`
- Future: Validate URLs point to accessible resources via API

### Phase 2 Implementation (Complete)

#### New Service Functions (`airtable.ts`)

Added project search and fetch functions:
```typescript
// Search projects by name (substring match)
searchProjects(searchTerm: string, maxResults?: number): Promise<ProjectSearchResult[]>

// Get full project data by ID
getProjectById(projectId: string): Promise<FullProjectData | null>

// Get milestones for a project
getProjectMilestones(projectId: string): Promise<MilestoneRecord[]>

// Get assignments for a project
getProjectAssignments(projectId: string): Promise<AssignmentRecord[]>

// Parse Airtable URL to extract record ID
parseAirtableUrl(url: string): { recordId: string | null; baseId: string | null }
```

#### New Components

**ProjectSearch** (`src/components/ui/ProjectSearch.tsx`)
- Collapsible search box shown at top of form
- Supports name search with debouncing (300ms)
- Supports direct Airtable URL paste
- Shows search results with project name, acronym, status, and dates
- Click result to open preview modal

**ProjectPreviewModal** (`src/components/ui/ProjectPreviewModal.tsx`)
- Fetches full project data including milestones and assignments
- Displays project info, dates, description preview
- Shows warning if project has existing resources (Asana, Scoping Doc)
- Lists team assignments and milestones
- "Load Project Data" button to populate form

#### Form Population Logic (`ProjectForm.tsx`)

**State tracking:**
```typescript
editingExistingProject: string | null  // Airtable record ID if editing
```

**Population handler:**
1. Clears current form and created resources
2. Populates all basic fields (name, acronym, dates, description, etc.)
3. Populates linked record fields (funder, parent initiative)
4. Pre-fills existing resource URLs if project has Asana/Scoping Doc
5. Maps Airtable role values back to form role keys
6. Populates team assignments with member IDs and FTE
7. Clears existing outcomes and adds milestones from project
8. Sets `editingExistingProject` state

**Editing mode indicator:**
- Blue banner shows when editing from existing project
- "Start Fresh" button clears form and exits editing mode

### Phase 3 Implementation (Complete)

#### Button Consolidation

Replaced dual-button approach with single "Submit and Check" button:
- Removed "Create All Resources" and individual platform buttons
- Single button initiates duplicate check then shows modal
- Modal handles all resource creation decisions

#### Updated Actions Section (`ProjectForm.tsx`)

**Before:**
- "Check for Duplicates" button
- "Create All Resources" button
- Individual ActionButtons for each platform (Asana, Google Docs, Airtable)

**After:**
- Single "Submit and Check" button
- Created Resources Status section (shows after creation)
- Cleaner UX with all creation moved to modal

#### Enhanced DuplicateResolutionModal

Completely redesigned modal to show all platforms:

**Platform Status Types:**
- `will_create` (green) - No duplicate found, will create new
- `duplicate_found` (amber) - Existing project found, show options
- `user_provided` (blue) - User linked existing URL, skip creation
- `not_connected` (gray) - Service not connected

**Visual Summary Bar:**
Shows counts for each status type at a glance

**Per-Platform Display:**
- Shows appropriate status badge and color
- Duplicate found: Radio options for resolution (including skip)
- Will create: Radio options for Create (recommended) or Skip
- User provided: Shows linked status with URL

**Skip Options:**
Users can skip resource creation for any platform, even when no duplicate is found:
- Airtable: "Skip Airtable" - Don't create or update any Airtable records
- Asana: "Skip Asana" - Don't create or update any Asana project
- Google Drive: "Skip Google Drive" - Don't create any Google Drive resources

This allows users to selectively create resources on only the platforms they need.

**Footer Actions:**
- "Cancel" to close without action
- "Create Resources" to proceed with selections

#### Skip Resolution Handling (`ProjectForm.tsx`)

The `executeCreateAll` function checks resolution choices before creating each resource:
```typescript
const skipAsana = resolution?.asana === 'skip';
const skipGoogle = resolution?.google === 'skip';
const skipAirtable = resolution?.airtable === 'skip';

// Each platform creation is gated by its skip flag
if (connectionStatus.asana && !skipAsana) { /* create Asana */ }
if (connectionStatus.google && !skipGoogle) { /* create Google Drive */ }
if (connectionStatus.airtable && !skipAirtable) { /* create Airtable */ }
```

## Consequences

### Positive
- Prevents accidental duplicate creation
- Allows linking to existing resources
- Clearer user flow with explicit confirmation
- Substring matching catches more potential duplicates

### Negative
- More complex submission flow
- Substring matching may show false positives
- Additional API calls for validation

### Risks
- Users may find the modal flow cumbersome
- Substring matching could be too aggressive for short project names

## Files Changed

### Phase 1
- `src/config/fields.toml` - Added new URL field configurations
- `src/types/index.ts` - Added `existingScopingDocUrl`, `existingAsanaUrl` to FormData; added `userProvided`/`skipped` flags to duplicate result types
- `src/services/duplicates.ts` - Extended `CheckAllDuplicatesParams` with `existingUrls`; updated `checkAllDuplicates` to skip checks when URLs provided
- `src/components/form/FormComponents.tsx` - Added fields to `DEFAULT_FORM_VALUES`
- `src/pages/ProjectForm.tsx` - Added UI for existing URL inputs; integrated into duplicate check and creation flows

### Phase 2
- `src/services/airtable.ts` - Added `searchProjects`, `getProjectById`, `getProjectMilestones`, `getProjectAssignments`, `parseAirtableUrl` functions
- `src/components/ui/ProjectSearch.tsx` - New component for searching existing projects
- `src/components/ui/ProjectPreviewModal.tsx` - New modal for previewing project before loading
- `src/pages/ProjectForm.tsx` - Added search/preview integration, form population handlers, editing mode tracking

### Phase 3
- `src/pages/ProjectForm.tsx` - Replaced dual buttons with single "Submit and Check"; removed individual ActionButtons; added Created Resources Status section
- `src/components/ui/DuplicateResolutionModal.tsx` - Complete redesign with platform status types, summary bar, enhanced visual display for all states

## References
- ROADMAP.md lines 79-89
- integrations.toml `[duplicates]` configuration section
