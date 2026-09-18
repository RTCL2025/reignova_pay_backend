'use client';

import React, { useState } from 'react';
import { Smartphone, Loader2, HelpCircle, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';
import { formatCurrency, formatPhoneNumber, PROVIDER_MAP } from '@/lib/formatters';
import type { CheckoutSession } from '@/types/checkout';

interface CheckoutProcessingProps {
  session: CheckoutSession;
  phone?: string;
  providerId?: string;
  onRefreshStatus?: () => void;
}

export function CheckoutProcessing({
  session,
  phone,
  providerId,
  onRefreshStatus,
}: CheckoutProcessingProps) {
  const [showTroubleshooting, setShowTroubleshooting] = useState(false);
  const targetPhone = phone || session.customer.phone || '';
  const meta = PROVIDER_MAP[providerId || 'VODACOM_TZA'] || {
    shortName: 'Mobile Money',
    promptInstructions: 'Enter your PIN on your phone to authorize payment.',
  };

  return (
    <div className="w-full max-w-lg mx-auto reignova-card rounded-2xl p-7 sm:p-8 border border-white/10 text-center space-y-6 animate-fade-in relative overflow-hidden">
      {/* Animated Radar Glow */}
      <div className="relative mx-auto w-24 h-24 flex items-center justify-center">
        <div className="absolute inset-0 rounded-full bg-brand-accent/20 animate-ping" />
        <div className="absolute inset-2 rounded-full bg-brand-accent/30 animate-pulse" />
        <div className="relative w-16 h-16 rounded-full bg-brand-navy-900 border-2 border-brand-accent flex items-center justify-center text-brand-accent shadow-xl glow-accent">
          <Smartphone className="w-8 h-8 animate-bounce" />
        </div>
      </div>

      {/* Main Status Text */}
      <div>
        <h2 className="text-xl font-bold text-white tracking-tight">
          Check Your Mobile Phone
        </h2>
        <p className="text-sm text-brand-slate-300 mt-2 leading-relaxed">
          We sent an instant payment request to{' '}
          <span className="font-mono font-semibold text-white">
            {formatPhoneNumber(targetPhone)}
          </span>
        </p>
      </div>

      {/* Instruction Box */}
      <div className="reignova-card-inner rounded-xl p-4 text-left border border-white/5 space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-brand-accent uppercase tracking-wider">
          <span>Action Required</span>
        </div>
        <ol className="text-xs text-brand-slate-300 space-y-2 list-decimal list-inside leading-relaxed">
          <li>A prompt has appeared on your phone handset screen.</li>
          <li>Confirm the payment of <strong className="text-white font-mono">{formatCurrency(session.amount, session.currency)}</strong> to <strong className="text-white">{session.merchant.name}</strong>.</li>
          <li>Enter your secret <strong className="text-white">{meta.shortName} PIN</strong> to complete payment.</li>
        </ol>
      </div>

      {/* Live Polling Spinner */}
      <div className="flex items-center justify-center gap-2 text-xs text-brand-slate-400 py-1">
        <Loader2 className="w-4 h-4 animate-spin text-brand-accent" />
        <span>Waiting for payment confirmation from network...</span>
      </div>

      {/* Troubleshooting Dropdown */}
      <div className="border-t border-white/5 pt-4 text-left">
        <button
          type="button"
          onClick={() => setShowTroubleshooting(!showTroubleshooting)}
          className="flex items-center justify-between w-full text-xs text-brand-slate-400 hover:text-white transition-colors"
        >
          <span className="flex items-center gap-1.5 font-medium">
            <HelpCircle className="w-3.5 h-3.5 text-brand-accent" />
            Didn't receive the prompt on your phone?
          </span>
          {showTroubleshooting ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </button>

        {showTroubleshooting && (
          <div className="mt-3 p-3 rounded-lg bg-brand-navy-950/60 border border-white/5 text-[11px] text-brand-slate-400 space-y-2 leading-relaxed animate-fade-in">
            <p>1. Check if your phone screen is unlocked and has cellular network bars.</p>
            <p>2. If your phone is in Do Not Disturb or Airplane mode, turn it off.</p>
            <p>3. Ensure your mobile wallet has sufficient balance for this transaction.</p>
            {onRefreshStatus && (
              <button
                type="button"
                onClick={onRefreshStatus}
                className="mt-2 text-xs text-brand-accent hover:underline font-semibold block"
              >
                Click here to refresh status
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
