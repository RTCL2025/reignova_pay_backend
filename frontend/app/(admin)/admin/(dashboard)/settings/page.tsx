'use client';

import React, { useState } from 'react';
import {
  Settings,
  Shield,
  Layers,
  Globe,
  Lock,
  Save,
  Check,
  ShieldAlert,
  Users,
} from 'lucide-react';
import { PageHeader } from '@/components/admin/PageHeader';
import { PermissionDeniedBanner } from '@/components/admin/PermissionDeniedBanner';
import { PermissionGate } from '@/components/admin/PermissionGate';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAdminAuth } from '@/context/AdminAuthContext';
import { AdminRole } from '@/types/admin';

const RBAC_MATRIX = [
  {
    permission: 'merchants.read',
    description: 'View merchant applications, profiles, and configuration',
    roles: ['SUPER_ADMIN', 'OPERATIONS_ADMIN', 'FINANCE_ADMIN', 'AUDITOR', 'SUPPORT_AGENT'],
  },
  {
    permission: 'merchants.create',
    description: 'Provision and register new merchant tenant accounts',
    roles: ['SUPER_ADMIN', 'OPERATIONS_ADMIN'],
  },
  {
    permission: 'merchants.suspend',
    description: 'Temporarily halt or reactivate merchant transaction processing',
    roles: ['SUPER_ADMIN', 'OPERATIONS_ADMIN'],
  },
  {
    permission: 'merchants.rotate_key',
    description: 'Rotate API secret keys and invalidate compromised credentials',
    roles: ['SUPER_ADMIN', 'OPERATIONS_ADMIN'],
  },
  {
    permission: 'payments.read',
    description: 'Inspect live payment streams, references, and amounts',
    roles: ['SUPER_ADMIN', 'OPERATIONS_ADMIN', 'FINANCE_ADMIN', 'AUDITOR', 'SUPPORT_AGENT'],
  },
  {
    permission: 'payments.retry',
    description: 'Trigger manual carrier USSD push re-dispatch for failed deposits',
    roles: ['SUPER_ADMIN', 'OPERATIONS_ADMIN'],
  },
  {
    permission: 'refunds.read',
    description: 'Inspect customer dispute and payment reversal requests',
    roles: ['SUPER_ADMIN', 'OPERATIONS_ADMIN', 'FINANCE_ADMIN', 'AUDITOR'],
  },
  {
    permission: 'refunds.approve',
    description: 'Authorize wallet refund reversals and disburse settlement funds',
    roles: ['SUPER_ADMIN', 'FINANCE_ADMIN'],
  },
  {
    permission: 'payouts.create',
    description: 'Dispatch outgoing B2C mobile money bulk disbursements',
    roles: ['SUPER_ADMIN', 'FINANCE_ADMIN'],
  },
  {
    permission: 'audit_logs.read',
    description: 'Query immutable administrative audit logs and state diffs',
    roles: ['SUPER_ADMIN', 'OPERATIONS_ADMIN', 'FINANCE_ADMIN', 'AUDITOR'],
  },
  {
    permission: 'settings.update',
    description: 'Modify gateway timeouts, webhook secrets, and global RBAC policies',
    roles: ['SUPER_ADMIN'],
  },
];

export default function SettingsPage() {
  const { role, switchRole, hasPermission } = useAdminAuth();
  const [activeTab, setActiveTab] = useState<
    'platform' | 'providers' | 'webhooks' | 'rbac' | 'preview_denied'
  >('platform');
  const [isSaved, setIsSaved] = useState(false);

  const handleSave = () => {
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform & Security Settings"
        description="Configure settlement corridors, gateway webhooks, role-based access policies, and audit retention rules."
        actions={
          <PermissionGate permission="settings.update" renderDisabled>
            <Button
              size="sm"
              onClick={handleSave}
              className="h-8 text-xs bg-slate-900 hover:bg-slate-800 text-white font-semibold gap-1.5 shadow-xs"
            >
              {isSaved ? <Check className="size-3.5 text-emerald-400" /> : <Save className="size-3.5" />}
              <span>{isSaved ? 'Changes Saved' : 'Save Changes'}</span>
            </Button>
          </PermissionGate>
        }
      />

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 text-xs font-medium text-slate-500 overflow-x-auto">
        {[
          { key: 'platform', label: 'Platform Config' },
          { key: 'providers', label: 'Gateway Corridors' },
          { key: 'webhooks', label: 'Webhook Engine' },
          { key: 'rbac', label: 'Roles & Permissions (RBAC)' },
          { key: 'preview_denied', label: '403 Forbidden State Preview' },
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

      {/* Tab: Platform Config */}
      {activeTab === 'platform' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs max-w-3xl space-y-5">
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-slate-900">Service Core Configuration</h3>
            <p className="text-xs text-slate-500">Global defaults applied across all tenant applications</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Platform Service Name</Label>
              <Input
                defaultValue="Reignova Payment Microservice"
                className="h-9 text-xs bg-slate-50 border-slate-200"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Primary Currency</Label>
              <Input
                defaultValue="TZS (Tanzanian Shilling)"
                className="h-9 text-xs font-mono bg-slate-50 border-slate-200"
                disabled
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Hosted Session Expiry</Label>
              <Input
                defaultValue="60 minutes"
                className="h-9 text-xs font-mono bg-slate-50 border-slate-200"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Max Inbound Deposit Retries</Label>
              <Input
                defaultValue="3 attempts"
                className="h-9 text-xs font-mono bg-slate-50 border-slate-200"
              />
            </div>
          </div>
        </div>
      )}

      {/* Tab: Gateway Corridors */}
      {activeTab === 'providers' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs max-w-3xl space-y-5">
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-slate-900">PawaPay Integration Engine</h3>
            <p className="text-xs text-slate-500">Live corridor health and mobile network aggregator status</p>
          </div>

          <div className="space-y-3">
            {[
              { corridor: 'Vodacom M-Pesa (TZA)', code: 'VODACOM_TZN', status: 'Online', latency: '1.8s' },
              { corridor: 'Airtel Money (TZA)', code: 'AIRTEL_TZN', status: 'Online', latency: '2.1s' },
              { corridor: 'Tigo Pesa (TZA)', code: 'TIGO_TZN', status: 'Online', latency: '2.4s' },
              { corridor: 'Halotel Money (TZA)', code: 'HALOTEL_TZN', status: 'Online', latency: '2.9s' },
            ].map((c) => (
              <div
                key={c.code}
                className="p-3.5 rounded-lg border border-slate-200 flex items-center justify-between text-xs"
              >
                <div>
                  <div className="font-semibold text-slate-900">{c.corridor}</div>
                  <div className="text-[11px] font-mono text-slate-400">{c.code}</div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-slate-500">{c.latency}</span>
                  <span className="inline-flex items-center gap-1 font-mono text-[11px] text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 font-semibold">
                    <span className="size-1.5 rounded-full bg-emerald-500" />
                    <span>{c.status}</span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab: Webhook Engine */}
      {activeTab === 'webhooks' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs max-w-3xl space-y-5">
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-slate-900">Webhook Dispatch Policy</h3>
            <p className="text-xs text-slate-500">HMAC signature and retry backoff parameters</p>
          </div>

          <div className="space-y-4 text-xs">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <span className="font-semibold text-slate-800">Signature Algorithm:</span>
              <p className="text-slate-600 font-mono text-[11px]">HMAC-SHA256 (Header: X-Reignova-Signature)</p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <span className="font-semibold text-slate-800">Retry Schedule:</span>
              <p className="text-slate-600 text-[11px]">
                Exponential backoff: Immediate, 5m, 15m, 1h, 6h, 24h before dead-letter quarantine.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Roles & Permissions Matrix */}
      {activeTab === 'rbac' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-900">Access Control Matrix (RBAC)</h3>
              <p className="text-xs text-slate-500">
                Permission assignments across all 5 administrative personas
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-medium">Switch Active Persona:</span>
              <select
                value={role}
                onChange={(e) => switchRole(e.target.value as AdminRole)}
                className="h-8 px-2 text-xs bg-slate-50 border border-slate-200 rounded-md font-semibold text-slate-900 cursor-pointer"
              >
                <option value="SUPER_ADMIN">Super Admin</option>
                <option value="OPERATIONS_ADMIN">Operations Admin</option>
                <option value="FINANCE_ADMIN">Finance Admin</option>
                <option value="AUDITOR">Auditor</option>
                <option value="SUPPORT_AGENT">Support Agent</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/75 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-2.5 px-3">Permission Token</th>
                  <th className="py-2.5 px-3">Description</th>
                  <th className="py-2.5 px-3 text-center">Super Admin</th>
                  <th className="py-2.5 px-3 text-center">Operations</th>
                  <th className="py-2.5 px-3 text-center">Finance</th>
                  <th className="py-2.5 px-3 text-center">Auditor</th>
                  <th className="py-2.5 px-3 text-center">Support</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {RBAC_MATRIX.map((item) => (
                  <tr key={item.permission} className="hover:bg-slate-50/60">
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                      {item.permission}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">{item.description}</td>
                    {['SUPER_ADMIN', 'OPERATIONS_ADMIN', 'FINANCE_ADMIN', 'AUDITOR', 'SUPPORT_AGENT'].map(
                      (r) => {
                        const hasIt = item.roles.includes(r);
                        return (
                          <td key={r} className="py-2.5 px-3 text-center">
                            {hasIt ? (
                              <span className="inline-flex items-center justify-center size-5 rounded-full bg-emerald-50 text-emerald-700 font-bold border border-emerald-200 text-[10px]">
                                ✓
                              </span>
                            ) : (
                              <span className="text-slate-300 font-mono">—</span>
                            )}
                          </td>
                        );
                      }
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: 403 Forbidden State Preview */}
      {activeTab === 'preview_denied' && (
        <div className="space-y-4">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900">
            <strong>Demonstration State:</strong> This preview showcases how restricted actions and unauthorized pages are presented when an administrative persona lacks necessary permissions.
          </div>

          <PermissionDeniedBanner
            requiredPermission={['settings.update', 'credentials.rotate']}
            actionTitle="Gateway Master Secret Key Re-issuance"
            onReturn={() => setActiveTab('rbac')}
          />
        </div>
      )}
    </div>
  );
}
