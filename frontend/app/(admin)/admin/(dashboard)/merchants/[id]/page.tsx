'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Building2,
  KeyRound,
  CreditCard,
  Layers,
  FileCode2,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Check,
  Globe,
  Shield,
  Clock,
  RefreshCw,
} from 'lucide-react';
import { PageHeader } from '@/components/admin/PageHeader';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { DataTable, Column } from '@/components/admin/DataTable';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { DisplayOnceKeyModal } from '@/components/admin/DisplayOnceKeyModal';
import { PermissionGate } from '@/components/admin/PermissionGate';
import { Button } from '@/components/ui/button';
import { adminApiClient } from '@/lib/admin-api';
import { Application, Payment, CheckoutSession, AuditLog } from '@/types/admin';

export default function MerchantDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const merchantId = params.id as string;

  const [merchant, setMerchant] = useState<Application | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [sessions, setSessions] = useState<CheckoutSession[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [activeTab, setActiveTab] = useState<
    'overview' | 'payments' | 'sessions' | 'credentials' | 'audit' | 'danger'
  >('overview');
  const [isLoading, setIsLoading] = useState(true);
  const [copiedId, setCopiedId] = useState(false);

  // Modals
  const [newKeyModal, setNewKeyModal] = useState<{ apiKey: string; appName: string } | null>(null);
  const [confirmAction, setConfirmAction] = useState<'suspend' | 'reactivate' | 'rotate' | null>(null);

  useEffect(() => {
    async function loadDetails() {
      setIsLoading(true);
      try {
        const [m, pRes, sRes, aRes] = await Promise.all([
          adminApiClient.merchants.get(merchantId),
          adminApiClient.payments.list({ merchantId }),
          adminApiClient.checkoutSessions.list(),
          adminApiClient.auditLogs.list(),
        ]);
        setMerchant(m);
        setPayments(pRes.payments.filter((p) => p.applicationId === merchantId));
        setSessions(sRes.sessions.filter((s) => s.applicationId === merchantId));
        setAuditLogs(aRes.logs.filter((l) => l.applicationId === merchantId));
      } finally {
        setIsLoading(false);
      }
    }
    loadDetails();
  }, [merchantId]);

  const handleCopyId = () => {
    if (merchant) {
      navigator.clipboard.writeText(merchant.id);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 1500);
    }
  };

  const handleExecuteAction = async (reason?: string) => {
    if (!merchant || !confirmAction) return;

    if (confirmAction === 'suspend') {
      await adminApiClient.merchants.suspend(merchant.id, reason);
      setMerchant((prev) => (prev ? { ...prev, status: 'SUSPENDED' } : null));
    } else if (confirmAction === 'reactivate') {
      await adminApiClient.merchants.reactivate(merchant.id);
      setMerchant((prev) => (prev ? { ...prev, status: 'ACTIVE' } : null));
    } else if (confirmAction === 'rotate') {
      const res = await adminApiClient.merchants.rotateKey(merchant.id);
      setMerchant((prev) =>
        prev ? { ...prev, apiKeyPrefix: res.apiKeyPrefix } : null
      );
      setNewKeyModal({ apiKey: res.apiKey, appName: merchant.name });
    }
  };

  if (isLoading) {
    return (
      <div className="p-12 text-center text-xs text-slate-500 font-mono">
        Loading merchant details...
      </div>
    );
  }

  if (!merchant) {
    return (
      <div className="p-12 text-center space-y-3">
        <h3 className="text-base font-bold text-slate-900">Application Not Found</h3>
        <p className="text-xs text-slate-500">
          No registered application matches ID: {merchantId}
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push('/admin/merchants')}
        >
          Return to Merchants List
        </Button>
      </div>
    );
  }

  const paymentColumns: Column<Payment>[] = [
    {
      key: 'reference',
      header: 'Reference',
      render: (p) => <span className="font-mono font-bold text-slate-900">{p.reference}</span>,
    },
    {
      key: 'amount',
      header: 'Amount',
      render: (p) => (
        <span className="font-mono text-slate-900 font-bold">
          {p.amount.toLocaleString()} {p.currency}
        </span>
      ),
    },
    {
      key: 'provider',
      header: 'Provider',
      render: (p) => <span>{p.provider || 'PawaPay'}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (p) => <StatusBadge status={p.status} />,
    },
    {
      key: 'createdAt',
      header: 'Timestamp',
      render: (p) => (
        <span className="text-xs font-mono text-slate-500">
          {new Date(p.createdAt).toLocaleString()}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Back link */}
      <div>
        <Link
          href="/admin/merchants"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="size-3.5" />
          <span>Back to All Merchants</span>
        </Link>
      </div>

      {/* Header Banner */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="size-12 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center shrink-0">
            <Building2 className="size-6" />
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl font-bold text-slate-900 font-sans tracking-tight">
                {merchant.name}
              </h1>
              <StatusBadge status={merchant.status} />
            </div>

            <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
              <span className="font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-700">
                slug: {merchant.slug}
              </span>
              <button
                type="button"
                onClick={handleCopyId}
                className="font-mono text-[11px] text-slate-400 hover:text-slate-700 inline-flex items-center gap-1 focus:outline-hidden"
              >
                <span>id: {merchant.id}</span>
                {copiedId ? (
                  <Check className="size-3 text-emerald-600" />
                ) : (
                  <Copy className="size-3" />
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          <PermissionGate permission="merchants.rotate_key" renderDisabled>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmAction('rotate')}
              className="h-8 text-xs bg-white border-slate-200 text-slate-700 hover:bg-slate-50 gap-1.5"
            >
              <KeyRound className="size-3.5" />
              <span>Rotate Key</span>
            </Button>
          </PermissionGate>

          {merchant.status === 'ACTIVE' ? (
            <PermissionGate permission="merchants.suspend" renderDisabled>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmAction('suspend')}
                className="h-8 text-xs text-rose-600 border-rose-200 bg-rose-50/50 hover:bg-rose-100 gap-1.5"
              >
                <AlertTriangle className="size-3.5" />
                <span>Suspend</span>
              </Button>
            </PermissionGate>
          ) : (
            <PermissionGate permission="merchants.suspend" renderDisabled>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmAction('reactivate')}
                className="h-8 text-xs text-emerald-600 border-emerald-200 bg-emerald-50/50 hover:bg-emerald-100 gap-1.5"
              >
                <CheckCircle2 className="size-3.5" />
                <span>Reactivate</span>
              </Button>
            </PermissionGate>
          )}
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 text-xs font-medium text-slate-500 overflow-x-auto">
        {[
          { key: 'overview', label: 'Overview' },
          { key: 'payments', label: `Payments (${payments.length})` },
          { key: 'sessions', label: `Checkout Sessions (${sessions.length})` },
          { key: 'credentials', label: 'API Credentials' },
          { key: 'audit', label: `Audit Logs (${auditLogs.length})` },
          { key: 'danger', label: 'Danger Zone' },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key as any)}
            className={`pb-3 px-3 border-b-2 font-medium transition-colors shrink-0 ${
              activeTab === tab.key
                ? 'border-slate-900 text-slate-900 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Application Profile
            </h3>
            <div className="divide-y divide-slate-100 text-xs">
              <div className="py-2.5 flex justify-between">
                <span className="text-slate-500">Legal Business Name</span>
                <span className="font-semibold text-slate-900">{merchant.name}</span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-slate-500">Application Identifier</span>
                <span className="font-mono text-slate-800">{merchant.slug}</span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-slate-500">Commercial Purpose</span>
                <span className="text-slate-700">{merchant.description || 'Not provided'}</span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-slate-500">Account Created</span>
                <span className="font-mono text-slate-800">
                  {new Date(merchant.createdAt).toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Webhook & Integration Setup
            </h3>
            <div className="divide-y divide-slate-100 text-xs">
              <div className="py-2.5 flex justify-between items-start gap-2">
                <span className="text-slate-500">Target Webhook URL</span>
                <span className="font-mono text-slate-800 text-right truncate max-w-[240px]">
                  {merchant.webhookUrl || 'None configured'}
                </span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-slate-500">Webhook Secret</span>
                <span className="font-mono text-slate-800">
                  {merchant.webhookSecret ? `${merchant.webhookSecret.substring(0, 10)}••••••••` : 'Default'}
                </span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-slate-500">Supported Currencies</span>
                <span className="font-mono font-semibold text-slate-800">TZS, KES, UGX</span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-slate-500">Gateway Corridors</span>
                <span className="text-slate-800">M-Pesa, Airtel Money, Tigo Pesa</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'payments' && (
        <DataTable
          columns={paymentColumns}
          data={payments}
          keyExtractor={(p) => p.id}
          emptyTitle="No transactions found for this application"
          emptyDescription="This merchant has not initiated any mobile money deposits or refunds yet."
        />
      )}

      {activeTab === 'sessions' && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <h3 className="text-sm font-bold text-slate-900 mb-3">
            Hosted Checkout Sessions ({sessions.length})
          </h3>
          {sessions.length === 0 ? (
            <p className="text-xs text-slate-500">No checkout sessions active.</p>
          ) : (
            <div className="divide-y divide-slate-100 text-xs">
              {sessions.map((s) => (
                <div key={s.id} className="py-3 flex items-center justify-between">
                  <div>
                    <span className="font-mono font-semibold text-slate-900">{s.reference}</span>
                    <div className="text-[11px] text-slate-400 font-mono">
                      Token: {s.publicToken.substring(0, 12)}••••••••
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-slate-900">
                      {s.amount.toLocaleString()} {s.currency}
                    </span>
                    <StatusBadge status={s.sessionStatus} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'credentials' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs max-w-2xl space-y-4">
          <h3 className="text-sm font-bold text-slate-900 font-sans">
            API Secret Credentials
          </h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            API credentials allow this application to initiate checkout sessions, query status, and trigger payouts. Plaintext keys are never stored in database records.
          </p>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-700">Active Key Prefix:</span>
              <span className="font-mono font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                {merchant.apiKeyPrefix}••••••••••••••••
              </span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Key Status:</span>
              <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                <CheckCircle2 className="size-3.5" />
                <span>Active & Authenticated</span>
              </span>
            </div>
          </div>

          <div className="pt-2">
            <PermissionGate permission="merchants.rotate_key" renderDisabled>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmAction('rotate')}
                className="text-xs bg-white border-slate-300 hover:bg-slate-50 text-slate-800 gap-1.5"
              >
                <KeyRound className="size-3.5" />
                <span>Rotate API Key</span>
              </Button>
            </PermissionGate>
          </div>
        </div>
      )}

      {activeTab === 'audit' && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <h3 className="text-sm font-bold text-slate-900 mb-3">
            Scoped Application Audit Trail ({auditLogs.length})
          </h3>
          {auditLogs.length === 0 ? (
            <p className="text-xs text-slate-500">No audit events recorded for this application.</p>
          ) : (
            <div className="divide-y divide-slate-100 text-xs">
              {auditLogs.map((log) => (
                <div key={log.id} className="py-3 flex items-center justify-between">
                  <div>
                    <span className="font-mono font-bold text-slate-900">{log.action}</span>
                    <div className="text-[11px] text-slate-500">by {log.actor}</div>
                  </div>
                  <span className="font-mono text-[11px] text-slate-400">
                    {new Date(log.createdAt).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'danger' && (
        <div className="bg-white rounded-xl border border-rose-200 p-6 shadow-xs max-w-2xl space-y-4">
          <div className="flex items-center gap-2 text-rose-700">
            <AlertTriangle className="size-5" />
            <h3 className="text-sm font-bold font-sans">Danger Zone</h3>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            High-impact administrative actions that affect transaction processing and customer checkout experience.
          </p>

          <div className="p-4 rounded-xl border border-rose-100 bg-rose-50/40 flex items-center justify-between gap-4">
            <div>
              <div className="text-xs font-bold text-slate-900">
                {merchant.status === 'ACTIVE' ? 'Suspend Merchant' : 'Reactivate Merchant'}
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {merchant.status === 'ACTIVE'
                  ? 'Temporarily block this merchant from processing transactions.'
                  : 'Restore normal checkout and payment operations.'}
              </p>
            </div>

            <PermissionGate permission="merchants.suspend" renderDisabled>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setConfirmAction(merchant.status === 'ACTIVE' ? 'suspend' : 'reactivate')
                }
                className={
                  merchant.status === 'ACTIVE'
                    ? 'h-8 text-xs bg-rose-600 hover:bg-rose-700 text-white border-none'
                    : 'h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white border-none'
                }
              >
                {merchant.status === 'ACTIVE' ? 'Suspend Application' : 'Reactivate Application'}
              </Button>
            </PermissionGate>
          </div>
        </div>
      )}

      {/* Modals */}
      {newKeyModal && (
        <DisplayOnceKeyModal
          isOpen={true}
          onClose={() => setNewKeyModal(null)}
          apiKey={newKeyModal.apiKey}
          applicationName={newKeyModal.appName}
        />
      )}

      {confirmAction && (
        <ConfirmDialog
          isOpen={true}
          onClose={() => setConfirmAction(null)}
          onConfirm={handleExecuteAction}
          title={
            confirmAction === 'suspend'
              ? `Suspend Application: ${merchant.name}?`
              : confirmAction === 'reactivate'
              ? `Reactivate Application: ${merchant.name}?`
              : `Rotate API Key for ${merchant.name}?`
          }
          description={
            confirmAction === 'suspend'
              ? 'Suspension immediately rejects all checkout creation and payment requests for this application.'
              : confirmAction === 'reactivate'
              ? 'Reactivation restores normal transaction processing for this merchant.'
              : 'Rotating credentials immediately invalidates the existing secret key.'
          }
          variant={confirmAction === 'suspend' ? 'destructive' : 'default'}
          requireReason={confirmAction === 'suspend'}
          confirmMatchString={confirmAction === 'rotate' ? merchant.slug : undefined}
          confirmText={
            confirmAction === 'suspend'
              ? 'Suspend Merchant'
              : confirmAction === 'reactivate'
              ? 'Reactivate Merchant'
              : 'Rotate & Invalidate Old Key'
          }
        />
      )}
    </div>
  );
}
