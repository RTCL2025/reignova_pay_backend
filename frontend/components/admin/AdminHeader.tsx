'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Menu,
  Search,
  Bell,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ChevronRight,
} from 'lucide-react';
import { CommandSearchDialog } from './CommandSearchDialog';
import { cn } from '@/lib/utils';

interface AdminHeaderProps {
  onOpenMobileMenu: () => void;
}

export function AdminHeader({ onOpenMobileMenu }: AdminHeaderProps) {
  const pathname = usePathname();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isBackendHealthy, setIsBackendHealthy] = useState<boolean | null>(null);

  // Ping backend /health
  useEffect(() => {
    async function checkHealth() {
      try {
        const res = await fetch('http://localhost:5000/health', { method: 'GET' });
        setIsBackendHealthy(res.ok);
      } catch {
        setIsBackendHealthy(false);
      }
    }
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  // Compute breadcrumbs
  const segments = pathname
    .split('/')
    .filter(Boolean)
    .filter((s) => s !== 'admin');

  const breadcrumbs = [
    { label: 'Admin', href: '/admin' },
    ...segments.map((seg, idx) => {
      const href = '/admin/' + segments.slice(0, idx + 1).join('/');
      const label = seg
        .replace(/-/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
      return { label, href };
    }),
  ];

  return (
    <>
      <header className="h-16 px-5 border-b border-slate-200/80 bg-white/90 backdrop-blur-md sticky top-0 z-30 flex items-center justify-between gap-4">
        {/* Left: Mobile hamburger & Breadcrumbs */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onOpenMobileMenu}
            className="lg:hidden p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 focus:outline-hidden"
          >
            <Menu className="size-5" />
          </button>

          <nav className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
            {breadcrumbs.map((b, i) => {
              const isLast = i === breadcrumbs.length - 1;
              return (
                <React.Fragment key={b.href}>
                  {i > 0 && <ChevronRight className="size-3 text-slate-300 shrink-0" />}
                  {isLast ? (
                    <span className="text-slate-900 font-semibold">{b.label}</span>
                  ) : (
                    <Link
                      href={b.href}
                      className="hover:text-slate-900 transition-colors"
                    >
                      {b.label}
                    </Link>
                  )}
                </React.Fragment>
              );
            })}
          </nav>
        </div>

        {/* Right: Search Palette, Backend Health, Notifications */}
        <div className="flex items-center gap-3">
          {/* Global Search Button */}
          <button
            type="button"
            onClick={() => setIsSearchOpen(true)}
            className="hidden sm:flex items-center gap-2 h-9 px-3 rounded-lg border border-slate-200 bg-slate-50/70 hover:bg-slate-100 hover:border-slate-300 text-xs text-slate-500 transition-colors w-48 md:w-60 focus:outline-none focus:ring-1 focus:ring-slate-400"
          >
            <Search className="size-3.5 text-slate-400" />
            <span className="flex-1 text-left">Search...</span>
            <kbd className="font-mono text-[10px] bg-white px-1.5 py-0.5 rounded-sm border border-slate-200 text-slate-400">
              ⌘K
            </kbd>
          </button>

          {/* Backend API Health Status */}
          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono border bg-slate-50 border-slate-200 text-slate-600">
            <span
              className={cn(
                'size-2 rounded-full',
                isBackendHealthy === true
                  ? 'bg-emerald-500'
                  : isBackendHealthy === false
                  ? 'bg-rose-500'
                  : 'bg-amber-400'
              )}
            />
            <span>API {isBackendHealthy ? 'Online' : 'Degraded'}</span>
          </div>

          {/* Notifications Trigger & Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsNotificationsOpen((prev) => !prev)}
              className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 focus:outline-hidden relative transition-colors"
            >
              <Bell className="size-4.5" />
              <span className="absolute top-1.5 right-1.5 size-2 bg-amber-500 rounded-full ring-2 ring-white" />
            </button>

            {isNotificationsOpen && (
              <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl border border-slate-200 shadow-xl p-3 z-50 animate-in fade-in zoom-in-95 duration-100">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
                  <span className="text-xs font-bold text-slate-900 font-sans">
                    Operational Alerts
                  </span>
                  <span className="text-[10px] font-mono text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-sm border border-amber-200">
                    2 Pending
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="p-2 rounded-lg bg-amber-50/70 border border-amber-200/80 flex items-start gap-2.5">
                    <AlertCircle className="size-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-semibold text-amber-900">
                        Refund Request Awaiting Approval
                      </div>
                      <div className="text-[11px] text-amber-700 mt-0.5">
                        Safari Air & Travel (ref: SAF-RES-94819) for 260,000 TZS.
                      </div>
                    </div>
                  </div>

                  <div className="p-2 rounded-lg bg-slate-50 border border-slate-200 flex items-start gap-2.5">
                    <CheckCircle2 className="size-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-semibold text-slate-800">
                        Webhook Deliveries Healthy
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        99.98% delivery rate across 5 registered applications.
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-2 mt-2 border-t border-slate-100 text-center">
                  <Link
                    href="/admin/audit-logs"
                    onClick={() => setIsNotificationsOpen(false)}
                    className="text-[11px] text-slate-600 hover:text-slate-900 font-medium inline-flex items-center gap-1"
                  >
                    <span>View all audit events</span>
                    <ExternalLink className="size-3" />
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <CommandSearchDialog
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
      />
    </>
  );
}
