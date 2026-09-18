'use client';

import React from 'react';
import Link from 'next/link';
import { AlertCircle, ArrowRight, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export function OperationalAlertsBanner({ className }: { className?: string }) {
  return (
    <div className={cn('grid grid-cols-1 md:grid-cols-2 gap-3', className)}>
      {/* Pending Refund Alert */}
      <div className="bg-amber-50/90 border border-amber-200 rounded-xl p-3.5 flex items-start justify-between gap-3 shadow-2xs">
        <div className="flex items-start gap-2.5">
          <AlertCircle className="size-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs">
            <div className="font-semibold text-amber-900">
              Refund Approval Required
            </div>
            <p className="text-amber-700 text-[11px] mt-0.5">
              1 refund request is awaiting compliance approval (Safari Air & Travel, 260,000 TZS).
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

      {/* Suspended Merchant Alert */}
      <div className="bg-slate-100 border border-slate-200 rounded-xl p-3.5 flex items-start justify-between gap-3 shadow-2xs">
        <div className="flex items-start gap-2.5">
          <AlertTriangle className="size-4 text-slate-600 shrink-0 mt-0.5" />
          <div className="text-xs">
            <div className="font-semibold text-slate-800">
              Merchant Suspended
            </div>
            <p className="text-slate-600 text-[11px] mt-0.5">
              Kilimanjaro Roasters Co. suspended due to KYC renewal documentation.
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
    </div>
  );
}
