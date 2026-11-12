import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { StaffUser, AppConfig, DBStatus, UserRole } from '../types';
import { api } from '../api/client';

interface AuthContextType {
  user: StaffUser | null;
  appConfig: AppConfig | null;
  dbStatus: DBStatus | null;
  loading: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  refreshConfig: () => Promise<void>;
  refreshHealth: () => Promise<void>;
  hasRole: (allowedRoles: UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<StaffUser | null>(null);
  const [appConfig, setAppConfig] = useState<AppConfig | null>(null);
  const [dbStatus, setDbStatus] = useState<DBStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const refreshHealth = useCallback(async () => {
    try {
      const res = await api.getHealth();
      setDbStatus(res.database);
    } catch {
      // Ignored if server is waking up
    }
  }, []);

  const refreshConfig = useCallback(async () => {
    try {
      const res = await api.getConfig();
      setAppConfig(res.config);
    } catch (err) {
      console.error('Failed to load active config:', err);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const res = await api.getMe();
      setUser(res.user);
      if (res.appConfig) setAppConfig(res.appConfig);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshHealth();
    refreshConfig();
    refreshUser();
  }, [refreshHealth, refreshConfig, refreshUser]);

  const login = async (identifier: string, password: string) => {
    const res = await api.login(identifier, password);
    setUser(res.user);
    await refreshConfig();
    await refreshHealth();
  };

  const logout = async () => {
    try {
      await api.logout();
    } catch (e) {
      console.error('Logout error:', e);
    } finally {
      setUser(null);
    }
  };

  const hasRole = (allowedRoles: UserRole[]): boolean => {
    if (!user) return false;
    if (user.role === 'Superadmin') return true;
    return allowedRoles.includes(user.role);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        appConfig,
        dbStatus,
        loading,
        login,
        logout,
        refreshUser,
        refreshConfig,
        refreshHealth,
        hasRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
