import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { enqueueTransaction } from '../../lib/offlineQueue';
import { CategoryTree } from '../../types/categories';
import {
  Transaction,
  TransactionCreatePayload,
  TransactionUpdatePayload,
  TransactionListResponse,
  RecentMerchant,
  PaymentMethod,
} from '../../types/transactions';

export interface TransactionFilters {
  q?: string;
  from?: string;
  to?: string;
  category_id?: string;
  subcategory_id?: string;
  payment_method?: PaymentMethod | PaymentMethod[];
  min_amount_minor?: number;
  max_amount_minor?: number;
  sort?: string;
  cursor?: string;
  limit?: number;
}

export function useTransactions(filters: TransactionFilters = {}) {
  return useQuery({
    queryKey: ['transactions', filters],
    queryFn: async () => {
      const params = new URLSearchParams();

      if (filters.q?.trim()) params.append('q', filters.q.trim());
      if (filters.from) params.append('from', filters.from);
      if (filters.to) params.append('to', filters.to);
      if (filters.category_id) params.append('category_id', filters.category_id);
      if (filters.subcategory_id) params.append('subcategory_id', filters.subcategory_id);
      if (filters.min_amount_minor !== undefined && filters.min_amount_minor > 0) {
        params.append('min_amount_minor', filters.min_amount_minor.toString());
      }
      if (filters.max_amount_minor !== undefined && filters.max_amount_minor > 0) {
        params.append('max_amount_minor', filters.max_amount_minor.toString());
      }
      if (filters.sort) params.append('sort', filters.sort);
      if (filters.cursor) params.append('cursor', filters.cursor);
      if (filters.limit) params.append('limit', filters.limit.toString());

      if (filters.payment_method) {
        if (Array.isArray(filters.payment_method)) {
          filters.payment_method.forEach((pm) => params.append('payment_method', pm));
        } else {
          params.append('payment_method', filters.payment_method);
        }
      }

      const queryString = params.toString();
      const endpoint = `/transactions${queryString ? `?${queryString}` : ''}`;
      return api.get<TransactionListResponse>(endpoint);
    },
  });
}

export function useRecentMerchants() {
  return useQuery({
    queryKey: ['recent-merchants'],
    queryFn: async () => {
      return api.get<RecentMerchant[]>('/transactions/recent-merchants');
    },
    staleTime: 60 * 1000,
  });
}

export function useCreateTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: TransactionCreatePayload): Promise<Transaction> => {
      const clientId = payload.client_id || crypto.randomUUID();
      const enrichedPayload = { ...payload, client_id: clientId };

      const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;

      if (isOffline) {
        await enqueueTransaction(enrichedPayload);

        const categories = queryClient.getQueryData<CategoryTree[]>(['categories']) || [];
        const cat = categories.find((c) => c.id === payload.category_id);
        const subcat = cat?.children?.find((s) => s.id === payload.subcategory_id);

        const optimisticTx: Transaction = {
          id: clientId,
          amount_minor: payload.amount_minor,
          category: {
            id: cat?.id || payload.category_id,
            name: cat?.name || 'Expense',
            icon: cat?.icon || 'tag',
            color: cat?.color || '#4F46E5',
          },
          subcategory: subcat ? { id: subcat.id, name: subcat.name } : null,
          merchant: payload.merchant || null,
          description: payload.description || null,
          notes: payload.notes || null,
          payment_method: payload.payment_method || 'upi',
          occurred_at: payload.occurred_at || new Date().toISOString(),
          source: payload.source || 'manual',
          client_id: clientId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          is_pending_sync: true,
        };

        queryClient.setQueriesData<TransactionListResponse>(
          { queryKey: ['transactions'] },
          (old) => {
            if (!old) return old;
            return {
              ...old,
              items: [optimisticTx, ...old.items],
              totals: {
                count: (old.totals?.count || 0) + 1,
                sum_minor: (old.totals?.sum_minor || 0) + payload.amount_minor,
              },
            };
          }
        );

        return optimisticTx;
      }

      try {
        return await api.post<Transaction>('/transactions', enrichedPayload);
      } catch (err: unknown) {
        const isNetworkError =
          (typeof navigator !== 'undefined' && !navigator.onLine) ||
          err instanceof TypeError ||
          (err instanceof Error &&
            (err.message.includes('Failed to fetch') ||
              err.message.includes('NetworkError') ||
              err.message.includes('Load failed')));

        if (isNetworkError) {
          await enqueueTransaction(enrichedPayload);

          const categories = queryClient.getQueryData<CategoryTree[]>(['categories']) || [];
          const cat = categories.find((c) => c.id === payload.category_id);
          const subcat = cat?.children?.find((s) => s.id === payload.subcategory_id);

          const optimisticTx: Transaction = {
            id: clientId,
            amount_minor: payload.amount_minor,
            category: {
              id: cat?.id || payload.category_id,
              name: cat?.name || 'Expense',
              icon: cat?.icon || 'tag',
              color: cat?.color || '#4F46E5',
            },
            subcategory: subcat ? { id: subcat.id, name: subcat.name } : null,
            merchant: payload.merchant || null,
            description: payload.description || null,
            notes: payload.notes || null,
            payment_method: payload.payment_method || 'upi',
            occurred_at: payload.occurred_at || new Date().toISOString(),
            source: payload.source || 'manual',
            client_id: clientId,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            is_pending_sync: true,
          };

          queryClient.setQueriesData<TransactionListResponse>(
            { queryKey: ['transactions'] },
            (old) => {
              if (!old) return old;
              return {
                ...old,
                items: [optimisticTx, ...old.items],
                totals: {
                  count: (old.totals?.count || 0) + 1,
                  sum_minor: (old.totals?.sum_minor || 0) + payload.amount_minor,
                },
              };
            }
          );

          return optimisticTx;
        }

        throw err;
      }
    },
    onSuccess: (data) => {
      if (!data.is_pending_sync) {
        queryClient.invalidateQueries({ queryKey: ['transactions'] });
        queryClient.invalidateQueries({ queryKey: ['categories'] });
        queryClient.invalidateQueries({ queryKey: ['recent-merchants'] });
      }
    },
  });
}

export function useUpdateTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: TransactionUpdatePayload }) => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        throw new Error('Connect to the internet to edit or delete existing expenses');
      }
      return api.patch<Transaction>(`/transactions/${id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
  });
}

export function useDeleteTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        throw new Error('Connect to the internet to edit or delete existing expenses');
      }
      await api.delete(`/transactions/${id}`);
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['recent-merchants'] });
    },
  });
}

export function useRestoreTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      return api.post<Transaction>(`/transactions/${id}/restore`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['recent-merchants'] });
    },
  });
}
