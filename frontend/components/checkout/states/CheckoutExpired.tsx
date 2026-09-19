'use client';

import React from 'react';
import { TimerOff, RefreshCw } from 'lucide-react';
import type { CheckoutSession } from '@/types/checkout';

interface CheckoutExpiredProps {
  session: CheckoutSession;
  onRestart?: () => void;
}

export function CheckoutExpired({ session, onRestart }: CheckoutExpiredProps) {
  const returnUrl = session.merchant.cancelUrl || session.merchant.returnUrl;

  return (
    <div className="flex flex-col items-center justify-center py-10 sm:py-14 text-center px-4 sm:px-8 gap-5 animate-fade-in">
      {/* Expired Badge */}
      <div className="w-16 h-16 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center shadow-xs">
        <TimerOff className="w-9 h-9" />
      </div>

      {/* Main Title & Subtitle */}
      <div>
        <h3 className="text-2xl font-bold text-slate-900 tracking-tight">
          Session Expired
        </h3>
        <p className="text-sm text-slate-500 max-w-sm mx-auto mt-1 leading-relaxed">
          Checkout session <span className="font-mono font-medium text-slate-700">{session.reference}</span> timed out after 15 minutes to secure spot FX rate.
        </p>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
        {onRestart ? (
          <button
            type="button"
            onClick={onRestart}
            className="px-6 py-2.5 rounded-xl bg-brand-gold hover:bg-brand-gold-hover text-brand-navy-900 font-bold text-sm shadow-md transition-all cursor-pointer"
          >
            Regenerate Fresh Session
          </button>
        ) : returnUrl ? (
          <a
            href={returnUrl}
            className="px-6 py-2.5 rounded-xl bg-brand-gold hover:bg-brand-gold-hover text-brand-navy-900 font-bold text-sm shadow-md inline-block"
          >
            Return to {session.merchant.name}
          </a>
        ) : (
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-6 py-2.5 rounded-xl bg-brand-gold hover:bg-brand-gold-hover text-brand-navy-900 font-bold text-sm shadow-md cursor-pointer"
          >
            Reload Session
          </button>
        )}
      </div>
    </div>
  );
}
