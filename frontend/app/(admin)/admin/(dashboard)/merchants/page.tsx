'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Building2,
  Plus,
  RefreshCw,
  ExternalLink,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  Shield,
  KeyRound,
} from 'lucide-react';
import { PageHeader } from '@/components/admin/PageHeader';
import { DataTable, Column } from '@/components/admin/DataTable';
import { DataTableToolbar } from '@/components/admin/DataTableToolbar';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { AddMerchantModal } from '@/components/admin/AddMerchantModal';
import { DisplayOnceKeyModal } from '@/components/admin/DisplayOnceKeyModal';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { PermissionGate } from '@/components/admin/PermissionGate';
import { Button } from '@/components/ui/button';
import { adminApiClient } from '@/lib/admin-api';
import { Application } from '@/types/admin';

export default function MerchantsListPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [merchants, setMerchants] = useState<Application[]>([]);
  const [total, setTotal] = useState(0);
  const [isLive, setIsLive] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modals
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newKeyModal, setNewKeyModal] = useState<{ apiKey: string; appName: string } | null>(null);

  // Actions confirm modal
  const [confirmAction, setConfirmAction] = useState<{
    type: 'suspend' | 'reactivate' | 'rotate';
    merchant: Application;
  } | null>(null);

  useEffect(() => {
    if (searchParams.get('action') === 'add') {
      setIsAddOpen(true);
    }
  }, [searchParams]);

  const loadMerchants = async () => {
    setIsLoading(true);
    try {
      const res = await adminApiClient.merchants.list(1, 50);
      setMerchants(res.applications);
      setTotal(res.total);
      setIsLive(res.isLive);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMerchants();
  }, []);

  const handleCreated = (created: Application, generatedKey: string) => {
    setMerchants((prev) => [created, ...prev]);
    setTotal((t) => t + 1);
    setNewKeyModal({ apiKey: generatedKey, appName: created.name });
  };

  const handleExecuteAction = async (reason?: string) => {
    if (!confirmAction) return;
    const { type, merchant } = confirmAction;

    if (type === 'suspend') {
      await adminApiClient.merchants.suspend(merchant.id, reason);
      setMerchants((prev) =>
        prev.map((m) => (m.id === merchant.id ? { ...m, status: 'SUSPENDED' } : m))
      );
    } else if (type === 'reactivate') {
      await adminApiClient.merchants.reactivate(merchant.id);
      setMerchants((prev) =>
        prev.map((m) => (m.id === merchant.id ? { ...m, status: 'ACTIVE' } : m))
      );
    } else if (type === 'rotate') {
      const res = await adminApiClient.merchants.rotateKey(merchant.id);
      setMerchants((prev) =>
        prev.map((m) =>
          m.id === merchant.id ? { ...m, apiKeyPrefix: res.apiKeyPrefix } : m
        )
      );
      setNewKeyModal({ apiKey: res.apiKey, appName: merchant.name });
    }
  };

  // Filtered data
  const filteredMerchants = useMemo(() => {
    return merchants.filter((m) => {
      const matchesStatus = statusFilter === 'ALL' || m.status === statusFilter;
      const q = search.toLowerCase();
      const matchesSearch =
        !search ||
        m.name.toLowerCase().includes(q) ||
        m.slug.toLowerCase().includes(q) ||
        m.apiKeyPrefix.toLowerCase().includes(q);
      return matchesStatus && matchesSearch;
    });
  }, [merchants, search, statusFilter]);

  const columns: Column<Application>[] = [
    {
      key: 'name',
      header: 'Application / Merchant',
      sortable: true,
      render: (m) => (
        <div className="flex flex-col">
          <span className="font-semibold text-slate-900 font-sans hover:underline cursor-pointer">
            {m.name}
          </span>
          {m.description && (
            <span className="text-[11px] text-slate-500 max-w-sm truncate mt-0.5">
              {m.description}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'slug',
      header: 'Slug',
      sortable: true,
      render: (m) => (
        <span className="font-mono text-xs text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200/80">
          {m.slug}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (m) => <StatusBadge status={m.status} />,
    },
    {
      key: 'apiKeyPrefix',
      header: 'Key Prefix',
      render: (m) => (
        <span className="font-mono text-xs text-slate-700 font-medium">
          {m.apiKeyPrefix}••••••••
        </span>
      ),
    },
    {
      key: 'webhookUrl',
      header: 'Webhook URL',
      render: (m) =>
        m.webhookUrl ? (
          <span className="text-xs text-slate-500 font-mono truncate max-w-[180px] inline-block" title={m.webhookUrl}>
            {m.webhookUrl}
          </span>
        ) : (
          <span className="text-slate-400 text-xs italic">None configured</span>
        ),
    },
    {
      key: 'createdAt',
      header: 'Registered',
      sortable: true,
      render: (m) => (
        <span className="text-xs font-mono text-slate-500">
          {new Date(m.createdAt).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      className: 'text-right',
      render: (m) => (
        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
          <PermissionGate permission="merchants.rotate_key" renderDisabled>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirmAction({ type: 'rotate', merchant: m })}
              title="Rotate API Key"
              className="h-7 px-2 text-xs text-slate-600 hover:text-slate-900"
            >
              <KeyRound className="size-3.5" />
            </Button>
          </PermissionGate>

          {m.status === 'ACTIVE' ? (
            <PermissionGate permission="merchants.suspend" renderDisabled>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirmAction({ type: 'suspend', merchant: m })}
                title="Suspend Application"
                className="h-7 px-2 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50"
              >
                <AlertTriangle className="size-3.5" />
              </Button>
            </PermissionGate>
          ) : (
            <PermissionGate permission="merchants.suspend" renderDisabled>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirmAction({ type: 'reactivate', merchant: m })}
                title="Reactivate Application"
                className="h-7 px-2 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
              >
                <CheckCircle2 className="size-3.5" />
              </Button>
            </PermissionGate>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/admin/merchants/${m.id}`)}
            className="h-7 px-2 text-xs text-slate-700 bg-white border-slate-200 hover:bg-slate-50"
          >
            Inspect
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Merchants & Applications"
        description="Provision, monitor, and enforce access controls on multi-tenant merchants integrated with Reignova Payment Service."
        badge={
          <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
            {total} Applications
          </span>
        }
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadMerchants}
              disabled={isLoading}
              className="h-8 text-xs bg-white border-slate-200 text-slate-700 hover:bg-slate-50 gap-1.5"
            >
              <RefreshCw className={`size-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </Button>

            <PermissionGate permission="merchants.create" renderDisabled>
              <Button
                size="sm"
                onClick={() => setIsAddOpen(true)}
                className="h-8 text-xs bg-slate-900 hover:bg-slate-800 text-white font-semibold gap-1.5 shadow-xs"
              >
                <Plus className="size-3.5" />
                <span>Add Merchant</span>
              </Button>
            </PermissionGate>
          </div>
        }
      />

      {/* Backend Mode Indicator */}
      <div className="flex items-center justify-between px-4 py-2.5 rounded-lg border bg-white text-xs border-slate-200">
        <div className="flex items-center gap-2">
          <span className={`size-2 rounded-full ${isLive ? 'bg-emerald-500' : 'bg-amber-500'}`} />
          <span className="font-medium text-slate-700">
            {isLive ? 'Connected to Live PostgreSQL Database' : 'Fallback Dataset Active (Backend Disconnected)'}
          </span>
        </div>
        <span className="text-slate-400 font-mono text-[11px]">
          Route: /api/v1/admin/applications
        </span>
      </div>

      {/* Toolbar */}
      <DataTableToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Filter by name, slug, or key prefix..."
        statusFilter={{
          value: statusFilter,
          options: [
            { label: 'All Statuses', value: 'ALL' },
            { label: 'Active Only', value: 'ACTIVE' },
            { label: 'Suspended', value: 'SUSPENDED' },
            { label: 'Revoked', value: 'REVOKED' },
          ],
          onChange: setStatusFilter,
        }}
        hasActiveFilters={search !== '' || statusFilter !== 'ALL'}
        onReset={() => {
          setSearch('');
          setStatusFilter('ALL');
        }}
      />

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={filteredMerchants}
        isLoading={isLoading}
        keyExtractor={(m) => m.id}
        onRowClick={(m) => router.push(`/admin/merchants/${m.id}`)}
        emptyTitle="No merchants match criteria"
        emptyDescription="Try adjusting your status filter or search query to locate the application."
      />

      {/* Add Merchant Wizard Modal */}
      <AddMerchantModal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        onSuccess={handleCreated}
      />

      {/* Display Once Modal */}
      {newKeyModal && (
        <DisplayOnceKeyModal
          isOpen={true}
          onClose={() => setNewKeyModal(null)}
          apiKey={newKeyModal.apiKey}
          applicationName={newKeyModal.appName}
        />
      )}

      {/* Confirmation Dialog for Destructive / High-risk Actions */}
      {confirmAction && (
        <ConfirmDialog
          isOpen={true}
          onClose={() => setConfirmAction(null)}
          onConfirm={handleExecuteAction}
          title={
            confirmAction.type === 'suspend'
              ? `Suspend Merchant: ${confirmAction.merchant.name}?`
              : confirmAction.type === 'reactivate'
              ? `Reactivate Merchant: ${confirmAction.merchant.name}?`
              : `Rotate API Secret Key for ${confirmAction.merchant.name}?`
          }
          description={
            confirmAction.type === 'suspend'
              ? 'Suspension immediately rejects all checkout creation and payment requests for this application.'
              : confirmAction.type === 'reactivate'
              ? 'Reactivation restores normal transaction processing for this merchant.'
              : 'Rotating credentials immediately invalidates the existing secret key. Any client services using the previous key will fail authentication.'
          }
          variant={confirmAction.type === 'suspend' ? 'destructive' : 'default'}
          requireReason={confirmAction.type === 'suspend'}
          confirmMatchString={confirmAction.type === 'rotate' ? confirmAction.merchant.slug : undefined}
          confirmText={
            confirmAction.type === 'suspend'
              ? 'Suspend Merchant'
              : confirmAction.type === 'reactivate'
              ? 'Reactivate Merchant'
              : 'Rotate & Invalidate Old Key'
          }
        />
      )}
    </div>
  );
}
