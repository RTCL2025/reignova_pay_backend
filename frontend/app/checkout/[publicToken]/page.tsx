'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  getCheckoutSession,
  initiatePayment,
  cancelCheckoutSession,
  getCheckoutStatus,
} from '@/lib/checkout-api';
import { useCheckoutStatus } from '@/hooks/use-checkout-status';
import { CheckoutHeader } from '@/components/checkout/CheckoutHeader';
import { MerchantSummary } from '@/components/checkout/MerchantSummary';
import { PaymentSummary } from '@/components/checkout/PaymentSummary';
import { CustomerDetailsForm } from '@/components/checkout/CustomerDetailsForm';
import { CheckoutSkeleton } from '@/components/checkout/states/CheckoutSkeleton';
import { CheckoutProcessing } from '@/components/checkout/states/CheckoutProcessing';
import { CheckoutSuccess } from '@/components/checkout/states/CheckoutSuccess';
import { CheckoutFailed } from '@/components/checkout/states/CheckoutFailed';
import { CheckoutExpired } from '@/components/checkout/states/CheckoutExpired';
import { CheckoutCancelled } from '@/components/checkout/states/CheckoutCancelled';
import { ShieldCheck, AlertCircle, RefreshCw } from 'lucide-react';
import type { CheckoutSession, CheckoutStatus, InitiatePaymentPayload } from '@/types/checkout';
import { PROVIDER_MAP } from '@/lib/formatters';

export default function CheckoutPage() {
  const params = useParams();
  const router = useRouter();
  const publicToken = (params?.publicToken as string) || '';

  const [session, setSession] = useState<CheckoutSession | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Form submission state
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedPhone, setSubmittedPhone] = useState<string>('');
  const [submittedProvider, setSubmittedProvider] = useState<string>('');
  const [isCancelling, setIsCancelling] = useState<boolean>(false);

  // Polling hook
  const {
    status,
    setStatus,
    failureReason,
    startPolling,
    stopPolling,
  } = useCheckoutStatus({
    publicToken,
    initialStatus: 'PENDING',
    onStatusChange: (newStatus, reason) => {
      if (session) {
        setSession((prev) => (prev ? { ...prev, status: newStatus, failureReason: reason } : null));
      }
    },
  });

  // Fetch session on mount
  const fetchSession = useCallback(async () => {
    if (!publicToken) return;
    setIsLoading(true);
    setLoadError(null);

    try {
      const data = await getCheckoutSession(publicToken);
      setSession(data);
      setStatus(data.status);
      if (data.status === 'PROCESSING') {
        startPolling();
      }
    } catch (err: any) {
      setLoadError(err?.message || 'Unable to load checkout session. It may have expired or been removed.');
    } finally {
      setIsLoading(false);
    }
  }, [publicToken, setStatus, startPolling]);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  // Handle payment submission
  const handlePaymentSubmit = async (payload: InitiatePaymentPayload) => {
    if (!publicToken || !session) return;
    setIsSubmitting(true);
    setSubmitError(null);
    setSubmittedPhone(payload.customerPhone);
    setSubmittedProvider(payload.provider);

    try {
      const result = await initiatePayment(publicToken, payload);
      setStatus(result.status);
      setSession((prev) => (prev ? { ...prev, status: result.status } : null));
      startPolling();
    } catch (err: any) {
      setSubmitError(
        err?.message || 'Failed to initiate payment. Please check the phone number and try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle session cancellation
  const handleCancel = async () => {
    if (!publicToken || !session) return;
    const confirmed = window.confirm('Are you sure you want to cancel this payment?');
    if (!confirmed) return;

    setIsCancelling(true);
    try {
      stopPolling();
      await cancelCheckoutSession(publicToken);
      setStatus('CANCELLED');
      setSession((prev) => (prev ? { ...prev, status: 'CANCELLED' } : null));
    } catch (err: any) {
      alert(err?.message || 'Could not cancel session');
    } finally {
      setIsCancelling(false);
    }
  };

  // Retry from failed state
  const handleRetry = () => {
    setSubmitError(null);
    setStatus('WAITING_PAYMENT');
    setSession((prev) => (prev ? { ...prev, status: 'WAITING_PAYMENT' } : null));
  };

  // Loading Skeleton
  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <div className="h-16 border-b border-white/10 bg-brand-navy-900/80" />
        <main className="flex-1 py-8">
          <CheckoutSkeleton />
        </main>
      </div>
    );
  }

  // Session Not Found / Network Load Error
  if (loadError || !session) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 text-center">
        <div className="w-full max-w-md reignova-card rounded-2xl p-8 border border-white/10 space-y-6">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400">
            <AlertCircle className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white mb-2">Checkout Error</h1>
            <p className="text-sm text-brand-slate-400">{loadError || 'Session could not be retrieved.'}</p>
          </div>
          <button
            type="button"
            onClick={fetchSession}
            className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl bg-brand-navy-800 hover:bg-brand-navy-700 text-white text-sm font-medium transition-colors border border-white/10"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Try Loading Again</span>
          </button>
        </div>
      </div>
    );
  }

  const currentStatus = session.status || status;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Checkout Navigation Bar */}
      <CheckoutHeader
        expiresAt={session.expiresAt}
        onCancel={handleCancel}
        isCancelling={isCancelling}
        hideTimer={['COMPLETED', 'CANCELLED', 'EXPIRED'].includes(currentStatus)}
        hideCancel={['COMPLETED', 'CANCELLED', 'EXPIRED', 'PROCESSING'].includes(currentStatus)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8">
        {/* Terminal State Screens */}
        {currentStatus === 'PROCESSING' && (
          <CheckoutProcessing
            session={session}
            phone={submittedPhone}
            providerId={submittedProvider}
            onRefreshStatus={async () => {
              const res = await getCheckoutStatus(publicToken);
              setStatus(res.status);
            }}
          />
        )}

        {currentStatus === 'COMPLETED' && (
          <CheckoutSuccess
            session={session}
            phone={submittedPhone}
            providerName={PROVIDER_MAP[submittedProvider]?.shortName || 'Mobile Money'}
          />
        )}

        {currentStatus === 'FAILED' && (
          <CheckoutFailed
            session={session}
            failureReason={failureReason || session.failureReason}
            failureCode={session.failureCode}
            onRetry={handleRetry}
          />
        )}

        {currentStatus === 'EXPIRED' && <CheckoutExpired session={session} />}

        {currentStatus === 'CANCELLED' && <CheckoutCancelled session={session} />}

        {/* Active Payment Form State (PENDING or WAITING_PAYMENT) */}
        {['PENDING', 'WAITING_PAYMENT'].includes(currentStatus) && (
          <div className="space-y-6 animate-fade-in">
            {/* Merchant Top Bar */}
            <MerchantSummary
              merchant={session.merchant}
              amount={session.amount}
              currency={session.currency}
              reference={session.reference}
            />

            {/* Split layout: Form on Left, Breakdown on Right */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
              <div className="md:col-span-7">
                <CustomerDetailsForm
                  session={session}
                  onSubmitPayment={handlePaymentSubmit}
                  isSubmitting={isSubmitting}
                  errorMessage={submitError}
                />
              </div>

              <div className="md:col-span-5 space-y-6">
                <PaymentSummary
                  amount={session.amount}
                  currency={session.currency}
                  reference={session.reference}
                  merchantName={session.merchant.name}
                />
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-white/5 py-6 px-4 text-center text-xs text-brand-slate-500 space-y-1">
        <div className="flex items-center justify-center gap-1 text-brand-slate-400 font-medium">
          <ShieldCheck className="w-3.5 h-3.5 text-brand-accent" />
          <span>Secured by Reignova Technologies Payment Engine</span>
        </div>
        <p>© {new Date().getFullYear()} Reignova Technologies. All rights reserved.</p>
      </footer>
    </div>
  );
}
