// Hook for checking duplicates across platforms before project creation

import { useState, useCallback, useMemo } from 'react';
import { useIntegrationsConfig } from './useConfig';
import {
  checkAllDuplicates,
  getDefaultResolutions,
  isDuplicateCheckEnabled,
  type CheckAllDuplicatesParams,
} from '../services/duplicates';
import type {
  DuplicateCheckResult,
  DuplicateResolution,
  DuplicateDefaults,
} from '../types';

interface UseDuplicateCheckResult {
  /** Trigger a duplicate check for the given project name */
  checkDuplicates: (params: CheckAllDuplicatesParams) => Promise<DuplicateCheckResult>;
  /** Most recent duplicate check result */
  result: DuplicateCheckResult | null;
  /** Whether a check is currently in progress */
  isChecking: boolean;
  /** Error from the most recent check, if any */
  error: Error | null;
  /** Reset the check state (clear results) */
  reset: () => void;
  /** Whether duplicate checking is enabled in config */
  isEnabled: boolean;
  /** Default resolution strategies from config */
  defaults: DuplicateDefaults;
  /** Current user resolution choices (can be modified) */
  resolution: DuplicateResolution;
  /** Update resolution for a specific platform */
  setResolution: (resolution: Partial<DuplicateResolution>) => void;
  /** Reset resolution to defaults */
  resetResolution: () => void;
}

/**
 * Hook for managing duplicate detection workflow
 *
 * Usage:
 * ```tsx
 * const {
 *   checkDuplicates,
 *   result,
 *   isChecking,
 *   resolution,
 *   setResolution,
 * } = useDuplicateCheck();
 *
 * // Trigger check when user submits
 * const handleSubmit = async () => {
 *   const duplicates = await checkDuplicates({ projectName, workspaceGid });
 *   if (duplicates.hasDuplicates) {
 *     // Show resolution modal
 *   } else {
 *     // Proceed with creation
 *   }
 * };
 * ```
 */
export function useDuplicateCheck(): UseDuplicateCheckResult {
  const { config } = useIntegrationsConfig();

  const isEnabled = isDuplicateCheckEnabled(config?.duplicates);

  // Memoize defaults to prevent useEffect in modal from resetting user choices on every render
  const duplicatesConfig = config?.duplicates;
  const defaults = useMemo<DuplicateDefaults>(
    () => getDefaultResolutions(duplicatesConfig),
    [duplicatesConfig?.defaults?.airtable, duplicatesConfig?.defaults?.asana, duplicatesConfig?.defaults?.google]
  );

  const [result, setResult] = useState<DuplicateCheckResult | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [resolution, setResolutionState] = useState<DuplicateResolution>({ ...defaults });

  const checkDuplicates = useCallback(
    async (params: CheckAllDuplicatesParams): Promise<DuplicateCheckResult> => {
      setIsChecking(true);
      setError(null);

      try {
        const checkResult = await checkAllDuplicates(params);
        setResult(checkResult);
        return checkResult;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Duplicate check failed');
        setError(error);
        // Return empty result on error - allow creation to proceed
        const emptyResult: DuplicateCheckResult = {
          airtable: { found: false },
          asana: { found: false },
          google: { found: false },
          hasDuplicates: false,
          checkedAt: Date.now(),
        };
        setResult(emptyResult);
        return emptyResult;
      } finally {
        setIsChecking(false);
      }
    },
    []
  );

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
    setIsChecking(false);
  }, []);

  const setResolution = useCallback((partial: Partial<DuplicateResolution>) => {
    setResolutionState(prev => ({ ...prev, ...partial }));
  }, []);

  const resetResolution = useCallback(() => {
    setResolutionState({ ...defaults });
  }, [defaults]);

  return {
    checkDuplicates,
    result,
    isChecking,
    error,
    reset,
    isEnabled,
    defaults,
    resolution,
    setResolution,
    resetResolution,
  };
}

/**
 * Helper to determine if we should show the resolution modal
 */
export function shouldShowResolutionModal(
  result: DuplicateCheckResult | null,
  isEnabled: boolean
): boolean {
  if (!isEnabled) return false;
  if (!result) return false;
  return result.hasDuplicates;
}

export default useDuplicateCheck;
