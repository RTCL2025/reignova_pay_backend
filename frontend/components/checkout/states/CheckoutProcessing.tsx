'use client';

import React, { useState, useEffect } from 'react';
import { Smartphone, RefreshCw, HelpCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { formatCurrency, formatPhoneNumber, PROVIDER_MAP } from '@/lib/formatters';
import type { CheckoutSession } from '@/types/checkout';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';

interface CheckoutProcessingProps {
  session: CheckoutSession;
  phone?: string;
  providerId?: string;
  onRefreshStatus?: () => void;
  onSimulateSuccess?: () => void;
  onSimulateFailed?: () => void;
}

export function CheckoutProcessing({
  session,
  phone,
  providerId,
  onRefreshStatus,
  onSimulateSuccess,
  onSimulateFailed,
}: CheckoutProcessingProps) {
  const [showTroubleshooting, setShowTroubleshooting] = useState(false);
  const [countdown, setCountdown] = useState(45);
  const targetPhone = phone || session.customer.phone || '';
  const meta = PROVIDER_MAP[providerId || 'VODACOM_TZA'] || {
    shortName: 'Vodacom M-Pesa',
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center py-10 sm:py-14 text-center px-4 sm:px-8 gap-5 animate-fade-in">
      {/* Animated Phone Icon with Circular Radar Spinner */}
      <div className="relative w-20 h-20 flex items-center justify-center">
        <svg className="animate-spin w-20 h-20 text-slate-200" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
          <path className="opacity-85 text-brand-gold" d="M4 12a8 8 0 018-8v8H4z" fill="currentColor" />
        </svg>
        <Smartphone className="w-8 h-8 text-brand-navy-900 absolute animate-pulse" />
      </div>

      {/* Main Title and Instruction */}
      <div className="flex flex-col gap-1.5 max-w-md">
        <h3 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
          USSD Push Dispatched
        </h3>
        <p className="text-sm text-slate-500 leading-relaxed">
          Check your handset screen{' '}
          <strong className="text-slate-900 font-mono font-bold">
            {formatPhoneNumber(targetPhone)}
          </strong>
          . A prompt from{' '}
          <span className="inline-flex items-center gap-1 font-bold text-slate-900 align-baseline">
            {meta.logoUrl && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={meta.logoUrl}
                alt={meta.shortName}
                className="w-4 h-4 object-contain inline-block rounded-xs shadow-2xs"
              />
            )}
            <span>{meta.shortName}</span>
          </span>{' '}
          is waiting for your PIN approval.
        </p>
      </div>

      {/* Awaiting Confirmation Box */}
      <div className="w-full max-w-xs bg-slate-50 p-4 rounded-xl flex items-center justify-between border border-slate-200 shadow-2xs">
        <span className="text-xs text-slate-500 font-medium">Awaiting confirmation</span>
        <span className="font-mono text-brand-gold font-bold text-sm">
          00:{countdown < 10 ? `0${countdown}` : countdown}
        </span>
      </div>

      {/* Refresh and Simulation Actions (in Sandbox / Dev) */}
      <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
        {onRefreshStatus && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onRefreshStatus}
            className="text-xs bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1 text-slate-400" />
            <span>Check Network Status</span>
          </Button>
        )}
        {onSimulateSuccess && (
          <button
            type="button"
            onClick={onSimulateSuccess}
            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-mono text-xs font-semibold shadow-xs"
          >
            Simulate Handset Approval
          </button>
        )}
        {onSimulateFailed && (
          <button
            type="button"
            onClick={onSimulateFailed}
            className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-mono text-xs font-semibold"
          >
            Simulate Timeout
          </button>
        )}
      </div>

      {/* Troubleshooting Dropdown */}
      <Collapsible
        open={showTroubleshooting}
        onOpenChange={setShowTroubleshooting}
        className="w-full max-w-md text-left pt-2 border-t border-slate-100"
      >
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex items-center justify-between w-full text-xs text-slate-500 hover:text-slate-800 py-1"
          >
            <span className="flex items-center gap-1.5 font-medium">
              <HelpCircle className="w-3.5 h-3.5 text-brand-gold" />
              Didn&apos;t receive the prompt on your phone?
            </span>
            {showTroubleshooting ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2 text-xs text-slate-600 bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 flex flex-col gap-2">
          <p>
            1. Ensure your phone has active mobile network reception and is unlocked.
          </p>
          <p>
            2. For M-Pesa, dial <code className="bg-slate-200 px-1 py-0.5 rounded font-mono">*150*00#</code> to check pending approvals.
          </p>
          <p>
            3. Make sure your SIM balance has sufficient funds to cover{' '}
            <strong className="text-slate-900">{formatCurrency(session.amount, session.currency)}</strong>.
          </p>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
