'use client';

import React from 'react';
import { ShieldCheck, Zap, Smartphone, Lock } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';

interface PaymentSummaryProps {
  amount: number;
  currency: string;
  reference: string;
  merchantName: string;
}

export function PaymentSummary({
  amount,
  currency,
  reference,
  merchantName,
}: PaymentSummaryProps) {
  return (
    <div className="reignova-card rounded-2xl p-6 border border-white/10 space-y-6">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-brand-slate-300">
        Order Summary
      </h3>

      {/* Breakdown List */}
      <div className="space-y-3 text-sm">
        <div className="flex justify-between items-center text-brand-slate-300">
          <span>Payment to</span>
          <span className="font-medium text-white">{merchantName}</span>
        </div>
        <div className="flex justify-between items-center text-brand-slate-300">
          <span>Reference</span>
          <span className="font-mono text-xs text-brand-accent">{reference}</span>
        </div>
        <div className="flex justify-between items-center text-brand-slate-300">
          <span>Processing Fee</span>
          <span className="text-emerald-400 font-medium">Free (0.00)</span>
        </div>

        <div className="pt-3 border-t border-white/10 flex justify-between items-baseline">
          <span className="font-semibold text-white">Total Amount</span>
          <span className="text-xl font-bold text-white font-mono">
            {formatCurrency(amount, currency)}
          </span>
        </div>
      </div>

      {/* Trust & Guarantee Badges */}
      <div className="pt-4 border-t border-white/5 space-y-3">
        <div className="flex items-center gap-2.5 text-xs text-brand-slate-300">
          <div className="p-1 rounded bg-brand-accent/10 text-brand-accent">
            <Lock className="w-3.5 h-3.5" />
          </div>
          <span>256-bit bank-grade encryption</span>
        </div>
        <div className="flex items-center gap-2.5 text-xs text-brand-slate-300">
          <div className="p-1 rounded bg-brand-accent/10 text-brand-accent">
            <Smartphone className="w-3.5 h-3.5" />
          </div>
          <span>Direct mobile USSD prompt to your handset</span>
        </div>
        <div className="flex items-center gap-2.5 text-xs text-brand-slate-300">
          <div className="p-1 rounded bg-brand-accent/10 text-brand-accent">
            <Zap className="w-3.5 h-3.5" />
          </div>
          <span>Real-time instant transaction confirmation</span>
        </div>
      </div>
    </div>
  );
}
