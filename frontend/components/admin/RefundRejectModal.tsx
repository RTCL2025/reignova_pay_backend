'use client';

import React, { useState } from 'react';
import { XCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Refund } from '@/types/admin';

interface RefundRejectModalProps {
  refund: Refund | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
}

export function RefundRejectModal({
  refund,
  isOpen,
  onClose,
  onConfirm,
}: RefundRejectModalProps) {
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !refund) return null;

  const handleReject = async () => {
    if (!reason.trim()) return;
    setIsSubmitting(true);
    try {
      await onConfirm(reason.trim());
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Blurred Backdrop Overlay */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity animate-in fade-in duration-150"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative z-10 bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 text-left space-y-4 animate-in zoom-in-95 duration-150">
        <div className="flex items-start gap-3.5">
          <div className="size-10 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center justify-center shrink-0">
            <XCircle className="size-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 font-sans">
              Decline Refund Request
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Refusing refund for reference {refund.originalPaymentRef}.
            </p>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-slate-700">
            Mandatory Rejection Reason (Audit Trail)
          </Label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Explain why this refund request was declined..."
            rows={3}
            className="w-full text-xs p-3 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-1 focus:ring-slate-900"
            required
          />
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
            onClick={handleReject}
            disabled={isSubmitting || reason.trim().length < 5}
            className="h-8 text-xs bg-rose-600 hover:bg-rose-700 text-white font-semibold gap-1.5"
          >
            {isSubmitting && <Loader2 className="size-3.5 animate-spin" />}
            <span>Confirm Rejection</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
