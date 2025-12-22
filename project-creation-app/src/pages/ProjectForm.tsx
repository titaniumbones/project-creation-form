import { useState, useEffect, FormEvent } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import Header from '../components/layout/Header';
import ShareDraftModal from '../components/ui/ShareDraftModal';
import DuplicateResolutionModal from '../components/ui/DuplicateResolutionModal';
import ProjectSearch from '../components/ui/ProjectSearch';
import ProjectPreviewModal, { type PopulateFormData } from '../components/ui/ProjectPreviewModal';
import ResourceManagement from '../components/ui/ResourceManagement';
import {
  FormSection,
  FormField,
  ActionButton,
  ROLE_TYPES,
  DEFAULT_FORM_VALUES,
} from '../components/form/FormComponents';
import { airtableRoleValues } from '../config';
import { useTeamMembers } from '../hooks/useTeamMembers';
import { useFunders } from '../hooks/useFunders';
import { useParentInitiatives } from '../hooks/useParentInitiatives';
import { useProjectTypes } from '../hooks/useProjectTypes';
import { useFieldsConfig, useIntegrationsConfig } from '../hooks/useConfig';
import { useDuplicateCheck } from '../hooks/useDuplicateCheck';
import { useAsanaTemplateGid } from '../utils/asanaTemplates';
import { getConnectionStatus, userManager } from '../services/oauth';
import * as airtable from '../services/airtable';
import { airtableProjectFields, airtableTables, getRecordUrl } from '../services/airtable';
import * as asana from '../services/asana';
import * as google from '../services/google';
import * as drafts from '../services/drafts';
import { debugLogger } from '../services/debugLogger';
import {
  ExclamationTriangleIcon,
  PlusIcon,
  TrashIcon,
  CheckCircleIcon,
  ArrowPathIcon,
  DocumentDuplicateIcon,
  PaperAirplaneIcon,
  ClipboardDocumentListIcon,
  RocketLaunchIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import type { FormData, CreatedResources, ConnectionStatus, DraftStatus, RoleAssignment, DuplicateResolution } from '../types';
import type { AsanaUser, RoleAssignment as AsanaRoleAssignment } from '../services/asana';

// Local storage keys for form state persistence
const DRAFT_KEY = 'project_creation_draft';
const CREATED_RESOURCES_KEY = 'project_creation_resources';

interface Section {
  id: string;
  label: string;
}

// Section progress indicator
interface ProgressIndicatorProps {
  sections: Section[];
  currentSection: string;
}

function ProgressIndicator({ sections, currentSection }: ProgressIndicatorProps) {
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

type LoadingActionType = 'asanaBoard' | 'asanaMilestones' | 'scopingDoc' | 'kickoffDeck' | 'airtable' | 'saveDraft' | 'duplicateCheck' | 'createAll' | null;

interface DraftMessage {
  type: 'success' | 'error';
  text: string;
}

interface ShareDraftData {
  memberId?: string | null;
  memberName?: string;
  email?: string;
}

export default function ProjectForm() {
  const navigate = useNavigate();
  const [_searchParams] = useSearchParams();
  const [currentSection, setCurrentSection] = useState('basics');
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Track which action is currently loading
  const [loadingAction, setLoadingAction] = useState<LoadingActionType>(null);

  // Draft management state
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(null);
  const [draftStatus, setDraftStatus] = useState<DraftStatus | null>(null);
  const [draftShareToken, setDraftShareToken] = useState<string | null>(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [isShareLoading, setIsShareLoading] = useState(false);
  const [draftMessage, setDraftMessage] = useState<DraftMessage | null>(null);

  // Duplicate detection state
  const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);
  const [pendingResolution, setPendingResolution] = useState<DuplicateResolution | null>(null);

  // Existing project state (Phase 2)
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [editingExistingProject, setEditingExistingProject] = useState<string | null>(null);

  // Track created resources
  const [createdResources, setCreatedResources] = useState<CreatedResources>(() => {
    const saved = localStorage.getItem(CREATED_RESOURCES_KEY);
    if (saved) {
      try {
        return JSON.parse(saved) as CreatedResources;
      } catch {
        return {};
      }
    }
    return {};
  });

  // Save created resources to localStorage
  const updateCreatedResources = (updates: Partial<CreatedResources>): void => {
    setCreatedResources((prev) => {
      const next = { ...prev, ...updates };
      localStorage.setItem(CREATED_RESOURCES_KEY, JSON.stringify(next));
      return next;
    });
  };

  // Clear all created resources (for starting fresh)
  const clearCreatedResources = (): void => {
    setCreatedResources({});
    localStorage.removeItem(CREATED_RESOURCES_KEY);
  };

  // Debug mode state
  const [debugMode, setDebugMode] = useState(false);

  // Toggle debug mode
  const handleToggleDebug = (): void => {
    if (!debugMode) {
      debugLogger.start();
      debugLogger.log('form', 'Debug session started - form data snapshot', getFormData());
    } else {
      debugLogger.stop();
    }
    setDebugMode(!debugMode);
  };

  // Download debug log
  const handleDownloadDebugLog = (): void => {
    debugLogger.downloadLogs();
  };

  const connectionStatus: ConnectionStatus = getConnectionStatus();
  const isConnected = connectionStatus.airtable;

  const { data: teamMembers = [], isLoading: loadingMembers } = useTeamMembers();
  const { data: funders = [] } = useFunders();
  const { data: parentInitiatives = [] } = useParentInitiatives();
  const { data: projectTypeOptions = [] } = useProjectTypes();
  const { config } = useFieldsConfig();
  const { config: integrationsConfig } = useIntegrationsConfig();

  // Duplicate detection hook
  const {
    checkDuplicates,
    result: duplicateResult,
    isChecking: isCheckingDuplicates,
    isEnabled: duplicateCheckEnabled,
    defaults: duplicateDefaults,
  } = useDuplicateCheck();


  // Form setup with draft restoration
  const {
    register,
    control,
    watch,
    setValue,
    getValues,
    formState: { errors, isDirty },
  } = useForm<FormData>({
    defaultValues: DEFAULT_FORM_VALUES,
  });

  // Outcomes field array
  const { fields: outcomeFields, append: addOutcome, remove: removeOutcome, replace: replaceOutcomes } = useFieldArray({
    control,
    name: 'outcomes',
  });

  // Watch only specific fields that need reactivity (NOT all fields)
  const watchedProjectType = watch('projectType');
  const asanaTemplateGid = useAsanaTemplateGid(watchedProjectType);

  // Load draft on mount
  useEffect(() => {
    const saved = localStorage.getItem(DRAFT_KEY);
    if (saved) {
      try {
        const draft = JSON.parse(saved) as FormData;
        Object.entries(draft).forEach(([key, value]) => {
          setValue(key as keyof FormData, value as FormData[keyof FormData]);
        });
      } catch (e) {
        console.warn('Failed to restore draft:', e);
      }
    }
  }, [setValue]);

  // Save draft on changes (using watch subscription to avoid re-renders)
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;

    const subscription = watch((formValues) => {
      // Clear any pending save
      if (timeoutId) clearTimeout(timeoutId);

      // Debounce save to localStorage
      timeoutId = setTimeout(() => {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(formValues));
      }, 1000);
    });

    return () => {
      subscription.unsubscribe();
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [watch]);

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

  // Get current form data (use getValues for on-demand access without re-renders)
  const getFormData = (): FormData => getValues();

  // === INDIVIDUAL ACTION HANDLERS ===

  // 1. Create Asana Board (from template)
  const handleCreateAsanaBoard = async (): Promise<void> => {
    const data = getFormData();
    setLoadingAction('asanaBoard');
    setSubmitError(null);

    try {
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
      let asanaUsers: AsanaUser[] = [];
      if (workspaceGid) {
        asanaUsers = await asana.getWorkspaceUsers(workspaceGid);
      }

      // Build role assignments for Asana
      const asanaRoleAssignments: AsanaRoleAssignment[] = [];
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
      setSubmitError(`Asana Board: ${(err as Error).message}`);
    } finally {
      setLoadingAction(null);
    }
  };

  // 2. Create Asana Milestone Tickets (from outcomes)
  const handleCreateAsanaMilestones = async (): Promise<void> => {
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

      // Get Project Coordinator's Asana user GID for assignment
      let coordinatorAsanaGid: string | null = null;
      const coordinatorId = data.roles.project_coordinator?.memberId;
      const coordinatorMember = teamMembers.find(m => m.id === coordinatorId);

      if (coordinatorMember) {
        // Get Asana users to find coordinator
        const user = await asana.getCurrentUser();
        const workspaceGid = user.workspaces?.[0]?.gid;
        if (workspaceGid) {
          const asanaUsers = await asana.getWorkspaceUsers(workspaceGid);
          const match = asana.findBestUserMatch(coordinatorMember.name, asanaUsers);
          if (match?.user?.gid) {
            coordinatorAsanaGid = match.user.gid;
            debugLogger.log('asana', 'Assigning milestones to coordinator', {
              coordinatorName: coordinatorMember.name,
              asanaUserGid: coordinatorAsanaGid,
            });
          }
        }
      }

      // Create tasks for each outcome, assigned to coordinator
      for (const outcome of validOutcomes) {
        await asana.createTask(
          createdResources.asanaProjectGid,
          {
            name: outcome.name,
            description: outcome.description || '',
            dueDate: outcome.dueDate,
          },
          coordinatorAsanaGid
        );
      }

      updateCreatedResources({ asanaMilestonesCreated: true });
    } catch (err) {
      setSubmitError(`Asana Milestones: ${(err as Error).message}`);
    } finally {
      setLoadingAction(null);
    }
  };

  // Helper function to transform form data with role names for Google templates
  const transformDataWithRoleNames = (data: FormData): FormData & { roles: Record<string, RoleAssignment & { name: string }> } => {
    const transformedData: FormData & { roles: Record<string, RoleAssignment & { name: string }> } = {
      ...data,
      roles: {} as Record<string, RoleAssignment & { name: string }>
    };

    debugLogger.log('form', 'Transform roles - input', {
      rawRoles: data.roles,
      teamMembersAvailable: teamMembers.length,
      teamMemberIds: teamMembers.map(m => ({ id: m.id, name: m.name })),
    });

    for (const [roleKey, roleData] of Object.entries(data.roles || {})) {
      const memberId = roleData?.memberId;

      // Skip empty/unassigned roles
      if (!memberId) {
        debugLogger.log('form', `Role ${roleKey}: skipped (no memberId)`);
        continue;
      }

      const member = teamMembers.find(m => m.id === memberId);
      const memberName = member?.name || '';

      debugLogger.log('form', `Role ${roleKey}: processing`, {
        memberId,
        memberFound: !!member,
        memberName,
        fte: roleData.fte,
      });

      transformedData.roles[roleKey] = {
        memberId,
        fte: roleData.fte || '',
        name: memberName,
      };
    }

    debugLogger.log('form', 'Transform roles - output', {
      transformedRoles: transformedData.roles,
      roleCount: Object.keys(transformedData.roles).length,
    });

    return transformedData;
  };

  // 3. Create Google Scoping Doc
  const handleCreateScopingDoc = async (): Promise<void> => {
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

      let folderId: string;
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

      // Populate tables for milestones and staff
      await google.populateDocWithTables(doc.id, transformedData, teamMembers);

      const scopingDocUrl = google.getDocUrl(doc.id);
      updateCreatedResources({ googleFolderId: folderId, folderUrl, scopingDocId: doc.id, scopingDocUrl });
    } catch (err) {
      debugLogger.logError('google', 'Failed to create scoping doc', err as Error);
      setSubmitError(`Scoping Doc: ${(err as Error).message}`);
    } finally {
      setLoadingAction(null);
    }
  };

  // 4. Create Google Kickoff Deck
  const handleCreateKickoffDeck = async (): Promise<void> => {
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
      debugLogger.logError('google', 'Failed to create kickoff deck', err as Error);
      setSubmitError(`Kickoff Deck: ${(err as Error).message}`);
    } finally {
      setLoadingAction(null);
    }
  };

  // 5. Create Airtable Records (project, milestones, assignments) and populate URLs
  const handleCreateAirtableRecords = async (): Promise<void> => {
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

      // Update project with URLs from other resources
      const urlUpdates: Record<string, string> = {};
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

      const airtableUrl = getRecordUrl(projectId, 'projects');
      updateCreatedResources({ airtableProjectId: projectId, airtableUrl });
    } catch (err) {
      setSubmitError(`Airtable: ${(err as Error).message}`);
    } finally {
      setLoadingAction(null);
    }
  };

  // Navigate to success page
  const handleFinish = (): void => {
    localStorage.removeItem(DRAFT_KEY);
    const data = getFormData();
    navigate('/success', {
      state: {
        projectName: data.projectName,
        airtableUrl: createdResources.airtableUrl,
        asanaUrl: createdResources.asanaUrl,
        driveUrl: createdResources.folderUrl,
        deckUrl: createdResources.kickoffDeckUrl,
      },
    });
  };

  // === POST-SUBMISSION RESOURCE MANAGEMENT (Phase 4) ===

  // Link an existing resource URL to the Airtable record
  const handleLinkResource = async (resourceKey: keyof CreatedResources, url: string): Promise<void> => {
    if (!createdResources.airtableProjectId) {
      throw new Error('No Airtable record to link to');
    }

    // Map resource keys to Airtable field names
    const fieldMap: Partial<Record<keyof CreatedResources, string>> = {
      asanaUrl: airtableProjectFields.asana_url || 'Asana Board',
      scopingDocUrl: airtableProjectFields.scoping_doc_url || 'Scoping Doc',
      kickoffDeckUrl: airtableProjectFields.kickoff_deck_url || 'Kickoff Deck',
      folderUrl: airtableProjectFields.folder_url || 'Project Folder',
    };

    const fieldName = fieldMap[resourceKey];
    if (!fieldName) {
      throw new Error(`Cannot link resource type: ${resourceKey}`);
    }

    // Update Airtable record
    const tableName = airtableTables.projects || 'Projects';
    await airtable.updateRecord(tableName, createdResources.airtableProjectId, {
      [fieldName]: url,
    });

    // Update local state
    updateCreatedResources({ [resourceKey]: url });

    debugLogger.log('form', 'Linked resource to Airtable', { resourceKey, url });
  };

  // Create an individual resource after initial submission
  const handleCreateIndividualResource = async (
    resourceType: 'asana' | 'scopingDoc' | 'kickoffDeck' | 'folder'
  ): Promise<void> => {
    const data = getFormData();

    switch (resourceType) {
      case 'asana':
        await handleCreateAsanaBoard();
        // Update Airtable with new Asana URL
        if (createdResources.asanaUrl && createdResources.airtableProjectId) {
          const tableName = airtableTables.projects || 'Projects';
          await airtable.updateRecord(tableName, createdResources.airtableProjectId, {
            [airtableProjectFields.asana_url || 'Asana Board']: createdResources.asanaUrl,
          });
        }
        break;

      case 'scopingDoc':
        await handleCreateScopingDoc();
        // Update Airtable with new Scoping Doc URL
        if (createdResources.scopingDocUrl && createdResources.airtableProjectId) {
          const tableName = airtableTables.projects || 'Projects';
          await airtable.updateRecord(tableName, createdResources.airtableProjectId, {
            [airtableProjectFields.scoping_doc_url || 'Scoping Doc']: createdResources.scopingDocUrl,
          });
        }
        break;

      case 'kickoffDeck':
        await handleCreateKickoffDeck();
        // Update Airtable with new Kickoff Deck URL
        if (createdResources.kickoffDeckUrl && createdResources.airtableProjectId) {
          const tableName = airtableTables.projects || 'Projects';
          await airtable.updateRecord(tableName, createdResources.airtableProjectId, {
            [airtableProjectFields.kickoff_deck_url || 'Kickoff Deck']: createdResources.kickoffDeckUrl,
          });
        }
        break;

      case 'folder':
        // Create just the folder
        const sharedDriveId = import.meta.env.VITE_GOOGLE_SHARED_DRIVE_ID;
        const parentFolderId = import.meta.env.VITE_GOOGLE_PROJECTS_FOLDER_ID;
        const folderName = data.projectAcronym || data.projectName;

        const newFolder = await google.createDriveFolder(folderName, sharedDriveId, parentFolderId);
        const folderUrl = google.getFolderUrl(newFolder.id);
        updateCreatedResources({ googleFolderId: newFolder.id, folderUrl });

        // Update Airtable
        if (createdResources.airtableProjectId) {
          const tableName = airtableTables.projects || 'Projects';
          await airtable.updateRecord(tableName, createdResources.airtableProjectId, {
            [airtableProjectFields.folder_url || 'Project Folder']: folderUrl,
          });
        }
        break;
    }
  };

  // Sync milestones to Asana (for post-facto creation)
  const handleSyncMilestones = async (): Promise<void> => {
    if (!createdResources.asanaProjectGid) {
      setSubmitError('No Asana project found. Please create or link an Asana project first.');
      return;
    }

    setLoadingAction('syncMilestones');
    setSubmitError(null);

    try {
      const data = getFormData();
      const validOutcomes = data.outcomes.filter(o => o.name?.trim());

      if (validOutcomes.length === 0) {
        setSubmitError('No milestones to sync. Please add outcomes first.');
        return;
      }

      // Get Asana users for assignee matching
      const asanaUsers = await asana.getWorkspaceUsers(
        integrationsConfig?.asana?.workspace_gid || import.meta.env.VITE_ASANA_WORKSPACE_GID
      );

      // Get project coordinator member ID for default assignment
      const projectCoordinatorId = data.roles.project_coordinator?.memberId;

      // Helper to find Asana user GID
      const findUserGid = (memberId: string | undefined): string | null => {
        if (!memberId) return null;
        const member = teamMembers.find((m) => m.id === memberId);
        if (!member) return null;
        const match = asana.findBestUserMatch(member.name, asanaUsers);
        return match?.user.gid || null;
      };

      for (const outcome of validOutcomes) {
        // Use specific assignee if set, otherwise default to project coordinator
        const assigneeMemberId = outcome.assignee || projectCoordinatorId;
        const assigneeGid = findUserGid(assigneeMemberId);

        await asana.createTask(
          createdResources.asanaProjectGid,
          {
            name: outcome.name,
            description: outcome.description,
            dueDate: outcome.dueDate,
          },
          assigneeGid
        );
      }

      updateCreatedResources({ asanaMilestonesCreated: true });
      debugLogger.log('form', 'Milestones synced to Asana', { count: validOutcomes.length });
    } catch (err) {
      setSubmitError(`Milestone sync failed: ${(err as Error).message}`);
      debugLogger.log('error', 'Milestone sync failed', err);
    } finally {
      setLoadingAction(null);
    }
  };

  // === CREATE ALL RESOURCES (with duplicate check) ===

  // Create all resources in sequence after duplicate resolution
  const executeCreateAll = async (resolution?: DuplicateResolution): Promise<void> => {
    setLoadingAction('createAll');
    setSubmitError(null);

    try {
      const data = getFormData();

      // For now, we proceed with creation regardless of resolution
      // Future phases will implement update vs. create logic based on resolution
      // Currently just logs the resolution for debugging
      if (resolution) {
        debugLogger.log('form', 'Creating resources with resolution', resolution);
      }

      // Check for existing URLs provided by user
      const hasExistingAsana = !!data.existingAsanaUrl;
      const hasExistingScopingDoc = !!data.existingScopingDocUrl;

      // Check for skip resolutions
      const skipAsana = resolution?.asana === 'skip';
      const skipGoogle = resolution?.google === 'skip';
      const skipAirtable = resolution?.airtable === 'skip';

      // Track newly created resource IDs locally (React state updates are async)
      let newAsanaProjectGid: string | undefined;
      let newAirtableProjectId: string | undefined;
      let newScopingDocUrl: string | undefined;
      let newFolderUrl: string | undefined;
      let asanaUsers: AsanaUser[] | null = null;

      // Helper to get Asana users (fetch once and cache)
      const getAsanaUsers = async (): Promise<AsanaUser[]> => {
        if (!asanaUsers) {
          asanaUsers = await asana.getWorkspaceUsers(
            integrationsConfig?.asana?.workspace_gid || import.meta.env.VITE_ASANA_WORKSPACE_GID
          );
        }
        return asanaUsers;
      };

      // Helper to find Asana user GID for a team member
      const findAsanaUserGid = async (memberId: string | undefined): Promise<string | null> => {
        if (!memberId) return null;
        const member = teamMembers.find((m) => m.id === memberId);
        if (!member) return null;
        const users = await getAsanaUsers();
        const match = asana.findBestUserMatch(member.name, users);
        return match?.user.gid || null;
      };

      // If user provided existing URLs, use them instead of creating
      if (hasExistingAsana && !createdResources.asanaUrl) {
        debugLogger.log('form', 'Using existing Asana URL from form', data.existingAsanaUrl);
        updateCreatedResources({ asanaUrl: data.existingAsanaUrl });
      }
      if (hasExistingScopingDoc && !createdResources.scopingDocUrl) {
        debugLogger.log('form', 'Using existing Scoping Doc URL from form', data.existingScopingDocUrl);
        updateCreatedResources({ scopingDocUrl: data.existingScopingDocUrl });
      }

      // 1. Create Asana Board (if connected, not skipped, and no existing URL)
      if (connectionStatus.asana && !createdResources.asanaProjectGid && !hasExistingAsana && !skipAsana) {
        try {
          const users = await getAsanaUsers();

          const roleAssignments: AsanaRoleAssignment[] = [];
          for (const [roleName, assignment] of Object.entries(data.roles)) {
            if (assignment?.memberId) {
              const member = teamMembers.find((m) => m.id === assignment.memberId);
              if (member) {
                const match = asana.findBestUserMatch(member.name, users);
                if (match) {
                  roleAssignments.push({ roleName, userGid: match.user.gid });
                }
              }
            }
          }

          newAsanaProjectGid = await asana.createProjectFromTemplate(
            templateGid || import.meta.env.VITE_ASANA_TEMPLATE_GID,
            data.projectName,
            import.meta.env.VITE_ASANA_TEAM_GID,
            data.startDate,
            roleAssignments
          );

          const asanaUrl = asana.getProjectUrl(newAsanaProjectGid);
          updateCreatedResources({ asanaProjectGid: newAsanaProjectGid, asanaUrl });
        } catch (err) {
          debugLogger.log('error', 'Asana Board creation failed', err);
          // Continue with other resources
        }
      }

      // 2. Create Asana Milestones
      // Use newAsanaProjectGid (just created) or createdResources.asanaProjectGid (from previous run)
      const asanaProjectGidForMilestones = newAsanaProjectGid || createdResources.asanaProjectGid;
      if (connectionStatus.asana && asanaProjectGidForMilestones && !createdResources.asanaMilestonesCreated) {
        try {
          // Get project coordinator member ID for default assignment
          const projectCoordinatorId = data.roles.project_coordinator?.memberId;

          for (const outcome of data.outcomes) {
            if (outcome.name) {
              // Use specific assignee if set, otherwise default to project coordinator
              const assigneeMemberId = outcome.assignee || projectCoordinatorId;
              const assigneeGid = await findAsanaUserGid(assigneeMemberId);

              await asana.createTask(
                asanaProjectGidForMilestones,
                {
                  name: outcome.name,
                  description: outcome.description,
                  dueDate: outcome.dueDate,
                },
                assigneeGid
              );
            }
          }
          updateCreatedResources({ asanaMilestonesCreated: true });
        } catch (err) {
          debugLogger.log('error', 'Asana Milestones creation failed', err);
        }
      }

      // 3. Create Google Drive Folder and Documents (skip if user provided existing scoping doc or chose to skip)
      if (connectionStatus.google && !createdResources.googleFolderId && !hasExistingScopingDoc && !skipGoogle) {
        try {
          const sharedDriveId = import.meta.env.VITE_GOOGLE_SHARED_DRIVE_ID;
          const parentFolderId = import.meta.env.VITE_GOOGLE_PARENT_FOLDER_ID;

          const folderId = await google.createDriveFolder(
            data.projectName,
            sharedDriveId,
            parentFolderId
          );
          newFolderUrl = google.getFolderUrl(folderId);
          updateCreatedResources({
            googleFolderId: folderId,
            folderUrl: newFolderUrl,
          });

          // Create Scoping Doc (only if user didn't provide existing URL)
          const scopingTemplateId = import.meta.env.VITE_GOOGLE_SCOPING_TEMPLATE_ID;
          if (scopingTemplateId && !hasExistingScopingDoc) {
            const scopingDoc = await google.copyTemplate(
              scopingTemplateId,
              folderId,
              `${data.projectName} - Scoping Document`
            );
            const replacements = google.buildReplacements(data);
            await google.populateDocWithTables(scopingDoc.id, data, teamMembers);
            await google.populateDoc(scopingDoc.id, replacements);
            newScopingDocUrl = google.getDocUrl(scopingDoc.id);
            updateCreatedResources({
              scopingDocId: scopingDoc.id,
              scopingDocUrl: newScopingDocUrl,
            });
          }

          // Create Kickoff Deck
          const kickoffTemplateId = import.meta.env.VITE_GOOGLE_KICKOFF_DECK_TEMPLATE_ID;
          if (kickoffTemplateId) {
            const kickoffDeck = await google.copyTemplate(
              kickoffTemplateId,
              folderId,
              `${data.projectName} - Kickoff Deck`
            );
            const replacements = google.buildReplacements(data);
            await google.populateSlides(kickoffDeck.id, replacements);
            updateCreatedResources({
              kickoffDeckId: kickoffDeck.id,
              kickoffDeckUrl: google.getSlidesUrl(kickoffDeck.id),
            });
          }
        } catch (err) {
          debugLogger.log('error', 'Google Drive creation failed', err);
        }
      }

      // 4. Create or Update Airtable Records
      const shouldUpdateAirtable = resolution?.airtable === 'update' && duplicateResult?.airtable?.record?.id;
      const existingAirtableId = duplicateResult?.airtable?.record?.id;

      if (connectionStatus.airtable && !skipAirtable) {
        try {
          const f = airtableProjectFields;
          const tableName = airtableTables.projects || 'Projects';

          if (shouldUpdateAirtable && existingAirtableId) {
            // UPDATE existing record
            debugLogger.log('form', 'Updating existing Airtable record', { existingAirtableId });

            const updateFields: Record<string, unknown> = {
              [f.name || 'Project']: data.projectName,
              [f.acronym || 'Project Acronym']: data.projectAcronym || '',
              [f.description || 'Project Description']: data.description || '',
              [f.objectives || 'Objectives']: data.objectives || '',
              [f.start_date || 'Start Date']: data.startDate || null,
              [f.end_date || 'End Date']: data.endDate || null,
            };

            // Add optional fields
            if (data.funder) {
              updateFields[f.funder || 'Funder'] = [data.funder];
            }
            if (data.parentInitiative) {
              updateFields[f.parent_initiative || 'Parent Initiative'] = [data.parentInitiative];
            }
            if (data.projectType) {
              updateFields[f.project_type || 'Project Type'] = data.projectType;
            }

            await airtable.updateRecord(tableName, existingAirtableId, updateFields);
            newAirtableProjectId = existingAirtableId;

            // TODO: Merge milestones and assignments (for now, just note this)
            debugLogger.log('form', 'Note: Milestone/assignment merging not yet implemented');

            const airtableUrl = getRecordUrl(existingAirtableId, 'projects');
            updateCreatedResources({ airtableProjectId: existingAirtableId, airtableUrl });

          } else if (!createdResources.airtableProjectId) {
            // CREATE new record
            debugLogger.log('form', 'Creating new Airtable record');

            const project = await airtable.createProject({
              name: data.projectName,
              acronym: data.projectAcronym,
              description: data.description,
              objectives: data.objectives,
              startDate: data.startDate,
              endDate: data.endDate,
              funder: data.funder,
              parentInitiative: data.parentInitiative,
              projectType: data.projectType,
            });

            newAirtableProjectId = project.id;

            // Create milestones
            const milestones = data.outcomes
              .filter((o) => o.name)
              .map((o) => ({
                name: o.name,
                description: o.description,
                dueDate: o.dueDate,
              }));
            await airtable.createMilestones(newAirtableProjectId, milestones);

            // Create assignments
            await airtable.createAssignments(newAirtableProjectId, data.roles);

            const airtableUrl = getRecordUrl(newAirtableProjectId, 'projects');
            updateCreatedResources({ airtableProjectId: newAirtableProjectId, airtableUrl });
          }
        } catch (err) {
          debugLogger.log('error', 'Airtable creation/update failed', err);
          setSubmitError(`Airtable: ${(err as Error).message}`);
        }
      }

      // 5. Update Airtable record with resource URLs (if we have an Airtable record)
      const airtableProjectIdToUpdate = newAirtableProjectId || createdResources.airtableProjectId;
      if (connectionStatus.airtable && airtableProjectIdToUpdate) {
        try {
          const f = airtableProjectFields;
          const tableName = airtableTables.projects || 'Projects';
          const urlUpdates: Record<string, string> = {};

          // Get the URLs from local variables (just created) or state (existing)
          const asanaUrl = newAsanaProjectGid ? asana.getProjectUrl(newAsanaProjectGid) : createdResources.asanaUrl;
          const scopingDocUrl = newScopingDocUrl || createdResources.scopingDocUrl;
          const folderUrl = newFolderUrl || createdResources.folderUrl;

          if (asanaUrl) {
            urlUpdates[f.asana_url || 'Asana Board'] = asanaUrl;
          }
          if (scopingDocUrl) {
            urlUpdates[f.scoping_doc_url || 'Project Scope'] = scopingDocUrl;
          }
          if (folderUrl) {
            urlUpdates[f.folder_url || 'Project Folder'] = folderUrl;
          }

          if (Object.keys(urlUpdates).length > 0) {
            debugLogger.log('form', 'Updating Airtable with resource URLs', { airtableProjectIdToUpdate, urlUpdates });
            await airtable.updateRecord(tableName, airtableProjectIdToUpdate, urlUpdates);
          }
        } catch (err) {
          debugLogger.log('error', 'Failed to update Airtable with resource URLs', err);
          // Don't fail the whole operation for this
        }
      }
    } finally {
      setLoadingAction(null);
      setPendingResolution(null);
    }
  };

  // Handle "Create All Resources" button click
  const handleCreateAllResources = async (): Promise<void> => {
    console.log('[DuplicateCheck] Starting, enabled:', duplicateCheckEnabled);

    if (!duplicateCheckEnabled) {
      console.log('[DuplicateCheck] Disabled, skipping check');
      await executeCreateAll();
      return;
    }

    setLoadingAction('duplicateCheck');
    setSubmitError(null);

    try {
      const data = getFormData();
      console.log('[DuplicateCheck] Checking for:', data.projectName);

      const result = await checkDuplicates({
        projectName: data.projectName,
        workspaceGid: integrationsConfig?.asana?.workspace_gid || import.meta.env.VITE_ASANA_WORKSPACE_GID,
        sharedDriveId: import.meta.env.VITE_GOOGLE_SHARED_DRIVE_ID,
        parentFolderId: import.meta.env.VITE_GOOGLE_PARENT_FOLDER_ID,
        existingUrls: {
          asanaUrl: data.existingAsanaUrl || undefined,
          scopingDocUrl: data.existingScopingDocUrl || undefined,
        },
      });

      console.log('[DuplicateCheck] Result:', result);

      if (result.hasDuplicates) {
        console.log('[DuplicateCheck] Duplicates found, showing modal');
        setDuplicateModalOpen(true);
      } else {
        console.log('[DuplicateCheck] No duplicates, proceeding with creation');
        await executeCreateAll();
      }
    } catch (err) {
      console.error('[DuplicateCheck] Error:', err);
      setSubmitError(`Duplicate check failed: ${(err as Error).message}`);
    } finally {
      if (!duplicateModalOpen) {
        setLoadingAction(null);
      }
    }
  };

  // Handle resolution from duplicate modal
  const handleDuplicateResolution = async (resolution: DuplicateResolution): Promise<void> => {
    setDuplicateModalOpen(false);
    setPendingResolution(resolution);
    await executeCreateAll(resolution);
  };

  // Handle "Check for Duplicates" button click (check only, no creation)
  const handleCheckDuplicatesOnly = async (): Promise<void> => {
    console.log('[DuplicateCheck] Check only - starting');
    setLoadingAction('duplicateCheck');
    setSubmitError(null);

    try {
      const data = getFormData();
      console.log('[DuplicateCheck] Checking for:', data.projectName);

      const result = await checkDuplicates({
        projectName: data.projectName,
        workspaceGid: integrationsConfig?.asana?.workspace_gid || import.meta.env.VITE_ASANA_WORKSPACE_GID,
        sharedDriveId: import.meta.env.VITE_GOOGLE_SHARED_DRIVE_ID,
        parentFolderId: import.meta.env.VITE_GOOGLE_PARENT_FOLDER_ID,
        existingUrls: {
          asanaUrl: data.existingAsanaUrl || undefined,
          scopingDocUrl: data.existingScopingDocUrl || undefined,
        },
      });

      console.log('[DuplicateCheck] Result:', result);

      // Always show modal with results (even if no duplicates found)
      setDuplicateModalOpen(true);
    } catch (err) {
      console.error('[DuplicateCheck] Error:', err);
      setSubmitError(`Duplicate check failed: ${(err as Error).message}`);
    } finally {
      setLoadingAction(null);
    }
  };

  // === EXISTING PROJECT HANDLERS (Phase 2) ===

  // Handle project selection from search
  const handleSelectExistingProject = (projectId: string): void => {
    setSelectedProjectId(projectId);
    setPreviewModalOpen(true);
  };

  // Map Airtable role value back to form role key
  const getRoleKeyFromAirtableValue = (airtableRole: string): string | null => {
    // Reverse lookup: find form key for Airtable role value
    for (const [formKey, airtableValue] of Object.entries(airtableRoleValues)) {
      if (airtableValue === airtableRole) {
        return formKey;
      }
    }
    return null;
  };

  // Populate form with existing project data
  const handlePopulateFromExisting = (data: PopulateFormData): void => {
    const { project, milestones, assignments } = data;

    // Clear current form and resources
    clearCreatedResources();

    // Populate basic fields
    setValue('projectName', project.name);
    setValue('projectAcronym', project.acronym || '');
    setValue('description', project.description || '');
    setValue('objectives', project.objectives || '');
    setValue('startDate', project.startDate || '');
    setValue('endDate', project.endDate || '');
    setValue('projectType', project.projectType || '');

    // Populate linked record fields (Airtable returns array of IDs)
    if (project.funder && project.funder.length > 0) {
      setValue('funder', project.funder[0]);
    }
    if (project.parentInitiative && project.parentInitiative.length > 0) {
      setValue('parentInitiative', project.parentInitiative[0]);
    }

    // Populate existing resource URLs
    if (project.asanaUrl) {
      setValue('existingAsanaUrl', project.asanaUrl);
    }
    if (project.scopingDocUrl) {
      setValue('existingScopingDocUrl', project.scopingDocUrl);
    }

    // Populate role assignments
    // Reset all roles first
    ROLE_TYPES.forEach(role => {
      setValue(`roles.${role.key as keyof FormData['roles']}.memberId`, '');
      setValue(`roles.${role.key as keyof FormData['roles']}.fte`, '');
    });

    // Map assignments to roles
    for (const assignment of assignments) {
      const roleKey = getRoleKeyFromAirtableValue(assignment.role);
      if (roleKey) {
        setValue(`roles.${roleKey as keyof FormData['roles']}.memberId`, assignment.teamMemberId);
        if (assignment.fte !== undefined) {
          setValue(`roles.${roleKey as keyof FormData['roles']}.fte`, String(assignment.fte));
        }
      }
    }

    // Populate outcomes/milestones using replace to avoid infinite loop
    if (milestones.length > 0) {
      replaceOutcomes(milestones.map(milestone => ({
        name: milestone.name,
        description: milestone.description || '',
        dueDate: milestone.dueDate || '',
      })));
    } else {
      // Add one empty outcome if no milestones
      replaceOutcomes([{ name: '', description: '', dueDate: '' }]);
    }

    // Track that we're editing an existing project
    setEditingExistingProject(project.id);

    // Close modal
    setPreviewModalOpen(false);
    setSelectedProjectId(null);

    debugLogger.log('form', 'Form populated from existing project', {
      projectId: project.id,
      projectName: project.name,
      milestonesCount: milestones.length,
      assignmentsCount: assignments.length,
    });
  };

  // Clear existing project mode and reset form
  const handleClearExistingProject = (): void => {
    setEditingExistingProject(null);
    // Reset form to defaults
    Object.entries(DEFAULT_FORM_VALUES).forEach(([key, value]) => {
      setValue(key as keyof FormData, value as FormData[keyof FormData]);
    });
    clearCreatedResources();
  };

  // === DRAFT HANDLERS ===

  // Save current form as draft
  const handleSaveDraft = async (): Promise<void> => {
    setLoadingAction('saveDraft');
    setDraftMessage(null);

    try {
      if (!connectionStatus.airtable) {
        throw new Error('Please connect to Airtable first to save drafts');
      }

      // Get current user's team member ID (set in Settings)
      const teamMemberId = userManager.getTeamMemberId();
      if (!teamMemberId) {
        throw new Error('Please select your profile in Settings first');
      }

      const formData = getFormData();

      if (currentDraftId) {
        // Update existing draft
        await drafts.updateDraft(currentDraftId, formData);
        setDraftMessage({ type: 'success', text: 'Draft updated successfully' });
      } else {
        // Create new draft
        const result = await drafts.createDraft(formData, teamMemberId);
        setCurrentDraftId(result.id);
        setDraftShareToken(result.shareToken);
        setDraftStatus('Draft');
        setDraftMessage({ type: 'success', text: 'Draft saved successfully' });
      }
    } catch (err) {
      setDraftMessage({ type: 'error', text: (err as Error).message });
    } finally {
      setLoadingAction(null);
    }
  };

  // Submit draft for approval
  const handleShareDraft = async ({ memberId, memberName, email }: ShareDraftData): Promise<void> => {
    setIsShareLoading(true);
    setDraftMessage(null);

    try {
      // Make sure we have a saved draft first
      if (!currentDraftId) {
        const teamMemberId = userManager.getTeamMemberId();
        if (!teamMemberId) {
          throw new Error('Please connect to Airtable first');
        }

        const formData = getFormData();
        const result = await drafts.createDraft(formData, teamMemberId);
        setCurrentDraftId(result.id);
        setDraftShareToken(result.shareToken);
      }

      // The email to send to - either custom or we need to get it
      const approverEmail = email;
      if (!approverEmail) {
        throw new Error('Approver email is required');
      }

      await drafts.submitForApproval(currentDraftId!, memberId || undefined, approverEmail);
      setDraftStatus('Pending Approval');
      setShareModalOpen(false);
      setDraftMessage({
        type: 'success',
        text: `Draft sent to ${memberName || approverEmail} for approval`,
      });
    } catch (err) {
      setDraftMessage({ type: 'error', text: (err as Error).message });
    } finally {
      setIsShareLoading(false);
    }
  };

  // Copy share link to clipboard
  const handleCopyShareLink = (): void => {
    if (!draftShareToken) return;

    const shareUrl = `${window.location.origin}/review/${draftShareToken}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setDraftMessage({ type: 'success', text: 'Link copied to clipboard' });
      setTimeout(() => setDraftMessage(null), 3000);
    });
  };

  const sections: Section[] = [
    { id: 'basics', label: 'Basics' },
    { id: 'description', label: 'Description' },
    { id: 'team', label: 'Team' },
    { id: 'outcomes', label: 'Outcomes' },
    { id: 'drafts', label: 'Save & Share' },
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

        {/* Start from existing project (Phase 2) */}
        {!editingExistingProject && isConnected && (
          <div className="mb-6">
            <ProjectSearch
              onSelectProject={handleSelectExistingProject}
              disabled={loadingAction !== null}
            />
          </div>
        )}

        {/* Editing existing project banner */}
        {editingExistingProject && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-3">
              <DocumentDuplicateIcon className="w-5 h-5 text-blue-600" />
              <div>
                <p className="font-medium text-blue-900">Editing from existing project</p>
                <p className="text-sm text-blue-700">Form populated with data from Airtable</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleClearExistingProject}
              className="px-3 py-1.5 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded transition-colors"
            >
              Start Fresh
            </button>
          </div>
        )}

        <form onSubmit={(e: FormEvent) => e.preventDefault()}>
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

            {/* Optional Classification Fields */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
              <FormField label="Funder">
                <select className="form-input" {...register('funder')}>
                  <option value="">Select funder (optional)...</option>
                  {funders.map((f) => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              </FormField>

              <FormField label="Parent Initiative">
                <select className="form-input" {...register('parentInitiative')}>
                  <option value="">Select initiative (optional)...</option>
                  {parentInitiatives.map((i) => (
                    <option key={i.id} value={i.id}>{i.name}</option>
                  ))}
                </select>
              </FormField>

              <FormField label="Project Type">
                <select className="form-input" {...register('projectType')}>
                  <option value="">Select type (optional)...</option>
                  {projectTypeOptions.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </FormField>
            </div>

            {/* Existing Resource Links */}
            <div className="mt-6 pt-6 border-t border-gray-200">
              <h4 className="text-sm font-medium text-gray-700 mb-3">
                Link Existing Resources (Optional)
              </h4>
              <p className="text-sm text-gray-500 mb-4">
                If resources already exist for this project, paste their URLs here to skip creation.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField label="Existing Scoping Doc URL">
                  <input
                    type="url"
                    className="form-input"
                    placeholder="https://docs.google.com/document/d/..."
                    {...register('existingScopingDocUrl', {
                      pattern: {
                        value: /docs\.google\.com\/document\/d\//,
                        message: 'Must be a Google Docs URL',
                      },
                    })}
                  />
                  {errors.existingScopingDocUrl && (
                    <p className="text-red-500 text-sm mt-1">{errors.existingScopingDocUrl.message}</p>
                  )}
                </FormField>

                <FormField label="Existing Asana Board URL">
                  <input
                    type="url"
                    className="form-input"
                    placeholder="https://app.asana.com/..."
                    {...register('existingAsanaUrl', {
                      pattern: {
                        value: /app\.asana\.com\//,
                        message: 'Must be an Asana URL',
                      },
                    })}
                  />
                  {errors.existingAsanaUrl && (
                    <p className="text-red-500 text-sm mt-1">{errors.existingAsanaUrl.message}</p>
                  )}
                </FormField>
              </div>
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
                {ROLE_TYPES.map((role) => (
                  <FormField
                    key={role.key}
                    label={role.label}
                    required={role.required}
                    error={errors.roles?.[role.key as keyof FormData['roles']]?.memberId}
                  >
                    <div className="flex gap-3">
                      <select
                        className="form-input flex-1"
                        {...register(`roles.${role.key as keyof FormData['roles']}.memberId`, {
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
                        {...register(`roles.${role.key as keyof FormData['roles']}.fte`)}
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
                        {errors.outcomes[index]?.name?.message}
                      </p>
                    )}

                    <textarea
                      className="form-input"
                      placeholder="Brief description (optional)"
                      rows={2}
                      {...register(`outcomes.${index}.description`)}
                    />

                    <div className="grid grid-cols-2 gap-3">
                      <input
                        type="date"
                        className="form-input"
                        {...register(`outcomes.${index}.dueDate`)}
                      />

                      <select
                        className="form-input"
                        {...register(`outcomes.${index}.assignee`)}
                      >
                        <option value="">Assign to Project Coordinator</option>
                        {teamMembers.map((member) => (
                          <option key={member.id} value={member.id}>
                            {member.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={() => addOutcome({ name: '', description: '', dueDate: '', assignee: '' })}
                className="btn-secondary w-full flex items-center justify-center space-x-2"
              >
                <PlusIcon className="w-4 h-4" />
                <span>Add Outcome</span>
              </button>
            </div>
          </FormSection>

          {/* Draft Actions Section */}
          <FormSection id="drafts" title="Save & Share">
            {draftMessage && (
              <div
                className={`mb-4 p-3 rounded-lg ${
                  draftMessage.type === 'success'
                    ? 'bg-green-50 border border-green-200 text-green-700'
                    : 'bg-red-50 border border-red-200 text-red-700'
                }`}
              >
                {draftMessage.text}
              </div>
            )}

            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200 space-y-3">
              <p className="text-sm text-blue-800">
                Save your work as a draft and optionally share it with a lead for approval before creating resources.
              </p>

              {/* Draft Status Display */}
              {draftStatus && (
                <div className="flex items-center space-x-2 text-sm">
                  <span className="text-gray-600">Status:</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      draftStatus === 'Draft'
                        ? 'bg-gray-200 text-gray-700'
                        : draftStatus === 'Pending Approval'
                        ? 'bg-yellow-200 text-yellow-800'
                        : draftStatus === 'Approved'
                        ? 'bg-green-200 text-green-800'
                        : 'bg-orange-200 text-orange-800'
                    }`}
                  >
                    {draftStatus}
                  </span>
                  {draftStatus === 'Approved' && (
                    <span className="text-green-700 font-medium">Ready to create resources!</span>
                  )}
                </div>
              )}

              {/* Draft Action Buttons */}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleSaveDraft}
                  disabled={loadingAction === 'saveDraft' || !connectionStatus.airtable}
                  className="flex items-center space-x-2 px-4 py-2 bg-white border border-blue-300 text-blue-700 rounded-lg hover:bg-blue-50 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  {loadingAction === 'saveDraft' ? (
                    <ArrowPathIcon className="w-4 h-4 animate-spin" />
                  ) : (
                    <DocumentDuplicateIcon className="w-4 h-4" />
                  )}
                  <span>{currentDraftId ? 'Update Draft' : 'Save as Draft'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShareModalOpen(true)}
                  disabled={!connectionStatus.airtable}
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  <PaperAirplaneIcon className="w-4 h-4" />
                  <span>Share for Approval</span>
                </button>

                {draftShareToken && (
                  <button
                    type="button"
                    onClick={handleCopyShareLink}
                    className="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <ClipboardDocumentListIcon className="w-4 h-4" />
                    <span>Copy Link</span>
                  </button>
                )}

                <Link
                  to="/drafts"
                  className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                >
                  <span>View My Drafts</span>
                </Link>
              </div>
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

            {/* Submit and Check Button (Phase 3) */}
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start gap-4">
                <div className="flex-1">
                  <h4 className="font-medium text-blue-900 mb-1">Submit Project</h4>
                  <p className="text-sm text-blue-700">
                    Check for existing projects and choose how to create resources. You'll see a preview before anything is created.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCheckDuplicatesOnly}
                  disabled={
                    loadingAction !== null ||
                    (!connectionStatus.airtable && !connectionStatus.asana && !connectionStatus.google)
                  }
                  className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors whitespace-nowrap font-medium"
                >
                  {loadingAction === 'duplicateCheck' ? (
                    <>
                      <ArrowPathIcon className="w-5 h-5 animate-spin" />
                      Checking...
                    </>
                  ) : loadingAction === 'createAll' ? (
                    <>
                      <ArrowPathIcon className="w-5 h-5 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <RocketLaunchIcon className="w-5 h-5" />
                      Submit and Check
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Created Resources Status (shown after resources are created) */}
            {Object.keys(createdResources).length > 0 && (
              <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                <h4 className="font-medium text-green-900 mb-3">Created Resources</h4>
                <div className="space-y-2">
                  {createdResources.airtableUrl && (
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircleIcon className="w-4 h-4 text-green-600" />
                      <span className="text-green-800">Airtable Record</span>
                      <a href={createdResources.airtableUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline ml-auto">
                        View
                      </a>
                    </div>
                  )}
                  {createdResources.asanaUrl && (
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircleIcon className="w-4 h-4 text-green-600" />
                      <span className="text-green-800">Asana Project</span>
                      <a href={createdResources.asanaUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline ml-auto">
                        View
                      </a>
                    </div>
                  )}
                  {createdResources.scopingDocUrl && (
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircleIcon className="w-4 h-4 text-green-600" />
                      <span className="text-green-800">Scoping Document</span>
                      <a href={createdResources.scopingDocUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline ml-auto">
                        View
                      </a>
                    </div>
                  )}
                  {createdResources.kickoffDeckUrl && (
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircleIcon className="w-4 h-4 text-green-600" />
                      <span className="text-green-800">Kickoff Deck</span>
                      <a href={createdResources.kickoffDeckUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline ml-auto">
                        View
                      </a>
                    </div>
                  )}
                  {createdResources.folderUrl && (
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircleIcon className="w-4 h-4 text-green-600" />
                      <span className="text-green-800">Google Drive Folder</span>
                      <a href={createdResources.folderUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline ml-auto">
                        View
                      </a>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Post-submission Resource Management (Phase 4) */}
            <ResourceManagement
              createdResources={createdResources}
              connectionStatus={connectionStatus}
              airtableProjectId={createdResources.airtableProjectId}
              onLinkResource={handleLinkResource}
              onCreateResource={handleCreateIndividualResource}
              onSyncMilestones={handleSyncMilestones}
              isLoading={loadingAction !== null}
            />

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

        {/* Share Draft Modal */}
        <ShareDraftModal
          isOpen={shareModalOpen}
          onClose={() => setShareModalOpen(false)}
          onSubmit={handleShareDraft}
          teamMembers={teamMembers}
          isLoading={isShareLoading}
        />

        {/* Duplicate Resolution Modal */}
        {duplicateResult && (
          <DuplicateResolutionModal
            isOpen={duplicateModalOpen}
            onClose={() => {
              setDuplicateModalOpen(false);
              setLoadingAction(null);
            }}
            onConfirm={handleDuplicateResolution}
            checkResult={duplicateResult}
            defaults={duplicateDefaults}
            isLoading={loadingAction === 'createAll'}
            allowGoogleRecreate={integrationsConfig?.duplicates?.google?.allow_recreate}
          />
        )}

        {/* Project Preview Modal (Phase 2) */}
        <ProjectPreviewModal
          isOpen={previewModalOpen}
          onClose={() => {
            setPreviewModalOpen(false);
            setSelectedProjectId(null);
          }}
          onConfirm={handlePopulateFromExisting}
          projectId={selectedProjectId}
          teamMembers={teamMembers}
        />
      </main>
    </div>
  );
}
