# ADR-004: Save as Draft & Share for Approval Workflow

**Status:** Accepted
**Date:** 2025-12-20
**Deciders:** Matt Price
**Technical Story:** Allow coordinators to save project scopes as drafts, then share with a lead for approval before creating resources.

---

## Context and Problem Statement

Currently, the project creation form creates all resources (Airtable records, Asana project, Google documents) immediately upon submission. This presents challenges:

1. **No review process**: Project coordinators cannot get lead approval before resources are created
2. **No iteration**: Once submitted, changes require manual cleanup across systems
3. **Risk of duplicates**: Accidental submissions create orphaned resources
4. **Lack of visibility**: Leads have no visibility into pending project scopes

We need a workflow where:
1. Coordinators can save work-in-progress scopes
2. Leads can review and approve before resource creation
3. Approved scopes can be created by either party
4. Communication happens via email notifications

---

## Decision Drivers

- **Minimal infrastructure**: Avoid new backend services where possible
- **Email notifications**: Users want email alerts, not just in-app notifications
- **Flexibility**: Leads should be able to modify and create, or return to coordinator
- **Auditability**: Track who approved what and when
- **Existing patterns**: Reuse Airtable as the data store, consistent with current architecture

---

## Considered Options

### Option 1: Airtable-Only Storage with Airtable Automations

Store drafts in a new Airtable table and use Airtable's built-in Automations for email notifications.

**Pros:**
- No new backend services
- Zero code for email notifications
- Airtable Automations are reliable and configurable by non-developers
- Draft data stays in same system as final project data

**Cons:**
- Airtable has record size limits (100KB per long text field)
- Automations require Airtable Pro/Enterprise plan

### Option 2: Separate Backend with Email Service

Build a lightweight backend (Netlify Functions) to store drafts and send emails via SendGrid/Resend.

**Pros:**
- No Airtable plan dependency
- More control over email templates
- Could store larger drafts

**Cons:**
- More infrastructure to maintain
- New service dependencies
- Additional cost (email service)
- More code to write and debug

### Option 3: localStorage + Magic Links

Store drafts in browser localStorage, generate shareable links with encoded data.

**Pros:**
- No backend changes
- Instant implementation

**Cons:**
- Data lost if browser storage cleared
- No cross-device access
- Links become very long with encoded form data
- No audit trail

---

## Decision Outcome

**Chosen option: Option 1 - Airtable-Only Storage with Airtable Automations**

This aligns with our existing architecture (Airtable as primary data store) and provides email notifications without writing email infrastructure code. The trade-off of requiring Airtable Pro is acceptable since the organization already has this plan.

---

## Architecture

### Data Model: Project Drafts Table

New Airtable table with the following fields:

| Field | Type | Description |
|-------|------|-------------|
| Project Name | Text | Extracted from form for display |
| Draft Data | Long Text | JSON blob of complete form state |
| Status | Single Select | Draft, Pending Approval, Approved, Changes Requested |
| Created By | Email | Coordinator's email address |
| Created At | Date | Auto-populated |
| Approver | Link to Data Team Members | Selected lead |
| Approver Email | Email | For automation trigger |
| Approver Notes | Long Text | Feedback from lead |
| Decision At | Date | When approved/rejected |
| Share Token | Text | UUID for shareable review URL |

### User Flow

```
Coordinator creates/edits project scope
        │
        ├──▶ [Save as Draft] ──▶ Creates/updates draft record
        │                        Status = "Draft"
        │
        └──▶ [Share for Approval] ──▶ Prompts to select approver
                    │
                    ▼
            Updates draft record:
            - Status = "Pending Approval"
            - Approver = selected lead
            - Approver Email = lead's email
            - Share Token = generated UUID
                    │
                    ▼
            Airtable Automation triggers on Status change
                    │
                    ▼
            Email sent to approver with review link
                    │
                    ▼
Lead opens /review/:shareToken
        │
        ├──▶ Reviews/edits form data
        │
        └──▶ Takes action:
             │
             ├──▶ [Approve & Create] ──▶ Creates all resources
             │                           Status = "Approved"
             │
             ├──▶ [Approve & Return] ──▶ Status = "Approved"
             │                           Coordinator creates resources
             │
             └──▶ [Request Changes] ──▶ Adds notes
                                        Status = "Changes Requested"
                                        (Automation emails coordinator)
```

### URL Structure

| Route | Purpose |
|-------|---------|
| `/` | ProjectForm (existing) |
| `/drafts` | List current user's drafts |
| `/review/:shareToken` | Review/approve a shared draft |

### Email Notifications (Airtable Automations)

**Automation 1: New Approval Request**
- Trigger: Status changes to "Pending Approval"
- Action: Send email to {Approver Email}
- Subject: "Project scope needs your approval: {Project Name}"
- Body includes link to `/review/{Share Token}`

**Automation 2: Changes Requested**
- Trigger: Status changes to "Changes Requested"
- Action: Send email to {Created By}
- Subject: "Changes requested on: {Project Name}"
- Body includes approver notes and link to edit

**Automation 3: Approved (optional)**
- Trigger: Status changes to "Approved"
- Action: Send email to {Created By}
- Subject: "Project scope approved: {Project Name}"

---

## Implementation Components

### New Files

| File | Purpose |
|------|---------|
| `src/services/drafts.js` | Draft CRUD operations |
| `src/pages/ReviewDraft.jsx` | Approval review page |
| `src/pages/MyDrafts.jsx` | User's drafts list |
| `src/components/ui/ShareDraftModal.jsx` | Approver selection modal |

### Modified Files

| File | Changes |
|------|---------|
| `src/services/oauth.js` | Add user email capture |
| `src/pages/ProjectForm.jsx` | Add draft save/share UI |
| `src/App.jsx` | Add new routes |
| `src/config/fields.toml` | Add draft table config |
| `netlify/functions/airtable-callback.js` | Capture user email on OAuth |

### Draft Service API

```javascript
// src/services/drafts.js

// Create a new draft
export async function createDraft(formData, creatorEmail)

// Update existing draft
export async function updateDraft(recordId, formData)

// Get draft by share token (for review page)
export async function getDraftByToken(shareToken)

// Submit draft for approval
export async function submitForApproval(recordId, approverMemberId, approverEmail)

// Approve a draft
export async function approveDraft(recordId, notes)

// Request changes on a draft
export async function requestChanges(recordId, notes)

// Get all drafts for a user
export async function getUserDrafts(userEmail)

// Delete a draft
export async function deleteDraft(recordId)
```

---

## Configuration

Added to `src/config/fields.toml`:

```toml
[airtable.tables]
drafts = "Project Drafts"

[airtable.draft_fields]
project_name = "Project Name"
draft_data = "Draft Data"
status = "Status"
created_by = "Created By"
created_at = "Created At"
approver = "Approver"
approver_email = "Approver Email"
approver_notes = "Approver Notes"
decision_at = "Decision At"
share_token = "Share Token"

[airtable.draft_status_values]
draft = "Draft"
pending = "Pending Approval"
approved = "Approved"
changes_requested = "Changes Requested"
```

---

## Security Considerations

1. **Share Token Privacy**: Tokens are UUIDs, not guessable but anyone with the link can access
   - Acceptable for internal use; leads are trusted
   - Consider adding expiration in future if needed

2. **User Identity**: Email captured during OAuth callback
   - Stored in localStorage alongside tokens
   - Used to filter "My Drafts" list

3. **Data in Transit**: All Airtable API calls over HTTPS

4. **Draft Size Limits**: Airtable long text field limit is 100KB
   - Form data typically < 10KB, well within limits

---

## Trade-offs and Risks

### Trade-offs

| Aspect | Trade-off |
|--------|-----------|
| Email delivery | Dependent on Airtable Automations reliability |
| Draft storage | Limited to Airtable field size (100KB) |
| Share links | Anyone with link can access (no auth) |
| Edit conflicts | No real-time collaboration; last-write-wins |

### Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Airtable Automation quota limits | Monitor usage; Pro plan has generous limits |
| Share token leakage | Tokens are per-draft; can regenerate if compromised |
| Form data format changes | Draft data is versioned; handle migration in code |
| Orphaned drafts | Add cleanup job or manual archive process |

---

## Implementation Phases

1. **Phase 1**: Airtable table setup + drafts.js service
2. **Phase 2**: User identity capture in OAuth flow
3. **Phase 3**: Save/Share UI in ProjectForm
4. **Phase 4**: Review page for approvers
5. **Phase 5**: My Drafts list page
6. **Phase 6**: Airtable Automation configuration (manual setup)

---

## Future Considerations

- **Draft versioning**: Track changes between saves
- **Comments/discussion**: Allow back-and-forth on drafts
- **Expiration**: Auto-expire old drafts
- **Templates**: Save approved drafts as templates for future projects
- **Bulk approval**: Review multiple drafts in one session

---

## References

- [ADR-003: Standalone Web Application](./ADR-003-standalone-web-app.md)
- [Airtable Automations Documentation](https://support.airtable.com/docs/airtable-automations-overview)
- [Airtable Long Text Field Limits](https://support.airtable.com/docs/long-text-field)
