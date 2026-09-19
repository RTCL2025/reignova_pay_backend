'use client';

import React, { useState, useEffect } from 'react';
import { Lock, Globe, User, AlertTriangle, X } from 'lucide-react';
import { ReignovaLogo } from '@/components/brand/ReignovaLogo';
import { formatTimeRemaining } from '@/lib/formatters';
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
import { Button } from '@/components/ui/button';

interface CheckoutHeaderProps {
  expiresAt?: string;
  onCancel?: () => void;
  isCancelling?: boolean;
  hideTimer?: boolean;
  hideCancel?: boolean;
  isTestMode?: boolean;
  activeTab?: 'payment' | 'details';
  onTabChange?: (tab: 'payment' | 'details') => void;
}

export function CheckoutHeader({
  expiresAt,
  onCancel,
  isCancelling = false,
  hideTimer = false,
  hideCancel = false,
  isTestMode = true,
  activeTab = 'payment',
  onTabChange,
}: CheckoutHeaderProps) {
  const [timeLeft, setTimeLeft] = useState(() => (expiresAt ? formatTimeRemaining(expiresAt) : null));
  const [isAlertOpen, setIsAlertOpen] = useState(false);

  useEffect(() => {
    if (!expiresAt || hideTimer) return;

    const timer = setInterval(() => {
      setTimeLeft(formatTimeRemaining(expiresAt));
    }, 1000);

    return () => clearInterval(timer);
  }, [expiresAt, hideTimer]);

  return (
    <header className="fixed top-0 left-0 right-0 w-full z-50 bg-white/90 backdrop-blur-xl border-b border-slate-200/80 shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
      <div className="h-16 max-w-5xl mx-auto px-4 sm:px-6 flex items-center justify-between">
        {/* Left: Official Reignova Logo & Security Badges */}
        <div className="flex items-center gap-3">
          <ReignovaLogo size={34} textClassName="text-slate-900" />

          {/* 256-bit Encrypted Badge */}
          <div className="hidden sm:flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200/70 text-emerald-700 text-xs font-medium">
            <Lock className="w-3 h-3 text-emerald-600" />
            <span>256-bit Encrypted</span>
          </div>

          {/* Test Mode Badge */}
          {isTestMode && (
            <div className="hidden md:inline-flex items-center px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-200/60 text-blue-700 text-[11px] font-semibold tracking-wider font-mono">
              TEST MODE
            </div>
          )}
        </div>

        {/* Right: Navigation, Currency Selector, and User Pill */}
        <div className="flex items-center gap-3">
          <nav className="flex items-center gap-1 bg-slate-100/70 p-1 rounded-xl border border-slate-200/60">
            <button
              type="button"
              onClick={() => onTabChange?.('payment')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'payment'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Payment
            </button>
            <button
              type="button"
              onClick={() => onTabChange?.('details')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'details'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Details
            </button>
          </nav>

          {/* Currency / Language Switcher */}
          <div className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100/80 border border-slate-200 text-slate-700 text-xs font-medium cursor-default">
            <Globe className="w-3.5 h-3.5 text-slate-500" />
            <span>TZS / EN</span>
          </div>

          {/* User Avatar Circle */}
          <div
            className="w-8 h-8 rounded-full bg-brand-navy-900 text-brand-gold flex items-center justify-center shadow-xs"
            title="Authenticated Session"
          >
            <User className="w-4 h-4 text-brand-gold" />
          </div>

          {/* Cancel Action if available */}
          {!hideCancel && onCancel && (
            <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
              <AlertDialogTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={isCancelling}
                  className="rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                  title="Cancel checkout session"
                >
                  <X className="w-4 h-4" />
                </Button>
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
                    onClick={onCancel}
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
    </header>
  );
}
