// Google Workspace API client (Drive, Docs, Slides)
import { getValidToken } from './oauth';
import { debugLogger } from './debugLogger';
import { googlePlaceholders } from '../config';
import type { GoogleFile, TeamMember, Outcome, RoleAssignment } from '../types';

interface GoogleDocElement {
  paragraph?: {
    elements?: Array<{
      textRun?: {
        content?: string;
      };
      startIndex: number;
      endIndex: number;
    }>;
  };
  table?: {
    tableRows?: Array<{
      tableCells?: Array<{
        content?: GoogleDocElement[];
      }>;
    }>;
  };
  startIndex: number;
  endIndex: number;
}

interface GoogleDoc {
  body?: {
    content?: GoogleDocElement[];
  };
}

interface TableElement {
  table: {
    tableRows?: Array<{
      tableCells?: Array<{
        content?: Array<{
          paragraph?: {
            elements?: Array<{
              textRun?: {
                content?: string;
              };
              startIndex: number;
              endIndex: number;
            }>;
          };
        }>;
      }>;
    }>;
  };
  startIndex: number;
  endIndex: number;
}

interface RoleData extends RoleAssignment {
  name?: string;
}

interface ProjectDataForGoogle {
  projectName?: string;
  projectAcronym?: string;
  description?: string;
  objectives?: string;
  startDate?: string;
  endDate?: string;
  outcomes?: Outcome[];
  roles?: Record<string, RoleData>;
}

async function getAccessToken(): Promise<string> {
  const token = await getValidToken('google');
  if (!token) {
    throw new Error('Not connected to Google. Please connect in Settings.');
  }
  return token;
}

// Search for a folder in Google Drive by name
export async function searchDriveFolder(
  folderName: string,
  sharedDriveId: string | null = null,
  parentFolderId: string | null = null
): Promise<GoogleFile[]> {
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
export async function createDriveFolder(
  folderName: string,
  sharedDriveId: string | null = null,
  parentFolderId: string | null = null
): Promise<GoogleFile> {
  const token = await getAccessToken();

  const metadata: Record<string, unknown> = {
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
export async function copyTemplate(
  templateId: string,
  destinationFolderId: string,
  newName: string
): Promise<GoogleFile> {
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
export async function populateDoc(
  documentId: string,
  replacements: Record<string, string>
): Promise<unknown> {
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
export async function populateSlides(
  presentationId: string,
  replacements: Record<string, string>
): Promise<unknown> {
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
async function getDocument(documentId: string): Promise<GoogleDoc> {
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
function findPlaceholderIndex(doc: GoogleDoc, placeholder: string): number {
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
export async function insertTableAtPlaceholder(
  documentId: string,
  placeholder: string,
  tableData: string[][],
  headers: string[]
): Promise<{ rows: number; cols: number } | null> {
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
  const requests: unknown[] = [];

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

  // Find the table we just inserted (use expected dimensions to avoid finding wrong table)
  const tableElement = findTableNearIndex(updatedDoc, placeholderIndex, numRows, numCols);

  if (!tableElement) {
    debugLogger.log('google', 'Could not find inserted table');
    return null;
  }

  // Table styling configuration
  const headerBgColor = { red: 0.2, green: 0.2, blue: 0.3 }; // Dark gray-blue
  const headerTextColor = { red: 1, green: 1, blue: 1 }; // White
  const dataTextColor = { red: 0, green: 0, blue: 0 }; // Black for data rows
  const cellPadding = { magnitude: 5, unit: 'PT' };

  // Get table start index for cell styling
  const tableStartIndex = tableElement.startIndex;

  // STEP 1: Apply cell styling (background colors, padding) - order doesn't matter
  const styleRequests: unknown[] = [];

  // Style header cells
  for (let col = 0; col < numCols; col++) {
    styleRequests.push({
      updateTableCellStyle: {
        tableRange: {
          tableCellLocation: {
            tableStartLocation: { index: tableStartIndex },
            rowIndex: 0,
            columnIndex: col,
          },
          rowSpan: 1,
          columnSpan: 1,
        },
        tableCellStyle: {
          backgroundColor: { color: { rgbColor: headerBgColor } },
          paddingTop: cellPadding,
          paddingBottom: cellPadding,
          paddingLeft: cellPadding,
          paddingRight: cellPadding,
        },
        fields: 'backgroundColor,paddingTop,paddingBottom,paddingLeft,paddingRight',
      },
    });
  }

  // Style data cells (padding only)
  for (let row = 0; row < tableData.length; row++) {
    for (let col = 0; col < numCols; col++) {
      styleRequests.push({
        updateTableCellStyle: {
          tableRange: {
            tableCellLocation: {
              tableStartLocation: { index: tableStartIndex },
              rowIndex: row + 1,
              columnIndex: col,
            },
            rowSpan: 1,
            columnSpan: 1,
          },
          tableCellStyle: {
            paddingTop: cellPadding,
            paddingBottom: cellPadding,
            paddingLeft: cellPadding,
            paddingRight: cellPadding,
          },
          fields: 'paddingTop,paddingBottom,paddingLeft,paddingRight',
        },
      });
    }
  }

  // Execute cell styling
  if (styleRequests.length > 0) {
    const styleResponse = await fetch(`https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ requests: styleRequests }),
    });

    if (!styleResponse.ok) {
      const error = await styleResponse.json().catch(() => ({}));
      debugLogger.log('google', 'Failed to apply cell styling', error);
    }
  }

  // STEP 2: Insert all text (in reverse order to maintain indices)
  const textRequests: Array<{ insertText: { location: { index: number }; text: string } }> = [];

  // Collect header text insertions
  const headerRow = tableElement.table.tableRows?.[0];
  if (headerRow) {
    for (let col = 0; col < headers.length; col++) {
      const cell = headerRow.tableCells?.[col];
      const cellIndex = getCellInsertIndex(cell);
      if (cellIndex !== null) {
        textRequests.push({
          insertText: {
            location: { index: cellIndex },
            text: headers[col],
          },
        });
      }
    }
  }

  // Collect data text insertions
  for (let row = 0; row < tableData.length; row++) {
    const tableRow = tableElement.table.tableRows?.[row + 1];
    if (tableRow) {
      for (let col = 0; col < headers.length; col++) {
        const cell = tableRow.tableCells?.[col];
        const cellIndex = getCellInsertIndex(cell);
        const cellValue = tableData[row][col] || '';
        if (cellIndex !== null && cellValue) {
          textRequests.push({
            insertText: {
              location: { index: cellIndex },
              text: cellValue,
            },
          });
        }
      }
    }
  }

  // Execute text insertions in reverse order
  if (textRequests.length > 0) {
    textRequests.reverse();

    const textResponse = await fetch(`https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ requests: textRequests }),
    });

    if (!textResponse.ok) {
      const error = await textResponse.json().catch(() => ({}));
      debugLogger.logApiResponse('google', `/documents/${documentId}:batchUpdate (text)`, error, new Error(error.error?.message || 'Failed to insert text'));
      throw new Error(error.error?.message || 'Failed to insert text');
    }
  }

  // STEP 3: Apply text formatting (need fresh document to get correct indices)
  const formattedDoc = await getDocument(documentId);
  const formattedTable = findTableNearIndex(formattedDoc, placeholderIndex, numRows, numCols);

  if (formattedTable) {
    const formatRequests: unknown[] = [];

    // Format header text (bold, white)
    const fmtHeaderRow = formattedTable.table.tableRows?.[0];
    if (fmtHeaderRow) {
      for (let col = 0; col < headers.length; col++) {
        const cell = fmtHeaderRow.tableCells?.[col];
        const content = cell?.content?.[0]?.paragraph?.elements?.[0];
        if (content?.textRun?.content?.trim()) {
          formatRequests.push({
            updateTextStyle: {
              range: {
                startIndex: content.startIndex,
                endIndex: content.endIndex - 1, // Exclude trailing newline
              },
              textStyle: {
                bold: true,
                foregroundColor: { color: { rgbColor: headerTextColor } },
              },
              fields: 'bold,foregroundColor',
            },
          });
        }
      }
    }

    // Format data text (ensure black color)
    for (let row = 0; row < tableData.length; row++) {
      const fmtDataRow = formattedTable.table.tableRows?.[row + 1];
      if (fmtDataRow) {
        for (let col = 0; col < numCols; col++) {
          const cell = fmtDataRow.tableCells?.[col];
          const content = cell?.content?.[0]?.paragraph?.elements?.[0];
          if (content?.textRun?.content?.trim()) {
            formatRequests.push({
              updateTextStyle: {
                range: {
                  startIndex: content.startIndex,
                  endIndex: content.endIndex - 1,
                },
                textStyle: {
                  bold: false,
                  foregroundColor: { color: { rgbColor: dataTextColor } },
                },
                fields: 'bold,foregroundColor',
              },
            });
          }
        }
      }
    }

    if (formatRequests.length > 0) {
      const formatResponse = await fetch(`https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ requests: formatRequests }),
      });

      if (!formatResponse.ok) {
        const error = await formatResponse.json().catch(() => ({}));
        debugLogger.log('google', 'Failed to apply text formatting', error);
      }
    }
  }

  debugLogger.logApiResponse('google', `/documents/${documentId}:batchUpdate`, { success: true, rows: numRows, cols: numCols });
  return { rows: numRows, cols: numCols };
}

// Find a table near a given index with expected dimensions
function findTableNearIndex(
  doc: GoogleDoc,
  targetIndex: number,
  expectedRows: number | null = null,
  expectedCols: number | null = null
): TableElement | null {
  const content = doc.body?.content || [];
  const tables: Array<{
    element: TableElement;
    startIndex: number;
    endIndex: number;
    numRows: number;
    numCols: number;
    distance: number;
  }> = [];

  // Collect all tables with their positions
  for (const element of content) {
    if (element.table) {
      const numRows = element.table.tableRows?.length || 0;
      const numCols = element.table.tableRows?.[0]?.tableCells?.length || 0;
      tables.push({
        element: element as TableElement,
        startIndex: element.startIndex,
        endIndex: element.endIndex,
        numRows,
        numCols,
        distance: Math.abs(element.startIndex - targetIndex),
      });
    }
  }

  debugLogger.log('google', 'Finding table near index', {
    targetIndex,
    expectedRows,
    expectedCols,
    tablesFound: tables.map(t => ({
      startIndex: t.startIndex,
      rows: t.numRows,
      cols: t.numCols,
      distance: t.distance,
    })),
  });

  if (tables.length === 0) {
    return null;
  }

  // If we have expected dimensions, prefer tables that match
  if (expectedRows !== null && expectedCols !== null) {
    const matchingTables = tables.filter(
      t => t.numRows === expectedRows && t.numCols === expectedCols
    );

    if (matchingTables.length > 0) {
      // Return the matching table closest to target index
      matchingTables.sort((a, b) => a.distance - b.distance);
      debugLogger.log('google', 'Found matching table by dimensions', {
        startIndex: matchingTables[0].startIndex,
        rows: matchingTables[0].numRows,
      });
      return matchingTables[0].element;
    }
  }

  // Fallback: find table closest to target index
  tables.sort((a, b) => a.distance - b.distance);
  debugLogger.log('google', 'Using closest table', {
    startIndex: tables[0].startIndex,
    rows: tables[0].numRows,
  });
  return tables[0].element;
}

// Get the insert index for a table cell
interface TableCell {
  content?: Array<{
    paragraph?: {
      elements?: Array<{
        startIndex: number;
      }>;
    };
  }>;
}

function getCellInsertIndex(cell: TableCell | undefined): number | null {
  const content = cell?.content || [];
  for (const elem of content) {
    if (elem.paragraph?.elements?.[0]) {
      return elem.paragraph.elements[0].startIndex;
    }
  }
  return null;
}

// Format milestones data for table insertion
export function buildMilestonesTableData(outcomes: Outcome[] | undefined): string[][] {
  const formatDate = (dateStr: string | undefined): string => {
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
export function buildStaffTableData(
  roles: Record<string, RoleData> | undefined,
  teamMembers: TeamMember[] | undefined
): string[][] {
  const roleLabels: Record<string, string> = {
    project_owner: 'Project Owner',
    project_coordinator: 'Project Coordinator',
    technical_support: 'Technical Support',
    comms_support: 'Communications Support',
    oversight: 'Oversight',
    other: 'Other',
  };

  debugLogger.log('google', 'Building staff table data - start', {
    rolesReceived: roles,
    rolesType: typeof roles,
    rolesKeys: roles ? Object.keys(roles) : 'null/undefined',
    teamMembersCount: teamMembers?.length || 0,
  });

  // Handle null/undefined roles
  if (!roles || typeof roles !== 'object') {
    debugLogger.log('google', 'No valid roles object received');
    return [];
  }

  const staffData: string[][] = [];

  for (const [roleKey, roleData] of Object.entries(roles)) {
    debugLogger.log('google', `Evaluating role: ${roleKey}`, {
      roleData: JSON.stringify(roleData),
      roleDataType: typeof roleData,
      memberId: roleData?.memberId,
      memberIdTruthy: !!roleData?.memberId,
      name: roleData?.name,
      nameTruthy: !!roleData?.name,
      fte: roleData?.fte,
    });

    // Include role if it has a name (already resolved from transform)
    // or memberId (will look up from teamMembers)
    const hasName = roleData?.name && roleData.name.trim() !== '';
    const hasMemberId = roleData?.memberId && roleData.memberId.trim() !== '';

    if (hasName || hasMemberId) {
      // Prefer the pre-resolved name, or look up by memberId
      let memberName = roleData.name || '';
      if (!memberName && hasMemberId && teamMembers?.length) {
        const member = teamMembers.find(m => m.id === roleData.memberId);
        memberName = member?.name || '';
      }

      // If we still don't have a name, use TBD
      if (!memberName) {
        memberName = 'TBD';
      }

      const fte = roleData.fte ? `${roleData.fte}%` : 'TBD';
      const roleLabel = roleLabels[roleKey] || roleKey;

      debugLogger.log('google', `Adding staff row for ${roleKey}`, {
        roleLabel,
        memberName,
        fte,
      });

      staffData.push([roleLabel, memberName, fte]);
    } else {
      debugLogger.log('google', `Skipping role ${roleKey}: no name or memberId`);
    }
  }

  debugLogger.log('google', 'Staff table data built - complete', {
    rowCount: staffData.length,
    staffData,
  });

  return staffData;
}

// Populate a Google Doc with tables for milestones and staff
export async function populateDocWithTables(
  documentId: string,
  projectData: ProjectDataForGoogle,
  teamMembers: TeamMember[] | undefined
): Promise<void> {
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
      debugLogger.log('google', `Failed to insert milestones table: ${(err as Error).message}`);
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
      debugLogger.log('google', `Failed to insert staff table: ${(err as Error).message}`);
    }
  } else {
    // No staff - just remove the placeholder
    await populateDoc(documentId, { [staffPlaceholder]: '(No staff assigned)' });
  }
}

// Get Google Doc URL from document ID
export function getDocUrl(documentId: string): string {
  return `https://docs.google.com/document/d/${documentId}/edit`;
}

// Get Google Slides URL from presentation ID
export function getSlidesUrl(presentationId: string): string {
  return `https://docs.google.com/presentation/d/${presentationId}/edit`;
}

// Get Google Drive folder URL
export function getFolderUrl(folderId: string): string {
  return `https://drive.google.com/drive/folders/${folderId}`;
}

// Build placeholder replacements from project data
// Uses placeholder values from config/fields.toml [google.placeholders]
export function buildReplacements(projectData: ProjectDataForGoogle): Record<string, string> {
  const formatDate = (dateStr: string | undefined): string => {
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
  const replacements: Record<string, string> = {
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
      .filter(([, value]) => !value)
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
