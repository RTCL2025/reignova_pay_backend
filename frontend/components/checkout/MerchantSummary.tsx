'use client';

import React, { useState, useEffect } from 'react';
import { Ticket, CheckCircle2, Timer, Info, X, Building2 } from 'lucide-react';
import { formatCurrency, formatTimeRemaining } from '@/lib/formatters';
import type { CheckoutMerchant } from '@/types/checkout';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface MerchantSummaryProps {
  merchant: CheckoutMerchant;
  amount: number;
  currency: string;
  reference: string;
  expiresAt?: string;
  description?: string;
  metadata?: Record<string, any> | null;
  reason?: Record<string, any> | string | null;
  itemTitle?: string;
  itemSubtitle?: string;
  itemCategory?: string;
  itemImage?: string;
  onCancel?: () => void;
  isCancelling?: boolean;
}

export function MerchantSummary({
  merchant,
  amount,
  currency,
  reference,
  expiresAt,
  description,
  metadata,
  reason,
  itemTitle,
  itemSubtitle,
  itemCategory,
  itemImage,
  onCancel,
  isCancelling = false,
}: MerchantSummaryProps) {
  const [timeLeft, setTimeLeft] = useState(() => (expiresAt ? formatTimeRemaining(expiresAt) : null));
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    if (!expiresAt) return;
    const interval = setInterval(() => {
      setTimeLeft(formatTimeRemaining(expiresAt));
    }, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  // Extract title: explicit prop > metadata > reason > description > reference
  const derivedTitle =
    itemTitle ||
    metadata?.itemTitle ||
    metadata?.title ||
    (typeof reason === 'object' && reason?.title ? String(reason.title) : null) ||
    description ||
    reference;

  // Extract subtitle: explicit prop > metadata > reason
  const derivedSubtitle =
    itemSubtitle ||
    metadata?.itemSubtitle ||
    metadata?.subtitle ||
    (typeof reason === 'object' && reason?.subtitle ? String(reason.subtitle) : null) ||
    (typeof reason === 'object' && reason?.description ? String(reason.description) : null) ||
    null;

  // Extract category: explicit prop > metadata > reason
  const derivedCategory =
    itemCategory ||
    metadata?.itemCategory ||
    metadata?.category ||
    (typeof reason === 'object' && reason?.category ? String(reason.category) : null) ||
    metadata?.type ||
    'Checkout Order';

  // Extract image URL: explicit prop > metadata > merchant logo
  const derivedImage =
    itemImage ||
    metadata?.itemImage ||
    metadata?.imageUrl ||
    metadata?.image ||
    merchant?.logoUrl ||
    null;

  // Extract line items / breakdown if available
  const subtotal: number | null =
    typeof metadata?.subtotal === 'number'
      ? metadata.subtotal
      : typeof metadata?.baseAmount === 'number'
      ? metadata.baseAmount
      : typeof metadata?.itemAmount === 'number'
      ? metadata.itemAmount
      : null;

  const feeAmount: number | null =
    typeof metadata?.fee === 'number'
      ? metadata.fee
      : typeof metadata?.feeAmount === 'number'
      ? metadata.feeAmount
      : typeof metadata?.serviceFee === 'number'
      ? metadata.serviceFee
      : subtotal !== null && amount >= subtotal
      ? amount - subtotal
      : null;

  const quantity = metadata?.quantity || metadata?.itemQuantity || 1;
  const itemName = metadata?.itemName || metadata?.itemLabel || 'Item Access';

  const merchantName = merchant?.name || 'Merchant';

  return (
    <div className="bg-gradient-to-b from-slate-50/90 to-white p-5 sm:p-6 lg:p-7 border-b border-slate-200/80 flex flex-col gap-4">
      {/* 1. Merchant Status & Session Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Merchant Info */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shadow-xs shrink-0">
            {merchant.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={merchant.logoUrl}
                alt={merchantName}
                className="w-full h-full object-contain rounded-xl p-1"
              />
            ) : (
              <Building2 className="w-5 h-5 text-blue-600" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-base text-slate-900 tracking-tight">
                {merchantName}
              </span>
              <CheckCircle2 className="w-4 h-4 text-emerald-500 fill-emerald-100" />
            </div>
            <p className="text-xs text-slate-500 font-medium">
              Verified Enterprise Merchant
            </p>
          </div>
        </div>

        {/* Status Badges, Expiry Timer & Cancel */}
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-200/60 text-blue-700 text-xs font-semibold font-mono">
            Official Checkout
          </span>
          {timeLeft && (
            <div className="flex items-center gap-1.5 px-3 py-0.5 bg-white rounded-full border border-slate-200 text-slate-600 text-xs font-mono shadow-xs">
              <Timer className="w-3.5 h-3.5 text-brand-gold animate-pulse" />
              <span>
                Expires in <strong className="text-slate-900 font-bold">{timeLeft.formatted}</strong>
              </span>
            </div>
          )}
          {onCancel && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button
                  type="button"
                  disabled={isCancelling}
                  title="Cancel checkout session"
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors ml-0.5 cursor-pointer disabled:opacity-50"
                >
                  <X className="w-4 h-4" />
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent className="bg-white border-slate-200 text-slate-900">
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-slate-900">Cancel Checkout?</AlertDialogTitle>
                  <AlertDialogDescription className="text-slate-500">
                    Are you sure you want to cancel this checkout session? This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="bg-slate-100 text-slate-700 hover:bg-slate-200">
                    Continue Checkout
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={onCancel}
                    className="bg-red-600 hover:bg-red-700 text-white"
                  >
                    Yes, Cancel Payment
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      {/* 2. Event / Order Details Row + Total Due Hero */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center bg-white rounded-xl p-4 border border-slate-200/80 shadow-xs">
        {/* Left Hero Item Info */}
        <div className="md:col-span-7 flex gap-3.5 items-center">
          {derivedImage && !imgError ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              className="w-16 h-16 rounded-lg object-cover shadow-xs border border-slate-100 shrink-0"
              alt={derivedTitle}
              src={derivedImage}
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="w-16 h-16 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0 shadow-2xs">
              <Ticket className="w-8 h-8" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-brand-navy-900 block">
              {derivedCategory}
            </span>
            <h3 className="text-base font-bold text-slate-900 truncate" title={derivedTitle}>
              {derivedTitle}
            </h3>
            {derivedSubtitle && (
              <p className="text-xs text-slate-500 truncate" title={derivedSubtitle}>
                {derivedSubtitle}
              </p>
            )}
          </div>
        </div>

        {/* Right Total Due Hero */}
        <div className="md:col-span-5 flex flex-col md:items-end justify-center pt-3 md:pt-0 border-t md:border-t-0 md:border-l border-slate-100 md:pl-5">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Total Amount Due
          </span>
          <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {formatCurrency(amount, currency)}
          </span>
          <span className="text-[11px] text-slate-400 mt-0.5 font-medium">
            Taxes &amp; network fees included
          </span>
        </div>
      </div>

      {/* 3. Breakdown / Reference Strip */}
      <div className="bg-slate-50 rounded-lg p-2.5 sm:px-3.5 flex flex-wrap items-center justify-between gap-y-1.5 text-slate-600 text-xs border border-slate-200/70">
        <div className="flex items-center gap-2 flex-wrap">
          {subtotal !== null ? (
            <>
              <span>
                {quantity}x {itemName}{' '}
                <strong className="text-slate-900 font-semibold ml-1">
                  {formatCurrency(subtotal, currency)}
                </strong>
              </span>
              {feeAmount !== null && feeAmount > 0 && (
                <>
                  <span className="text-slate-300">•</span>
                  <span className="flex items-center gap-1">
                    Platform &amp; Network Fee
                    <span title="Regulated Telecom Clearing Fee" className="inline-flex cursor-help">
                      <Info className="w-3 h-3 text-slate-400" />
                    </span>
                    <strong className="text-slate-900 font-semibold ml-1">
                      {formatCurrency(feeAmount, currency)}
                    </strong>
                  </span>
                </>
              )}
            </>
          ) : (
            <span>
              Order Amount{' '}
              <strong className="text-slate-900 font-semibold ml-1">
                {formatCurrency(amount, currency)}
              </strong>
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 font-mono text-[11px] text-slate-500">
          <span>Ref:</span>
          <span className="bg-slate-200/80 px-1.5 py-0.5 rounded text-slate-800 font-semibold">
            {reference}
          </span>
        </div>
      </div>
    </div>
  );
}

