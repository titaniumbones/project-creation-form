import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useForm, useFieldArray } from 'react-hook-form';
import Header from '../components/layout/Header';
import HelpTooltip from '../components/ui/HelpTooltip';
import { useTeamMembers } from '../hooks/useTeamMembers';
import { getConnectionStatus } from '../services/oauth';
import * as drafts from '../services/drafts';
import * as airtable from '../services/airtable';
import { airtableProjectFields, airtableTables } from '../services/airtable';
import * as asana from '../services/asana';
import * as google from '../services/google';
import { debugLogger } from '../services/debugLogger';
import {
  ExclamationTriangleIcon,
  PlusIcon,
  TrashIcon,
  CheckCircleIcon,
  ArrowPathIcon,
  ArrowTopRightOnSquareIcon,
  XCircleIcon,
  ChatBubbleLeftIcon,
} from '@heroicons/react/24/outline';

// Form field wrapper
function FormField({ label, required, helpFile, error, children }) {
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-1">
        <label className="form-label">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
        {helpFile && <HelpTooltip helpFile={helpFile} />}
      </div>
      {children}
      {error && (
        <p className="mt-1 text-sm text-red-600">{error.message}</p>
      )}
    </div>
  );
}

// Form section wrapper
function FormSection({ id, title, children }) {
  return (
    <section id={id} className="form-section scroll-mt-24">
      <h2 className="form-section-title mb-4">{title}</h2>
      {children}
    </section>
  );
}

// Action button component for individual steps
function ActionButton({ label, onClick, isLoading, isComplete, url, disabled }) {
  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
      <div className="flex items-center space-x-3">
        {isComplete ? (
          <CheckCircleIcon className="w-5 h-5 text-green-500" />
        ) : (
          <div className="w-5 h-5 rounded-full border-2 border-gray-300" />
        )}
        <span className={`font-medium ${isComplete ? 'text-green-700' : 'text-gray-700'}`}>
          {label}
        </span>
      </div>
      <div className="flex items-center space-x-2">
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800"
          >
            <ArrowTopRightOnSquareIcon className="w-5 h-5" />
          </a>
        )}
        <button
          type="button"
          onClick={onClick}
          disabled={disabled || isLoading}
          className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
            isComplete
              ? 'bg-green-100 text-green-700 hover:bg-green-200'
              : 'bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed'
          }`}
        >
          {isLoading ? (
            <ArrowPathIcon className="w-4 h-4 animate-spin" />
          ) : isComplete ? (
            'Recreate'
          ) : (
            'Create'
          )}
        </button>
      </div>
    </div>
  );
}

export default function ReviewDraft() {
  const { token } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [draft, setDraft] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [actionMessage, setActionMessage] = useState(null);
  const [loadingAction, setLoadingAction] = useState(null);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [notes, setNotes] = useState('');
  const [createdResources, setCreatedResources] = useState({});

  const connectionStatus = getConnectionStatus();
  const { data: teamMembers = [], isLoading: loadingMembers } = useTeamMembers();

  // Form setup
  const {
    register,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm({
    defaultValues: {
      projectName: '',
      projectAcronym: '',
      startDate: '',
      endDate: '',
      description: '',
      objectives: '',
      roles: {
        project_owner: { memberId: '', fte: '' },
        project_coordinator: { memberId: '', fte: '' },
        technical_support: { memberId: '', fte: '' },
        comms_support: { memberId: '', fte: '' },
        oversight: { memberId: '', fte: '' },
        other: { memberId: '', fte: '' },
      },
      outcomes: [{ name: '', description: '', dueDate: '' }],
    },
  });

  const { fields: outcomeFields, append: addOutcome, remove: removeOutcome } = useFieldArray({
    control,
    name: 'outcomes',
  });

  const watchedValues = watch();

  // Load draft on mount
  useEffect(() => {
    async function loadDraft() {
      try {
        setLoading(true);
        const draftData = await drafts.getDraftByToken(token);
        setDraft(draftData);

        // Populate form with draft data
        const formData = draftData.formData || {};
        Object.entries(formData).forEach(([key, value]) => {
          setValue(key, value);
        });
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    if (token) {
      loadDraft();
    }
  }, [token, setValue]);

  // Get current form data
  const getFormData = () => watchedValues;

  // Update draft with current form data
  const handleSaveChanges = async () => {
    setLoadingAction('save');
    try {
      await drafts.updateDraftFormData(draft.id, getFormData());
      setActionMessage({ type: 'success', text: 'Changes saved' });
      setIsEditing(false);
    } catch (err) {
      setActionMessage({ type: 'error', text: err.message });
    } finally {
      setLoadingAction(null);
    }
  };

  // Helper function to transform form data with role names for Google templates
  const transformDataWithRoleNames = (data) => {
    const transformedData = { ...data, roles: {} };

    for (const [roleKey, roleData] of Object.entries(data.roles || {})) {
      if (roleData?.memberId) {
        const member = teamMembers.find(m => m.id === roleData.memberId);
        transformedData.roles[roleKey] = {
          ...roleData,
          name: member?.name || '',
        };
      }
    }

    return transformedData;
  };

  // Approve and create all resources
  const handleApproveAndCreate = async () => {
    setLoadingAction('approveCreate');
    setActionMessage(null);

    try {
      // Mark as approved first
      await drafts.approveDraft(draft.id, 'Approved and resources created by reviewer');

      const data = getFormData();

      // Create Asana board
      const asanaTemplateGid = import.meta.env.VITE_ASANA_TEMPLATE_GID;
      const asanaTeamGid = import.meta.env.VITE_ASANA_TEAM_GID;

      if (asanaTemplateGid && asanaTeamGid && connectionStatus.asana) {
        const user = await asana.getCurrentUser();
        const workspaceGid = user.workspaces?.[0]?.gid;
        let asanaUsers = [];
        if (workspaceGid) {
          asanaUsers = await asana.getWorkspaceUsers(workspaceGid);
        }

        const asanaRoleAssignments = [];
        const coordinatorId = data.roles.project_coordinator?.memberId;
        const coordinatorMember = teamMembers.find(m => m.id === coordinatorId);
        if (coordinatorMember) {
          const match = asana.findBestUserMatch(coordinatorMember.name, asanaUsers);
          if (match?.user?.gid) {
            asanaRoleAssignments.push({ roleName: 'coordinator', userGid: match.user.gid });
          }
        }

        const ownerId = data.roles.project_owner?.memberId;
        const ownerMember = teamMembers.find(m => m.id === ownerId);
        if (ownerMember) {
          const match = asana.findBestUserMatch(ownerMember.name, asanaUsers);
          if (match?.user?.gid) {
            asanaRoleAssignments.push({ roleName: 'owner', userGid: match.user.gid });
          }
        }

        const asanaProjectGid = await asana.createProjectFromTemplate(
          asanaTemplateGid,
          data.projectName,
          asanaTeamGid,
          data.startDate,
          asanaRoleAssignments
        );

        const asanaUrl = asana.getProjectUrl(asanaProjectGid);
        setCreatedResources(prev => ({ ...prev, asanaProjectGid, asanaUrl }));
      }

      // Create Google folder and docs
      const sharedDriveId = import.meta.env.VITE_GOOGLE_SHARED_DRIVE_ID;
      const parentFolderId = import.meta.env.VITE_GOOGLE_PROJECTS_FOLDER_ID;
      const scopingDocTemplateId = import.meta.env.VITE_GOOGLE_SCOPING_DOC_TEMPLATE_ID;
      const kickoffDeckTemplateId = import.meta.env.VITE_GOOGLE_KICKOFF_DECK_TEMPLATE_ID;

      if (parentFolderId && connectionStatus.google) {
        const folderName = data.projectAcronym || data.projectName;
        let folders = await google.searchDriveFolder(folderName, sharedDriveId, parentFolderId);

        let folderId;
        if (folders.length > 0) {
          folderId = folders[0].id;
        } else {
          const newFolder = await google.createDriveFolder(folderName, sharedDriveId, parentFolderId);
          folderId = newFolder.id;
        }
        const folderUrl = google.getFolderUrl(folderId);
        setCreatedResources(prev => ({ ...prev, googleFolderId: folderId, folderUrl }));

        if (scopingDocTemplateId) {
          const docName = `${data.projectName} - Scoping Document`;
          const doc = await google.copyTemplate(scopingDocTemplateId, folderId, docName);
          const transformedData = transformDataWithRoleNames(data);
          const replacements = google.buildReplacements(transformedData);
          await google.populateDoc(doc.id, replacements);
          const scopingDocUrl = google.getDocUrl(doc.id);
          setCreatedResources(prev => ({ ...prev, scopingDocId: doc.id, scopingDocUrl }));
        }

        if (kickoffDeckTemplateId) {
          const deckName = `${data.projectName} - Kickoff Deck`;
          const deck = await google.copyTemplate(kickoffDeckTemplateId, folderId, deckName);
          const transformedData = transformDataWithRoleNames(data);
          const replacements = google.buildReplacements(transformedData);
          await google.populateSlides(deck.id, replacements);
          const kickoffDeckUrl = google.getSlidesUrl(deck.id);
          setCreatedResources(prev => ({ ...prev, kickoffDeckId: deck.id, kickoffDeckUrl }));
        }
      }

      // Create Airtable records
      if (connectionStatus.airtable) {
        const projectRecord = await airtable.createProject({
          name: data.projectName,
          acronym: data.projectAcronym,
          description: data.description,
          objectives: data.objectives,
          startDate: data.startDate,
          endDate: data.endDate,
        });

        const projectId = projectRecord.id;
        const validOutcomes = data.outcomes.filter(o => o.name?.trim());
        if (validOutcomes.length > 0) {
          await airtable.createMilestones(projectId, validOutcomes);
        }

        const roleAssignments = {};
        for (const [roleKey, roleData] of Object.entries(data.roles)) {
          if (roleData?.memberId) {
            roleAssignments[roleKey] = {
              memberId: roleData.memberId,
              fte: roleData.fte,
            };
          }
        }
        if (Object.keys(roleAssignments).length > 0) {
          await airtable.createAssignments(projectId, roleAssignments);
        }

        const airtableUrl = `https://airtable.com/${import.meta.env.VITE_AIRTABLE_BASE_ID}/${projectId}`;
        setCreatedResources(prev => ({ ...prev, airtableProjectId: projectId, airtableUrl }));
      }

      setActionMessage({
        type: 'success',
        text: 'All resources created successfully! Draft approved.',
      });
    } catch (err) {
      setActionMessage({ type: 'error', text: err.message });
    } finally {
      setLoadingAction(null);
    }
  };

  // Approve and return to coordinator
  const handleApproveAndReturn = async () => {
    setLoadingAction('approveReturn');
    try {
      await drafts.approveDraft(draft.id, 'Approved by reviewer - coordinator to create resources');
      setActionMessage({
        type: 'success',
        text: 'Draft approved! The coordinator has been notified to create resources.',
      });
      setDraft(prev => ({ ...prev, status: 'Approved' }));
    } catch (err) {
      setActionMessage({ type: 'error', text: err.message });
    } finally {
      setLoadingAction(null);
    }
  };

  // Request changes
  const handleRequestChanges = async () => {
    if (!notes.trim()) {
      setActionMessage({ type: 'error', text: 'Please provide feedback notes' });
      return;
    }

    setLoadingAction('requestChanges');
    try {
      await drafts.requestChanges(draft.id, notes);
      setActionMessage({
        type: 'success',
        text: 'Changes requested. The coordinator has been notified.',
      });
      setDraft(prev => ({ ...prev, status: 'Changes Requested' }));
      setShowNotesModal(false);
      setNotes('');
    } catch (err) {
      setActionMessage({ type: 'error', text: err.message });
    } finally {
      setLoadingAction(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main className="max-w-3xl mx-auto px-4 py-8">
          <div className="flex items-center justify-center py-12">
            <ArrowPathIcon className="w-8 h-8 animate-spin text-blue-600" />
            <span className="ml-3 text-gray-600">Loading draft...</span>
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main className="max-w-3xl mx-auto px-4 py-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <XCircleIcon className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-red-800 mb-2">Unable to Load Draft</h2>
            <p className="text-red-700">{error}</p>
            <Link
              to="/"
              className="inline-block mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              Return Home
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const isAlreadyProcessed = draft?.status === 'Approved' || draft?.status === 'Changes Requested';

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="max-w-3xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-2 text-sm text-gray-500 mb-2">
            <Link to="/" className="hover:text-blue-600">Home</Link>
            <span>/</span>
            <span>Review Draft</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Review Project Draft
          </h1>
          <p className="text-gray-600">
            Review the project scope below and approve or request changes.
          </p>
        </div>

        {/* Draft Info Banner */}
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="font-semibold text-blue-900">{draft?.projectName || 'Untitled Draft'}</h2>
              <p className="text-sm text-blue-700 mt-1">
                Created by: {draft?.createdBy || 'Unknown'}
              </p>
              <p className="text-sm text-blue-700">
                Status:{' '}
                <span className={`font-medium ${
                  draft?.status === 'Approved' ? 'text-green-700' :
                  draft?.status === 'Changes Requested' ? 'text-orange-700' :
                  'text-yellow-700'
                }`}>
                  {draft?.status || 'Pending'}
                </span>
              </p>
            </div>
            {!isAlreadyProcessed && (
              <button
                type="button"
                onClick={() => setIsEditing(!isEditing)}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                {isEditing ? 'Cancel Editing' : 'Edit Draft'}
              </button>
            )}
          </div>
        </div>

        {/* Action Messages */}
        {actionMessage && (
          <div className={`mb-6 p-4 rounded-lg ${
            actionMessage.type === 'success'
              ? 'bg-green-50 border border-green-200 text-green-700'
              : 'bg-red-50 border border-red-200 text-red-700'
          }`}>
            {actionMessage.text}
          </div>
        )}

        {/* Previous Notes */}
        {draft?.approverNotes && (
          <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <h3 className="font-medium text-yellow-800 mb-2">Reviewer Notes:</h3>
            <p className="text-yellow-700 whitespace-pre-wrap">{draft.approverNotes}</p>
          </div>
        )}

        {/* Form Content */}
        <form onSubmit={(e) => e.preventDefault()}>
          {/* Basics Section */}
          <FormSection id="basics" title="Project Basics">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField label="Project Name" required error={errors.projectName}>
                <input
                  type="text"
                  className="form-input"
                  disabled={!isEditing}
                  {...register('projectName')}
                />
              </FormField>

              <FormField label="Project Acronym" error={errors.projectAcronym}>
                <input
                  type="text"
                  className="form-input"
                  disabled={!isEditing}
                  {...register('projectAcronym')}
                />
              </FormField>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField label="Start Date" required error={errors.startDate}>
                <input
                  type="date"
                  className="form-input"
                  disabled={!isEditing}
                  {...register('startDate')}
                />
              </FormField>

              <FormField label="End Date" required error={errors.endDate}>
                <input
                  type="date"
                  className="form-input"
                  disabled={!isEditing}
                  {...register('endDate')}
                />
              </FormField>
            </div>
          </FormSection>

          {/* Description Section */}
          <FormSection id="description" title="Project Description">
            <FormField label="Description" required error={errors.description}>
              <textarea
                className="form-input min-h-[200px]"
                disabled={!isEditing}
                {...register('description')}
              />
            </FormField>

            <FormField label="Objectives" required error={errors.objectives}>
              <textarea
                className="form-input min-h-[150px]"
                disabled={!isEditing}
                {...register('objectives')}
              />
            </FormField>
          </FormSection>

          {/* Team Section */}
          <FormSection id="team" title="Project Team">
            {loadingMembers ? (
              <div className="py-8 text-center text-gray-500">Loading team members...</div>
            ) : (
              <div className="space-y-4">
                {[
                  { key: 'project_owner', label: 'Project Owner', required: true },
                  { key: 'project_coordinator', label: 'Project Coordinator', required: true },
                  { key: 'technical_support', label: 'Technical Support' },
                  { key: 'comms_support', label: 'Communications Support' },
                  { key: 'oversight', label: 'Oversight' },
                  { key: 'other', label: 'Other' },
                ].map((role) => (
                  <FormField
                    key={role.key}
                    label={role.label}
                    required={role.required}
                    error={errors.roles?.[role.key]?.memberId}
                  >
                    <div className="flex gap-3">
                      <select
                        className="form-input flex-1"
                        disabled={!isEditing}
                        {...register(`roles.${role.key}.memberId`)}
                      >
                        <option value="">Select team member...</option>
                        {teamMembers.map((member) => (
                          <option key={member.id} value={member.id}>
                            {member.name}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        className="form-input w-24"
                        placeholder="% FTE"
                        disabled={!isEditing}
                        {...register(`roles.${role.key}.fte`)}
                      />
                    </div>
                  </FormField>
                ))}
              </div>
            )}
          </FormSection>

          {/* Outcomes Section */}
          <FormSection id="outcomes" title="Outcomes & Milestones">
            <div className="space-y-4">
              {outcomeFields.map((field, index) => (
                <div
                  key={field.id}
                  className="p-4 bg-gray-50 rounded-lg border border-gray-200"
                >
                  <div className="flex justify-between items-start mb-3">
                    <span className="text-sm font-medium text-gray-500">
                      Outcome {index + 1}
                    </span>
                    {isEditing && outcomeFields.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeOutcome(index)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="space-y-3">
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Outcome name"
                      disabled={!isEditing}
                      {...register(`outcomes.${index}.name`)}
                    />

                    <textarea
                      className="form-input"
                      placeholder="Brief description (optional)"
                      rows={2}
                      disabled={!isEditing}
                      {...register(`outcomes.${index}.description`)}
                    />

                    <input
                      type="date"
                      className="form-input"
                      disabled={!isEditing}
                      {...register(`outcomes.${index}.dueDate`)}
                    />
                  </div>
                </div>
              ))}

              {isEditing && (
                <button
                  type="button"
                  onClick={() => addOutcome({ name: '', description: '', dueDate: '' })}
                  className="btn-secondary w-full flex items-center justify-center space-x-2"
                >
                  <PlusIcon className="w-4 h-4" />
                  <span>Add Outcome</span>
                </button>
              )}
            </div>
          </FormSection>

          {/* Save Changes Button (when editing) */}
          {isEditing && (
            <div className="mt-6">
              <button
                type="button"
                onClick={handleSaveChanges}
                disabled={loadingAction === 'save'}
                className="btn-primary w-full"
              >
                {loadingAction === 'save' ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          )}
        </form>

        {/* Approval Actions */}
        {!isAlreadyProcessed && (
          <div className="mt-8 p-6 bg-white rounded-lg border border-gray-200 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Approval Decision</h3>

            <div className="space-y-3">
              <button
                type="button"
                onClick={handleApproveAndCreate}
                disabled={loadingAction !== null}
                className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                {loadingAction === 'approveCreate' ? (
                  <ArrowPathIcon className="w-5 h-5 animate-spin" />
                ) : (
                  <CheckCircleIcon className="w-5 h-5" />
                )}
                <span>Approve & Create All Resources</span>
              </button>

              <button
                type="button"
                onClick={handleApproveAndReturn}
                disabled={loadingAction !== null}
                className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                {loadingAction === 'approveReturn' ? (
                  <ArrowPathIcon className="w-5 h-5 animate-spin" />
                ) : (
                  <CheckCircleIcon className="w-5 h-5" />
                )}
                <span>Approve & Return to Coordinator</span>
              </button>

              <button
                type="button"
                onClick={() => setShowNotesModal(true)}
                disabled={loadingAction !== null}
                className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                <ChatBubbleLeftIcon className="w-5 h-5" />
                <span>Request Changes</span>
              </button>
            </div>
          </div>
        )}

        {/* Created Resources */}
        {Object.keys(createdResources).length > 0 && (
          <div className="mt-8 p-6 bg-green-50 rounded-lg border border-green-200">
            <h3 className="text-lg font-semibold text-green-800 mb-4">Created Resources</h3>
            <div className="space-y-2">
              {createdResources.airtableUrl && (
                <a
                  href={createdResources.airtableUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-2 text-green-700 hover:text-green-900"
                >
                  <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                  <span>Airtable Project</span>
                </a>
              )}
              {createdResources.asanaUrl && (
                <a
                  href={createdResources.asanaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-2 text-green-700 hover:text-green-900"
                >
                  <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                  <span>Asana Board</span>
                </a>
              )}
              {createdResources.folderUrl && (
                <a
                  href={createdResources.folderUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-2 text-green-700 hover:text-green-900"
                >
                  <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                  <span>Google Drive Folder</span>
                </a>
              )}
              {createdResources.scopingDocUrl && (
                <a
                  href={createdResources.scopingDocUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-2 text-green-700 hover:text-green-900"
                >
                  <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                  <span>Scoping Document</span>
                </a>
              )}
              {createdResources.kickoffDeckUrl && (
                <a
                  href={createdResources.kickoffDeckUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-2 text-green-700 hover:text-green-900"
                >
                  <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                  <span>Kickoff Deck</span>
                </a>
              )}
            </div>
          </div>
        )}

        {/* Notes Modal */}
        {showNotesModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Request Changes</h3>
              <p className="text-sm text-gray-600 mb-4">
                Provide feedback on what changes are needed. This will be sent to the coordinator.
              </p>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Enter your feedback..."
                className="form-input min-h-[150px] mb-4"
              />
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowNotesModal(false);
                    setNotes('');
                  }}
                  className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleRequestChanges}
                  disabled={loadingAction === 'requestChanges' || !notes.trim()}
                  className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:bg-gray-300"
                >
                  {loadingAction === 'requestChanges' ? 'Sending...' : 'Submit Feedback'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
