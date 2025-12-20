// Google Workspace API client (Drive, Docs, Slides)
import { getValidToken } from './oauth';
import { debugLogger } from './debugLogger';
import { googlePlaceholders } from '../config';

async function getAccessToken() {
  const token = await getValidToken('google');
  if (!token) {
    throw new Error('Not connected to Google. Please connect in Settings.');
  }
  return token;
}

// Search for a folder in Google Drive by name
export async function searchDriveFolder(folderName, sharedDriveId = null, parentFolderId = null) {
  const token = await getAccessToken();

  let query = `name='${folderName.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;

  if (parentFolderId) {
    query += ` and '${parentFolderId}' in parents`;
  }

  const params = new URLSearchParams({
    q: query,
    supportsAllDrives: 'true',
    includeItemsFromAllDrives: 'true',
    fields: 'files(id,name,webViewLink)',
  });

  if (sharedDriveId) {
    params.set('corpora', 'drive');
    params.set('driveId', sharedDriveId);
  }

  const response = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || 'Failed to search Google Drive');
  }

  const data = await response.json();
  return data.files || [];
}

// Create a folder in Google Drive
export async function createDriveFolder(folderName, sharedDriveId = null, parentFolderId = null) {
  const token = await getAccessToken();

  const metadata = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder',
  };

  if (parentFolderId) {
    metadata.parents = [parentFolderId];
  } else if (sharedDriveId) {
    metadata.parents = [sharedDriveId];
  }

  const response = await fetch('https://www.googleapis.com/drive/v3/files?supportsAllDrives=true', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(metadata),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || 'Failed to create folder');
  }

  return response.json();
}

// Copy a Google Doc/Slides template
export async function copyTemplate(templateId, destinationFolderId, newName) {
  const token = await getAccessToken();

  debugLogger.logApiRequest('google', `/drive/v3/files/${templateId}/copy`, 'POST', {
    name: newName,
    parents: [destinationFolderId],
  });

  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${templateId}/copy?supportsAllDrives=true`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: newName,
      parents: [destinationFolderId],
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    debugLogger.logApiResponse('google', `/drive/v3/files/${templateId}/copy`, error, new Error(error.error?.message || 'Failed to copy template'));
    throw new Error(error.error?.message || 'Failed to copy template');
  }

  const result = await response.json();
  debugLogger.logApiResponse('google', `/drive/v3/files/${templateId}/copy`, result);
  return result;
}

// Populate a Google Doc with placeholder replacements
export async function populateDoc(documentId, replacements) {
  const token = await getAccessToken();

  const requests = Object.entries(replacements).map(([placeholder, value]) => ({
    replaceAllText: {
      containsText: {
        text: placeholder,
        matchCase: true,
      },
      replaceText: value || '',
    },
  }));

  if (requests.length === 0) return;

  debugLogger.logApiRequest('google', `/documents/${documentId}:batchUpdate`, 'POST', {
    requestCount: requests.length,
    replacements: Object.fromEntries(
      Object.entries(replacements).map(([k, v]) => [k, v ? (v.length > 50 ? v.substring(0, 50) + '...' : v) : '(empty)'])
    ),
  });

  const response = await fetch(`https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ requests }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    debugLogger.logApiResponse('google', `/documents/${documentId}:batchUpdate`, error, new Error(error.error?.message || 'Failed to populate document'));
    throw new Error(error.error?.message || 'Failed to populate document');
  }

  const result = await response.json();
  debugLogger.logApiResponse('google', `/documents/${documentId}:batchUpdate`, result);
  return result;
}

// Populate a Google Slides presentation with placeholder replacements
export async function populateSlides(presentationId, replacements) {
  const token = await getAccessToken();

  const requests = Object.entries(replacements).map(([placeholder, value]) => ({
    replaceAllText: {
      containsText: {
        text: placeholder,
        matchCase: true,
      },
      replaceText: value || '',
    },
  }));

  if (requests.length === 0) return;

  debugLogger.logApiRequest('google', `/presentations/${presentationId}:batchUpdate`, 'POST', {
    requestCount: requests.length,
    replacements: Object.fromEntries(
      Object.entries(replacements).map(([k, v]) => [k, v ? (v.length > 50 ? v.substring(0, 50) + '...' : v) : '(empty)'])
    ),
  });

  const response = await fetch(`https://slides.googleapis.com/v1/presentations/${presentationId}:batchUpdate`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ requests }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    debugLogger.logApiResponse('google', `/presentations/${presentationId}:batchUpdate`, error, new Error(error.error?.message || 'Failed to populate slides'));
    throw new Error(error.error?.message || 'Failed to populate slides');
  }

  const result = await response.json();
  debugLogger.logApiResponse('google', `/presentations/${presentationId}:batchUpdate`, result);
  return result;
}

// Get a Google Doc's content (to find placeholder locations)
async function getDocument(documentId) {
  const token = await getAccessToken();

  const response = await fetch(`https://docs.googleapis.com/v1/documents/${documentId}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || 'Failed to get document');
  }

  return response.json();
}

// Find a placeholder's start index in the document
function findPlaceholderIndex(doc, placeholder) {
  const content = doc.body?.content || [];

  for (const element of content) {
    if (element.paragraph) {
      for (const elem of element.paragraph.elements || []) {
        if (elem.textRun?.content?.includes(placeholder)) {
          const textContent = elem.textRun.content;
          const placeholderPos = textContent.indexOf(placeholder);
          return elem.startIndex + placeholderPos;
        }
      }
    }
    // Also check tables
    if (element.table) {
      for (const row of element.table.tableRows || []) {
        for (const cell of row.tableCells || []) {
          for (const cellContent of cell.content || []) {
            if (cellContent.paragraph) {
              for (const elem of cellContent.paragraph.elements || []) {
                if (elem.textRun?.content?.includes(placeholder)) {
                  const textContent = elem.textRun.content;
                  const placeholderPos = textContent.indexOf(placeholder);
                  return elem.startIndex + placeholderPos;
                }
              }
            }
          }
        }
      }
    }
  }

  return -1;
}

// Insert a table at a placeholder location in a Google Doc
export async function insertTableAtPlaceholder(documentId, placeholder, tableData, headers) {
  const token = await getAccessToken();

  // Get document to find placeholder location
  const doc = await getDocument(documentId);
  const placeholderIndex = findPlaceholderIndex(doc, placeholder);

  if (placeholderIndex === -1) {
    debugLogger.log('google', `Placeholder ${placeholder} not found in document`);
    return null;
  }

  const numRows = tableData.length + 1; // +1 for header row
  const numCols = headers.length;

  // Build requests: delete placeholder, insert table, populate cells
  const requests = [];

  // 1. Delete the placeholder text
  requests.push({
    deleteContentRange: {
      range: {
        startIndex: placeholderIndex,
        endIndex: placeholderIndex + placeholder.length,
      },
    },
  });

  // 2. Insert table at placeholder location
  requests.push({
    insertTable: {
      rows: numRows,
      columns: numCols,
      location: { index: placeholderIndex },
    },
  });

  debugLogger.logApiRequest('google', `/documents/${documentId}:batchUpdate`, 'POST', {
    action: 'insertTable',
    placeholder,
    rows: numRows,
    cols: numCols,
  });

  // Execute table creation first
  const createResponse = await fetch(`https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ requests }),
  });

  if (!createResponse.ok) {
    const error = await createResponse.json().catch(() => ({}));
    debugLogger.logApiResponse('google', `/documents/${documentId}:batchUpdate`, error, new Error(error.error?.message || 'Failed to insert table'));
    throw new Error(error.error?.message || 'Failed to insert table');
  }

  // Get updated document to find table cell indices
  const updatedDoc = await getDocument(documentId);

  // Find the table we just inserted (it should be near the placeholder index)
  const tableElement = findTableNearIndex(updatedDoc, placeholderIndex);

  if (!tableElement) {
    debugLogger.log('google', 'Could not find inserted table');
    return null;
  }

  // Build requests to populate table cells
  const cellRequests = [];

  // Populate header row
  const headerRow = tableElement.table.tableRows[0];
  for (let col = 0; col < headers.length; col++) {
    const cell = headerRow.tableCells[col];
    const cellIndex = getCellInsertIndex(cell);
    if (cellIndex !== null) {
      cellRequests.push({
        insertText: {
          location: { index: cellIndex },
          text: headers[col],
        },
      });
      // Make header bold
      cellRequests.push({
        updateTextStyle: {
          range: {
            startIndex: cellIndex,
            endIndex: cellIndex + headers[col].length,
          },
          textStyle: { bold: true },
          fields: 'bold',
        },
      });
    }
  }

  // Populate data rows
  for (let row = 0; row < tableData.length; row++) {
    const tableRow = tableElement.table.tableRows[row + 1]; // +1 to skip header
    for (let col = 0; col < headers.length; col++) {
      const cell = tableRow.tableCells[col];
      const cellIndex = getCellInsertIndex(cell);
      const cellValue = tableData[row][col] || '';
      if (cellIndex !== null && cellValue) {
        cellRequests.push({
          insertText: {
            location: { index: cellIndex },
            text: cellValue,
          },
        });
      }
    }
  }

  if (cellRequests.length > 0) {
    // Execute cell population (in reverse order to maintain indices)
    cellRequests.reverse();

    const populateResponse = await fetch(`https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ requests: cellRequests }),
    });

    if (!populateResponse.ok) {
      const error = await populateResponse.json().catch(() => ({}));
      debugLogger.logApiResponse('google', `/documents/${documentId}:batchUpdate (populate)`, error, new Error(error.error?.message || 'Failed to populate table'));
      throw new Error(error.error?.message || 'Failed to populate table');
    }
  }

  debugLogger.logApiResponse('google', `/documents/${documentId}:batchUpdate`, { success: true, rows: numRows, cols: numCols });
  return { rows: numRows, cols: numCols };
}

// Find a table near a given index
function findTableNearIndex(doc, targetIndex) {
  const content = doc.body?.content || [];

  for (const element of content) {
    if (element.table && element.startIndex <= targetIndex + 10) {
      return element;
    }
  }

  // Fallback: return first table found
  for (const element of content) {
    if (element.table) {
      return element;
    }
  }

  return null;
}

// Get the insert index for a table cell
function getCellInsertIndex(cell) {
  const content = cell?.content || [];
  for (const elem of content) {
    if (elem.paragraph?.elements?.[0]) {
      return elem.paragraph.elements[0].startIndex;
    }
  }
  return null;
}

// Format milestones data for table insertion
export function buildMilestonesTableData(outcomes) {
  const formatDate = (dateStr) => {
    if (!dateStr) return 'TBD';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const validOutcomes = (outcomes || []).filter(o => o.name?.trim());

  return validOutcomes.map(outcome => [
    outcome.name || '',
    outcome.description || '',
    formatDate(outcome.dueDate),
  ]);
}

// Format staff/roles data for table insertion
export function buildStaffTableData(roles, teamMembers) {
  const roleLabels = {
    project_owner: 'Project Owner',
    project_coordinator: 'Project Coordinator',
    technical_support: 'Technical Support',
    comms_support: 'Communications Support',
    oversight: 'Oversight',
    other: 'Other',
  };

  const staffData = [];

  for (const [roleKey, roleData] of Object.entries(roles || {})) {
    if (roleData?.memberId) {
      const member = teamMembers?.find(m => m.id === roleData.memberId);
      const memberName = member?.name || roleData.name || 'TBD';
      const fte = roleData.fte ? `${roleData.fte}%` : 'TBD';

      staffData.push([
        roleLabels[roleKey] || roleKey,
        memberName,
        fte,
      ]);
    }
  }

  return staffData;
}

// Populate a Google Doc with tables for milestones and staff
export async function populateDocWithTables(documentId, projectData, teamMembers) {
  const p = googlePlaceholders;

  // Insert milestones table
  const milestonesPlaceholder = p.milestones || '{{MILESTONES}}';
  const milestonesData = buildMilestonesTableData(projectData.outcomes);

  if (milestonesData.length > 0) {
    try {
      await insertTableAtPlaceholder(
        documentId,
        milestonesPlaceholder,
        milestonesData,
        ['Milestone', 'Description', 'Due Date']
      );
    } catch (err) {
      debugLogger.log('google', `Failed to insert milestones table: ${err.message}`);
    }
  } else {
    // No milestones - just remove the placeholder
    await populateDoc(documentId, { [milestonesPlaceholder]: '(No milestones defined)' });
  }

  // Insert staff table
  const staffPlaceholder = p.staff_table || '{{STAFF_TABLE}}';
  const staffData = buildStaffTableData(projectData.roles, teamMembers);

  if (staffData.length > 0) {
    try {
      await insertTableAtPlaceholder(
        documentId,
        staffPlaceholder,
        staffData,
        ['Role', 'Staff', '% FTE']
      );
    } catch (err) {
      debugLogger.log('google', `Failed to insert staff table: ${err.message}`);
    }
  } else {
    // No staff - just remove the placeholder
    await populateDoc(documentId, { [staffPlaceholder]: '(No staff assigned)' });
  }
}

// Get Google Doc URL from document ID
export function getDocUrl(documentId) {
  return `https://docs.google.com/document/d/${documentId}/edit`;
}

// Get Google Slides URL from presentation ID
export function getSlidesUrl(presentationId) {
  return `https://docs.google.com/presentation/d/${presentationId}/edit`;
}

// Get Google Drive folder URL
export function getFolderUrl(folderId) {
  return `https://drive.google.com/drive/folders/${folderId}`;
}

// Build placeholder replacements from project data
// Uses placeholder values from config/fields.toml [google.placeholders]
export function buildReplacements(projectData) {
  const formatDate = (dateStr) => {
    if (!dateStr) return 'TBD';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const today = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // Log incoming data structure for debugging role name issues
  debugLogger.log('google', 'Building replacements from project data', {
    projectName: projectData.projectName,
    projectAcronym: projectData.projectAcronym,
    description: projectData.description ? `${projectData.description.substring(0, 50)}...` : null,
    objectives: projectData.objectives ? `${projectData.objectives.substring(0, 50)}...` : null,
    startDate: projectData.startDate,
    endDate: projectData.endDate,
    roles: projectData.roles,
    rolesKeys: Object.keys(projectData.roles || {}),
    configuredPlaceholders: googlePlaceholders,
  });

  // Use placeholder values from config, with fallbacks
  const p = googlePlaceholders;
  const replacements = {
    [p.project_name || '{{PROJECT_NAME}}']: projectData.projectName || '',
    [p.project_acronym || '{{PROJECT_ACRONYM}}']: projectData.projectAcronym || '',
    [p.project_description || '{{PROJECT_DESCRIPTION}}']: projectData.description || '',
    [p.objectives || '{{OBJECTIVES}}']: projectData.objectives || '',
    [p.start_date || '{{START_DATE}}']: formatDate(projectData.startDate),
    [p.end_date || '{{END_DATE}}']: formatDate(projectData.endDate),
    [p.created_date || '{{CREATED_DATE}}']: today,
    [p.project_owner || '{{PROJECT_OWNER}}']: projectData.roles?.project_owner?.name || '',
    [p.project_coordinator || '{{PROJECT_COORDINATOR}}']: projectData.roles?.project_coordinator?.name || '',
  };

  // Log the actual replacements that will be made
  debugLogger.log('google', 'Template replacements prepared', {
    replacements,
    emptyPlaceholders: Object.entries(replacements)
      .filter(([_, value]) => !value)
      .map(([key]) => key),
  });

  return replacements;
}

export default {
  searchDriveFolder,
  createDriveFolder,
  copyTemplate,
  populateDoc,
  populateSlides,
  populateDocWithTables,
  insertTableAtPlaceholder,
  buildMilestonesTableData,
  buildStaffTableData,
  getDocUrl,
  getSlidesUrl,
  getFolderUrl,
  buildReplacements,
};
