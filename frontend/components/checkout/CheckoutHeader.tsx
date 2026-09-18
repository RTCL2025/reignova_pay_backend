'use client';

import React, { useState, useEffect } from 'react';
import { ShieldCheck, Clock, X, AlertTriangle } from 'lucide-react';
import { formatTimeRemaining } from '@/lib/formatters';

interface CheckoutHeaderProps {
  expiresAt: string;
  onCancel?: () => void;
  isCancelling?: boolean;
  hideTimer?: boolean;
  hideCancel?: boolean;
}

export function CheckoutHeader({
  expiresAt,
  onCancel,
  isCancelling = false,
  hideTimer = false,
  hideCancel = false,
}: CheckoutHeaderProps) {
  const [timeLeft, setTimeLeft] = useState(() => formatTimeRemaining(expiresAt));

  useEffect(() => {
    if (hideTimer) return;

    const timer = setInterval(() => {
      const updated = formatTimeRemaining(expiresAt);
      setTimeLeft(updated);
    }, 1000);

    return () => clearInterval(timer);
  }, [expiresAt, hideTimer]);

  const isUrgent = timeLeft.minutes < 2 && !timeLeft.isExpired;

  return (
    <header className="w-full border-b border-white/10 bg-brand-navy-900/80 backdrop-blur-md sticky top-0 z-30">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Brand Emblem and Title */}
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-brand-navy-800 border border-brand-accent/40 flex items-center justify-center text-brand-accent shadow-sm">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm tracking-tight text-white">REIGNOVA</span>
              <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-brand-accent/15 text-brand-accent border border-brand-accent/20">
                PAY
              </span>
            </div>
            <p className="text-[11px] text-brand-slate-400">
              Secured & Encrypted Checkout
            </p>
          </div>
        </div>

        {/* Right side: Countdown Timer & Cancel Button */}
        <div className="flex items-center gap-3">
          {!hideTimer && (
            <div
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-medium transition-colors ${
                timeLeft.isExpired
                  ? 'bg-red-500/15 text-red-400 border border-red-500/20'
                  : isUrgent
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30 animate-pulse'
                  : 'bg-white/5 text-brand-slate-300 border border-white/10'
              }`}
              title="Time remaining to complete payment"
            >
              {isUrgent ? (
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              ) : (
                <Clock className="w-3.5 h-3.5 text-brand-accent" />
              )}
              <span>{timeLeft.formatted}</span>
            </div>
          )}

          {!hideCancel && onCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={isCancelling}
              className="p-1.5 rounded-lg text-brand-slate-400 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-50"
              title="Cancel checkout session"
              aria-label="Cancel checkout session"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
