'use client';

import React, { useEffect, useState } from 'react';
import { CheckCircle2, ArrowRight, Download, Printer, ShieldCheck } from 'lucide-react';
import confetti from 'canvas-confetti';
import { formatCurrency, formatPhoneNumber } from '@/lib/formatters';
import type { CheckoutSession } from '@/types/checkout';

interface CheckoutSuccessProps {
  session: CheckoutSession;
  phone?: string;
  providerName?: string;
}

export function CheckoutSuccess({
  session,
  phone,
  providerName = 'Mobile Money',
}: CheckoutSuccessProps) {
  const [countdown, setCountdown] = useState(5);
  const returnUrl = session.merchant.returnUrl;

  // Trigger celebration confetti
  useEffect(() => {
    try {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#F3A221', '#10B981', '#FFB74D', '#FFFFFF'],
      });
    } catch {
      // ignore if canvas is unavailable
    }
  }, []);

  // Automatic countdown redirect if returnUrl exists
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

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="w-full max-w-lg mx-auto reignova-card rounded-2xl p-7 sm:p-8 border border-white/10 text-center space-y-6 animate-slide-up">
      {/* Success Badge */}
      <div className="mx-auto w-20 h-20 rounded-full bg-emerald-500/10 border-2 border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-xl shadow-emerald-500/10">
        <CheckCircle2 className="w-10 h-10 stroke-[2.5]" />
      </div>

      {/* Title */}
      <div>
        <h2 className="text-2xl font-bold text-white tracking-tight">
          Payment Successful!
        </h2>
        <p className="text-sm text-brand-slate-300 mt-1">
          Your transaction has been confirmed and settled.
        </p>
      </div>

      {/* Receipt Details Card */}
      <div className="reignova-card-inner rounded-xl p-5 text-left border border-white/5 space-y-3.5 text-sm">
        <div className="flex justify-between items-center text-brand-slate-300">
          <span>Amount Paid</span>
          <span className="text-lg font-bold text-white font-mono">
            {formatCurrency(session.amount, session.currency)}
          </span>
        </div>

        <div className="border-t border-white/5 pt-3 space-y-2.5">
          <div className="flex justify-between items-center text-xs">
            <span className="text-brand-slate-400">Merchant</span>
            <span className="font-semibold text-white">{session.merchant.name}</span>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="text-brand-slate-400">Order Reference</span>
            <span className="font-mono text-brand-accent font-medium">{session.reference}</span>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="text-brand-slate-400">Payment Channel</span>
            <span className="text-brand-cream-100">{providerName}</span>
          </div>
          {(phone || session.customer.phone) && (
            <div className="flex justify-between items-center text-xs">
              <span className="text-brand-slate-400">Paid from</span>
              <span className="font-mono text-brand-cream-100">
                {formatPhoneNumber(phone || session.customer.phone || '')}
              </span>
            </div>
          )}
          <div className="flex justify-between items-center text-xs">
            <span className="text-brand-slate-400">Date</span>
            <span className="text-brand-cream-100 font-mono">
              {new Date().toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* Return to Merchant Action */}
      {returnUrl ? (
        <div className="space-y-3">
          <a
            href={returnUrl}
            className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-brand-accent to-brand-accent-hover text-brand-navy-950 font-bold text-sm tracking-wide transition-all shadow-lg hover:shadow-brand-accent/25 flex items-center justify-center gap-2"
          >
            <span>Return to {session.merchant.name}</span>
            <ArrowRight className="w-4 h-4" />
          </a>
          <p className="text-xs text-brand-slate-400 font-mono">
            Redirecting automatically in {countdown}s...
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <button
            type="button"
            onClick={handlePrint}
            className="w-full py-3 px-6 rounded-xl bg-brand-navy-800 hover:bg-brand-navy-700 text-white font-semibold text-sm transition-colors border border-white/10 flex items-center justify-center gap-2"
          >
            <Printer className="w-4 h-4" />
            <span>Print Receipt</span>
          </button>
          <p className="text-xs text-brand-slate-400">
            You can safely close this window now.
          </p>
        </div>
      )}

      {/* Footer verification badge */}
      <div className="pt-2 flex items-center justify-center gap-1.5 text-[11px] text-brand-slate-500">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
        <span>Verified by Reignova Payment Engine</span>
      </div>
    </div>
  );
}
