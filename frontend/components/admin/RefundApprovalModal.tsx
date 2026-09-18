'use client';

import React, { useState } from 'react';
import { RotateCcw, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Refund } from '@/types/admin';

interface RefundApprovalModalProps {
  refund: Refund | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export function RefundApprovalModal({
  refund,
  isOpen,
  onClose,
  onConfirm,
}: RefundApprovalModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !refund) return null;

  const handleApprove = async () => {
    setIsSubmitting(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 text-left space-y-4">
        <div className="flex items-start gap-3.5">
          <div className="size-10 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center shrink-0">
            <RotateCcw className="size-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 font-sans">
              Approve Payment Refund
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Review and authorize reversal of settled customer funds.
            </p>
          </div>
        </div>

        {/* Refund Details Summary */}
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2">
          <div className="flex justify-between">
            <span className="text-slate-500">Refund Amount:</span>
            <span className="font-mono font-bold text-slate-900 text-sm">
              {refund.amount.toLocaleString()} {refund.currency}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Merchant:</span>
            <span className="font-semibold text-slate-800">{refund.applicationName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Original Reference:</span>
            <span className="font-mono text-slate-800">{refund.originalPaymentRef}</span>
          </div>
          <div className="pt-2 border-t border-slate-200/60">
            <span className="text-slate-500 block mb-1">Reason:</span>
            <p className="text-slate-700 italic bg-white p-2 rounded border border-slate-200">
              "{refund.reason}"
            </p>
          </div>
        </div>

        {/* Provider Notice */}
        <div className="p-3 rounded-lg bg-amber-50/80 border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
          <AlertTriangle className="size-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-[11px] leading-relaxed">
            Upon approval, Reignova will submit a refund instruction to the payment aggregator. Funds are credited back to the customer's mobile wallet asynchronously.
          </p>
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isSubmitting}
            className="h-8 text-xs text-slate-700 bg-white border-slate-200"
          >
            Cancel
          </Button>

          <Button
            size="sm"
            onClick={handleApprove}
            disabled={isSubmitting}
            className="h-8 text-xs bg-slate-900 hover:bg-slate-800 text-white font-semibold gap-1.5"
          >
            {isSubmitting && <Loader2 className="size-3.5 animate-spin" />}
            <span>Authorize Refund</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
