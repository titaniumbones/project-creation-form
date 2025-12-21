// Hook for fetching team members from Airtable
import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { getTeamMembers } from '../services/airtable';
import { tokenManager } from '../services/oauth';
import type { TeamMember } from '../types';

export function useTeamMembers(): UseQueryResult<TeamMember[], Error> {
  return useQuery({
    queryKey: ['teamMembers'],
    queryFn: getTeamMembers,
    enabled: tokenManager.isTokenValid('airtable'),
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    retry: false, // Don't retry on auth errors
  });
}

export default useTeamMembers;
