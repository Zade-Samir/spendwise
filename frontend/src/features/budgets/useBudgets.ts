import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Budget, BudgetListResponse, BudgetUpsertPayload } from '../../types/budget';

export function useBudgets() {
  return useQuery<BudgetListResponse>({
    queryKey: ['budgets'],
    queryFn: () => api.get<BudgetListResponse>('/budgets'),
    staleTime: 30_000,
  });
}

export function useUpsertBudget() {
  const queryClient = useQueryClient();

  return useMutation<Budget, Error, BudgetUpsertPayload>({
    mutationFn: (payload) => api.put<Budget>('/budgets', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
      queryClient.invalidateQueries({ queryKey: ['insights'] });
    },
  });
}

export function useDeleteBudget() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: (id) => api.delete<void>(`/budgets/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
      queryClient.invalidateQueries({ queryKey: ['insights'] });
    },
  });
}
