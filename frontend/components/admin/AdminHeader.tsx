'use client';

import React, { useState, useEffect, useCallback } from 'react';
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
import { adminApiClient } from '@/lib/admin-api';

interface AdminHeaderProps {
  onOpenMobileMenu: () => void;
}

interface HeaderNotificationItem {
  id: string;
  type: 'amber' | 'emerald' | 'rose' | 'slate';
  title: string;
  description: string;
  href: string;
  timestamp?: string;
}

export function AdminHeader({ onOpenMobileMenu }: AdminHeaderProps) {
  const pathname = usePathname();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isBackendHealthy, setIsBackendHealthy] = useState<boolean | null>(null);
  const [merchantNames, setMerchantNames] = useState<Record<string, string>>({});
  const [notifications, setNotifications] = useState<HeaderNotificationItem[]>([]);
  const [pendingCount, setPendingCount] = useState<number>(0);

  // Load live notification alerts from backend
  const loadNotifications = useCallback(async () => {
    try {
      const [refundsRes, auditRes, metricsRes] = await Promise.all([
        adminApiClient.refunds.list(1, 10),
        adminApiClient.auditLogs.list({ limit: 5 }),
        adminApiClient.stats.getOverviewMetrics(),
      ]);

      const items: HeaderNotificationItem[] = [];

      // 1. Pending/Requested Refunds requiring approval
      const pendingRefunds = (refundsRes.refunds || []).filter(
        (r) => r.status === 'REQUESTED' || r.status === 'UNDER_REVIEW'
      );

      pendingRefunds.forEach((r) => {
        const appName = r.applicationName || 'Application';
        const refStr = r.originalPaymentRef || (r.paymentId ? r.paymentId.substring(0, 8) : r.id.substring(0, 8));
        const amountStr = r.amount ? `${r.amount.toLocaleString()} ${r.currency || 'TZS'}` : '';
        items.push({
          id: `refund-${r.id}`,
          type: 'amber',
          title: 'Refund Request Awaiting Approval',
          description: `${appName} (ref: ${refStr})${amountStr ? ` for ${amountStr}` : ''}.`,
          href: '/admin/refunds',
          timestamp: r.createdAt,
        });
      });

      // 2. Suspended Merchants Alert
      if (metricsRes.suspendedMerchants > 0) {
        items.push({
          id: 'suspended-merchants-notice',
          type: 'rose',
          title: 'Merchant Compliance Notice',
          description: `${metricsRes.suspendedMerchants} merchant ${metricsRes.suspendedMerchants === 1 ? 'account is' : 'accounts are'} currently suspended.`,
          href: '/admin/merchants',
        });
      }

      // 3. Recent Live Audit Events
      (auditRes.logs || []).slice(0, 3).forEach((log) => {
        const actionFormatted = log.action
          .replace(/_/g, ' ')
          .toLowerCase()
          .replace(/\b\w/g, (c) => c.toUpperCase());
        const actorName = log.actor || 'System Admin';
        const resourceStr = log.resourceType
          ? `${log.resourceType.toLowerCase()} (${(log.resourceId || '').substring(0, 8)})`
          : 'resource';
        items.push({
          id: `audit-${log.id}`,
          type: 'slate',
          title: actionFormatted,
          description: `Action by ${actorName} on ${resourceStr}.`,
          href: '/admin/audit-logs',
          timestamp: log.createdAt,
        });
      });

      // 4. Default healthy state if no pending alerts or logs
      if (items.length === 0) {
        items.push({
          id: 'system-healthy',
          type: 'emerald',
          title: 'All Systems Operational',
          description: `Live monitoring across ${metricsRes.activeMerchants || 0} registered applications.`,
          href: '/admin',
        });
      }

      setNotifications(items);
      setPendingCount(pendingRefunds.length + (metricsRes.suspendedMerchants > 0 ? 1 : 0));
    } catch (err) {
      console.error('Failed to load notifications from live API:', err);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, [loadNotifications]);

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

  const merchantId = segments[0] === 'merchants' && segments[1] ? segments[1] : null;

  useEffect(() => {
    if (!merchantId || merchantNames[merchantId]) return;

    let isMounted = true;
    adminApiClient.merchants.get(merchantId).then((merchant) => {
      if (isMounted && merchant?.name) {
        setMerchantNames((prev) => ({ ...prev, [merchantId]: merchant.name }));
      }
    });

    return () => {
      isMounted = false;
    };
  }, [merchantId, merchantNames]);

  const breadcrumbs = [
    { label: 'Admin', href: '/admin' },
    ...segments.map((seg, idx) => {
      const href = '/admin/' + segments.slice(0, idx + 1).join('/');
      let label = seg
        .replace(/-/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());

      if (idx === 1 && segments[0] === 'merchants' && merchantNames[seg]) {
        label = merchantNames[seg];
      }

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
              onClick={() => {
                setIsNotificationsOpen((prev) => !prev);
                loadNotifications();
              }}
              className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 focus:outline-hidden relative transition-colors"
            >
              <Bell className="size-4.5" />
              {pendingCount > 0 && (
                <span className="absolute top-1.5 right-1.5 size-2 bg-amber-500 rounded-full ring-2 ring-white" />
              )}
            </button>

            {isNotificationsOpen && (
              <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl border border-slate-200 shadow-xl p-3 z-50 animate-in fade-in zoom-in-95 duration-100">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
                  <span className="text-xs font-bold text-slate-900 font-sans">
                    Operational Alerts
                  </span>
                  <span
                    className={cn(
                      'text-[10px] font-mono px-1.5 py-0.5 rounded-sm border',
                      pendingCount > 0
                        ? 'text-amber-700 bg-amber-50 border-amber-200'
                        : 'text-emerald-700 bg-emerald-50 border-emerald-200'
                    )}
                  >
                    {pendingCount > 0 ? `${pendingCount} Pending` : 'All Healthy'}
                  </span>
                </div>

                <div className="space-y-2 text-xs max-h-72 overflow-y-auto">
                  {notifications.map((item) => {
                    const isAmber = item.type === 'amber';
                    const isRose = item.type === 'rose';
                    const isEmerald = item.type === 'emerald';

                    return (
                      <Link
                        key={item.id}
                        href={item.href}
                        onClick={() => setIsNotificationsOpen(false)}
                        className={cn(
                          'p-2 rounded-lg border flex items-start gap-2.5 transition-colors block',
                          isAmber && 'bg-amber-50/70 border-amber-200/80 hover:bg-amber-100/70',
                          isRose && 'bg-rose-50/70 border-rose-200/80 hover:bg-rose-100/70',
                          isEmerald && 'bg-emerald-50/70 border-emerald-200/80 hover:bg-emerald-100/70',
                          !isAmber && !isRose && !isEmerald && 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                        )}
                      >
                        {isAmber ? (
                          <AlertCircle className="size-4 text-amber-600 shrink-0 mt-0.5" />
                        ) : isRose ? (
                          <AlertCircle className="size-4 text-rose-600 shrink-0 mt-0.5" />
                        ) : (
                          <CheckCircle2
                            className={cn(
                              'size-4 shrink-0 mt-0.5',
                              isEmerald ? 'text-emerald-600' : 'text-slate-600'
                            )}
                          />
                        )}
                        <div className="min-w-0 flex-1">
                          <div
                            className={cn(
                              'font-semibold truncate',
                              isAmber && 'text-amber-900',
                              isRose && 'text-rose-900',
                              isEmerald && 'text-emerald-900',
                              !isAmber && !isRose && !isEmerald && 'text-slate-800'
                            )}
                          >
                            {item.title}
                          </div>
                          <div
                            className={cn(
                              'text-[11px] mt-0.5 leading-tight',
                              isAmber && 'text-amber-700',
                              isRose && 'text-rose-700',
                              isEmerald && 'text-emerald-700',
                              !isAmber && !isRose && !isEmerald && 'text-slate-500'
                            )}
                          >
                            {item.description}
                          </div>
                        </div>
                      </Link>
                    );
                  })}
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
