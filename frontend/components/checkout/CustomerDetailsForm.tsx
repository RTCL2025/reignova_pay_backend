'use client';

import React, { useState, useEffect } from 'react';
import {
  Lock,
  Smartphone,
  CreditCard,
  Delete,
  Info,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { PaymentMethodSelector } from './PaymentMethodSelector';
import { detectProviderFromPhone, formatCurrency, PROVIDER_MAP } from '@/lib/formatters';
import { paymentFormSchema } from '@/lib/validation';
import type { CheckoutSession, InitiatePaymentPayload } from '@/types/checkout';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface CustomerDetailsFormProps {
  session: CheckoutSession;
  onSubmitPayment: (payload: InitiatePaymentPayload) => Promise<void>;
  isSubmitting: boolean;
  errorMessage?: string | null;
}

export function CustomerDetailsForm({
  session,
  onSubmitPayment,
  isSubmitting,
  errorMessage,
}: CustomerDetailsFormProps) {
  const defaultProvider = session.supportedProviders[0]?.id || 'VODACOM_TZA';
  const [provider, setProvider] = useState<string>(defaultProvider);
  const [rawPhone, setRawPhone] = useState<string>(() => {
    const p = session.customer.phone || '';
    return p.replace(/^\+?255/, '').replace(/^0/, '');
  });
  const [name, setName] = useState<string>(session.customer.name || '');
  const [email, setEmail] = useState<string>(session.customer.email || '');
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Format phone display as 7XX XXX XXX
  const formatMsisdnDisplay = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 9);
    let formatted = '';
    for (let i = 0; i < digits.length; i++) {
      if (i === 3 || i === 6) formatted += ' ';
      formatted += digits[i];
    }
    return formatted;
  };

  const [formattedPhone, setFormattedPhone] = useState<string>(() =>
    formatMsisdnDisplay(rawPhone || '')
  );

  const handlePhoneInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputVal = e.target.value;
    const digits = inputVal.replace(/\D/g, '').slice(0, 9);
    setRawPhone(digits);
    setFormattedPhone(formatMsisdnDisplay(digits));

    // Auto-detect Tanzanian carrier prefix
    // Vodacom: 74, 75, 76, 77
    if (
      digits.startsWith('74') ||
      digits.startsWith('75') ||
      digits.startsWith('76') ||
      digits.startsWith('77')
    ) {
      setProvider('VODACOM_TZA');
    }
    // Airtel: 78, 68, 69
    else if (digits.startsWith('78') || digits.startsWith('68') || digits.startsWith('69')) {
      setProvider('AIRTEL_TZA');
    }
    // Tigo: 71, 65, 67
    else if (digits.startsWith('71') || digits.startsWith('65') || digits.startsWith('67')) {
      setProvider('TIGO_TZA');
    }
    // Halotel: 62, 61
    else if (digits.startsWith('62') || digits.startsWith('61')) {
      setProvider('HALOTEL_TZA');
    }

    if (validationErrors.customerPhone) {
      setValidationErrors((prev) => ({ ...prev, customerPhone: '' }));
    }
  };

  const handleClearPhone = () => {
    setRawPhone('');
    setFormattedPhone('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationErrors({});

    // Normalize phone to international +255XXXXXXXXX format
    const cleanDigits = rawPhone.replace(/\D/g, '');
    let fullPhone = cleanDigits;
    if (!fullPhone.startsWith('255')) {
      if (fullPhone.startsWith('0')) {
        fullPhone = `+255${fullPhone.slice(1)}`;
      } else {
        fullPhone = `+255${fullPhone}`;
      }
    } else {
      fullPhone = `+${fullPhone}`;
    }

    const result = paymentFormSchema.safeParse({
      provider,
      customerPhone: fullPhone,
      customerName: name,
      customerEmail: email,
    });

    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const fieldName = issue.path[0] as string;
        fieldErrors[fieldName] = issue.message;
      }
      setValidationErrors(fieldErrors);
      return;
    }

    await onSubmitPayment({
      provider: result.data.provider,
      customerPhone: result.data.customerPhone,
      customerName: result.data.customerName || undefined,
      customerEmail: result.data.customerEmail || undefined,
    });
  };

  const activeProviderInfo = PROVIDER_MAP[provider] || {
    name: 'Vodacom M-Pesa',
    shortName: 'M-Pesa',
  };

  return (
    <form onSubmit={handleSubmit} className="p-5 sm:p-6 lg:p-7 flex flex-col gap-6">
      {/* Error Banner */}
      {errorMessage && (
        <Alert variant="destructive" className="border-red-200 bg-red-50 text-red-800">
          <AlertCircle className="w-4 h-4 text-red-600" />
          <AlertDescription className="text-xs font-medium">
            {errorMessage}
          </AlertDescription>
        </Alert>
      )}

      {/* STEP 1: Payer Details Card */}
      <div className="bg-slate-50/80 rounded-xl p-4 sm:p-5 border border-slate-200/80 flex flex-col gap-3">
        {/* Step Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-brand-navy-900 text-white flex items-center justify-center text-xs font-bold shadow-2xs">
              1
            </span>
            <span className="font-bold text-base text-slate-900">
              Payer Details
            </span>
          </div>
          <span className="text-xs font-medium text-emerald-600 flex items-center gap-1">
            <Lock className="w-3.5 h-3.5" />
            <span>Verified Customer</span>
          </span>
        </div>

        {/* 2-Column Fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Full Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. John Doe"
              className="h-11 px-3.5 bg-white border border-slate-200 rounded-lg text-slate-900 font-medium text-sm focus:outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20 transition-all shadow-2xs"
            />
            {validationErrors.customerName && (
              <span className="text-xs text-red-500">{validationErrors.customerName}</span>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Email Receipt Target
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. john.doe@example.com"
              className="h-11 px-3.5 bg-white border border-slate-200 rounded-lg text-slate-900 font-medium text-sm focus:outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20 transition-all shadow-2xs"
            />
            {validationErrors.customerEmail && (
              <span className="text-xs text-red-500">{validationErrors.customerEmail}</span>
            )}
          </div>
        </div>
      </div>

      {/* STEP 2: Select Payment Method */}
      <div className="bg-slate-50/80 rounded-xl p-4 sm:p-5 border border-slate-200/80 flex flex-col gap-4">
        {/* Step Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-brand-navy-900 text-white flex items-center justify-center text-xs font-bold shadow-2xs">
              2
            </span>
            <span className="font-bold text-base text-slate-900">
              Select Payment Method
            </span>
          </div>
          <span className="text-xs text-slate-400 font-medium">
            Instant push notification
          </span>
        </div>

        {/* Channel Navigation: Segmented Tabs */}
        <div className="grid grid-cols-2 gap-1 p-1 bg-slate-200/60 rounded-xl">
          <button
            type="button"
            className="flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-white shadow-xs text-brand-navy-900 font-bold text-xs sm:text-sm transition-all"
          >
            <Smartphone className="w-4 h-4 text-brand-navy-900" />
            <span>Mobile Money</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          </button>
          <button
            type="button"
            disabled
            className="flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-slate-400 opacity-60 font-medium text-xs sm:text-sm cursor-not-allowed"
          >
            <CreditCard className="w-4 h-4" />
            <span>Card &amp; Wire</span>
            <span className="text-[10px] bg-slate-300/80 text-slate-600 px-1.5 py-0.2 rounded font-mono font-semibold">
              Soon
            </span>
          </button>
        </div>

        {/* 4-Operator Grid */}
        <PaymentMethodSelector
          selectedProvider={provider}
          onSelectProvider={(id) => setProvider(id)}
          disabled={isSubmitting}
        />

        {/* MSISDN Phone Input */}
        <div className="flex flex-col gap-1.5 pt-1">
          <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
            Mobile Money Handset Number
          </label>
          <div className="h-13 w-full bg-white border border-slate-200 rounded-xl flex items-center px-4 shadow-xs focus-within:border-brand-gold focus-within:ring-2 focus-within:ring-brand-gold/20 transition-all">
            {/* Country Flag & Dial Code */}
            <div className="flex items-center gap-1.5 pr-3 border-r border-slate-200 shrink-0">
              <span className="text-xl">🇹🇿</span>
              <span className="font-bold text-slate-900 text-sm font-mono">+255</span>
            </div>

            {/* Formatted Handset Input */}
            <input
              type="tel"
              value={formattedPhone}
              onChange={handlePhoneInput}
              disabled={isSubmitting}
              placeholder="7XX XXX XXX"
              maxLength={11}
              className="w-full pl-3 bg-transparent outline-none font-bold text-lg text-slate-900 placeholder:text-slate-300 font-mono tracking-wider"
            />

            {/* Clear Button */}
            {formattedPhone && (
              <button
                type="button"
                onClick={handleClearPhone}
                className="text-slate-400 hover:text-slate-700 p-1 transition-colors"
                title="Clear input"
              >
                <Delete className="w-4 h-4" />
              </button>
            )}
          </div>
          {validationErrors.customerPhone && (
            <span className="text-xs text-red-500">{validationErrors.customerPhone}</span>
          )}

          {/* Sandbox Test Number Helper Chips */}
          <div className="flex flex-col gap-1.5 mt-1 bg-amber-50/70 border border-amber-200/80 rounded-xl p-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-amber-900 uppercase tracking-wider flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                PawaPay Sandbox Test Numbers (Auto-Approve):
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              <button
                type="button"
                onClick={() => {
                  setRawPhone('763456789');
                  setFormattedPhone('763 456 789');
                  setProvider('VODACOM_TZA');
                }}
                className="px-2.5 py-1 text-xs font-mono font-bold bg-white text-slate-800 border border-amber-300 rounded-lg hover:bg-amber-100 hover:border-amber-400 active:scale-95 transition-all shadow-2xs cursor-pointer flex items-center gap-1.5"
              >
                <span className="w-2 h-2 rounded-full bg-red-600" />
                Vodacom: 763 456 789
              </button>

              <button
                type="button"
                onClick={() => {
                  setRawPhone('683456789');
                  setFormattedPhone('683 456 789');
                  setProvider('AIRTEL_TZA');
                }}
                className="px-2.5 py-1 text-xs font-mono font-bold bg-white text-slate-800 border border-amber-300 rounded-lg hover:bg-amber-100 hover:border-amber-400 active:scale-95 transition-all shadow-2xs cursor-pointer flex items-center gap-1.5"
              >
                <span className="w-2 h-2 rounded-full bg-red-500" />
                Airtel: 683 456 789
              </button>

              <button
                type="button"
                onClick={() => {
                  setRawPhone('713456789');
                  setFormattedPhone('713 456 789');
                  setProvider('TIGO_TZA');
                }}
                className="px-2.5 py-1 text-xs font-mono font-bold bg-white text-slate-800 border border-amber-300 rounded-lg hover:bg-amber-100 hover:border-amber-400 active:scale-95 transition-all shadow-2xs cursor-pointer flex items-center gap-1.5"
              >
                <span className="w-2 h-2 rounded-full bg-blue-600" />
                Tigo/Yas: 713 456 789
              </button>

              <button
                type="button"
                onClick={() => {
                  setRawPhone('623456789');
                  setFormattedPhone('623 456 789');
                  setProvider('HALOTEL_TZA');
                }}
                className="px-2.5 py-1 text-xs font-mono font-bold bg-white text-slate-800 border border-amber-300 rounded-lg hover:bg-amber-100 hover:border-amber-400 active:scale-95 transition-all shadow-2xs cursor-pointer flex items-center gap-1.5"
              >
                <span className="w-2 h-2 rounded-full bg-orange-500" />
                Halotel: 623 456 789
              </button>
            </div>
          </div>

          {/* Micro-copy Info Callout with Official Provider Logo */}
          <div className="flex items-start gap-2.5 p-3 bg-blue-50/60 border border-blue-100 rounded-xl text-slate-600 text-xs leading-relaxed mt-1">
            {activeProviderInfo.logoUrl ? (
              <div className="w-5 h-5 rounded-md bg-white border border-slate-200 p-0.5 shrink-0 mt-0.5 overflow-hidden shadow-2xs">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={activeProviderInfo.logoUrl}
                  alt={activeProviderInfo.name}
                  className="w-full h-full object-contain"
                />
              </div>
            ) : (
              <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            )}
            <p>
              You will receive an automated{' '}
              <strong className="text-slate-900 font-bold">
                {activeProviderInfo.name || 'Mobile Money'}
              </strong>{' '}
              USSD prompt on your mobile phone to authenticate the transaction with your 4-digit secret PIN.
            </p>
          </div>
        </div>
      </div>

      {/* Primary CTA Button & Security Guarantees */}
      <div className="flex flex-col gap-2.5 pt-1">
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full h-14 rounded-xl bg-brand-gold hover:bg-brand-gold-hover active:scale-[0.99] text-brand-navy-900 font-bold text-base tracking-tight flex items-center justify-center gap-2.5 shadow-lg shadow-brand-gold/25 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin text-brand-navy-900" />
              <span>Dispatching USSD Prompt...</span>
            </>
          ) : (
            <>
              <Lock className="w-4 h-4 text-brand-navy-900" />
              <span>Pay {formatCurrency(session.amount, session.currency)}</span>
              <ArrowRight className="w-4 h-4 text-brand-navy-900" />
            </>
          )}
        </button>
      </div>
    </form>
  );
}
