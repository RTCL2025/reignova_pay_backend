'use client';

import React from 'react';
import { Ban, ArrowLeft } from 'lucide-react';
import type { CheckoutSession } from '@/types/checkout';
import { Button } from '@/components/ui/button';

interface CheckoutCancelledProps {
  session: CheckoutSession;
  onRestart?: () => void;
}

export function CheckoutCancelled({ session, onRestart }: CheckoutCancelledProps) {
  const returnUrl = session.merchant.cancelUrl || session.merchant.returnUrl;

  return (
    <div className="flex flex-col items-center justify-center py-10 sm:py-14 text-center px-4 sm:px-8 gap-5 animate-fade-in">
      {/* Icon */}
      <div className="w-16 h-16 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center shadow-xs">
        <Ban className="w-9 h-9 stroke-[2]" />
      </div>

      {/* Header */}
      <div>
        <h3 className="text-2xl font-bold text-slate-900 tracking-tight">
          Checkout Cancelled
        </h3>
        <p className="text-sm text-slate-500 max-w-sm mx-auto mt-1 leading-relaxed">
          You have cancelled this checkout session. No funds were charged to your mobile wallet.
        </p>
      </div>

      {/* Return to Merchant Action */}
      <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
        {onRestart && (
          <button
            type="button"
            onClick={onRestart}
            className="px-6 py-2.5 rounded-xl bg-brand-gold hover:bg-brand-gold-hover text-brand-navy-900 font-bold text-sm shadow-md transition-all cursor-pointer"
          >
            Start Over
          </button>
        )}
        {returnUrl && (
          <a
            href={returnUrl}
            className="px-6 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm inline-flex items-center gap-1.5"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to {session.merchant.name}</span>
          </a>
        )}
      </div>
    </div>
  );
}
