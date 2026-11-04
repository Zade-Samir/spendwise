import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { InsightListResponse } from '../../types/insight';

export function useInsights() {
  return useQuery<InsightListResponse>({
    queryKey: ['insights'],
    queryFn: () => api.get<InsightListResponse>('/insights'),
    staleTime: 60_000,
  });
}
