import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import {
  RecurringRule,
  RecurringRuleCreateRequest,
  RecurringRuleUpdateRequest,
  RecurringConfirmRequest,
} from '../../types/recurring';

export const RECURRING_KEYS = {
  all: ['recurring'] as const,
  rules: () => [...RECURRING_KEYS.all, 'rules'] as const,
  due: () => [...RECURRING_KEYS.all, 'due'] as const,
};

export function useRecurringRules() {
  return useQuery<RecurringRule[]>({
    queryKey: RECURRING_KEYS.rules(),
    queryFn: () => api.get<RecurringRule[]>('/recurring'),
  });
}

export function useDueRecurringRules() {
  return useQuery<RecurringRule[]>({
    queryKey: RECURRING_KEYS.due(),
    queryFn: () => api.get<RecurringRule[]>('/recurring/due'),
  });
}

export function useCreateRecurringRule() {
  const queryClient = useQueryClient();
  return useMutation<RecurringRule, Error, RecurringRuleCreateRequest>({
    mutationFn: (data) => api.post<RecurringRule>('/recurring', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: RECURRING_KEYS.all });
    },
  });
}

export function useUpdateRecurringRule() {
  const queryClient = useQueryClient();
  return useMutation<RecurringRule, Error, { id: string; data: RecurringRuleUpdateRequest }>({
    mutationFn: ({ id, data }) => api.patch<RecurringRule>(`/recurring/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: RECURRING_KEYS.all });
    },
  });
}

export function useDeleteRecurringRule() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (id) => api.delete<void>(`/recurring/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: RECURRING_KEYS.all });
    },
  });
}

export function useConfirmRecurring() {
  const queryClient = useQueryClient();
  return useMutation<unknown, Error, { id: string; payload?: RecurringConfirmRequest }>({
    mutationFn: ({ id, payload }) => api.post(`/recurring/${id}/confirm`, payload || {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: RECURRING_KEYS.all });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
    },
  });
}

export function useSkipRecurring() {
  const queryClient = useQueryClient();
  return useMutation<RecurringRule, Error, string>({
    mutationFn: (id) => api.post<RecurringRule>(`/recurring/${id}/skip`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: RECURRING_KEYS.all });
    },
  });
}

