'use client';

import React from 'react';
import { XCircle, RefreshCw, ArrowLeft, AlertCircle } from 'lucide-react';
import type { CheckoutSession } from '@/types/checkout';

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
  const returnUrl = session.merchant.cancelUrl || session.merchant.returnUrl;

  const getFriendlyMessage = () => {
    if (failureReason) return failureReason;
    if (failureCode === 'INSUFFICIENT_FUNDS') {
      return 'Your mobile money wallet has insufficient balance for this purchase.';
    }
    if (failureCode === 'INVALID_PIN' || failureCode === 'WRONG_PIN') {
      return 'Incorrect mobile money PIN entered.';
    }
    if (failureCode === 'USER_CANCELLED' || failureCode === 'CANCELLED') {
      return 'The payment prompt was cancelled on the phone handset.';
    }
    if (failureCode === 'TIMEOUT') {
      return 'The payment request timed out before the PIN was entered.';
    }
    return 'The mobile money provider was unable to complete your payment request.';
  };

  return (
    <div className="w-full max-w-lg mx-auto reignova-card rounded-2xl p-7 sm:p-8 border border-white/10 text-center space-y-6 animate-slide-up">
      {/* Error Icon */}
      <div className="mx-auto w-20 h-20 rounded-full bg-red-500/10 border-2 border-red-500/30 flex items-center justify-center text-red-400 shadow-xl shadow-red-500/10">
        <XCircle className="w-10 h-10 stroke-[2.2]" />
      </div>

      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-white tracking-tight">
          Payment Not Completed
        </h2>
        <p className="text-sm text-brand-slate-300 mt-2 leading-relaxed">
          {getFriendlyMessage()}
        </p>
      </div>

      {/* Code box */}
      {failureCode && (
        <div className="reignova-card-inner rounded-xl p-3 border border-white/5 text-xs font-mono text-brand-slate-400">
          Reason code: <span className="text-red-400 font-semibold">{failureCode}</span>
        </div>
      )}

      {/* Actions */}
      <div className="space-y-3 pt-2">
        <button
          type="button"
          onClick={onRetry}
          className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-brand-accent to-brand-accent-hover text-brand-navy-950 font-bold text-sm tracking-wide transition-all shadow-lg hover:shadow-brand-accent/25 flex items-center justify-center gap-2 cursor-pointer"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Try Again</span>
        </button>

        {returnUrl && (
          <a
            href={returnUrl}
            className="w-full py-3 px-6 rounded-xl bg-brand-navy-800 hover:bg-brand-navy-700 text-brand-cream-100 font-medium text-sm transition-colors border border-white/10 flex items-center justify-center gap-2 block"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to {session.merchant.name}</span>
          </a>
        )}
      </div>

      <p className="text-xs text-brand-slate-500">
        No funds were deducted from your wallet for this failed transaction.
      </p>
    </div>
  );
}
