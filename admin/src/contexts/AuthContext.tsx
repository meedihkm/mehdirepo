// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - ADMIN AUTH CONTEXT
// Gestion de session, tokens, et state utilisateur
// ═══════════════════════════════════════════════════════════════════════════════

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { api as apiClient, tokenStorage } from '../api/client';

// ─── TYPES ───────────────────────────────────────────────────────────────────

interface User {
  id: string;
  email: string;
  name: string;
  phone?: string;
  role: 'admin' | 'manager' | 'deliverer' | 'kitchen' | 'customer';
  organizationId: string;
  organizationName: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (data: Partial<User>) => void;
  refreshSession: () => Promise<void>;
  hasRole: (...roles: string[]) => boolean;
}

// ─── CONTEXT ─────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
  });

  // Vérifier la session au démarrage
  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    const token = tokenStorage.getAccessToken();
    if (!token) {
      setState({ user: null, isAuthenticated: false, isLoading: false });
      return;
    }

    try {
      const response = await apiClient.get('/auth/profile');
      setState({
        user: response.data.data,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error) {
      // Token invalide → essayer refresh
      try {
        const refreshToken = tokenStorage.getRefreshToken();
        if (refreshToken) {
          const refreshResponse = await apiClient.post('/auth/refresh', {
            refreshToken,
          });
          tokenStorage.setTokens({
            accessToken: refreshResponse.data.data.accessToken,
            refreshToken: refreshResponse.data.data.refreshToken,
          });

          const profileResponse = await apiClient.get('/auth/profile');
          setState({
            user: profileResponse.data.data,
            isAuthenticated: true,
            isLoading: false,
          });
          return;
        }
      } catch {
        // Refresh échoué aussi
      }

      tokenStorage.clearTokens();
      setState({ user: null, isAuthenticated: false, isLoading: false });
    }
  };

  const login = useCallback(async (email: string, password: string) => {
    setState(s => ({ ...s, isLoading: true }));
    try {
      const response = await apiClient.post('/auth/login', { email, password });
      const { accessToken, refreshToken, user } = response.data.data;

      tokenStorage.setTokens({ accessToken, refreshToken });
      setState({
        user,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error: any) {
      setState(s => ({ ...s, isLoading: false }));
      const message = error.response?.data?.message || 'Erreur de connexion';
      throw new Error(message);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiClient.post('/auth/logout');
    } catch {
      // Ignorer erreurs réseau au logout
    }
    tokenStorage.clearTokens();
    setState({ user: null, isAuthenticated: false, isLoading: false });
  }, []);

  const updateProfile = useCallback((data: Partial<User>) => {
    setState(s => ({
      ...s,
      user: s.user ? { ...s.user, ...data } : null,
    }));
  }, []);

  const refreshSession = useCallback(async () => {
    await checkSession();
  }, []);

  const hasRole = useCallback((...roles: string[]) => {
    return state.user ? roles.includes(state.user.role) : false;
  }, [state.user]);

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        logout,
        updateProfile,
        refreshSession,
        hasRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// ─── HOOKS ───────────────────────────────────────────────────────────────────

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth doit être utilisé dans un AuthProvider');
  }
  return context;
};

export const useUser = (): User => {
  const { user } = useAuth();
  if (!user) {
    throw new Error('Utilisateur non connecté');
  }
  return user;
};

export const useIsAdmin = (): boolean => {
  const { hasRole } = useAuth();
  return hasRole('admin');
};

export const useIsManager = (): boolean => {
  const { hasRole } = useAuth();
  return hasRole('admin', 'manager');
};

export default AuthContext;
