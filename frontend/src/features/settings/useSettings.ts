import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { UserSettings, UserSettingsUpdateRequest } from '../../types/settings';

export const SETTINGS_KEY = ['settings'] as const;

export function useSettings() {
  return useQuery<UserSettings>({
    queryKey: SETTINGS_KEY,
    queryFn: () => api.get<UserSettings>('/settings'),
  });
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();
  return useMutation<UserSettings, Error, UserSettingsUpdateRequest>({
    mutationFn: (data) => api.patch<UserSettings>('/settings', data),
    onSuccess: (updated) => {
      queryClient.setQueryData(SETTINGS_KEY, updated);
      queryClient.invalidateQueries({ queryKey: SETTINGS_KEY });
    },
  });
}

