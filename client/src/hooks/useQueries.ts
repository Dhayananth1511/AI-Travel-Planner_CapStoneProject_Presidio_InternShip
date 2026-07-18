import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryService } from '../services/queryService';
import { useAuthStore } from '../store/authStore';
import type { SubmitQueryPayload } from '../services/queryService';

export function useSubmitQueryMutation() {
  return useMutation({
    mutationFn: (payload: SubmitQueryPayload) => queryService.submitQuery(payload),
  });
}

export function useAdminQueriesQuery(status?: string) {
  return useQuery({
    queryKey: ['adminQueries', status],
    queryFn: () => queryService.getAdminQueries(status),
    retry: 1,
  });
}

export function useMyQueriesQuery() {
  const { user } = useAuthStore();
  return useQuery({
    queryKey: ['myQueries'],
    queryFn: () => queryService.getMyQueries(),
    enabled: !!user,
    retry: 1,
  });
}

export function useResolveQueryMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ queryId, adminReply }: { queryId: string; adminReply?: string }) =>
      queryService.resolveQuery(queryId, adminReply),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminQueries'] });
      queryClient.invalidateQueries({ queryKey: ['myQueries'] });
    },
  });
}
