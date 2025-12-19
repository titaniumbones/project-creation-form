// Google Workspace API client (Drive, Docs, Slides)
import { getValidToken } from './oauth';

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
    throw new Error(error.error?.message || 'Failed to copy template');
  }

  return response.json();
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
    throw new Error(error.error?.message || 'Failed to populate document');
  }

  return response.json();
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
    throw new Error(error.error?.message || 'Failed to populate slides');
  }

  return response.json();
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

  return {
    '{{PROJECT_NAME}}': projectData.projectName || '',
    '{{PROJECT_ACRONYM}}': projectData.projectAcronym || '',
    '{{PROJECT_DESCRIPTION}}': projectData.description || '',
    '{{OBJECTIVES}}': projectData.objectives || '',
    '{{START_DATE}}': formatDate(projectData.startDate),
    '{{END_DATE}}': formatDate(projectData.endDate),
    '{{CREATED_DATE}}': today,
    '{{PROJECT_OWNER}}': projectData.roles?.project_owner?.name || '',
    '{{PROJECT_COORDINATOR}}': projectData.roles?.project_coordinator?.name || '',
  };
}

export default {
  searchDriveFolder,
  createDriveFolder,
  copyTemplate,
  populateDoc,
  populateSlides,
  getDocUrl,
  getSlidesUrl,
  getFolderUrl,
  buildReplacements,
};
