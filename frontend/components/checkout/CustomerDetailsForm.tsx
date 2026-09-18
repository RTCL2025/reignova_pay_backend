'use client';

import React, { useState } from 'react';
import { Lock, Phone, User, Mail, Loader2, AlertCircle, Sparkles } from 'lucide-react';
import { PaymentMethodSelector } from './PaymentMethodSelector';
import { detectProviderFromPhone, formatCurrency, PROVIDER_MAP } from '@/lib/formatters';
import { paymentFormSchema } from '@/lib/validation';
import type { CheckoutSession, InitiatePaymentPayload } from '@/types/checkout';

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
  // Pre-fill fields if customer info is already attached to session
  const defaultProvider = session.supportedProviders[0]?.id || 'VODACOM_TZA';
  const [provider, setProvider] = useState<string>(defaultProvider);
  const [phone, setPhone] = useState<string>(session.customer.phone || '');
  const [name, setName] = useState<string>(session.customer.name || '');
  const [email, setEmail] = useState<string>(session.customer.email || '');

  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [detectedBadge, setDetectedBadge] = useState<string | null>(null);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setPhone(val);

    // Auto-detect provider
    const detected = detectProviderFromPhone(val);
    if (detected) {
      setProvider(detected);
      setDetectedBadge(PROVIDER_MAP[detected]?.shortName || null);
    } else {
      setDetectedBadge(null);
    }

    if (validationErrors.customerPhone) {
      setValidationErrors((prev) => ({ ...prev, customerPhone: '' }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationErrors({});

    const result = paymentFormSchema.safeParse({
      provider,
      customerPhone: phone,
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

  const selectedMeta = PROVIDER_MAP[provider];

  return (
    <form onSubmit={handleSubmit} className="reignova-card rounded-2xl p-6 sm:p-7 border border-white/10 space-y-6">
      {/* Top Heading */}
      <div className="border-b border-white/5 pb-4">
        <h2 className="text-base font-semibold text-white tracking-tight">
          Complete Mobile Money Payment
        </h2>
        <p className="text-xs text-brand-slate-400 mt-1">
          A payment prompt will be dispatched instantly to your mobile number.
        </p>
      </div>

      {/* Global / Server Error Notice */}
      {errorMessage && (
        <div
          role="alert"
          aria-live="assertive"
          className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm flex items-start gap-2.5"
        >
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div className="leading-snug">{errorMessage}</div>
        </div>
      )}

      {/* Mobile Money Provider Radio Group */}
      <PaymentMethodSelector
        providers={session.supportedProviders}
        selectedProvider={provider}
        onSelectProvider={(id) => {
          setProvider(id);
          if (validationErrors.provider) {
            setValidationErrors((prev) => ({ ...prev, provider: '' }));
          }
        }}
        disabled={isSubmitting}
      />
      {validationErrors.provider && (
        <p className="text-xs text-red-400 mt-1" role="alert">
          {validationErrors.provider}
        </p>
      )}

      {/* Phone Number Input */}
      <div className="space-y-1.5">
        <div className="flex justify-between items-center">
          <label htmlFor="customerPhone" className="block text-xs font-semibold uppercase tracking-wider text-brand-slate-300">
            Mobile Money Phone Number <span className="text-red-400">*</span>
          </label>
          {detectedBadge && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
              <Sparkles className="w-3 h-3" />
              <span>{detectedBadge} detected</span>
            </span>
          )}
        </div>

        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-brand-slate-400">
            <Phone className="w-4 h-4" />
          </div>
          <input
            id="customerPhone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            required
            disabled={isSubmitting}
            value={phone}
            onChange={handlePhoneChange}
            placeholder="e.g. 0754 000 111 or +255 754 000 111"
            className={`w-full pl-10 pr-4 py-3 rounded-xl bg-brand-navy-900/70 border text-white placeholder-brand-slate-500 text-sm focus:outline-none transition-all font-mono ${
              validationErrors.customerPhone
                ? 'border-red-500 ring-2 ring-red-500/30'
                : 'border-white/15 focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/30'
            }`}
            aria-invalid={Boolean(validationErrors.customerPhone)}
            aria-describedby={validationErrors.customerPhone ? 'phone-error' : undefined}
          />
        </div>
        {validationErrors.customerPhone ? (
          <p id="phone-error" className="text-xs text-red-400 mt-1" role="alert">
            {validationErrors.customerPhone}
          </p>
        ) : (
          <p className="text-[11px] text-brand-slate-400">
            {selectedMeta?.promptInstructions || 'Enter your mobile wallet PIN when requested.'}
          </p>
        )}
      </div>

      {/* Optional Customer Name */}
      <div className="space-y-1.5">
        <label htmlFor="customerName" className="block text-xs font-semibold uppercase tracking-wider text-brand-slate-300">
          Payer Name <span className="text-brand-slate-500 font-normal lowercase">(optional)</span>
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-brand-slate-400">
            <User className="w-4 h-4" />
          </div>
          <input
            id="customerName"
            type="text"
            autoComplete="name"
            disabled={isSubmitting}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Alice Smith"
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-brand-navy-900/70 border border-white/15 text-white placeholder-brand-slate-500 text-sm focus:outline-none focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/30 transition-all"
          />
        </div>
      </div>

      {/* Optional Customer Email */}
      <div className="space-y-1.5">
        <label htmlFor="customerEmail" className="block text-xs font-semibold uppercase tracking-wider text-brand-slate-300">
          Receipt Email <span className="text-brand-slate-500 font-normal lowercase">(optional)</span>
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-brand-slate-400">
            <Mail className="w-4 h-4" />
          </div>
          <input
            id="customerEmail"
            type="email"
            inputMode="email"
            autoComplete="email"
            disabled={isSubmitting}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="e.g. alice@example.com"
            className={`w-full pl-10 pr-4 py-2.5 rounded-xl bg-brand-navy-900/70 border text-white placeholder-brand-slate-500 text-sm focus:outline-none transition-all ${
              validationErrors.customerEmail
                ? 'border-red-500 ring-2 ring-red-500/30'
                : 'border-white/15 focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/30'
            }`}
          />
        </div>
        {validationErrors.customerEmail && (
          <p className="text-xs text-red-400 mt-1" role="alert">
            {validationErrors.customerEmail}
          </p>
        )}
      </div>

      {/* Submit Action Button */}
      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-brand-accent to-brand-accent-hover hover:from-brand-accent-hover hover:to-brand-accent text-brand-navy-950 font-bold text-sm tracking-wide transition-all shadow-lg hover:shadow-brand-accent/25 active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Sending STK Push Prompt...</span>
          </>
        ) : (
          <>
            <Lock className="w-4 h-4" />
            <span>Pay {formatCurrency(session.amount, session.currency)}</span>
          </>
        )}
      </button>

      {/* Compliance / Security footnote */}
      <div className="text-center">
        <p className="text-[11px] text-brand-slate-400">
          By tapping Pay, a secure USSD dialog will appear on your phone.
        </p>
      </div>
    </form>
  );
}
