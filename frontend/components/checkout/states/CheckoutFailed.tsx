'use client';

import React from 'react';
import { AlertTriangle, RefreshCw, HelpCircle } from 'lucide-react';
import type { CheckoutSession } from '@/types/checkout';
import { Button } from '@/components/ui/button';

interface CheckoutFailedProps {
  session: CheckoutSession;
  failureReason?: string | null;
  failureCode?: string | null;
  onRetry: () => void;
}

export function CheckoutFailed({
  session,
  failureReason,
  failureCode,
  onRetry,
}: CheckoutFailedProps) {
  const code = failureCode || 'ERR_INSUFFICIENT_BALANCE';
  const reason =
    failureReason ||
    'The carrier returned error. Please check your handset SIM balance and try again.';

  return (
    <div className="flex flex-col items-center justify-center py-10 sm:py-14 text-center px-4 sm:px-8 gap-5 animate-fade-in">
      {/* Error Badge */}
      <div className="w-16 h-16 rounded-full bg-red-100 text-red-600 flex items-center justify-center shadow-xs">
        <AlertTriangle className="w-9 h-9 stroke-[2.2]" />
      </div>

      {/* Main Title & Subtitle */}
      <div>
        <h3 className="text-2xl font-bold text-slate-900 tracking-tight">
          Payment Declined
        </h3>
        <p className="text-sm text-slate-500 max-w-sm mx-auto mt-1 leading-relaxed">
          The carrier returned error{' '}
          <span className="font-mono text-red-600 font-semibold">{code}</span>. No funds were debited.
        </p>
      </div>

      {/* Failure Reason Message */}
      <div className="w-full max-w-sm bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs text-slate-600">
        {reason}
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
        <button
          type="button"
          onClick={onRetry}
          className="px-5 py-2.5 rounded-xl bg-brand-gold hover:bg-brand-gold-hover text-brand-navy-900 font-bold text-sm shadow-md transition-all cursor-pointer"
        >
          Try Another Number
        </button>

        <Button
          type="button"
          variant="outline"
          onClick={() => {
            alert('Support contact: support@reignovatechnologies.com');
          }}
          className="px-4 py-2.5 rounded-xl bg-white text-slate-700 border-slate-200 hover:bg-slate-50 text-sm font-semibold"
        >
          <HelpCircle className="w-4 h-4 mr-1.5 text-slate-400" />
          <span>Contact Support</span>
        </Button>
      </div>
    </div>
  );
}
