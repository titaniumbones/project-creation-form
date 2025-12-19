// Asana API client
import { getValidToken } from './oauth';

const API_URL = 'https://app.asana.com/api/1.0';

async function getAccessToken() {
  const token = await getValidToken('asana');
  if (!token) {
    throw new Error('Not connected to Asana. Please connect in Settings.');
  }
  return token;
}

async function asanaRequest(endpoint, options = {}) {
  const token = await getAccessToken();

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
    throw new Error(error.errors?.[0]?.message || `Asana request failed: ${response.status}`);
  }

  const data = await response.json();
  return data.data;
}

// Get current user info (useful for workspace GID)
export async function getCurrentUser() {
  return asanaRequest('/users/me?opt_fields=name,email,workspaces');
}

// Get workspace users for role matching
export async function getWorkspaceUsers(workspaceGid) {
  return asanaRequest(`/workspaces/${workspaceGid}/users?opt_fields=name,email`);
}

// Get project template details (dates, roles)
export async function getProjectTemplate(templateGid) {
  return asanaRequest(`/project_templates/${templateGid}?opt_fields=name,requested_dates,requested_roles`);
}

// Format a date to YYYY-MM-DD for Asana API
function formatDateForAsana(dateValue) {
  if (!dateValue) return null;
  if (typeof dateValue === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
    return dateValue;
  }
  const date = new Date(dateValue);
  if (isNaN(date.getTime())) return null;
  return date.toISOString().split('T')[0];
}

// Create project from template
export async function createProjectFromTemplate(templateGid, name, teamGid, startDate = null, roleAssignments = []) {
  // Get template to see what dates and roles are required
  const template = await getProjectTemplate(templateGid);

  // Build requested_dates
  const today = new Date().toISOString().split('T')[0];
  const formattedStartDate = formatDateForAsana(startDate);
  const dateValue = formattedStartDate || today;

  const requestedDates = (template.requested_dates || []).map((dateField) => ({
    gid: dateField.gid,
    value: dateValue,
  }));

  // Build requested_roles by matching template roles to assignments
  const requestedRoles = [];
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

    if (match) {
      requestedRoles.push({
        gid: templateRole.gid,
        value: match.userGid,
      });
    }
  }

  const requestBody = {
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

  const result = await asanaRequest(`/project_templates/${templateGid}/instantiateProject`, {
    method: 'POST',
    body: JSON.stringify({ data: requestBody }),
  });

  const projectGid = result?.new_project?.gid;
  if (!projectGid) {
    throw new Error('Project creation did not return a project GID');
  }

  return projectGid;
}

// Add members to a project
export async function addProjectMembers(projectGid, memberGids) {
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
export async function createTask(projectGid, task, assigneeGid = null) {
  const taskData = {
    name: task.name,
    notes: task.description || '',
    due_on: formatDateForAsana(task.dueDate),
    projects: [projectGid],
  };

  if (assigneeGid) {
    taskData.assignee = assigneeGid;
  }

  const result = await asanaRequest('/tasks', {
    method: 'POST',
    body: JSON.stringify({ data: taskData }),
  });

  return {
    taskGid: result.gid,
    taskUrl: `https://app.asana.com/0/${projectGid}/${result.gid}`,
  };
}

// Fuzzy match a name against Asana users
export function findBestUserMatch(searchName, asanaUsers) {
  if (!searchName || !asanaUsers?.length) return null;

  const searchLower = searchName.toLowerCase().trim();
  const searchParts = searchLower.split(/\s+/);

  let bestMatch = null;
  let bestScore = 0;

  for (const user of asanaUsers) {
    const userName = user.name?.toLowerCase() || '';
    const userParts = userName.split(/\s+/);

    // Exact match
    if (userName === searchLower) {
      return { user, score: 100, matchType: 'exact' };
    }

    // Check if all search parts are contained in user name
    const allPartsMatch = searchParts.every((part) => userName.includes(part));
    if (allPartsMatch) {
      const score = 80 + (searchParts.length / userParts.length) * 10;
      if (score > bestScore) {
        bestScore = score;
        bestMatch = { user, score, matchType: 'contains_all' };
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
          bestMatch = { user, score, matchType: 'first_last' };
        }
      }
    }

    // Partial match - any part matches
    const anyPartMatch = searchParts.some((part) => userName.includes(part) && part.length > 2);
    if (anyPartMatch && bestScore < 50) {
      bestScore = 50;
      bestMatch = { user, score: 50, matchType: 'partial' };
    }
  }

  return bestScore >= 50 ? bestMatch : null;
}

// Get project URL from GID
export function getProjectUrl(projectGid) {
  return `https://app.asana.com/0/${projectGid}/list`;
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
};
