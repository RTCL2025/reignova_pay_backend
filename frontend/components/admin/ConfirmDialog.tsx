'use client';

import React, { useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason?: string) => Promise<void> | void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'destructive' | 'default';
  requireReason?: boolean;
  reasonLabel?: string;
  reasonPlaceholder?: string;
  confirmMatchString?: string;
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'default',
  requireReason = false,
  reasonLabel = 'Mandatory reason for audit record',
  reasonPlaceholder = 'Enter explanation...',
  confirmMatchString,
}: ConfirmDialogProps) {
  const [reason, setReason] = useState('');
  const [typedMatch, setTypedMatch] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const isMatchValid = confirmMatchString ? typedMatch === confirmMatchString : true;
  const isReasonValid = requireReason ? reason.trim().length > 3 : true;
  const canConfirm = isMatchValid && isReasonValid && !isSubmitting;

  const handleConfirm = async () => {
    if (!canConfirm) return;
    setIsSubmitting(true);
    try {
      await onConfirm(reason);
      onClose();
    } catch {
      // errors handled by caller
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-md w-full p-6 text-left space-y-4">
        <div className="flex items-start gap-3.5">
          {variant === 'destructive' ? (
            <div className="size-10 rounded-lg bg-rose-50 border border-rose-200/80 flex items-center justify-center text-rose-600 shrink-0">
              <AlertTriangle className="size-5" />
            </div>
          ) : (
            <div className="size-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 shrink-0">
              <AlertTriangle className="size-5" />
            </div>
          )}
          <div>
            <h3 className="text-base font-semibold text-slate-900 font-sans">{title}</h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">{description}</p>
          </div>
        </div>

        {confirmMatchString && (
          <div className="space-y-1.5 pt-1">
            <Label className="text-xs text-slate-600 font-medium">
              Type <span className="font-mono font-bold text-slate-900 select-all">{confirmMatchString}</span> to confirm:
            </Label>
            <Input
              value={typedMatch}
              onChange={(e) => setTypedMatch(e.target.value)}
              placeholder={confirmMatchString}
              className="h-9 text-xs font-mono bg-slate-50 border-slate-200"
            />
          </div>
        )}

        {requireReason && (
          <div className="space-y-1.5 pt-1">
            <Label className="text-xs text-slate-600 font-medium">{reasonLabel}</Label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={reasonPlaceholder}
              className="h-9 text-xs bg-slate-50 border-slate-200"
            />
          </div>
        )}

        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isSubmitting}
            className="h-8 text-xs text-slate-700 bg-white border-slate-200 hover:bg-slate-50"
          >
            {cancelText}
          </Button>

          <Button
            type="button"
            size="sm"
            disabled={!canConfirm}
            onClick={handleConfirm}
            className={
              variant === 'destructive'
                ? 'h-8 text-xs bg-rose-600 hover:bg-rose-700 text-white gap-1.5'
                : 'h-8 text-xs bg-slate-900 hover:bg-slate-800 text-white gap-1.5'
            }
          >
            {isSubmitting && <Loader2 className="size-3.5 animate-spin" />}
            <span>{confirmText}</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
