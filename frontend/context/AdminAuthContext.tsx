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
  const [apiKey, setApiKey] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

  useEffect(() => {
    // Validate stored session with live backend /admin/auth/me
    const verifySession = async () => {
      try {
        const storedAuth = localStorage.getItem('reignova_admin_session');
        if (!storedAuth) {
          setUser(null);
          setApiKey('');
          setIsLoading(false);
          return;
        }

        const parsed = JSON.parse(storedAuth);
        const token = parsed.token || parsed.apiKey;

        if (!token) {
          setUser(null);
          setApiKey('');
          setIsLoading(false);
          return;
        }

        // Verify token with backend
        const res = await fetch(`${API_BASE_URL}/admin/auth/me`, {
          headers: {
            'Content-Type': 'application/json',
            'Admin-Api-Key': token,
            Authorization: `Bearer ${token}`,
          },
        });

        if (res.ok) {
          const json = await res.json();
          const serverUser = json.data;
          const liveUser: AdminUser = {
            id: serverUser?.id || parsed.user?.id,
            email: serverUser?.email || parsed.user?.email,
            name: serverUser?.name || parsed.user?.name,
            role: serverUser?.role || parsed.user?.role || 'SUPER_ADMIN',
            lastActive: new Date().toISOString(),
          };
          setUser(liveUser);
          setRole(liveUser.role);
          setApiKey(token);
        } else {
          // Token expired or invalid
          localStorage.removeItem('reignova_admin_session');
          setUser(null);
          setApiKey('');
        }
      } catch {
        // Backend unavailable or network failure
        const storedAuth = localStorage.getItem('reignova_admin_session');
        if (storedAuth) {
          try {
            const parsed = JSON.parse(storedAuth);
            setUser(parsed.user || null);
            setRole(parsed.user?.role || 'SUPER_ADMIN');
            setApiKey(parsed.token || parsed.apiKey || '');
          } catch {
            setUser(null);
            setApiKey('');
          }
        }
      } finally {
        setIsLoading(false);
      }
    };

    verifySession();
  }, [API_BASE_URL]);

  const login = useCallback(async (email: string, keyOrPass: string, chosenRole: AdminRole = 'SUPER_ADMIN') => {
    setIsLoading(true);
    const effectiveKey = keyOrPass.trim();
    const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

    try {
      const res = await fetch(`${API_BASE_URL}/admin/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: effectiveKey, role: chosenRole }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        const message = errJson.error?.message || errJson.message || 'Authentication failed. Please verify credentials.';
        throw new Error(message);
      }

      const json = await res.json();
      const serverUser = json.data?.user;
      const token = json.data?.token || effectiveKey;
      const authenticatedUser: AdminUser = {
        id: serverUser?.id || `usr_${Math.random().toString(36).substring(2, 9)}`,
        email: serverUser?.email || email,
        name: serverUser?.name || email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        role: serverUser?.role || chosenRole,
        lastActive: new Date().toISOString(),
      };

      setUser(authenticatedUser);
      setRole(authenticatedUser.role);
      setApiKey(token);

      localStorage.setItem(
        'reignova_admin_session',
        JSON.stringify({ user: authenticatedUser, apiKey: token, token })
      );

      setIsLoading(false);
      return true;
    } catch (err) {
      setIsLoading(false);
      throw err;
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setApiKey('');
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
