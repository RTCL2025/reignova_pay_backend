'use client';

import React from 'react';
import { Clock, ArrowLeft, ShieldAlert } from 'lucide-react';
import type { CheckoutSession } from '@/types/checkout';

interface CheckoutExpiredProps {
  session: CheckoutSession;
}

export function CheckoutExpired({ session }: CheckoutExpiredProps) {
  const returnUrl = session.merchant.cancelUrl || session.merchant.returnUrl;

  return (
    <div className="w-full max-w-lg mx-auto reignova-card rounded-2xl p-7 sm:p-8 border border-white/10 text-center space-y-6 animate-slide-up">
      {/* Expired Icon */}
      <div className="mx-auto w-20 h-20 rounded-full bg-amber-500/10 border-2 border-amber-500/30 flex items-center justify-center text-amber-400 shadow-xl shadow-amber-500/10">
        <Clock className="w-10 h-10 stroke-[2.2]" />
      </div>

      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-white tracking-tight">
          Checkout Session Expired
        </h2>
        <p className="text-sm text-brand-slate-300 mt-2 leading-relaxed">
          For your financial security, checkout sessions automatically expire after 15 minutes.
        </p>
      </div>

      {/* Notice Card */}
      <div className="reignova-card-inner rounded-xl p-4 text-left border border-white/5 space-y-2 text-xs text-brand-slate-400">
        <div className="flex items-center gap-1.5 text-brand-cream-100 font-medium">
          <ShieldAlert className="w-4 h-4 text-amber-400" />
          <span>Need to complete this payment?</span>
        </div>
        <p>
          Please return to {session.merchant.name} and restart checkout to generate a fresh, active payment link.
        </p>
      </div>

      {/* Return Action */}
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
          You can safely close this browser window.
        </p>
      )}
    </div>
  );
}
