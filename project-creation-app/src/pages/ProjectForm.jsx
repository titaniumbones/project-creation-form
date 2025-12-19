import { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import Header from '../components/layout/Header';
import HelpTooltip from '../components/ui/HelpTooltip';
import { useTeamMembers } from '../hooks/useTeamMembers';
import { getConnectionStatus } from '../services/oauth';
import * as airtable from '../services/airtable';
import * as asana from '../services/asana';
import * as google from '../services/google';
import {
  ExclamationTriangleIcon,
  PlusIcon,
  TrashIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';

// Draft storage key
const DRAFT_KEY = 'project_creator_draft';

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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

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
        project_owner: [],
        project_coordinator: [],
        technical_support: [],
        comms_support: [],
        oversight: [],
        other: [],
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

  // Form submission
  const onSubmit = async (data) => {
    setIsSubmitting(true);
    setSubmitError(null);

    const results = {
      projectName: data.projectName,
      airtableUrl: null,
      asanaUrl: null,
      driveUrl: null,
      deckUrl: null,
    };

    try {
      // 1. Create Airtable project record
      const projectRecord = await airtable.createProject({
        name: data.projectName,
        acronym: data.projectAcronym,
        description: data.description,
        objectives: data.objectives,
        startDate: data.startDate,
        endDate: data.endDate,
      });
      const projectId = projectRecord.id;
      results.airtableUrl = `https://airtable.com/${import.meta.env.VITE_AIRTABLE_BASE_ID}/${projectId}`;

      // 2. Create milestone records
      const validOutcomes = data.outcomes.filter(o => o.name?.trim());
      if (validOutcomes.length > 0) {
        await airtable.createMilestones(projectId, validOutcomes);
      }

      // 3. Create role assignments
      const roleAssignments = {};
      for (const [roleKey, memberId] of Object.entries(data.roles)) {
        if (memberId) {
          roleAssignments[roleKey] = [memberId];
        }
      }
      if (Object.keys(roleAssignments).length > 0) {
        await airtable.createAssignments(projectId, roleAssignments);
      }

      // 4. Create Asana project (if connected)
      if (connectionStatus.asana) {
        try {
          const asanaTemplateGid = import.meta.env.VITE_ASANA_TEMPLATE_GID;
          const asanaTeamGid = import.meta.env.VITE_ASANA_TEAM_GID;

          if (asanaTemplateGid && asanaTeamGid) {
            // Get coordinator name for Asana user matching
            const coordinatorId = data.roles.project_coordinator;
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

            const ownerId = data.roles.project_owner;
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

            results.asanaUrl = asana.getProjectUrl(asanaProjectGid);

            // Update Airtable with Asana URL
            await airtable.updateRecord('Projects', projectId, {
              'Asana Board': results.asanaUrl,
            });
          }
        } catch (asanaErr) {
          console.warn('Asana project creation failed:', asanaErr);
          // Continue - Asana is optional
        }
      }

      // 5. Create Google Drive folder and documents (if connected)
      if (connectionStatus.google) {
        try {
          const sharedDriveId = import.meta.env.VITE_GOOGLE_SHARED_DRIVE_ID;
          const parentFolderId = import.meta.env.VITE_GOOGLE_PROJECTS_FOLDER_ID;
          const scopingDocTemplateId = import.meta.env.VITE_GOOGLE_SCOPING_DOC_TEMPLATE_ID;

          if (parentFolderId) {
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
            results.driveUrl = google.getFolderUrl(folderId);

            // Create scoping document from template
            if (scopingDocTemplateId) {
              const docName = `${data.projectName} - Scoping Document`;
              const doc = await google.copyTemplate(scopingDocTemplateId, folderId, docName);

              // Populate placeholders
              const replacements = google.buildReplacements(data);
              await google.populateDoc(doc.id, replacements);
            }
          }
        } catch (googleErr) {
          console.warn('Google Drive setup failed:', googleErr);
          // Continue - Google is optional
        }
      }

      // Clear draft on successful submission
      localStorage.removeItem(DRAFT_KEY);

      // Navigate to success page
      navigate('/success', { state: results });
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const sections = [
    { id: 'basics', label: 'Basics' },
    { id: 'description', label: 'Description' },
    { id: 'team', label: 'Team' },
    { id: 'outcomes', label: 'Outcomes' },
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

        <form onSubmit={handleSubmit(onSubmit)}>
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
                    error={errors.roles?.[role.key]}
                  >
                    <select
                      className="form-input"
                      {...register(`roles.${role.key}`, {
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

          {/* Submit */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            {submitError && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                {submitError}
              </div>
            )}

            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">
                {isDirty && (
                  <span className="flex items-center space-x-1">
                    <CheckCircleIcon className="w-4 h-4 text-green-500" />
                    <span>Draft saved</span>
                  </span>
                )}
              </p>

              <button
                type="submit"
                disabled={isSubmitting || !isConnected}
                className="btn-primary px-8"
              >
                {isSubmitting ? 'Creating Project...' : 'Create Project'}
              </button>
            </div>
          </div>
        </form>
      </main>
    </div>
  );
}
