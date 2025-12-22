// Hook for fetching project type options from Airtable
import { useQuery } from '@tanstack/react-query';
import { getProjectTypeOptions } from '../services/airtable';
import { tokenManager } from '../services/oauth';
import { useFieldsConfig } from './useConfig';

interface UseProjectTypesResult {
  data: string[] | undefined;
  isLoading: boolean;
  error: Error | null;
  isConnected: boolean;
}

export function useProjectTypes(): UseProjectTypesResult {
  const { config } = useFieldsConfig();

  // Get static options from config as fallback
  const staticOptions = (config?.fields?.project_type?.options as string[]) || [];

  const isConnected = tokenManager.isTokenValid('airtable');

  const query = useQuery({
    queryKey: ['projectTypes'],
    queryFn: getProjectTypeOptions,
    enabled: isConnected,
    staleTime: 10 * 60 * 1000, // Cache for 10 minutes (schema changes rarely)
    retry: false, // Don't retry on auth errors
  });

  // Return dynamic options if available, fall back to static config
  return {
    data: query.data && query.data.length > 0 ? query.data : staticOptions,
    isLoading: query.isLoading,
    error: query.error,
    isConnected,
  };
}

export default useProjectTypes;
