'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Lock,
  Mail,
  KeyRound,
  ArrowRight,
  AlertCircle,
  Clock,
  Loader2,
} from 'lucide-react';
import { ReignovaIcon } from '@/components/brand/ReignovaLogo';
import { useAdminAuth } from '@/context/AdminAuthContext';
import { AdminRole } from '@/types/admin';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

function AdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, isAuthenticated, isLoading } = useAdminAuth();

  const redirectUrl = searchParams.get('redirect') || '/admin';
  const isExpired = searchParams.get('expired') === 'true';

  const [email, setEmail] = useState('');
  const [apiKeyOrPass, setApiKeyOrPass] = useState('');
  const [chosenRole, setChosenRole] = useState<AdminRole>('SUPER_ADMIN');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.push(redirectUrl);
    }
  }, [isAuthenticated, isLoading, router, redirectUrl]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email || !email.includes('@')) {
      setErrorMessage('Please enter a valid administrative email address.');
      return;
    }

    if (!apiKeyOrPass) {
      setErrorMessage('Please enter the Admin API key or password.');
      return;
    }

    setIsSubmitting(true);
    try {
      await login(email, apiKeyOrPass, chosenRole);
      router.push(redirectUrl);
    } catch (err: any) {
      setErrorMessage(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center p-4 sm:p-6 bg-slate-50 text-slate-900">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex justify-center mb-1">
            <ReignovaIcon size={48} className="size-12 shadow-sm rounded-xl" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 font-sans">
            Reignova Payment Service
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            Internal Operations & Financial Infrastructure Administration
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xl p-6 sm:p-8 space-y-5">
          {/* Expiration Banner */}
          {isExpired && (
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
              <Clock className="size-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">Session Expired:</span> You were idle for more than 30 minutes. Please sign in again to resume.
              </div>
            </div>
          )}

          {/* Error Banner */}
          {errorMessage && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-start gap-2.5">
              <AlertCircle className="size-4 text-rose-600 shrink-0 mt-0.5" />
              <div>{errorMessage}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Admin Work Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@reignova.com"
                  className="pl-9 h-10 text-xs bg-slate-50/50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus-visible:ring-1 focus-visible:ring-slate-900"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-slate-700">Admin API Key / Password</Label>
                <span className="text-[11px] font-mono text-slate-400">ADMIN_API_KEY</span>
              </div>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                <Input
                  type="password"
                  value={apiKeyOrPass}
                  onChange={(e) => setApiKeyOrPass(e.target.value)}
                  placeholder="••••••••••••••••"
                  className="pl-9 h-10 text-xs font-mono bg-slate-50/50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus-visible:ring-1 focus-visible:ring-slate-900"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Role Context</Label>
              <select
                value={chosenRole}
                onChange={(e) => setChosenRole(e.target.value as AdminRole)}
                className="w-full h-10 px-3 text-xs bg-slate-50/50 border border-slate-200 text-slate-900 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-slate-900 font-medium cursor-pointer"
              >
                <option value="SUPER_ADMIN">Super Admin (Full System Access)</option>
                <option value="OPERATIONS_ADMIN">Operations Admin (Merchants & Payments)</option>
                <option value="FINANCE_ADMIN">Finance Admin (Payouts & Refunds)</option>
                <option value="AUDITOR">Auditor (Read-only Compliance)</option>
                <option value="SUPPORT_AGENT">Support Agent (Limited Read-only)</option>
              </select>
            </div>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-10 text-xs bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-lg shadow-sm gap-2 transition-all mt-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <span>Sign In to Admin Portal</span>
                  <ArrowRight className="size-3.5" />
                </>
              )}
            </Button>
          </form>

        </div>

        {/* Security Notice */}
        <div className="flex items-center justify-center gap-2 text-center text-[11px] text-slate-400">
          <Lock className="size-3 text-slate-400" />
          <span>Protected by Enterprise TLS & Immutable Server Audit Logging</span>
        </div>
      </div>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50 text-xs text-slate-500 font-mono">
          Loading Admin Portal...
        </div>
      }
    >
      <AdminLoginForm />
    </Suspense>
  );
}

