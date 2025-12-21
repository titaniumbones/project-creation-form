// Hook for fetching funders from Airtable
import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { getFunders } from '../services/airtable';
import { tokenManager } from '../services/oauth';
import type { Funder } from '../types';

export function useFunders(): UseQueryResult<Funder[], Error> {
  return useQuery({
    queryKey: ['funders'],
    queryFn: getFunders,
    enabled: tokenManager.isTokenValid('airtable'),
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    retry: false, // Don't retry on auth errors
  });
}

export default useFunders;
