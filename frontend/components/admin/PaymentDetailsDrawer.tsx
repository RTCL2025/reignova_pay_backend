'use client';

import React, { useState } from 'react';
import { RotateCw, CheckCircle2, AlertTriangle, Download } from 'lucide-react';
import { DetailsDrawer } from './DetailsDrawer';
import { StatusBadge } from './StatusBadge';
import { StatusTimeline } from './StatusTimeline';
import { PermissionGate } from './PermissionGate';
import { Button } from '@/components/ui/button';
import { adminApiClient } from '@/lib/admin-api';
import { Payment } from '@/types/admin';

interface PaymentDetailsDrawerProps {
  payment: Payment | null;
  isOpen: boolean;
  onClose: () => void;
}

export function PaymentDetailsDrawer({
  payment,
  isOpen,
  onClose,
}: PaymentDetailsDrawerProps) {
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryMessage, setRetryMessage] = useState<string | null>(null);

  if (!payment) return null;

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      const res = await adminApiClient.payments.retry(payment.id);
      setRetryMessage(res.message);
      setTimeout(() => setRetryMessage(null), 3000);
    } finally {
      setIsRetrying(false);
    }
  };

  // Mask sensitive phone number
  const maskedPhone = payment.phoneNumber
    ? `${payment.phoneNumber.substring(0, 5)} ••• ••${payment.phoneNumber.slice(-2)}`
    : '—';

  const rows = [
    { label: 'Payment ID', value: payment.id, copyable: payment.id, isMono: true },
    { label: 'Merchant Reference', value: payment.reference, copyable: payment.reference, isMono: true },
    { label: 'Application', value: payment.applicationName || payment.applicationId },
    {
      label: 'Settled Amount',
      value: `${payment.amount.toLocaleString()} ${payment.currency}`,
      isMono: true,
    },
    { label: 'Payment Type', value: payment.type },
    { label: 'Customer Handset', value: maskedPhone, isMono: true },
    { label: 'Carrier Provider', value: payment.provider || 'PawaPay Mobile Money' },
    {
      label: 'Gateway Provider ID',
      value: payment.providerPaymentId || 'Pending Gateway Sync',
      copyable: payment.providerPaymentId || undefined,
      isMono: true,
    },
    {
      label: 'Initiated At',
      value: new Date(payment.createdAt).toLocaleString(),
      isMono: true,
    },
    {
      label: 'Completed / Failed At',
      value: payment.completedAt
        ? new Date(payment.completedAt).toLocaleString()
        : payment.failedAt
        ? new Date(payment.failedAt).toLocaleString()
        : 'Processing',
      isMono: true,
    },
  ];

  return (
    <DetailsDrawer
      isOpen={isOpen}
      onClose={onClose}
      title={payment.reference}
      subtitle={`Payment Transaction • ${payment.amount.toLocaleString()} ${payment.currency}`}
      badge={<StatusBadge status={payment.status} />}
      rows={rows}
      rawJson={payment as any}
      footerActions={
        <div className="flex items-center gap-2">
          {payment.status === 'FAILED' && (
            <PermissionGate permission="payments.retry" renderDisabled>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRetry}
                disabled={isRetrying}
                className="h-8 text-xs bg-white border-slate-200 text-slate-800 hover:bg-slate-50 gap-1.5"
              >
                <RotateCw className={`size-3.5 ${isRetrying ? 'animate-spin' : ''}`} />
                <span>Retry Payment</span>
              </Button>
            </PermissionGate>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              try {
                await adminApiClient.payments.downloadReceipt(payment.id, payment.reference);
              } catch (err: any) {
                alert(err?.message || 'Failed to download receipt');
              }
            }}
            className="h-8 text-xs bg-white border-slate-200 text-slate-800 hover:bg-slate-50 gap-1.5"
          >
            <Download className="size-3.5 text-slate-500" />
            <span>Download Receipt</span>
          </Button>

          <Button
            size="sm"
            onClick={onClose}
            className="h-8 text-xs bg-slate-900 hover:bg-slate-800 text-white"
          >
            Close Inspector
          </Button>
        </div>
      }
    >
      {/* Retry Feedback */}
      {retryMessage && (
        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
          <CheckCircle2 className="size-4 text-emerald-600" />
          <span>{retryMessage}</span>
        </div>
      )}

      {/* Failure Diagnostic Alert if failed */}
      {payment.status === 'FAILED' && payment.failureReason && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900 space-y-1">
          <div className="flex items-center gap-1.5 font-bold">
            <AlertTriangle className="size-4 text-rose-600" />
            <span>Carrier Decline Diagnostics:</span>
          </div>
          <p className="text-rose-800 leading-relaxed font-mono text-[11px]">
            {payment.failureReason}
          </p>
        </div>
      )}

      {/* Embedded Status Progression Timeline */}
      <div className="pt-2 border-t border-slate-100">
        <StatusTimeline
          status={payment.status}
          createdAt={payment.createdAt}
          completedAt={payment.completedAt}
          failedAt={payment.failedAt}
          failureReason={payment.failureReason}
        />
      </div>
    </DetailsDrawer>
  );
}
