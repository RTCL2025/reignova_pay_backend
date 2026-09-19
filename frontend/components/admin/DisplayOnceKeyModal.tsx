'use client';

import React, { useState } from 'react';
import { KeyRound, Copy, Check, AlertTriangle, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DisplayOnceKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  apiKey: string;
  applicationName: string;
}

export function DisplayOnceKeyModal({
  isOpen,
  onClose,
  apiKey,
  applicationName,
}: DisplayOnceKeyModalProps) {
  const [copied, setCopied] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = () => {
    setAcknowledged(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Blurred Backdrop Overlay */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity animate-in fade-in duration-150"
        onClick={handleClose}
        aria-hidden="true"
      />
      <div className="relative z-10 bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 text-left space-y-5 animate-in zoom-in-95 duration-150">
        <div className="flex items-start gap-3.5">
          <div className="size-11 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center shrink-0">
            <KeyRound className="size-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 font-sans">
              API Secret Key Generated
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Live credentials generated for{' '}
              <span className="font-semibold text-slate-800">{applicationName}</span>.
            </p>
          </div>
        </div>

        {/* Critical Security Alert */}
        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
          <AlertTriangle className="size-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-bold">Security Notice — Display Once Only:</div>
            <p className="text-amber-800 leading-relaxed text-[11px]">
              Copy and store this secret key securely right now. For security purposes, Reignova does not store plaintext keys and it can <strong>never</strong> be displayed again.
            </p>
          </div>
        </div>

        {/* API Key Box */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-600 font-medium">
            <span>Secret API Key</span>
            <span className="font-mono text-[11px] text-slate-400">Bearer Token</span>
          </div>

          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-900 text-slate-100 border border-slate-800 font-mono text-xs overflow-hidden">
            <span className="truncate flex-1 select-all">{apiKey}</span>
            <Button
              type="button"
              size="sm"
              onClick={handleCopy}
              className="h-7 text-xs bg-slate-800 hover:bg-slate-700 text-white gap-1.5 shrink-0"
            >
              {copied ? (
                <>
                  <Check className="size-3 text-emerald-400" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="size-3" />
                  <span>Copy Key</span>
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Acknowledgment checkbox */}
        <div className="flex items-center gap-2 pt-2">
          <input
            type="checkbox"
            id="ack-key"
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
            className="rounded border-slate-300 text-slate-900 focus:ring-slate-900 size-4 cursor-pointer"
          />
          <label htmlFor="ack-key" className="text-xs text-slate-600 cursor-pointer select-none">
            I have securely copied and saved this API key in an encrypted vault.
          </label>
        </div>

        {/* Action Button */}
        <div className="pt-3 border-t border-slate-100 flex justify-end">
          <Button
            type="button"
            disabled={!acknowledged}
            onClick={handleClose}
            className="h-9 text-xs bg-slate-900 hover:bg-slate-800 text-white font-semibold px-5 rounded-lg gap-2"
          >
            <ShieldCheck className="size-4" />
            <span>Done & Close Modal</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
