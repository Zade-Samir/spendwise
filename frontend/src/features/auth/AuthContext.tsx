import React, { useCallback, useEffect, useState } from 'react';
import { api, tokenStorage } from '../../lib/api';
import { TokenResponse, User } from '../../types/auth';
import { AuthContext } from './authContextDef';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const logout = useCallback(async (): Promise<void> => {
    const rawRefreshToken = tokenStorage.getRefreshToken();
    if (rawRefreshToken) {
      try {
        await api.post('/auth/logout', { refresh_token: rawRefreshToken });
      } catch {
        // Silently clear local credentials even if network fails
      }
    }
    tokenStorage.clearAll();
    setUser(null);
  }, []);

  const refreshProfile = useCallback(async (): Promise<void> => {
    try {
      const userProfile = await api.get<User>('/users/me');
      setUser(userProfile);
    } catch {
      setUser(null);
    }
  }, []);

  const login = useCallback(
    async (email: string, password: string): Promise<void> => {
      setError(null);
      const data = await api.post<TokenResponse>('/auth/login', { email, password });
      tokenStorage.setAccessToken(data.access_token);
      tokenStorage.setRefreshToken(data.refresh_token);
      setUser(data.user);
    },
    []
  );

  const register = useCallback(
    async (email: string, password: string, name?: string): Promise<void> => {
      setError(null);
      const data = await api.post<TokenResponse>('/auth/register', {
        email,
        password,
        name: name || undefined,
      });
      tokenStorage.setAccessToken(data.access_token);
      tokenStorage.setRefreshToken(data.refresh_token);
      setUser(data.user);
    },
    []
  );

  // Initialize session on mount
  useEffect(() => {
    tokenStorage.setUnauthorizedListener(() => {
      setUser(null);
    });

    const initAuth = async (): Promise<void> => {
      const rawRefreshToken = tokenStorage.getRefreshToken();
      if (!rawRefreshToken) {
        setIsLoading(false);
        return;
      }

      try {
        const refreshData = await api.post<{ access_token: string; refresh_token: string }>('/auth/refresh', {
          refresh_token: rawRefreshToken,
        });
        tokenStorage.setAccessToken(refreshData.access_token);
        tokenStorage.setRefreshToken(refreshData.refresh_token);
        const me = await api.get<User>('/users/me');
        setUser(me);
      } catch {
        tokenStorage.clearAll();
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        error,
        login,
        register,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
