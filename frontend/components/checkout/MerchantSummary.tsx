'use client';

import React from 'react';
import { Store, Tag, CheckCircle2 } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';
import type { CheckoutMerchant } from '@/types/checkout';

interface MerchantSummaryProps {
  merchant: CheckoutMerchant;
  amount: number;
  currency: string;
  reference: string;
}

export function MerchantSummary({
  merchant,
  amount,
  currency,
  reference,
}: MerchantSummaryProps) {
  const initials = merchant.name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="reignova-card rounded-2xl p-6 border border-white/10 relative overflow-hidden">
      {/* Subtle background glow */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-brand-accent/5 rounded-full blur-2xl pointer-events-none" />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Merchant Info */}
        <div className="flex items-center gap-3.5">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-brand-navy-800 to-brand-navy-700 border border-brand-accent/30 flex items-center justify-center text-brand-accent font-bold text-base shadow-inner">
            {merchant.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={merchant.logoUrl}
                alt={merchant.name}
                className="h-full w-full object-contain rounded-xl p-1"
              />
            ) : (
              <span>{initials || <Store className="w-5 h-5" />}</span>
            )}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="text-base font-semibold text-white tracking-tight">
                {merchant.name}
              </h2>
              <span title="Verified Merchant" className="inline-flex items-center">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </span>
            </div>
            <div className="flex items-center gap-1.5 mt-0.5 text-xs text-brand-slate-400 font-mono">
              <Tag className="w-3 h-3 text-brand-accent" />
              <span>Ref: {reference}</span>
            </div>
          </div>
        </div>

        {/* Amount to Pay */}
        <div className="sm:text-right pt-3 sm:pt-0 border-t sm:border-t-0 border-white/5">
          <span className="block text-xs uppercase tracking-wider text-brand-slate-400 font-medium">
            Total Due
          </span>
          <span className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight font-mono">
            {formatCurrency(amount, currency)}
          </span>
        </div>
      </div>
    </div>
  );
}
