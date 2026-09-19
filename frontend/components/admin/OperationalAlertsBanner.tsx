'use client';

import React from 'react';
import Link from 'next/link';
import { AlertCircle, ArrowRight, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OperationalAlertsBannerProps {
  className?: string;
  pendingRefundsCount?: number;
  suspendedMerchantsCount?: number;
}

export function OperationalAlertsBanner({
  className,
  pendingRefundsCount = 0,
  suspendedMerchantsCount = 0,
}: OperationalAlertsBannerProps) {
  const hasAlerts = pendingRefundsCount > 0 || suspendedMerchantsCount > 0;

  if (!hasAlerts) {
    return (
      <div className={cn('bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-3 flex items-center justify-between shadow-2xs text-xs', className)}>
        <div className="flex items-center gap-2 text-emerald-800 font-medium">
          <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
          <span>All payment corridors, merchant accounts, and compliance queues are operational.</span>
        </div>
        <span className="text-[11px] font-mono text-emerald-700 font-semibold bg-emerald-100/80 px-2 py-0.5 rounded-sm">
          Live Backend Connected
        </span>
      </div>
    );
  }

  return (
    <div className={cn('grid grid-cols-1 md:grid-cols-2 gap-3', className)}>
      {/* Pending Refund Alert */}
      {pendingRefundsCount > 0 ? (
        <div className="bg-amber-50/90 border border-amber-200 rounded-xl p-3.5 flex items-start justify-between gap-3 shadow-2xs">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="size-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs">
              <div className="font-semibold text-amber-900">
                Refund Approval Required
              </div>
              <p className="text-amber-700 text-[11px] mt-0.5">
                {pendingRefundsCount} {pendingRefundsCount === 1 ? 'refund request is' : 'refund requests are'} awaiting compliance approval.
              </p>
            </div>
          </div>

          <Link
            href="/admin/refunds"
            className="shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold text-amber-900 hover:text-amber-950 underline underline-offset-2"
          >
            <span>Review</span>
            <ArrowRight className="size-3" />
          </Link>
        </div>
      ) : null}

      {/* Suspended Merchant Alert */}
      {suspendedMerchantsCount > 0 ? (
        <div className="bg-slate-100 border border-slate-200 rounded-xl p-3.5 flex items-start justify-between gap-3 shadow-2xs">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="size-4 text-slate-600 shrink-0 mt-0.5" />
            <div className="text-xs">
              <div className="font-semibold text-slate-800">
                Merchant Account Notice
              </div>
              <p className="text-slate-600 text-[11px] mt-0.5">
                {suspendedMerchantsCount} merchant {suspendedMerchantsCount === 1 ? 'account requires' : 'accounts require'} administrative review.
              </p>
            </div>
          </div>

          <Link
            href="/admin/merchants"
            className="shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold text-slate-800 hover:text-slate-950 underline underline-offset-2"
          >
            <span>Inspect</span>
            <ArrowRight className="size-3" />
          </Link>
        </div>
      ) : null}
    </div>
  );
}
