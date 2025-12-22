// Asana API client
import { getValidToken } from './oauth';
import { debugLogger } from './debugLogger';
import type { AsanaUser, AsanaProject, AsanaUserMatch } from '../types';

const API_URL = 'https://app.asana.com/api/1.0';

interface AsanaRequestOptions {
  method?: string;
  body?: string;
  headers?: Record<string, string>;
}

interface AsanaTemplate {
  name: string;
  requested_dates?: Array<{ gid: string; name: string }>;
  requested_roles?: Array<{ gid: string; name: string }>;
}

export interface RoleAssignment {
  roleName: string;
  userGid: string;
}

// Re-export AsanaUser from types for convenience
export type { AsanaUser } from '../types';

interface TaskData {
  name: string;
  description?: string;
  dueDate?: string;
}

interface TaskResult {
  taskGid: string;
  taskUrl: string;
}

interface ProjectSearchResult {
  exists: boolean;
  existingProject: AsanaProject | null;
  url: string | null;
  searchResults: Array<{ name: string; gid: string }>;
}

async function getAccessToken(): Promise<string> {
  const token = await getValidToken('asana');
  if (!token) {
    throw new Error('Not connected to Asana. Please connect in Settings.');
  }
  return token;
}

async function asanaRequest<T = unknown>(endpoint: string, options: AsanaRequestOptions = {}): Promise<T> {
  const token = await getAccessToken();
  const method = options.method || 'GET';
  const payload = options.body ? JSON.parse(options.body) : null;

  debugLogger.logApiRequest('asana', endpoint, method, payload);

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    const errorMsg = error.errors?.[0]?.message || `Asana request failed: ${response.status}`;
    debugLogger.logApiResponse('asana', endpoint, error, new Error(errorMsg));
    throw new Error(errorMsg);
  }

  const data = await response.json();
  debugLogger.logApiResponse('asana', endpoint, data.data);
  return data.data;
}

// Get current user info (useful for workspace GID)
export async function getCurrentUser(): Promise<AsanaUser> {
  return asanaRequest<AsanaUser>('/users/me?opt_fields=name,email,workspaces');
}

// Get workspace users for role matching
export async function getWorkspaceUsers(workspaceGid: string): Promise<AsanaUser[]> {
  return asanaRequest<AsanaUser[]>(`/workspaces/${workspaceGid}/users?opt_fields=name,email`);
}

// Get project template details (dates, roles)
export async function getProjectTemplate(templateGid: string): Promise<AsanaTemplate> {
  return asanaRequest<AsanaTemplate>(`/project_templates/${templateGid}?opt_fields=name,requested_dates,requested_roles`);
}

// Format a date to YYYY-MM-DD for Asana API
function formatDateForAsana(dateValue: string | Date | null | undefined): string | null {
  if (!dateValue) return null;
  if (typeof dateValue === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
    return dateValue;
  }
  const date = new Date(dateValue);
  if (isNaN(date.getTime())) return null;
  return date.toISOString().split('T')[0];
}

// Create project from template
export async function createProjectFromTemplate(
  templateGid: string,
  name: string,
  teamGid: string,
  startDate: string | null = null,
  roleAssignments: RoleAssignment[] = []
): Promise<string> {
  // Get template to see what dates and roles are required
  const template = await getProjectTemplate(templateGid);

  // Log template and provided role assignments for debugging
  debugLogger.log('asana', 'Template roles from Asana', {
    templateName: template.name,
    templateRoles: template.requested_roles?.map(r => ({ gid: r.gid, name: r.name })) || [],
    providedAssignments: roleAssignments,
  });

  // Build requested_dates
  const today = new Date().toISOString().split('T')[0];
  const formattedStartDate = formatDateForAsana(startDate);
  const dateValue = formattedStartDate || today;

  const requestedDates = (template.requested_dates || []).map((dateField) => ({
    gid: dateField.gid,
    value: dateValue,
  }));

  // Build requested_roles by matching template roles to assignments
  const requestedRoles: Array<{ gid: string; value: string }> = [];
  const roleMatchingResults: Array<{
    templateRole: string;
    templateRoleGid: string;
    matchedTo: string | null;
    userGid: string | null;
    matched: boolean;
  }> = [];

  for (const templateRole of (template.requested_roles || [])) {
    const templateRoleName = templateRole.name?.toLowerCase() || '';

    const match = roleAssignments.find((ra) => {
      const assignmentName = ra.roleName?.toLowerCase() || '';
      return templateRoleName.includes(assignmentName) ||
             assignmentName.includes(templateRoleName) ||
             (assignmentName.includes('coordinator') && templateRoleName.includes('coordinator')) ||
             (assignmentName.includes('owner') && templateRoleName.includes('owner')) ||
             (assignmentName.includes('owner') && templateRoleName.includes('lead')) ||
             (assignmentName.includes('lead') && templateRoleName.includes('lead'));
    });

    // Track matching results for debugging
    roleMatchingResults.push({
      templateRole: templateRole.name,
      templateRoleGid: templateRole.gid,
      matchedTo: match?.roleName || null,
      userGid: match?.userGid || null,
      matched: !!match,
    });

    if (match) {
      requestedRoles.push({
        gid: templateRole.gid,
        value: match.userGid,
      });
    }
  }

  // Log role matching results
  debugLogger.log('asana', 'Role matching results', {
    matched: roleMatchingResults.filter(r => r.matched),
    unmatched: roleMatchingResults.filter(r => !r.matched),
    finalRequestedRoles: requestedRoles,
  });

  const requestBody: Record<string, unknown> = {
    name: name,
    team: teamGid,
    public: false,
  };

  if (requestedDates.length > 0) {
    requestBody.requested_dates = requestedDates;
  }

  if (requestedRoles.length > 0) {
    requestBody.requested_roles = requestedRoles;
  }

  debugLogger.log('asana', 'Creating project from template', {
    templateGid,
    requestBody,
  });

  const result = await asanaRequest<{ new_project?: { gid: string } }>(
    `/project_templates/${templateGid}/instantiateProject`,
    {
      method: 'POST',
      body: JSON.stringify({ data: requestBody }),
    }
  );

  const projectGid = result?.new_project?.gid;
  if (!projectGid) {
    throw new Error('Project creation did not return a project GID');
  }

  debugLogger.log('asana', 'Project created successfully', { projectGid });
  return projectGid;
}

// Add members to a project
export async function addProjectMembers(projectGid: string, memberGids: string[]): Promise<boolean> {
  if (!memberGids || memberGids.length === 0) return true;

  await asanaRequest(`/projects/${projectGid}/addMembers`, {
    method: 'POST',
    body: JSON.stringify({
      data: { members: memberGids },
    }),
  });

  return true;
}

// Create a task
export async function createTask(
  projectGid: string,
  task: TaskData,
  assigneeGid: string | null = null
): Promise<TaskResult> {
  const taskData: Record<string, unknown> = {
    name: task.name,
    notes: task.description || '',
    due_on: formatDateForAsana(task.dueDate),
    projects: [projectGid],
  };

  if (assigneeGid) {
    taskData.assignee = assigneeGid;
  }

  const result = await asanaRequest<{ gid: string }>('/tasks', {
    method: 'POST',
    body: JSON.stringify({ data: taskData }),
  });

  return {
    taskGid: result.gid,
    taskUrl: `https://app.asana.com/0/${projectGid}/${result.gid}`,
  };
}

// Fuzzy match a name against Asana users
export function findBestUserMatch(searchName: string, asanaUsers: AsanaUser[]): AsanaUserMatch | null {
  if (!searchName || !asanaUsers?.length) return null;

  const searchLower = searchName.toLowerCase().trim();
  const searchParts = searchLower.split(/\s+/);

  let bestMatch: AsanaUserMatch | null = null;
  let bestScore = 0;

  for (const user of asanaUsers) {
    const userName = user.name?.toLowerCase() || '';
    const userParts = userName.split(/\s+/);

    // Exact match
    if (userName === searchLower) {
      return { user, score: 100 };
    }

    // Check if all search parts are contained in user name
    const allPartsMatch = searchParts.every((part) => userName.includes(part));
    if (allPartsMatch) {
      const score = 80 + (searchParts.length / userParts.length) * 10;
      if (score > bestScore) {
        bestScore = score;
        bestMatch = { user, score };
      }
    }

    // Check first + last name match
    if (searchParts.length >= 2 && userParts.length >= 2) {
      const firstMatch = userParts[0].startsWith(searchParts[0]) || searchParts[0].startsWith(userParts[0]);
      const lastMatch = userParts[userParts.length - 1] === searchParts[searchParts.length - 1];
      if (firstMatch && lastMatch) {
        const score = 70;
        if (score > bestScore) {
          bestScore = score;
          bestMatch = { user, score };
        }
      }
    }

    // Partial match - any part matches
    const anyPartMatch = searchParts.some((part) => userName.includes(part) && part.length > 2);
    if (anyPartMatch && bestScore < 50) {
      bestScore = 50;
      bestMatch = { user, score: 50 };
    }
  }

  return bestScore >= 50 ? bestMatch : null;
}

// Get project URL from GID
export function getProjectUrl(projectGid: string): string {
  return `https://app.asana.com/0/${projectGid}/list`;
}

// Search for existing project by name (for duplicate checking)
export async function searchProjectByName(
  projectName: string,
  workspaceGid: string
): Promise<ProjectSearchResult> {
  debugLogger.log('asana', 'Searching for existing project', { projectName, workspaceGid });

  const results = await asanaRequest<AsanaProject[]>(
    `/workspaces/${workspaceGid}/typeahead?resource_type=project&query=${encodeURIComponent(projectName)}&opt_fields=name,permalink_url`
  );

  // Log what we're comparing (trim to handle trailing spaces)
  const searchTerm = projectName.toLowerCase().trim();
  console.log('[Asana Search] Looking for substring match:', {
    searchTerm,
    resultsCount: (results || []).length,
    resultNames: (results || []).map(p => {
      const projectName = p.name.toLowerCase().trim();
      return {
        name: p.name,
        nameTrimmed: p.name.trim(),
        containsSearchTerm: projectName.includes(searchTerm),
        searchTermContainsName: searchTerm.includes(projectName),
        isMatch: projectName.includes(searchTerm) || searchTerm.includes(projectName),
      };
    }),
  });

  // Substring match: either the search term is in the project name, or vice versa
  const match = (results || []).find(p => {
    const projectNameLower = p.name.toLowerCase().trim();
    return projectNameLower.includes(searchTerm) || searchTerm.includes(projectNameLower);
  });

  const result: ProjectSearchResult = {
    exists: !!match,
    existingProject: match || null,
    url: match?.permalink_url || null,
    searchResults: (results || []).slice(0, 5).map(p => ({ name: p.name, gid: p.gid })),
  };

  debugLogger.log('asana', 'Project search result', result);
  return result;
}

export default {
  getCurrentUser,
  getWorkspaceUsers,
  getProjectTemplate,
  createProjectFromTemplate,
  addProjectMembers,
  createTask,
  findBestUserMatch,
  getProjectUrl,
  searchProjectByName,
};
