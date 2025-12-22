// Duplicate detection orchestration service
// Checks all three platforms for existing projects before creation

import { checkProjectExists } from './airtable';
import { searchProjectByName } from './asana';
import { searchDriveFolder } from './google';
import { debugLogger } from './debugLogger';
import type {
  DuplicateCheckResult,
  AirtableDuplicateResult,
  AsanaDuplicateResult,
  GoogleDuplicateResult,
  DuplicateDefaults,
} from '../types';
import type { DuplicatesConfig } from '../hooks/useConfig';

// Default resolution strategies (used if config is unavailable)
const DEFAULT_RESOLUTIONS: DuplicateDefaults = {
  airtable: 'update',
  asana: 'use_existing',
  google: 'keep',
};

/**
 * Get default resolution strategies from config or use fallback defaults
 */
export function getDefaultResolutions(config?: DuplicatesConfig): DuplicateDefaults {
  return {
    airtable: config?.defaults?.airtable || DEFAULT_RESOLUTIONS.airtable,
    asana: config?.defaults?.asana || DEFAULT_RESOLUTIONS.asana,
    google: config?.defaults?.google || DEFAULT_RESOLUTIONS.google,
  };
}

/**
 * Check Airtable for an existing project with the same name
 */
async function checkAirtableDuplicate(projectName: string): Promise<AirtableDuplicateResult> {
  try {
    debugLogger.log('airtable', 'Starting Airtable duplicate check', { projectName });
    const result = await checkProjectExists(projectName);
    debugLogger.log('airtable', 'Airtable search completed', { result });
    return {
      found: result.exists,
      record: result.existingRecord || undefined,
      url: result.url || undefined,
      projectName: result.existingRecord?.fields?.['Project'] as string | undefined,
      createdTime: result.existingRecord?.createdTime,
    };
  } catch (error) {
    console.error('[DuplicateCheck] Airtable API error:', error);
    debugLogger.log('error', 'Airtable duplicate check failed', { error, projectName });
    // Return not found on error - allow creation to proceed
    return { found: false };
  }
}

/**
 * Check Asana for an existing project with the same name
 */
async function checkAsanaDuplicate(
  projectName: string,
  workspaceGid: string
): Promise<AsanaDuplicateResult> {
  try {
    debugLogger.log('asana', 'Starting Asana duplicate check', { projectName, workspaceGid });
    const result = await searchProjectByName(projectName, workspaceGid);
    debugLogger.log('asana', 'Asana search completed', { result });
    return {
      found: result.exists,
      project: result.existingProject || undefined,
      url: result.url || undefined,
      searchResults: result.searchResults,
    };
  } catch (error) {
    console.error('[DuplicateCheck] Asana API error:', error);
    debugLogger.log('error', 'Asana duplicate check failed', { error, projectName, workspaceGid });
    // Return not found on error - allow creation to proceed
    return { found: false };
  }
}

/**
 * Check Google Drive for an existing project folder with the same name
 */
async function checkGoogleDuplicate(
  folderName: string,
  sharedDriveId: string | null,
  parentFolderId: string | null
): Promise<GoogleDuplicateResult> {
  try {
    debugLogger.log('google', 'Starting Google Drive duplicate check', { folderName, sharedDriveId, parentFolderId });
    const folders = await searchDriveFolder(folderName, sharedDriveId, parentFolderId);
    debugLogger.log('google', 'Google Drive search completed', { foldersFound: folders.length, folders });

    // Find exact match by name
    const exactMatch = folders.find(
      f => f.name.toLowerCase() === folderName.toLowerCase()
    );

    if (exactMatch) {
      return {
        found: true,
        folderId: exactMatch.id,
        url: exactMatch.webViewLink,
        folderName: exactMatch.name,
        // TODO: Could fetch folder contents here if needed
        documents: [],
      };
    }

    return { found: false };
  } catch (error) {
    console.error('[DuplicateCheck] Google Drive API error:', error);
    debugLogger.log('error', 'Google Drive duplicate check failed', { error, folderName });
    // Return not found on error - allow creation to proceed
    return { found: false };
  }
}

/**
 * Parameters for checking all platforms for duplicates
 */
export interface CheckAllDuplicatesParams {
  projectName: string;
  /** Asana workspace GID (required for Asana check) */
  workspaceGid?: string;
  /** Google Shared Drive ID (optional, for scoped search) */
  sharedDriveId?: string | null;
  /** Google parent folder ID (optional, for scoped search) */
  parentFolderId?: string | null;
  /** Platforms to check (defaults to all) */
  platforms?: {
    airtable?: boolean;
    asana?: boolean;
    google?: boolean;
  };
  /** Existing resource URLs (skip check if provided) */
  existingUrls?: {
    asanaUrl?: string;
    scopingDocUrl?: string;
  };
}

/**
 * Check all configured platforms for existing projects in parallel
 *
 * @param params - Project name and platform-specific parameters
 * @returns Combined duplicate check results from all platforms
 */
export async function checkAllDuplicates(
  params: CheckAllDuplicatesParams
): Promise<DuplicateCheckResult> {
  const {
    projectName,
    workspaceGid,
    sharedDriveId = null,
    parentFolderId = null,
    platforms = { airtable: true, asana: true, google: true },
    existingUrls = {},
  } = params;

  // Log all parameters for debugging
  console.log('[DuplicateCheck] checkAllDuplicates called with:', {
    projectName,
    workspaceGid: workspaceGid || '(not provided)',
    sharedDriveId: sharedDriveId || '(not provided)',
    parentFolderId: parentFolderId || '(not provided)',
    platforms,
    existingUrls,
  });

  debugLogger.log('session', 'Starting duplicate check across platforms', {
    projectName,
    platforms,
    workspaceGid,
    sharedDriveId,
    parentFolderId,
    existingUrls,
  });

  const startTime = Date.now();

  // Check if user provided existing URLs (skip those platforms)
  const hasExistingAsana = !!existingUrls.asanaUrl;
  const hasExistingScopingDoc = !!existingUrls.scopingDocUrl;

  // Log which checks will run
  const willRunAirtable = platforms.airtable !== false;
  const willRunAsana = platforms.asana !== false && !!workspaceGid && !hasExistingAsana;
  const willRunGoogle = platforms.google !== false && !hasExistingScopingDoc;
  console.log('[DuplicateCheck] Will run checks:', {
    willRunAirtable,
    willRunAsana,
    willRunGoogle,
    skippedBecauseExisting: {
      asana: hasExistingAsana,
      google: hasExistingScopingDoc,
    }
  });

  // Run all checks in parallel for performance
  const [airtableResult, asanaResult, googleResult] = await Promise.all([
    willRunAirtable
      ? checkAirtableDuplicate(projectName)
      : Promise.resolve({ found: false } as AirtableDuplicateResult),

    // If user provided existing Asana URL, mark as "found" with the URL
    hasExistingAsana
      ? Promise.resolve({
          found: true,
          url: existingUrls.asanaUrl,
          userProvided: true,  // Flag to indicate user provided this
        } as AsanaDuplicateResult & { userProvided?: boolean })
      : willRunAsana
        ? checkAsanaDuplicate(projectName, workspaceGid!)
        : Promise.resolve({ found: false, skipped: true } as AsanaDuplicateResult),

    // If user provided existing Scoping Doc URL, mark as "found" with the URL
    hasExistingScopingDoc
      ? Promise.resolve({
          found: true,
          url: existingUrls.scopingDocUrl,
          userProvided: true,  // Flag to indicate user provided this
        } as GoogleDuplicateResult & { userProvided?: boolean })
      : willRunGoogle
        ? checkGoogleDuplicate(projectName, sharedDriveId, parentFolderId)
        : Promise.resolve({ found: false } as GoogleDuplicateResult),
  ]);

  const result: DuplicateCheckResult = {
    airtable: airtableResult,
    asana: asanaResult,
    google: googleResult,
    hasDuplicates: airtableResult.found || asanaResult.found || googleResult.found,
    checkedAt: Date.now(),
  };

  debugLogger.log('session', 'Duplicate check complete', {
    duration: Date.now() - startTime,
    hasDuplicates: result.hasDuplicates,
    foundIn: {
      airtable: airtableResult.found,
      asana: asanaResult.found,
      google: googleResult.found,
    },
    userProvided: {
      asana: hasExistingAsana,
      google: hasExistingScopingDoc,
    },
  });

  return result;
}

/**
 * Check if duplicate checking is enabled in config
 */
export function isDuplicateCheckEnabled(config?: DuplicatesConfig): boolean {
  // Enabled by default if config is missing
  return config?.enabled !== false;
}

export default {
  checkAllDuplicates,
  getDefaultResolutions,
  isDuplicateCheckEnabled,
};
