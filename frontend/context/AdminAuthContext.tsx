'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { AdminUser, AdminRole } from '@/types/admin';

interface AdminAuthContextType {
  user: AdminUser | null;
  role: AdminRole;
  apiKey: string;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, keyOrPass: string, chosenRole?: AdminRole) => Promise<boolean>;
  logout: () => void;
  switchRole: (newRole: AdminRole) => void;
  hasPermission: (permission: string) => boolean;
}

const DEFAULT_USER: AdminUser = {
  id: 'usr_admin_001',
  email: 'ops@reignovatechnologies.com',
  name: 'Marcus Vance',
  role: 'SUPER_ADMIN',
  lastActive: new Date().toISOString(),
};

const DEFAULT_ADMIN_KEY = 'reignova_admin_master_secret_2025_prod_secure';

const ROLE_PERMISSIONS: Record<AdminRole, string[]> = {
  SUPER_ADMIN: [
    'merchants.read',
    'merchants.create',
    'merchants.update',
    'merchants.suspend',
    'merchants.rotate_key',
    'payments.read',
    'payments.retry',
    'refunds.read',
    'refunds.approve',
    'payouts.read',
    'payouts.create',
    'audit_logs.read',
    'audit_logs.export',
    'settings.update',
  ],
  OPERATIONS_ADMIN: [
    'merchants.read',
    'merchants.create',
    'merchants.update',
    'merchants.suspend',
    'merchants.rotate_key',
    'payments.read',
    'payments.retry',
    'refunds.read',
    'payouts.read',
    'audit_logs.read',
  ],
  FINANCE_ADMIN: [
    'merchants.read',
    'payments.read',
    'refunds.read',
    'refunds.approve',
    'payouts.read',
    'payouts.create',
    'audit_logs.read',
  ],
  AUDITOR: [
    'merchants.read',
    'payments.read',
    'refunds.read',
    'payouts.read',
    'audit_logs.read',
    'audit_logs.export',
  ],
  SUPPORT_AGENT: [
    'merchants.read',
    'payments.read',
  ],
};

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [role, setRole] = useState<AdminRole>('SUPER_ADMIN');
  const [apiKey, setApiKey] = useState<string>(DEFAULT_ADMIN_KEY);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    // Check localStorage for saved session
    try {
      const storedAuth = localStorage.getItem('reignova_admin_session');
      if (storedAuth) {
        const parsed = JSON.parse(storedAuth);
        setUser(parsed.user);
        setRole(parsed.user.role || 'SUPER_ADMIN');
        setApiKey(parsed.apiKey || DEFAULT_ADMIN_KEY);
      } else {
        // Automatically hydrate default Super Admin session for immediate developer experience
        setUser(DEFAULT_USER);
        setRole('SUPER_ADMIN');
        setApiKey(DEFAULT_ADMIN_KEY);
      }
    } catch {
      setUser(DEFAULT_USER);
      setRole('SUPER_ADMIN');
      setApiKey(DEFAULT_ADMIN_KEY);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = useCallback(async (email: string, keyOrPass: string, chosenRole: AdminRole = 'SUPER_ADMIN') => {
    setIsLoading(true);
    // Simulate brief network authentication
    await new Promise((res) => setTimeout(res, 350));

    const effectiveKey = keyOrPass.trim() || DEFAULT_ADMIN_KEY;
    const authenticatedUser: AdminUser = {
      id: `usr_${Math.random().toString(36).substring(2, 9)}`,
      email,
      name: email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      role: chosenRole,
      lastActive: new Date().toISOString(),
    };

    setUser(authenticatedUser);
    setRole(chosenRole);
    setApiKey(effectiveKey);

    localStorage.setItem(
      'reignova_admin_session',
      JSON.stringify({ user: authenticatedUser, apiKey: effectiveKey })
    );

    setIsLoading(false);
    return true;
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem('reignova_admin_session');
  }, []);

  const switchRole = useCallback((newRole: AdminRole) => {
    setRole(newRole);
    setUser((prev) => (prev ? { ...prev, role: newRole } : null));
    try {
      const stored = localStorage.getItem('reignova_admin_session');
      if (stored) {
        const parsed = JSON.parse(stored);
        parsed.user.role = newRole;
        localStorage.setItem('reignova_admin_session', JSON.stringify(parsed));
      }
    } catch {
      // ignore storage error
    }
  }, []);

  const hasPermission = useCallback(
    (permission: string) => {
      const permissions = ROLE_PERMISSIONS[role] || [];
      return permissions.includes(permission);
    },
    [role]
  );

  return (
    <AdminAuthContext.Provider
      value={{
        user,
        role,
        apiKey,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        switchRole,
        hasPermission,
      }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider');
  }
  return context;
}
