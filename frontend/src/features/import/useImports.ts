import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import {
  ImportBatchResponse,
  ImportUploadResponse,
  ImportPreviewRequest,
  ImportPreviewResponse,
  ImportCommitRequest,
  ImportCommitResponse,
} from '../../types/imports';

export const IMPORT_KEYS = {
  all: ['imports'] as const,
  batches: () => [...IMPORT_KEYS.all, 'batches'] as const,
};

export function useImportBatches() {
  return useQuery<ImportBatchResponse[]>({
    queryKey: IMPORT_KEYS.batches(),
    queryFn: () => api.get<ImportBatchResponse[]>('/imports'),
  });
}

export function useUploadImport() {
  return useMutation<ImportUploadResponse, Error, FormData>({
    mutationFn: (formData) => api.post<ImportUploadResponse>('/imports', formData),
  });
}

export function usePreviewImport() {
  return useMutation<ImportPreviewResponse, Error, { batchId: string; request: ImportPreviewRequest }>({
    mutationFn: ({ batchId, request }) =>
      api.post<ImportPreviewResponse>(`/imports/${batchId}/preview`, request),
  });
}

export function useCommitImport() {
  const queryClient = useQueryClient();
  return useMutation<ImportCommitResponse, Error, { batchId: string; request: ImportCommitRequest }>({
    mutationFn: ({ batchId, request }) =>
      api.post<ImportCommitResponse>(`/imports/${batchId}/commit`, request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: IMPORT_KEYS.all });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
    },
  });
}

export function useUndoImport() {
  const queryClient = useQueryClient();
  return useMutation<{ rolled_back: number }, Error, string>({
    mutationFn: (batchId) => api.delete<{ rolled_back: number }>(`/imports/${batchId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: IMPORT_KEYS.all });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
    },
  });
}

