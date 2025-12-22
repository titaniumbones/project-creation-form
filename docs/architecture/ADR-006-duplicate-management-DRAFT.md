# ADR-006: Duplicate Management Strategy

**Status:** Draft (for discussion)

**Date:** 2025-12-21

**Deciders:** [To be determined]

**Technical Story:** When creating projects, detect existing duplicates across Airtable, Asana, and Google Drive, and provide users with options to update existing resources or create new ones.

---

## Context and Problem Statement

The project creation form currently creates new resources in all three platforms (Airtable, Asana, Google Drive) without checking for existing projects with the same name. This creates several problems:

1. **Accidental duplicates**: Users may re-submit a form, creating duplicate records
2. **Project re-scoping**: Legitimate updates to existing projects require manual cleanup
3. **Resource waste**: Orphaned Airtable records, Asana projects, and Google folders accumulate
4. **Data inconsistency**: Multiple versions of the same project exist across systems

### Current State

Duplicate detection functions **already exist** but are not integrated:
- `airtable.ts:checkProjectExists()` - Checks for exact name match in Projects table
- `asana.ts:searchProjectByName()` - Uses Asana typeahead API to find matching projects
- `google.ts:searchDriveFolder()` - Searches for folders by name

What's missing is:
1. Pre-creation duplicate checks during form submission
2. UI to present duplicates and gather user decisions
3. Logic to update existing resources vs. create new ones
4. Per-platform handling strategies

---

## Decision Drivers

- **User experience**: Make duplicate handling intuitive, not overwhelming
- **Safety**: Prevent accidental data loss; prefer updates over deletions
- **Consistency**: Apply sensible defaults while allowing overrides
- **Existing patterns**: Follow established modal/dialog patterns (see ShareDraftModal)
- **Configuration**: Allow per-platform defaults to be adjusted in TOML config

---

## Considered Options

### Option 1: Pre-flight Check with Modal Resolution

Check all three platforms before any creation, present a single modal showing all duplicates with per-platform choices.

**Pros:**
- User sees complete picture upfront
- Single decision point
- Can abort entirely if wrong project

**Cons:**
- Modal could be complex with three platforms
- All-or-nothing: can't easily skip one platform

### Option 2: Progressive Disclosure (Per-Platform)

Check each platform as its action is triggered, show inline warnings/options.

**Pros:**
- Simpler per-step UI
- Users only see what they're about to affect

**Cons:**
- Fragmented decision-making
- User may not realize duplicates exist until mid-way

### Option 3: Hybrid - Pre-flight with Inline Details

Pre-flight check before submission shows summary; detailed per-platform options inline in the form or a structured modal.

**Pros:**
- Early warning of duplicates
- Detailed control when needed
- Can proceed platform-by-platform

**Cons:**
- More UI complexity
- Two stages of duplicate handling

---

## Decision Outcome

**Recommended option: Option 3 - Hybrid Pre-flight with Structured Modal**

When the user initiates project creation (via "Create Project" button):

1. **Pre-flight check**: Query all three platforms for duplicates
2. **If no duplicates**: Proceed directly to creation
3. **If duplicates found**: Show **DuplicateResolutionModal** with:
   - Summary of what was found (per platform)
   - Per-platform options based on default behaviors
   - "Create Anyway" vs "Update Existing" choices
4. **Execute**: Proceed with user's selected strategy per platform

---

## Architecture

### Detection Phase

```
User clicks "Create Project"
        │
        ▼
┌─────────────────────────────────┐
│  Parallel duplicate checks:     │
│  • Airtable: checkProjectExists │
│  • Asana: searchProjectByName   │
│  • Google: searchDriveFolder    │
└─────────────────────────────────┘
        │
        ▼
    Duplicates found?
        │
   No ──┴── Yes
    │       │
    ▼       ▼
Create    Show DuplicateResolutionModal
All New   with per-platform options
```

### Resolution Modal Design

```
┌────────────────────────────────────────────────────────────┐
│  ⚠️  Existing Project Found                                │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  A project named "Q1 Impact Report" may already exist      │
│  in one or more systems:                                   │
│                                                            │
│  ┌─ Airtable ─────────────────────────────────────────┐   │
│  │  ✓ Match found: "Q1 Impact Report"                  │   │
│  │    Created: 2025-01-15 | Lead: Jane Smith           │   │
│  │    [View in Airtable ↗]                             │   │
│  │                                                     │   │
│  │    ○ Update existing record (recommended)           │   │
│  │    ○ Create new record anyway                       │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                            │
│  ┌─ Asana ────────────────────────────────────────────┐   │
│  │  ✓ Match found: "Q1 Impact Report"                  │   │
│  │    [View in Asana ↗]                                │   │
│  │                                                     │   │
│  │    ○ Use existing project & update milestones       │   │
│  │    ○ Create new Asana project                       │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                            │
│  ┌─ Google Drive ─────────────────────────────────────┐   │
│  │  ✓ Folder found: "Q1 Impact Report"                 │   │
│  │    [View folder ↗]                                  │   │
│  │                                                     │   │
│  │    ○ Keep existing documents (recommended)          │   │
│  │    ○ Skip Google Drive creation                     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                            │
│         [Cancel]                    [Continue →]           │
└────────────────────────────────────────────────────────────┘
```

### Per-Platform Strategies

#### Airtable

| Option | Behavior |
|--------|----------|
| **Update existing** (default) | Update fields on existing record; merge milestones by name; merge assignments |
| Create new | Create new Project record (ignores existing) |

**Update logic:**
- Find existing record by name
- Update all scalar fields (dates, description, etc.)
- For milestones: match by name, update due dates; create new if no match
- For assignments: match by role, update member; create new if no match

#### Asana

| Option | Behavior |
|--------|----------|
| **Use existing** (default) | Add/update milestones as tasks in existing project |
| Create new | Create new Asana project from template |

**Update logic:**
- Use existing project GID
- For milestones: search tasks by name, update if found, create if not
- Optionally update project members

#### Google Drive

| Option | Behavior |
|--------|----------|
| **Keep existing** (default) | Do not create new folder or documents |
| Skip creation | Same as above (explicit skip) |
| Delete and recreate | (HIDDEN - future option) Delete folder contents, recreate from templates |

**Rationale:** Google Docs are often manually edited after creation. Overwriting would lose user work.

### State Management

```typescript
interface DuplicateCheckResult {
  airtable: {
    found: boolean;
    record?: AirtableRecord;
    url?: string;
  };
  asana: {
    found: boolean;
    project?: AsanaProject;
    url?: string;
    searchResults?: Array<{ name: string; gid: string }>;
  };
  google: {
    found: boolean;
    folderId?: string;
    url?: string;
    documents?: Array<{ name: string; id: string }>;
  };
}

interface DuplicateResolution {
  airtable: 'update' | 'create_new';
  asana: 'use_existing' | 'create_new';
  google: 'keep' | 'skip' | 'recreate';
}
```

### Configuration

Add to `src/config/integrations.toml`:

```toml
[duplicates]
# Check for duplicates before creation
enabled = true

[duplicates.defaults]
# Default resolution strategies
airtable = "update"    # "update" | "create_new"
asana = "use_existing" # "use_existing" | "create_new"
google = "keep"        # "keep" | "skip" | "recreate"

[duplicates.airtable]
# Fields to update when using "update" strategy
update_fields = ["description", "objectives", "start_date", "end_date", "funder", "parent_initiative", "project_type"]
# Whether to merge milestones (match by name)
merge_milestones = true
# Whether to merge assignments (match by role)
merge_assignments = true

[duplicates.asana]
# Whether to update existing milestones or only add new ones
update_milestones = true
# Whether to sync project members on update
sync_members = true

[duplicates.google]
# Allow destructive recreate option (requires explicit user confirmation)
allow_recreate = false
```

---

## Implementation Components

### New Files

| File | Purpose |
|------|---------|
| `src/components/ui/DuplicateResolutionModal.tsx` | Modal for duplicate resolution choices |
| `src/services/duplicates.ts` | Orchestrates duplicate checks across platforms |
| `src/hooks/useDuplicateCheck.ts` | React Query hook for duplicate detection |

### Modified Files

| File | Changes |
|------|---------|
| `src/pages/ProjectForm.tsx` | Integrate duplicate check into submission flow |
| `src/services/airtable.ts` | Add `updateProject()`, `updateMilestones()` functions |
| `src/services/asana.ts` | Add `updateProjectMilestones()`, `findTaskByName()` functions |
| `src/config/integrations.toml` | Add `[duplicates]` configuration section |
| `src/types/index.ts` | Add duplicate-related type definitions |

### New Service API

```typescript
// src/services/duplicates.ts

// Check all platforms for duplicates in parallel
export async function checkAllDuplicates(
  projectName: string,
  workspaceGid: string,
  sharedDriveId: string
): Promise<DuplicateCheckResult>;

// Execute creation with resolution strategy
export async function createWithResolution(
  formData: FormData,
  resolution: DuplicateResolution,
  existingResources: DuplicateCheckResult
): Promise<CreatedResources>;
```

```typescript
// additions to src/services/airtable.ts

// Update existing project record
export async function updateProject(
  recordId: string,
  projectData: Partial<ProjectData>
): Promise<AirtableRecord>;

// Merge milestones (update existing, create new)
export async function mergeMilestones(
  projectId: string,
  milestones: Milestone[]
): Promise<{ updated: number; created: number }>;
```

```typescript
// additions to src/services/asana.ts

// Find task by name in project
export async function findTaskByName(
  projectGid: string,
  taskName: string
): Promise<AsanaTask | null>;

// Update or create milestones in existing project
export async function syncProjectMilestones(
  projectGid: string,
  milestones: Milestone[]
): Promise<{ updated: number; created: number }>;
```

---

## Security Considerations

1. **Destructive operations**: "Delete and recreate" for Google should require explicit confirmation
2. **Audit trail**: Log all update vs. create decisions for debugging
3. **Race conditions**: Check-then-act pattern; another user could create between check and action
   - Mitigation: Handle creation errors gracefully, offer retry or switch to update

---

## Trade-offs and Risks

### Trade-offs

| Aspect | Trade-off |
|--------|-----------|
| UX complexity | Modal adds a step, but prevents duplicates |
| Google conservatism | Default "keep" may leave stale docs, but prevents data loss |
| Update granularity | Bulk field updates may overwrite intentional differences |
| Asana matching | Name-based matching may miss renamed projects |

### Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| False positive matches | Show enough context (dates, owners) for user to decide |
| Update overwrites wanted data | Show diff preview (future enhancement) |
| Partial creation failure | Track what was created; allow retry of failed steps |
| Performance (3 API calls) | Parallel execution; show loading state |

---

## Implementation Phases

### Phase 1: Foundation
- [ ] Create `DuplicateCheckResult` and `DuplicateResolution` types
- [ ] Create `src/services/duplicates.ts` with `checkAllDuplicates()`
- [ ] Add `[duplicates]` section to `integrations.toml`
- [ ] Create `useDuplicateCheck` hook

**Checkpoint: Core detection working, can log results**

### Phase 2: Resolution Modal UI
- [ ] Create `DuplicateResolutionModal.tsx` component
- [ ] Implement platform-specific option UI
- [ ] Add modal trigger to ProjectForm submission flow
- [ ] Handle "no duplicates" case (skip modal)

**🔲 USER CHECKPOINT: Review modal design and UX flow**

### Phase 3: Airtable Update Strategy
- [ ] Implement `updateProject()` function
- [ ] Implement `mergeMilestones()` function
- [ ] Implement `mergeAssignments()` function
- [ ] Integrate with resolution handler

**Checkpoint: Can update existing Airtable projects**

### Phase 4: Asana Update Strategy
- [ ] Implement `findTaskByName()` function
- [ ] Implement `syncProjectMilestones()` function
- [ ] Handle "use existing project" flow
- [ ] Integrate with resolution handler

**Checkpoint: Can add milestones to existing Asana projects**

### Phase 5: Google Drive Strategy
- [ ] Implement "keep existing" (skip creation) logic
- [ ] Document "recreate" option for future implementation
- [ ] Integrate with resolution handler

**🔲 USER CHECKPOINT: Test full workflow end-to-end**

### Phase 6: Polish & Edge Cases
- [ ] Error handling for partial failures
- [ ] Loading states during duplicate check
- [ ] Debug logging for duplicate resolution
- [ ] Update help documentation

---

## Open Questions (for Discussion)

1. **Fuzzy matching**: Should we detect near-matches (e.g., "Q1 Report" vs "Q1 Report 2025")?
   - Pro: Catches more potential duplicates
   - Con: More false positives, complex UI

2. **Milestone matching strategy**: By name only, or also consider due dates?
   - By name: Simple, may update wrong milestone if renamed
   - By name + date range: More accurate, more complex

3. **Assignment conflicts**: What if existing assignment has different person for same role?
   - Overwrite: Uses form data (current approach)
   - Keep existing: Preserves manual changes
   - Prompt: Ask user (more complexity)

4. **Google recreate timing**: When should we enable the "delete and recreate" option?
   - After testing on staging?
   - Behind a feature flag?
   - Admin-only setting?

5. **Batch operations**: Should this integrate with draft approval workflow?
   - Approved drafts could auto-check duplicates before creation

---

## References

- [ADR-004: Draft Approval Workflow](./ADR-004-draft-approval-workflow.md)
- [ROADMAP: Manage Duplicates](../../../project-creation-app/ROADMAP.md#manage-duplicates)
- Existing duplicate check functions:
  - `src/services/airtable.ts:checkProjectExists()`
  - `src/services/asana.ts:searchProjectByName()`
  - `src/services/google.ts:searchDriveFolder()`
