import { useState, useEffect, FormEvent, ChangeEvent } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useForm, useFieldArray } from 'react-hook-form';
import Header from '../components/layout/Header';
import {
  FormSection,
  FormField,
  RoleAssignmentSection,
  OutcomesSection,
  DEFAULT_FORM_VALUES,
} from '../components/form/FormComponents';
import { useTeamMembers } from '../hooks/useTeamMembers';
import { useIntegrationsConfig } from '../hooks/useConfig';
import { getTemplateGidForProjectType } from '../utils/asanaTemplates';
import { getConnectionStatus } from '../services/oauth';
import * as drafts from '../services/drafts';
import * as airtable from '../services/airtable';
import { getRecordUrl } from '../services/airtable';
import * as asana from '../services/asana';
import * as google from '../services/google';
import {
  CheckCircleIcon,
  ArrowPathIcon,
  ArrowTopRightOnSquareIcon,
  XCircleIcon,
  ChatBubbleLeftIcon,
} from '@heroicons/react/24/outline';
import type { FormData, Draft, CreatedResources, ConnectionStatus, RoleAssignment } from '../types';
import type { AsanaUser, RoleAssignment as AsanaRoleAssignment } from '../services/asana';

type LoadingActionType = 'save' | 'approveCreate' | 'approveReturn' | 'requestReview' | null;

interface ActionMessage {
  type: 'success' | 'error';
  text: string;
}

export default function ReviewDraft() {
  const { token } = useParams<{ token: string }>();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [actionMessage, setActionMessage] = useState<ActionMessage | null>(null);
  const [loadingAction, setLoadingAction] = useState<LoadingActionType>(null);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [notes, setNotes] = useState('');
  const [createdResources, setCreatedResources] = useState<CreatedResources>({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const connectionStatus: ConnectionStatus = getConnectionStatus();
  const { data: teamMembers = [], isLoading: loadingMembers } = useTeamMembers();
  const { config: integrationsConfig } = useIntegrationsConfig();

  // Form setup
  const {
    register,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    defaultValues: DEFAULT_FORM_VALUES,
  });

  const { fields: outcomeFields, append: addOutcome, remove: removeOutcome } = useFieldArray({
    control,
    name: 'outcomes',
  });

  const watchedValues = watch();

  // Track form changes
  useEffect(() => {
    if (draft) {
      setHasUnsavedChanges(true);
    }
  }, [JSON.stringify(watchedValues)]);

  // Load draft on mount
  useEffect(() => {
    async function loadDraft() {
      try {
        setLoading(true);
        const draftData = await drafts.getDraftByToken(token!);
        setDraft(draftData);

        // Populate form with draft data
        const formData = draftData.formData || {};
        Object.entries(formData).forEach(([key, value]) => {
          setValue(key as keyof FormData, value as FormData[keyof FormData]);
        });
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    }

    if (token) {
      loadDraft();
    }
  }, [token, setValue]);

  // Get current form data
  const getFormData = (): FormData => watchedValues;

  // Save current form changes to draft
  const saveFormChanges = async (): Promise<boolean> => {
    try {
      await drafts.updateDraftFormData(draft!.id, getFormData());
      setHasUnsavedChanges(false);
      return true;
    } catch (err) {
      setActionMessage({ type: 'error', text: `Failed to save changes: ${(err as Error).message}` });
      return false;
    }
  };

  // Manual save button handler
  const handleSaveChanges = async (): Promise<void> => {
    setLoadingAction('save');
    const success = await saveFormChanges();
    if (success) {
      setActionMessage({ type: 'success', text: 'Changes saved' });
    }
    setLoadingAction(null);
  };

  // Helper function to transform form data with role names for Google templates
  const transformDataWithRoleNames = (data: FormData): FormData & { roles: Record<string, RoleAssignment & { name: string }> } => {
    const transformedData: FormData & { roles: Record<string, RoleAssignment & { name: string }> } = {
      ...data,
      roles: {} as Record<string, RoleAssignment & { name: string }>
    };

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
  const handleApproveAndCreate = async (): Promise<void> => {
    setLoadingAction('approveCreate');
    setActionMessage(null);

    try {
      // Save any form changes first
      await saveFormChanges();

      // Mark as approved
      await drafts.approveDraft(draft!.id, 'Approved and resources created by reviewer');

      const data = getFormData();

      // Create Asana board
      const asanaTeamGid = import.meta.env.VITE_ASANA_TEAM_GID;
      const asanaTemplateGid = getTemplateGidForProjectType(
        data.projectType,
        {
          defaultTemplateGid: integrationsConfig?.asana?.default_template_gid ||
            import.meta.env.VITE_ASANA_TEMPLATE_GID || '',
          templates: integrationsConfig?.asana?.templates || {},
        }
      );

      if (asanaTemplateGid && asanaTeamGid && connectionStatus.asana) {
        const user = await asana.getCurrentUser();
        const workspaceGid = user.workspaces?.[0]?.gid;
        let asanaUsers: AsanaUser[] = [];
        if (workspaceGid) {
          asanaUsers = await asana.getWorkspaceUsers(workspaceGid);
        }

        const asanaRoleAssignments: AsanaRoleAssignment[] = [];
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

        let folderId: string;
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
          // Populate tables for milestones and staff
          await google.populateDocWithTables(doc.id, transformedData, teamMembers);
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

        const roleAssignments: Record<string, { memberId: string; fte: string }> = {};
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

        const airtableUrl = getRecordUrl(projectId, 'projects');
        setCreatedResources(prev => ({ ...prev, airtableProjectId: projectId, airtableUrl }));
      }

      setActionMessage({
        type: 'success',
        text: 'All resources created successfully! Draft approved.',
      });
    } catch (err) {
      setActionMessage({ type: 'error', text: (err as Error).message });
    } finally {
      setLoadingAction(null);
    }
  };

  // Approve and return to coordinator
  const handleApproveAndReturn = async (): Promise<void> => {
    setLoadingAction('approveReturn');
    try {
      // Save any form changes first
      await saveFormChanges();

      await drafts.approveDraft(draft!.id, 'Approved by reviewer - coordinator to create resources');
      setActionMessage({
        type: 'success',
        text: 'Draft approved! The coordinator has been notified to create resources.',
      });
      setDraft(prev => prev ? { ...prev, status: 'Approved' } : null);
    } catch (err) {
      setActionMessage({ type: 'error', text: (err as Error).message });
    } finally {
      setLoadingAction(null);
    }
  };

  // Request further review - save changes and send back to coordinator
  const handleRequestFurtherReview = async (): Promise<void> => {
    if (!notes.trim()) {
      setActionMessage({ type: 'error', text: 'Please provide feedback notes' });
      return;
    }

    setLoadingAction('requestReview');
    try {
      // Save any form changes first
      await saveFormChanges();

      await drafts.requestChanges(draft!.id, notes);
      setActionMessage({
        type: 'success',
        text: 'Feedback sent. The coordinator has been notified to review your changes.',
      });
      setDraft(prev => prev ? { ...prev, status: 'Changes Requested' } : null);
      setShowNotesModal(false);
      setNotes('');
    } catch (err) {
      setActionMessage({ type: 'error', text: (err as Error).message });
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
            {hasUnsavedChanges && !isAlreadyProcessed && (
              <span className="text-sm text-orange-600">Unsaved changes</span>
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
        <form onSubmit={(e: FormEvent) => e.preventDefault()}>
          {/* Basics Section */}
          <FormSection id="basics" title="Project Basics">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField label="Project Name" required error={errors.projectName}>
                <input
                  type="text"
                  className="form-input"
                  disabled={isAlreadyProcessed}
                  {...register('projectName')}
                />
              </FormField>

              <FormField label="Project Acronym" error={errors.projectAcronym}>
                <input
                  type="text"
                  className="form-input"
                  disabled={isAlreadyProcessed}
                  {...register('projectAcronym')}
                />
              </FormField>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField label="Start Date" required error={errors.startDate}>
                <input
                  type="date"
                  className="form-input"
                  disabled={isAlreadyProcessed}
                  {...register('startDate')}
                />
              </FormField>

              <FormField label="End Date" required error={errors.endDate}>
                <input
                  type="date"
                  className="form-input"
                  disabled={isAlreadyProcessed}
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
                disabled={isAlreadyProcessed}
                {...register('description')}
              />
            </FormField>

            <FormField label="Objectives" required error={errors.objectives}>
              <textarea
                className="form-input min-h-[150px]"
                disabled={isAlreadyProcessed}
                {...register('objectives')}
              />
            </FormField>
          </FormSection>

          {/* Team Section */}
          <FormSection id="team" title="Project Team">
            {loadingMembers ? (
              <div className="py-8 text-center text-gray-500">Loading team members...</div>
            ) : (
              <RoleAssignmentSection
                register={register}
                errors={errors}
                teamMembers={teamMembers}
                disabled={isAlreadyProcessed}
              />
            )}
          </FormSection>

          {/* Outcomes Section */}
          <FormSection id="outcomes" title="Outcomes & Milestones">
            <OutcomesSection
              fields={outcomeFields}
              register={register}
              append={addOutcome}
              remove={removeOutcome}
              disabled={isAlreadyProcessed}
            />
          </FormSection>

          {/* Save Changes Button */}
          {!isAlreadyProcessed && hasUnsavedChanges && (
            <div className="mt-6">
              <button
                type="button"
                onClick={handleSaveChanges}
                disabled={loadingAction === 'save'}
                className="btn-secondary w-full"
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
                <span>Request Further Review</span>
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
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Request Further Review</h3>
              <p className="text-sm text-gray-600 mb-4">
                Your changes will be saved. Add notes explaining what still needs attention or why you're sending it back.
              </p>
              <textarea
                value={notes}
                onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setNotes(e.target.value)}
                placeholder="Enter your notes..."
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
                  onClick={handleRequestFurtherReview}
                  disabled={loadingAction === 'requestReview' || !notes.trim()}
                  className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:bg-gray-300"
                >
                  {loadingAction === 'requestReview' ? 'Sending...' : 'Send for Review'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
