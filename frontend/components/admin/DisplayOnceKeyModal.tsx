'use client';

import React, { useState } from 'react';
import { KeyRound, Copy, Check, AlertTriangle, ShieldCheck, Shield, CopyCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DisplayOnceKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  apiKey: string;
  webhookSecret?: string;
  applicationName: string;
}

export function DisplayOnceKeyModal({
  isOpen,
  onClose,
  apiKey,
  webhookSecret,
  applicationName,
}: DisplayOnceKeyModalProps) {
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [copiedAll, setCopiedAll] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);

  if (!isOpen) return null;

  const handleCopyKey = () => {
    navigator.clipboard.writeText(apiKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleCopySecret = () => {
    if (webhookSecret) {
      navigator.clipboard.writeText(webhookSecret);
      setCopiedSecret(true);
      setTimeout(() => setCopiedSecret(false), 2000);
    }
  };

  const handleCopyAll = () => {
    const text = `API Key: ${apiKey}\nWebhook Secret: ${webhookSecret || 'N/A'}`;
    navigator.clipboard.writeText(text);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
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
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3.5">
            <div className="size-11 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center shrink-0">
              <KeyRound className="size-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 font-sans">
                Credentials Generated Successfully
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Live credentials & secrets generated for{' '}
                <span className="font-semibold text-slate-800">{applicationName}</span>.
              </p>
            </div>
          </div>

          {webhookSecret && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopyAll}
              className="h-8 text-xs bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200 gap-1.5 shrink-0"
              title="Copy both API Key and Webhook Secret"
            >
              {copiedAll ? (
                <>
                  <Check className="size-3.5 text-emerald-600" />
                  <span>Copied All</span>
                </>
              ) : (
                <>
                  <CopyCheck className="size-3.5 text-slate-500" />
                  <span>Copy All</span>
                </>
              )}
            </Button>
          )}
        </div>

        {/* Critical Security Alert */}
        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
          <AlertTriangle className="size-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-bold">Security Notice — Save Secrets Securely:</div>
            <p className="text-amber-800 leading-relaxed text-[11px]">
              Copy and store these secret credentials right now. Plaintext API secret keys are <strong>never stored</strong> and cannot be displayed again after closing.
            </p>
          </div>
        </div>

        {/* API Key Box */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-600 font-medium">
            <span className="flex items-center gap-1.5 font-semibold text-slate-700">
              <KeyRound className="size-3.5 text-slate-500" />
              <span>Secret API Key</span>
            </span>
            <span className="font-mono text-[11px] text-slate-400">Bearer Token</span>
          </div>

          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-900 text-slate-100 border border-slate-800 font-mono text-xs overflow-hidden">
            <span className="truncate flex-1 select-all">{apiKey}</span>
            <Button
              type="button"
              size="sm"
              onClick={handleCopyKey}
              className="h-7 text-xs bg-slate-800 hover:bg-slate-700 text-white gap-1.5 shrink-0"
            >
              {copiedKey ? (
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

        {/* Auto-Generated Webhook Secret Box */}
        {webhookSecret && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-slate-600 font-medium">
              <span className="flex items-center gap-1.5 font-semibold text-slate-700">
                <Shield className="size-3.5 text-emerald-600" />
                <span>Auto-Generated Webhook Secret</span>
              </span>
              <span className="font-mono text-[11px] text-emerald-600 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                HMAC-SHA256
              </span>
            </div>

            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-900 text-slate-100 border border-slate-800 font-mono text-xs overflow-hidden">
              <span className="truncate flex-1 select-all">{webhookSecret}</span>
              <Button
                type="button"
                size="sm"
                onClick={handleCopySecret}
                className="h-7 text-xs bg-slate-800 hover:bg-slate-700 text-white gap-1.5 shrink-0"
              >
                {copiedSecret ? (
                  <>
                    <Check className="size-3 text-emerald-400" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="size-3" />
                    <span>Copy Secret</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

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
            I have securely copied and saved these credentials in an encrypted vault.
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
