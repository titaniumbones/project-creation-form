// Hook for fetching parent initiatives from Airtable
import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { getParentInitiatives } from '../services/airtable';
import { tokenManager } from '../services/oauth';
import type { ParentInitiative } from '../types';

export function useParentInitiatives(): UseQueryResult<ParentInitiative[], Error> {
  return useQuery({
    queryKey: ['parentInitiatives'],
    queryFn: getParentInitiatives,
    enabled: tokenManager.isTokenValid('airtable'),
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    retry: false, // Don't retry on auth errors
  });
}

export default useParentInitiatives;
