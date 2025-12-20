import { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import Header from '../components/layout/Header';
import HelpTooltip from '../components/ui/HelpTooltip';
import { useTeamMembers } from '../hooks/useTeamMembers';
import { getConnectionStatus } from '../services/oauth';
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
} from '@heroicons/react/24/outline';

// Draft storage key
const DRAFT_KEY = 'project_creator_draft';
const CREATED_RESOURCES_KEY = 'project_creator_resources';

// Action button component for individual steps
function ActionButton({ label, onClick, isLoading, isComplete, url, disabled, error }) {
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
      {error && <p className="text-sm text-red-600 mt-1">{error}</p>}
    </div>
  );
}

// Section progress indicator
function ProgressIndicator({ sections, currentSection }) {
  return (
    <div className="hidden lg:block fixed left-8 top-1/2 -translate-y-1/2">
      <nav className="space-y-2">
        {sections.map((section) => (
          <a
            key={section.id}
            href={`#${section.id}`}
            className={`block px-3 py-2 text-sm rounded-lg transition-colors ${
              currentSection === section.id
                ? 'bg-blue-100 text-blue-700 font-medium'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            }`}
          >
            {section.label}
          </a>
        ))}
      </nav>
    </div>
  );
}

// Form section wrapper
function FormSection({ id, title, children, helpFile }) {
  return (
    <section id={id} className="form-section scroll-mt-24">
      <div className="flex items-center justify-between mb-4">
        <h2 className="form-section-title">{title}</h2>
        {helpFile && <HelpTooltip helpFile={helpFile} />}
      </div>
      {children}
    </section>
  );
}

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

export default function ProjectForm() {
  const navigate = useNavigate();
  const [currentSection, setCurrentSection] = useState('basics');
  const [submitError, setSubmitError] = useState(null);

  // Track which action is currently loading
  const [loadingAction, setLoadingAction] = useState(null);

  // Track created resources
  const [createdResources, setCreatedResources] = useState(() => {
    const saved = localStorage.getItem(CREATED_RESOURCES_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return {};
      }
    }
    return {};
  });

  // Save created resources to localStorage
  const updateCreatedResources = (updates) => {
    setCreatedResources((prev) => {
      const next = { ...prev, ...updates };
      localStorage.setItem(CREATED_RESOURCES_KEY, JSON.stringify(next));
      return next;
    });
  };

  // Clear all created resources (for starting fresh)
  const clearCreatedResources = () => {
    setCreatedResources({});
    localStorage.removeItem(CREATED_RESOURCES_KEY);
  };

  // Debug mode state
  const [debugMode, setDebugMode] = useState(false);

  // Toggle debug mode
  const handleToggleDebug = () => {
    if (!debugMode) {
      debugLogger.start();
      debugLogger.log('form', 'Debug session started - form data snapshot', getFormData());
    } else {
      debugLogger.stop();
    }
    setDebugMode(!debugMode);
  };

  // Download debug log
  const handleDownloadDebugLog = () => {
    debugLogger.downloadLogs();
  };

  const connectionStatus = getConnectionStatus();
  const isConnected = connectionStatus.airtable;

  const { data: teamMembers = [], isLoading: loadingMembers } = useTeamMembers();

  // Form setup with draft restoration
  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isDirty },
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

  // Outcomes field array
  const { fields: outcomeFields, append: addOutcome, remove: removeOutcome } = useFieldArray({
    control,
    name: 'outcomes',
  });

  // Watch form values for draft saving
  const watchedValues = watch();

  // Load draft on mount
  useEffect(() => {
    const saved = localStorage.getItem(DRAFT_KEY);
    if (saved) {
      try {
        const draft = JSON.parse(saved);
        Object.entries(draft).forEach(([key, value]) => {
          setValue(key, value);
        });
      } catch (e) {
        console.warn('Failed to restore draft:', e);
      }
    }
  }, [setValue]);

  // Save draft on changes (debounced)
  useEffect(() => {
    if (!isDirty) return;

    const timeout = setTimeout(() => {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(watchedValues));
    }, 1000);

    return () => clearTimeout(timeout);
  }, [watchedValues, isDirty]);

  // Track current section based on scroll
  useEffect(() => {
    const sections = ['basics', 'description', 'team', 'outcomes'];

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setCurrentSection(entry.target.id);
          }
        });
      },
      { rootMargin: '-20% 0px -70% 0px' }
    );

    sections.forEach((id) => {
      const element = document.getElementById(id);
      if (element) observer.observe(element);
    });

    return () => observer.disconnect();
  }, []);

  // Get current form data
  const getFormData = () => watchedValues;

  // === INDIVIDUAL ACTION HANDLERS ===

  // 1. Create Asana Board (from template)
  const handleCreateAsanaBoard = async () => {
    const data = getFormData();
    setLoadingAction('asanaBoard');
    setSubmitError(null);

    try {
      const asanaTemplateGid = import.meta.env.VITE_ASANA_TEMPLATE_GID;
      const asanaTeamGid = import.meta.env.VITE_ASANA_TEAM_GID;

      if (!asanaTemplateGid || !asanaTeamGid) {
        throw new Error('Asana template or team GID not configured');
      }

      // Get coordinator name for Asana user matching
      const coordinatorId = data.roles.project_coordinator?.memberId;
      const coordinatorMember = teamMembers.find(m => m.id === coordinatorId);

      // Get Asana users for matching
      const user = await asana.getCurrentUser();
      const workspaceGid = user.workspaces?.[0]?.gid;
      let asanaUsers = [];
      if (workspaceGid) {
        asanaUsers = await asana.getWorkspaceUsers(workspaceGid);
      }

      // Build role assignments for Asana
      const asanaRoleAssignments = [];
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
      updateCreatedResources({ asanaProjectGid, asanaUrl });
    } catch (err) {
      setSubmitError(`Asana Board: ${err.message}`);
    } finally {
      setLoadingAction(null);
    }
  };

  // 2. Create Asana Milestone Tickets (from outcomes)
  const handleCreateAsanaMilestones = async () => {
    const data = getFormData();
    setLoadingAction('asanaMilestones');
    setSubmitError(null);

    try {
      if (!createdResources.asanaProjectGid) {
        throw new Error('Create Asana Board first');
      }

      const validOutcomes = data.outcomes.filter(o => o.name?.trim());
      if (validOutcomes.length === 0) {
        throw new Error('No outcomes to create');
      }

      // Create tasks for each outcome
      for (const outcome of validOutcomes) {
        await asana.createTask(createdResources.asanaProjectGid, {
          name: outcome.name,
          description: outcome.description || '',
          dueDate: outcome.dueDate,
        });
      }

      updateCreatedResources({ asanaMilestonesCreated: true });
    } catch (err) {
      setSubmitError(`Asana Milestones: ${err.message}`);
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

    debugLogger.logTransform('formRoles', 'googleRoles', data.roles, transformedData.roles);
    return transformedData;
  };

  // 3. Create Google Scoping Doc
  const handleCreateScopingDoc = async () => {
    const data = getFormData();
    setLoadingAction('scopingDoc');
    setSubmitError(null);

    debugLogger.log('form', 'Creating scoping doc', { projectName: data.projectName });

    try {
      const sharedDriveId = import.meta.env.VITE_GOOGLE_SHARED_DRIVE_ID;
      const parentFolderId = import.meta.env.VITE_GOOGLE_PROJECTS_FOLDER_ID;
      const scopingDocTemplateId = import.meta.env.VITE_GOOGLE_SCOPING_DOC_TEMPLATE_ID;

      if (!parentFolderId) {
        throw new Error('Google projects folder not configured');
      }
      if (!scopingDocTemplateId) {
        throw new Error('Scoping doc template not configured');
      }

      // Search for existing folder or create new one
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

      // Create scoping document from template
      const docName = `${data.projectName} - Scoping Document`;
      const doc = await google.copyTemplate(scopingDocTemplateId, folderId, docName);

      // Transform data to include role names, then populate placeholders
      const transformedData = transformDataWithRoleNames(data);
      const replacements = google.buildReplacements(transformedData);
      await google.populateDoc(doc.id, replacements);

      const scopingDocUrl = google.getDocUrl(doc.id);
      updateCreatedResources({ googleFolderId: folderId, folderUrl, scopingDocId: doc.id, scopingDocUrl });
    } catch (err) {
      debugLogger.logError('google', 'Failed to create scoping doc', err);
      setSubmitError(`Scoping Doc: ${err.message}`);
    } finally {
      setLoadingAction(null);
    }
  };

  // 4. Create Google Kickoff Deck
  const handleCreateKickoffDeck = async () => {
    const data = getFormData();
    setLoadingAction('kickoffDeck');
    setSubmitError(null);

    debugLogger.log('form', 'Creating kickoff deck', { projectName: data.projectName });

    try {
      const kickoffDeckTemplateId = import.meta.env.VITE_GOOGLE_KICKOFF_DECK_TEMPLATE_ID;

      if (!kickoffDeckTemplateId) {
        throw new Error('Kickoff deck template not configured');
      }

      // Need folder first
      let folderId = createdResources.googleFolderId;
      if (!folderId) {
        // Create folder if not exists
        const sharedDriveId = import.meta.env.VITE_GOOGLE_SHARED_DRIVE_ID;
        const parentFolderId = import.meta.env.VITE_GOOGLE_PROJECTS_FOLDER_ID;
        const folderName = data.projectAcronym || data.projectName;

        let folders = await google.searchDriveFolder(folderName, sharedDriveId, parentFolderId);
        if (folders.length > 0) {
          folderId = folders[0].id;
        } else {
          const newFolder = await google.createDriveFolder(folderName, sharedDriveId, parentFolderId);
          folderId = newFolder.id;
        }
        updateCreatedResources({ googleFolderId: folderId, folderUrl: google.getFolderUrl(folderId) });
      }

      // Create kickoff deck from template
      const deckName = `${data.projectName} - Kickoff Deck`;
      const deck = await google.copyTemplate(kickoffDeckTemplateId, folderId, deckName);

      // Transform data to include role names, then populate placeholders
      const transformedData = transformDataWithRoleNames(data);
      const replacements = google.buildReplacements(transformedData);
      await google.populateSlides(deck.id, replacements);

      const kickoffDeckUrl = google.getSlidesUrl(deck.id);
      updateCreatedResources({ kickoffDeckId: deck.id, kickoffDeckUrl });
    } catch (err) {
      debugLogger.logError('google', 'Failed to create kickoff deck', err);
      setSubmitError(`Kickoff Deck: ${err.message}`);
    } finally {
      setLoadingAction(null);
    }
  };

  // 5. Create Airtable Records (project, milestones, assignments) and populate URLs
  const handleCreateAirtableRecords = async () => {
    const data = getFormData();
    setLoadingAction('airtable');
    setSubmitError(null);

    try {
      // Create project record
      const projectRecord = await airtable.createProject({
        name: data.projectName,
        acronym: data.projectAcronym,
        description: data.description,
        objectives: data.objectives,
        startDate: data.startDate,
        endDate: data.endDate,
      });
      const projectId = projectRecord.id;

      // Create milestone records
      const validOutcomes = data.outcomes.filter(o => o.name?.trim());
      if (validOutcomes.length > 0) {
        await airtable.createMilestones(projectId, validOutcomes);
      }

      // Create role assignments (with FTE)
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

      // Update project with URLs from other resources
      const urlUpdates = {};
      const f = airtableProjectFields;
      if (createdResources.asanaUrl) {
        urlUpdates[f.asana_url || 'Asana Board'] = createdResources.asanaUrl;
      }
      if (createdResources.scopingDocUrl) {
        urlUpdates[f.scoping_doc_url || 'Scoping Doc'] = createdResources.scopingDocUrl;
      }
      if (createdResources.folderUrl) {
        urlUpdates[f.folder_url || 'Project Folder'] = createdResources.folderUrl;
      }

      if (Object.keys(urlUpdates).length > 0) {
        const tableName = airtableTables.projects || 'Projects';
        await airtable.updateRecord(tableName, projectId, urlUpdates);
      }

      const airtableUrl = `https://airtable.com/${import.meta.env.VITE_AIRTABLE_BASE_ID}/${projectId}`;
      updateCreatedResources({ airtableProjectId: projectId, airtableUrl });
    } catch (err) {
      setSubmitError(`Airtable: ${err.message}`);
    } finally {
      setLoadingAction(null);
    }
  };

  // Navigate to success page
  const handleFinish = () => {
    localStorage.removeItem(DRAFT_KEY);
    navigate('/success', {
      state: {
        projectName: watchedValues.projectName,
        airtableUrl: createdResources.airtableUrl,
        asanaUrl: createdResources.asanaUrl,
        driveUrl: createdResources.folderUrl,
        deckUrl: createdResources.kickoffDeckUrl,
      },
    });
  };

  const sections = [
    { id: 'basics', label: 'Basics' },
    { id: 'description', label: 'Description' },
    { id: 'team', label: 'Team' },
    { id: 'outcomes', label: 'Outcomes' },
    { id: 'actions', label: 'Actions' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <ProgressIndicator sections={sections} currentSection={currentSection} />

      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Create New Project
          </h1>
          <p className="text-gray-600">
            Fill out the form below to create a new project across Airtable, Asana, and Google Drive.
          </p>
        </div>

        {/* Connection warning */}
        {!isConnected && (
          <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start space-x-3">
            <ExclamationTriangleIcon className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-yellow-800 font-medium">Not connected to services</p>
              <p className="text-yellow-700 text-sm mt-1">
                Please <Link to="/settings" className="underline">connect your accounts</Link> in Settings before creating a project.
              </p>
            </div>
          </div>
        )}

        <form onSubmit={(e) => e.preventDefault()}>
          {/* Basics Section */}
          <FormSection id="basics" title="Project Basics" helpFile="project-name.md">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                label="Project Name"
                required
                error={errors.projectName}
              >
                <input
                  type="text"
                  className="form-input"
                  placeholder="Enter project name"
                  {...register('projectName', { required: 'Project name is required' })}
                />
              </FormField>

              <FormField
                label="Project Acronym"
                helpFile="project-acronym.md"
                error={errors.projectAcronym}
              >
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g., PROJ-25"
                  maxLength={20}
                  {...register('projectAcronym')}
                />
              </FormField>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                label="Start Date"
                required
                helpFile="dates.md"
                error={errors.startDate}
              >
                <input
                  type="date"
                  className="form-input"
                  {...register('startDate', { required: 'Start date is required' })}
                />
              </FormField>

              <FormField
                label="End Date"
                required
                error={errors.endDate}
              >
                <input
                  type="date"
                  className="form-input"
                  {...register('endDate', { required: 'End date is required' })}
                />
              </FormField>
            </div>
          </FormSection>

          {/* Description Section */}
          <FormSection id="description" title="Project Description" helpFile="project-description.md">
            <FormField
              label="Description"
              required
              error={errors.description}
            >
              <textarea
                className="form-input min-h-[200px]"
                placeholder="Describe the project scope, context, and approach..."
                {...register('description', {
                  required: 'Description is required',
                  minLength: { value: 100, message: 'Please provide more detail (min 100 characters)' },
                })}
              />
            </FormField>

            <FormField
              label="Objectives"
              required
              helpFile="objectives.md"
              error={errors.objectives}
            >
              <textarea
                className="form-input min-h-[150px]"
                placeholder="List the key objectives this project aims to achieve..."
                {...register('objectives', { required: 'Objectives are required' })}
              />
            </FormField>
          </FormSection>

          {/* Team Section */}
          <FormSection id="team" title="Project Team" helpFile="roles.md">
            {loadingMembers ? (
              <div className="py-8 text-center text-gray-500">Loading team members...</div>
            ) : !isConnected ? (
              <div className="py-8 text-center text-gray-500">
                Connect to Airtable to load team members
              </div>
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
                        {...register(`roles.${role.key}.memberId`, {
                          validate: role.required
                            ? (v) => (v && v.length > 0) || `${role.label} is required`
                            : undefined,
                        })}
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
                        min="0"
                        max="100"
                        step="5"
                        {...register(`roles.${role.key}.fte`)}
                      />
                    </div>
                  </FormField>
                ))}
              </div>
            )}
          </FormSection>

          {/* Outcomes Section */}
          <FormSection id="outcomes" title="Outcomes & Milestones" helpFile="outcomes.md">
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
                    {outcomeFields.length > 1 && (
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
                      {...register(`outcomes.${index}.name`, {
                        required: 'Outcome name is required',
                      })}
                    />
                    {errors.outcomes?.[index]?.name && (
                      <p className="text-sm text-red-600">
                        {errors.outcomes[index].name.message}
                      </p>
                    )}

                    <textarea
                      className="form-input"
                      placeholder="Brief description (optional)"
                      rows={2}
                      {...register(`outcomes.${index}.description`)}
                    />

                    <input
                      type="date"
                      className="form-input"
                      {...register(`outcomes.${index}.dueDate`)}
                    />
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={() => addOutcome({ name: '', description: '', dueDate: '' })}
                className="btn-secondary w-full flex items-center justify-center space-x-2"
              >
                <PlusIcon className="w-4 h-4" />
                <span>Add Outcome</span>
              </button>
            </div>
          </FormSection>

          {/* Actions Section */}
          <FormSection id="actions" title="Create Resources">
            {submitError && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                {submitError}
              </div>
            )}

            {/* Debug Mode Toggle */}
            <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={debugMode}
                    onChange={handleToggleDebug}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Debug Mode</span>
                </label>
                {debugMode && (
                  <span className="text-xs text-gray-500">
                    ({debugLogger.getLogCount()} logs captured)
                  </span>
                )}
              </div>
              {debugMode && (
                <button
                  type="button"
                  onClick={handleDownloadDebugLog}
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                >
                  Download Debug Log
                </button>
              )}
            </div>

            <p className="text-sm text-gray-600 mb-4">
              Create resources step by step. You can create them in any order, but Asana Milestones requires the Asana Board first, and Airtable will include URLs from other resources if created first.
            </p>

            <div className="space-y-3">
              {/* Asana Board */}
              <ActionButton
                label="Create Asana Board"
                onClick={handleCreateAsanaBoard}
                isLoading={loadingAction === 'asanaBoard'}
                isComplete={!!createdResources.asanaProjectGid}
                url={createdResources.asanaUrl}
                disabled={!connectionStatus.asana}
              />

              {/* Asana Milestones */}
              <ActionButton
                label="Create Asana Milestone Tickets"
                onClick={handleCreateAsanaMilestones}
                isLoading={loadingAction === 'asanaMilestones'}
                isComplete={createdResources.asanaMilestonesCreated}
                disabled={!connectionStatus.asana || !createdResources.asanaProjectGid}
              />

              {/* Scoping Doc */}
              <ActionButton
                label="Create Google Scoping Doc"
                onClick={handleCreateScopingDoc}
                isLoading={loadingAction === 'scopingDoc'}
                isComplete={!!createdResources.scopingDocId}
                url={createdResources.scopingDocUrl}
                disabled={!connectionStatus.google}
              />

              {/* Kickoff Deck */}
              <ActionButton
                label="Create Google Kickoff Deck"
                onClick={handleCreateKickoffDeck}
                isLoading={loadingAction === 'kickoffDeck'}
                isComplete={!!createdResources.kickoffDeckId}
                url={createdResources.kickoffDeckUrl}
                disabled={!connectionStatus.google}
              />

              {/* Airtable Records */}
              <ActionButton
                label="Create Airtable Records"
                onClick={handleCreateAirtableRecords}
                isLoading={loadingAction === 'airtable'}
                isComplete={!!createdResources.airtableProjectId}
                url={createdResources.airtableUrl}
                disabled={!connectionStatus.airtable}
              />
            </div>

            {/* Status and navigation */}
            <div className="mt-6 pt-4 border-t border-gray-200 flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <p className="text-sm text-gray-500">
                  {isDirty && (
                    <span className="flex items-center space-x-1">
                      <CheckCircleIcon className="w-4 h-4 text-green-500" />
                      <span>Draft saved</span>
                    </span>
                  )}
                </p>
                {Object.keys(createdResources).length > 0 && (
                  <button
                    type="button"
                    onClick={clearCreatedResources}
                    className="text-sm text-red-600 hover:text-red-800"
                  >
                    Clear progress
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={handleFinish}
                disabled={!createdResources.airtableProjectId}
                className="btn-primary px-8"
              >
                Finish & View Summary
              </button>
            </div>
          </FormSection>
        </form>
      </main>
    </div>
  );
}
