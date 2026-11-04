import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { ApiToken, ApiTokenCreatedResponse, ApiTokenCreateRequest } from '../../types/apiTokens';

export const API_TOKENS_KEY = ['api-tokens'] as const;

export function useApiTokens() {
  return useQuery<ApiToken[]>({
    queryKey: API_TOKENS_KEY,
    queryFn: () => api.get<ApiToken[]>('/api-tokens'),
  });
}

export function useCreateApiToken() {
  const queryClient = useQueryClient();
  return useMutation<ApiTokenCreatedResponse, Error, ApiTokenCreateRequest>({
    mutationFn: (data) => api.post<ApiTokenCreatedResponse>('/api-tokens', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: API_TOKENS_KEY });
    },
  });
}

export function useRevokeApiToken() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (tokenId) => api.delete<void>(`/api-tokens/${tokenId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: API_TOKENS_KEY });
    },
  });
}

