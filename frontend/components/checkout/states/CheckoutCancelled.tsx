'use client';

import React from 'react';
import { Ban, ArrowLeft } from 'lucide-react';
import type { CheckoutSession } from '@/types/checkout';

interface CheckoutCancelledProps {
  session: CheckoutSession;
}

export function CheckoutCancelled({ session }: CheckoutCancelledProps) {
  const returnUrl = session.merchant.cancelUrl || session.merchant.returnUrl;

  return (
    <div className="w-full max-w-lg mx-auto reignova-card rounded-2xl p-7 sm:p-8 border border-white/10 text-center space-y-6 animate-slide-up">
      {/* Icon */}
      <div className="mx-auto w-20 h-20 rounded-full bg-slate-500/10 border-2 border-slate-500/30 flex items-center justify-center text-slate-400 shadow-xl">
        <Ban className="w-10 h-10 stroke-[2]" />
      </div>

      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-white tracking-tight">
          Checkout Cancelled
        </h2>
        <p className="text-sm text-brand-slate-300 mt-2 leading-relaxed">
          You have cancelled this checkout session. No funds were charged to your mobile wallet.
        </p>
      </div>

      {/* Return to Merchant Action */}
      {returnUrl ? (
        <a
          href={returnUrl}
          className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-brand-accent to-brand-accent-hover text-brand-navy-950 font-bold text-sm tracking-wide transition-all shadow-lg hover:shadow-brand-accent/25 flex items-center justify-center gap-2 block"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Return to {session.merchant.name}</span>
        </a>
      ) : (
        <p className="text-xs text-brand-slate-400">
          You can close this window at any time.
        </p>
      )}
    </div>
  );
}
