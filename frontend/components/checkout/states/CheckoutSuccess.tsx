'use client';

import React, { useEffect, useState } from 'react';
import { CheckCircle2, ArrowRight, Printer, ShieldCheck } from 'lucide-react';
import confetti from 'canvas-confetti';
import { formatCurrency, formatPhoneNumber } from '@/lib/formatters';
import { API_BASE_URL } from '@/lib/api-client';
import type { CheckoutSession } from '@/types/checkout';
import { Button } from '@/components/ui/button';

interface CheckoutSuccessProps {
  session: CheckoutSession;
  phone?: string;
  providerName?: string;
  providerLogoUrl?: string;
  carrierTransId?: string;
  onResetState?: () => void;
}

export function CheckoutSuccess({
  session,
  phone,
  providerName = 'Mobile Money',
  providerLogoUrl,
  carrierTransId,
  onResetState,
}: CheckoutSuccessProps) {
  const [countdown, setCountdown] = useState(5);
  const returnUrl = session.merchant.returnUrl;
  const customerEmail = session.customer.email || 'your email';
  const effectiveTransId = session.depositId || carrierTransId || session.reference;

  useEffect(() => {
    try {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#F3A221', '#00A859', '#0F1A25', '#FFB74D'],
      });
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!returnUrl) return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          window.location.href = returnUrl;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [returnUrl]);

  return (
    <div className="flex flex-col items-center justify-center py-10 sm:py-14 text-center px-4 sm:px-8 gap-5 animate-fade-in">
      {/* Green Checkmark Circle */}
      <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-xs">
        <CheckCircle2 className="w-10 h-10 stroke-[2.5]" />
      </div>

      {/* Main Title */}
      <div>
        <h3 className="text-2xl font-bold text-slate-900 tracking-tight">
          Payment Confirmed!
        </h3>
        <p className="text-sm text-slate-500 max-w-sm mx-auto mt-1 leading-relaxed">
          Receipt sent to <span className="text-slate-900 font-semibold">{customerEmail}</span>.
        </p>
      </div>

      {/* Structured Receipt Box */}
      <div className="w-full max-w-sm bg-slate-50 p-4 rounded-xl flex flex-col gap-2.5 text-left border border-slate-200 shadow-2xs">
        <div className="flex justify-between items-center text-xs text-slate-600">
          <span className="text-slate-500">Payment Channel:</span>
          <span className="inline-flex items-center gap-1 font-semibold text-slate-900">
            {providerLogoUrl && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={providerLogoUrl}
                alt={providerName}
                className="w-4 h-4 object-contain rounded-xs shadow-2xs"
              />
            )}
            <span>{providerName}</span>
          </span>
        </div>
        <div className="flex justify-between text-xs text-slate-600">
          <span className="text-slate-500 font-medium">Trans ID:</span>
          <span className="text-slate-900 font-mono font-bold">{effectiveTransId}</span>
        </div>
        <div className="flex justify-between text-xs text-slate-600">
          <span className="text-slate-500">Amount Paid:</span>
          <span className="text-slate-900 font-bold">
            {formatCurrency(session.amount, session.currency)}
          </span>
        </div>
        <div className="flex justify-between text-xs text-slate-600">
          <span className="text-slate-500">Settled To:</span>
          <span className="text-slate-900 font-semibold">{session.merchant.name}</span>
        </div>
        <div className="flex justify-between text-xs text-slate-600 pt-1 border-t border-slate-200">
          <span className="text-slate-500">Order Reference:</span>
          <span className="text-slate-900 font-mono">{session.reference}</span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
        {returnUrl ? (
          <Button
            type="button"
            onClick={() => (window.location.href = returnUrl)}
            className="px-6 py-2.5 rounded-xl bg-brand-gold hover:bg-brand-gold-hover text-brand-navy-900 font-bold text-sm shadow-md"
          >
            <span>Return to Merchant ({countdown}s)</span>
            <ArrowRight className="w-4 h-4 ml-1.5" />
          </Button>
        ) : onResetState ? (
          <button
            type="button"
            onClick={onResetState}
            className="px-6 py-2.5 rounded-xl bg-brand-gold hover:bg-brand-gold-hover text-brand-navy-900 font-bold text-sm shadow-md transition-all"
          >
            Return to Checkout Home
          </button>
        ) : null}

        <a
          href={`${API_BASE_URL}/checkouts/public/${session.publicToken}/receipt?download=true`}
          download={`Receipt-${session.reference}.pdf`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 transition-colors shadow-2xs"
        >
          <Printer className="w-3.5 h-3.5 text-slate-500" />
          <span>Download Receipt</span>
        </a>
      </div>
    </div>
  );
}
