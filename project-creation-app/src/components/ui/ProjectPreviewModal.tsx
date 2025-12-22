// Modal to preview existing project before populating the form
import { useState, useEffect } from 'react';
import {
  XMarkIcon,
  ArrowPathIcon,
  ArrowTopRightOnSquareIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import {
  getProjectById,
  getProjectMilestones,
  getProjectAssignments,
  type FullProjectData,
  type MilestoneRecord,
  type AssignmentRecord,
} from '../../services/airtable';
import type { TeamMember } from '../../types';

interface ProjectPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: PopulateFormData) => void;
  projectId: string | null;
  teamMembers: TeamMember[];
}

export interface PopulateFormData {
  project: FullProjectData;
  milestones: MilestoneRecord[];
  assignments: AssignmentRecord[];
}

export default function ProjectPreviewModal({
  isOpen,
  onClose,
  onConfirm,
  projectId,
  teamMembers,
}: ProjectPreviewModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [project, setProject] = useState<FullProjectData | null>(null);
  const [milestones, setMilestones] = useState<MilestoneRecord[]>([]);
  const [assignments, setAssignments] = useState<AssignmentRecord[]>([]);

  // Fetch project data when projectId changes
  useEffect(() => {
    if (!isOpen || !projectId) {
      return;
    }

    const fetchData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const [projectData, milestonesData, assignmentsData] = await Promise.all([
          getProjectById(projectId),
          getProjectMilestones(projectId),
          getProjectAssignments(projectId),
        ]);

        if (!projectData) {
          setError('Project not found');
          return;
        }

        setProject(projectData);
        setMilestones(milestonesData);
        setAssignments(assignmentsData);
      } catch (err) {
        setError((err as Error).message || 'Failed to load project');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [isOpen, projectId]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setProject(null);
      setMilestones([]);
      setAssignments([]);
      setError(null);
    }
  }, [isOpen]);

  const handleConfirm = () => {
    if (project) {
      onConfirm({ project, milestones, assignments });
    }
  };

  // Get team member name by ID
  const getTeamMemberName = (memberId: string): string => {
    const member = teamMembers.find(m => m.id === memberId);
    return member?.name || 'Unknown';
  };

  // Check if project has existing resources
  const hasExistingResources = project?.asanaUrl || project?.scopingDocUrl || project?.folderUrl;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
          onClick={onClose}
        />

        {/* Modal */}
        <div className="relative bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              Load Existing Project
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <XMarkIcon className="w-6 h-6" />
            </button>
          </div>

          {/* Content */}
          <div className="px-6 py-4 overflow-y-auto max-h-[60vh]">
            {isLoading && (
              <div className="flex items-center justify-center py-12">
                <ArrowPathIcon className="w-8 h-8 text-blue-500 animate-spin" />
                <span className="ml-3 text-gray-600">Loading project details...</span>
              </div>
            )}

            {error && (
              <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                <ExclamationTriangleIcon className="w-5 h-5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {project && !isLoading && (
              <div className="space-y-6">
                {/* Project Info */}
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">{project.name}</h3>
                  <div className="flex items-center gap-3 mt-2">
                    {project.acronym && (
                      <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-sm">
                        {project.acronym}
                      </span>
                    )}
                    {project.status && (
                      <span className={`px-2 py-1 rounded text-sm ${
                        project.status === 'Active' ? 'bg-green-100 text-green-700' :
                        project.status === 'Complete' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {project.status}
                      </span>
                    )}
                    <a
                      href={project.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1"
                    >
                      View in Airtable
                      <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                    </a>
                  </div>
                </div>

                {/* Dates */}
                {(project.startDate || project.endDate) && (
                  <div className="grid grid-cols-2 gap-4">
                    {project.startDate && (
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Start Date</dt>
                        <dd className="text-gray-900">{project.startDate}</dd>
                      </div>
                    )}
                    {project.endDate && (
                      <div>
                        <dt className="text-sm font-medium text-gray-500">End Date</dt>
                        <dd className="text-gray-900">{project.endDate}</dd>
                      </div>
                    )}
                  </div>
                )}

                {/* Description */}
                {project.description && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500 mb-1">Description</dt>
                    <dd className="text-gray-900 text-sm whitespace-pre-wrap line-clamp-4">
                      {project.description}
                    </dd>
                  </div>
                )}

                {/* Existing Resources Warning */}
                {hasExistingResources && (
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div className="flex items-start gap-3">
                      <ExclamationTriangleIcon className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium text-yellow-800">This project has existing resources</p>
                        <p className="text-sm text-yellow-700 mt-1">
                          The existing resource URLs will be pre-filled in the form.
                        </p>
                        <div className="mt-2 space-y-1 text-sm">
                          {project.asanaUrl && (
                            <div className="flex items-center gap-2">
                              <CheckCircleIcon className="w-4 h-4 text-green-500" />
                              <span>Asana Board</span>
                            </div>
                          )}
                          {project.scopingDocUrl && (
                            <div className="flex items-center gap-2">
                              <CheckCircleIcon className="w-4 h-4 text-green-500" />
                              <span>Scoping Document</span>
                            </div>
                          )}
                          {project.folderUrl && (
                            <div className="flex items-center gap-2">
                              <CheckCircleIcon className="w-4 h-4 text-green-500" />
                              <span>Google Drive Folder</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Team Assignments */}
                {assignments.length > 0 && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500 mb-2">Team</dt>
                    <div className="space-y-1">
                      {assignments.map((a) => (
                        <div key={a.id} className="flex items-center justify-between text-sm">
                          <span className="text-gray-900">{getTeamMemberName(a.teamMemberId)}</span>
                          <span className="text-gray-500">{a.role}{a.fte ? ` (${a.fte}% FTE)` : ''}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Milestones */}
                {milestones.length > 0 && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500 mb-2">
                      Milestones ({milestones.length})
                    </dt>
                    <div className="space-y-2">
                      {milestones.slice(0, 5).map((m) => (
                        <div key={m.id} className="flex items-center justify-between text-sm p-2 bg-gray-50 rounded">
                          <span className="text-gray-900">{m.name}</span>
                          {m.dueDate && (
                            <span className="text-gray-500">{m.dueDate}</span>
                          )}
                        </div>
                      ))}
                      {milestones.length > 5 && (
                        <p className="text-sm text-gray-500 italic">
                          +{milestones.length - 5} more milestones
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
            <p className="text-sm text-gray-500">
              This will replace current form data
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={!project || isLoading}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                Load Project Data
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
