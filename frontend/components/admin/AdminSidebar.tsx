'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Layers,
  Building2,
  CreditCard,
  RotateCcw,
  Send,
  FileCode2,
  Settings,
  LogOut,
  ChevronDown,
} from 'lucide-react';
import { ReignovaLogo } from '@/components/brand/ReignovaLogo';
import { useAdminAuth } from '@/context/AdminAuthContext';
import { AdminRole } from '@/types/admin';
import { cn } from '@/lib/utils';

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Overview', href: '/admin', icon: Layers, exact: true },
  { label: 'Merchants', href: '/admin/merchants', icon: Building2 },
  { label: 'Payments', href: '/admin/payments', icon: CreditCard },
  { label: 'Refunds', href: '/admin/refunds', icon: RotateCcw },
  { label: 'Payouts', href: '/admin/payouts', icon: Send },
  { label: 'Checkout Sessions', href: '/admin/checkout-sessions', icon: Layers },
  { label: 'Audit Logs', href: '/admin/audit-logs', icon: FileCode2 },
  { label: 'Settings', href: '/admin/settings', icon: Settings },
];

const ROLES: { label: string; value: AdminRole }[] = [
  { label: 'Super Admin', value: 'SUPER_ADMIN' },
  { label: 'Operations Admin', value: 'OPERATIONS_ADMIN' },
  { label: 'Finance Admin', value: 'FINANCE_ADMIN' },
  { label: 'Auditor', value: 'AUDITOR' },
  { label: 'Support Agent', value: 'SUPPORT_AGENT' },
];

interface AdminSidebarProps {
  onCloseMobile?: () => void;
  className?: string;
}

export function AdminSidebar({ onCloseMobile, className }: AdminSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, role, switchRole, logout } = useAdminAuth();

  const handleSignOut = () => {
    logout();
    router.push('/admin/login');
  };

  return (
    <aside
      className={cn(
        'w-64 h-screen bg-white border-r border-slate-200/90 flex flex-col justify-between shrink-0 select-none',
        className
      )}
    >
      {/* Top Header */}
      <div>
        <div className="h-16 px-5 border-b border-slate-200/80 flex items-center justify-between">
          <Link
            href="/admin"
            className="flex items-center gap-2.5 group focus:outline-hidden"
            onClick={onCloseMobile}
          >
            <ReignovaLogo
              size={32}
              title="Reignova"
              subtitle="Payment Service"
              textClassName="text-sm text-slate-900"
            />
          </Link>

          {/* Environment Indicator */}
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold font-mono tracking-tight bg-emerald-50 text-emerald-800 border border-emerald-200/70 shadow-2xs">
            <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>LIVE</span>
          </span>
        </div>

        {/* Navigation Items */}
        <nav className="p-3 space-y-1">
          <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Operations Menu
          </div>

          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onCloseMobile}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors duration-100',
                  isActive
                    ? 'bg-slate-100/90 text-slate-900 font-semibold shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                )}
              >
                <Icon
                  className={cn(
                    'size-4 shrink-0',
                    isActive ? 'text-slate-900' : 'text-slate-400'
                  )}
                />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* User Card & Role Switcher Footer */}
      <div className="p-3 border-t border-slate-200/80 bg-slate-50/50 space-y-3">
        {/* Role Switcher for Interactive RBAC Testing */}
        <div className="space-y-1">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 px-1">
            Active Role
          </label>
          <div className="relative">
            <select
              value={role}
              onChange={(e) => switchRole(e.target.value as AdminRole)}
              className="w-full appearance-none h-7 px-2.5 pr-6 text-xs font-medium bg-white border border-slate-200 rounded-md text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-slate-900 cursor-pointer shadow-2xs"
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 size-3 text-slate-400 pointer-events-none" />
          </div>
        </div>

        {/* User Card */}
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200/60">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="size-7 rounded-full bg-slate-200 border border-slate-300 flex items-center justify-center text-xs font-bold text-slate-700 shrink-0">
              {user?.name?.[0] || 'A'}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-semibold text-slate-900 truncate">
                {user?.name || 'Administrator'}
              </span>
              <span className="text-[11px] text-slate-500 truncate font-mono">
                {user?.email || 'admin@reignova.com'}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSignOut}
            title="Sign out"
            className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 focus:outline-hidden transition-colors shrink-0"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
