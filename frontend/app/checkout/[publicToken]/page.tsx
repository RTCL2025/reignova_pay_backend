'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import {
  getCheckoutSession,
  initiatePayment,
  cancelCheckoutSession,
  getCheckoutStatus,
  simulateCheckoutApproval,
  simulateCheckoutTimeout,
} from '@/lib/checkout-api';
import { useCheckoutStatus } from '@/hooks/use-checkout-status';
import { MerchantSummary } from '@/components/checkout/MerchantSummary';
import { CustomerDetailsForm } from '@/components/checkout/CustomerDetailsForm';
import { CheckoutSkeleton } from '@/components/checkout/states/CheckoutSkeleton';
import { CheckoutProcessing } from '@/components/checkout/states/CheckoutProcessing';
import { CheckoutSuccess } from '@/components/checkout/states/CheckoutSuccess';
import { CheckoutFailed } from '@/components/checkout/states/CheckoutFailed';
import { CheckoutExpired } from '@/components/checkout/states/CheckoutExpired';
import { CheckoutCancelled } from '@/components/checkout/states/CheckoutCancelled';
import { ShieldCheck, AlertCircle, RefreshCw, Lock, X } from 'lucide-react';
import { ReignovaLogo } from '@/components/brand/ReignovaLogo';
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
import type { CheckoutSession, InitiatePaymentPayload } from '@/types/checkout';
import { PROVIDER_MAP } from '@/lib/formatters';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function CheckoutPage() {
  const params = useParams();
  const publicToken = (params?.publicToken as string) || '';

  const [session, setSession] = useState<CheckoutSession | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Form submission state
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedPhone, setSubmittedPhone] = useState<string>('');
  const [submittedProvider, setSubmittedProvider] = useState<string>('VODACOM_TZA');
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

  // Retry / reset from terminal state
  const handleResetToDefault = () => {
    setSubmitError(null);
    setStatus('WAITING_PAYMENT');
    setSession((prev) => (prev ? { ...prev, status: 'WAITING_PAYMENT' } : null));
  };

  // Loading Skeleton
  if (isLoading) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8 bg-canvas-bg">
        <main className="w-full max-w-3xl my-auto">
          <CheckoutSkeleton />
        </main>
      </div>
    );
  }

  // Session Not Found / Network Load Error
  if (loadError || !session) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 text-center bg-canvas-bg">
        <Card className="w-full max-w-md bg-white border-slate-200 shadow-xl">
          <CardContent className="flex flex-col items-center gap-5 py-6">
            <div className="size-14 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center text-red-500">
              <AlertCircle className="size-7" />
            </div>
            <div className="flex flex-col gap-1.5">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">Checkout Error</h1>
              <p className="text-sm text-slate-500">{loadError || 'Session could not be retrieved.'}</p>
            </div>
            <Button
              type="button"
              onClick={fetchSession}
              className="w-full h-11 text-sm font-bold rounded-xl bg-brand-gold hover:bg-brand-gold-hover text-brand-navy-900 shadow-md cursor-pointer"
            >
              <RefreshCw className="w-4 h-4 mr-1.5" />
              <span>Try Loading Again</span>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Determine current active view based on real session status
  const currentStatus = session.status || status;
  let activeView: 'default' | 'processing' | 'success' | 'failed' | 'expired' | 'cancelled' = 'default';

  if (currentStatus === 'PROCESSING') {
    activeView = 'processing';
  } else if (currentStatus === 'COMPLETED') {
    activeView = 'success';
  } else if (currentStatus === 'FAILED') {
    activeView = 'failed';
  } else if (currentStatus === 'EXPIRED') {
    activeView = 'expired';
  } else if (currentStatus === 'CANCELLED') {
    activeView = 'cancelled';
  } else {
    activeView = 'default';
  }

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8 bg-canvas-bg text-slate-900">
      {/* SINGLE-COLUMN ELEVATED CARD CONTAINER (MAX-W-3XL) */}
      <main className="w-full max-w-3xl my-auto">
        <div className="w-full bg-white rounded-2xl shadow-xl shadow-slate-900/5 border border-slate-200/80 overflow-hidden flex flex-col">
          {/* CARD TOP BRAND HEADER: Reignova Logo & ReignovaPay Branding */}
          <div className="px-5 sm:px-6 py-3.5 bg-slate-50/90 border-b border-slate-200/80 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ReignovaLogo size={28} textClassName="text-slate-900" />
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200/70 text-emerald-700 text-xs font-medium">
                <Lock className="w-3.5 h-3.5 text-emerald-600" />
                <span>256-bit Encrypted</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-200/60 text-blue-700 text-[11px] font-semibold tracking-wider font-mono">
                TEST MODE
              </span>
              {!['COMPLETED', 'CANCELLED', 'EXPIRED', 'PROCESSING'].includes(currentStatus) && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <button
                      type="button"
                      disabled={isCancelling}
                      title="Cancel checkout session"
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 transition-colors cursor-pointer disabled:opacity-50 ml-1"
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
                        onClick={handleCancel}
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

          {/* INTEGRATED TOP BANNER: Merchant Summary, Event Pass Hero & Total Due */}
          <MerchantSummary
            merchant={session.merchant}
            amount={session.amount}
            currency={session.currency}
            reference={session.reference}
            expiresAt={session.expiresAt}
            description={session.description}
            metadata={session.metadata}
            reason={session.reason}
          />

          {/* CARD BODY: SWITCHABLE STATES */}
          <div className="flex flex-col">
            {/* STATE 1: DEFAULT CHECKOUT FORM */}
            {activeView === 'default' && (
              <CustomerDetailsForm
                session={session}
                onSubmitPayment={handlePaymentSubmit}
                isSubmitting={isSubmitting}
                errorMessage={submitError}
              />
            )}

            {/* STATE 2: PROCESSING (USSD PUSH) */}
            {activeView === 'processing' && (
              <CheckoutProcessing
                session={session}
                phone={submittedPhone}
                providerId={submittedProvider}
                onSimulateSuccess={async () => {
                  try {
                    const res = await simulateCheckoutApproval(publicToken);
                    setStatus(res.status);
                    setSession((prev) => (prev ? { ...prev, status: res.status } : null));
                  } catch (err: any) {
                    alert(err?.message || 'Simulation failed');
                  }
                }}
                onSimulateFailed={async () => {
                  try {
                    const res = await simulateCheckoutTimeout(publicToken);
                    setStatus(res.status);
                    setSession((prev) => (prev ? { ...prev, status: res.status, failureReason: 'Handset authorization timed out' } : null));
                  } catch (err: any) {
                    alert(err?.message || 'Simulation failed');
                  }
                }}
              />
            )}

            {/* STATE 3: SUCCESS */}
            {activeView === 'success' && (
              <CheckoutSuccess
                session={session}
                phone={submittedPhone}
                providerName={PROVIDER_MAP[submittedProvider]?.shortName || 'Mobile Money'}
                providerLogoUrl={PROVIDER_MAP[submittedProvider]?.logoUrl}
                onResetState={handleResetToDefault}
              />
            )}

            {/* STATE 4: FAILED */}
            {activeView === 'failed' && (
              <CheckoutFailed
                session={session}
                failureReason={failureReason || session.failureReason}
                failureCode={session.failureCode}
                onRetry={handleResetToDefault}
              />
            )}

            {/* STATE 5: EXPIRED */}
            {activeView === 'expired' && (
              <CheckoutExpired
                session={session}
                onRestart={handleResetToDefault}
              />
            )}

            {/* STATE 6: CANCELLED */}
            {activeView === 'cancelled' && (
              <CheckoutCancelled
                session={session}
                onRestart={handleResetToDefault}
              />
            )}
          </div>

          {/* INTEGRATED CARD FOOTER: Trust Pillar & Regulatory Metadata Strip */}
          <div className="bg-slate-50/80 px-5 sm:px-6 py-3.5 border-t border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-2.5 text-slate-500 text-xs">
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-md bg-white border border-slate-200 flex items-center justify-center text-emerald-600 shadow-2xs">
                <ShieldCheck className="w-3.5 h-3.5" />
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-slate-900 font-semibold">Secured by Reignova</span>
                <span className="text-slate-300">•</span>
              </div>
            </div>
            <div className="flex items-center gap-2 font-mono text-[11px] text-slate-400">
              <span>PCI-DSS</span>
              <span>•</span>
              <span>TLS 1.3</span>
              <span>•</span>
              <span>AES-GCM-256</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
