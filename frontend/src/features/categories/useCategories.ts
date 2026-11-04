import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { CategoryTree, CategorySuggestion, CategoryChild } from '../../types/categories';

export function useCategories(includeArchived: boolean = false) {
  return useQuery({
    queryKey: ['categories', { includeArchived }],
    queryFn: async () => {
      const res = await api.get<CategoryTree[]>(
        `/categories${includeArchived ? '?include_archived=true' : ''}`
      );
      return res;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      name: string;
      icon: string;
      color: string;
      parent_id?: string | null;
    }) => {
      return api.post<CategoryChild>('/categories', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
  });
}

export function useCategorySuggest(merchant: string, enabled: boolean = true) {
  const trimmed = merchant.trim();
  return useQuery({
    queryKey: ['category-suggest', trimmed],
    queryFn: async () => {
      if (!trimmed || trimmed.length < 2) {
        return null;
      }
      return api.get<CategorySuggestion>(
        `/categories/suggest?merchant=${encodeURIComponent(trimmed)}`
      );
    },
    enabled: enabled && trimmed.length >= 2,
    staleTime: 60 * 1000,
  });
}
