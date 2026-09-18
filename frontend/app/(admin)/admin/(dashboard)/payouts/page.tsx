'use client';

import React, { useState, useEffect } from 'react';
import { Send, RefreshCw, CheckCircle2, Download } from 'lucide-react';
import { PageHeader } from '@/components/admin/PageHeader';
import { DataTable, Column } from '@/components/admin/DataTable';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { DetailsDrawer } from '@/components/admin/DetailsDrawer';
import { Button } from '@/components/ui/button';
import { adminApiClient } from '@/lib/admin-api';
import { Payout } from '@/types/admin';

export default function PayoutsManagementPage() {
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPayout, setSelectedPayout] = useState<Payout | null>(null);

  const loadPayouts = async () => {
    setIsLoading(true);
    try {
      const res = await adminApiClient.payouts.list();
      setPayouts(res.payouts);
      setTotal(res.total);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPayouts();
  }, []);

  const columns: Column<Payout>[] = [
    {
      key: 'id',
      header: 'Payout ID',
      sortable: true,
      render: (p) => <span className="font-mono text-xs font-semibold text-slate-900">{p.id}</span>,
    },
    {
      key: 'applicationName',
      header: 'Merchant Application',
      sortable: true,
      render: (p) => <span className="font-semibold text-slate-800 text-xs">{p.applicationName}</span>,
    },
    {
      key: 'recipientName',
      header: 'Beneficiary Name',
      render: (p) => <span className="text-xs text-slate-900 font-medium">{p.recipientName}</span>,
    },
    {
      key: 'recipientPhone',
      header: 'Recipient Wallet',
      render: (p) => (
        <span className="font-mono text-xs text-slate-500">
          {p.recipientPhone ? `${p.recipientPhone.substring(0, 5)} ••• ••${p.recipientPhone.slice(-2)}` : '—'}
        </span>
      ),
    },
    {
      key: 'amount',
      header: 'Disbursed Amount',
      sortable: true,
      render: (p) => (
        <span className="font-mono font-bold text-slate-900 text-xs">
          {p.amount.toLocaleString()} {p.currency}
        </span>
      ),
    },
    {
      key: 'provider',
      header: 'Telco Provider',
      render: (p) => <span className="text-xs text-slate-700">{p.provider}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (p) => <StatusBadge status={p.status} />,
    },
    {
      key: 'createdAt',
      header: 'Dispatched At',
      sortable: true,
      render: (p) => (
        <span className="font-mono text-xs text-slate-500">
          {new Date(p.createdAt).toLocaleDateString()}{' '}
          {new Date(p.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Action',
      className: 'text-right',
      render: (p) => (
        <Button
          variant="outline"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            setSelectedPayout(p);
          }}
          className="h-7 px-2.5 text-xs text-slate-700 bg-white border-slate-200 hover:bg-slate-50"
        >
          Inspect
        </Button>
      ),
    },
  ];

  const drawerRows = selectedPayout
    ? [
        { label: 'Payout ID', value: selectedPayout.id, copyable: selectedPayout.id, isMono: true },
        { label: 'Merchant Application', value: selectedPayout.applicationName },
        { label: 'Beneficiary Name', value: selectedPayout.recipientName },
        { label: 'Recipient Phone', value: selectedPayout.recipientPhone, isMono: true },
        {
          label: 'Disbursed Amount',
          value: `${selectedPayout.amount.toLocaleString()} ${selectedPayout.currency}`,
          isMono: true,
        },
        { label: 'Provider Corridor', value: selectedPayout.provider },
        {
          label: 'Initiated At',
          value: new Date(selectedPayout.createdAt).toLocaleString(),
          isMono: true,
        },
        {
          label: 'Settled At',
          value: new Date(selectedPayout.updatedAt).toLocaleString(),
          isMono: true,
        },
      ]
    : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mobile Money Payouts"
        description="Monitor outgoing B2C disbursements, subcontractor driver settlements, and vendor wallet transfers across carrier networks."
        badge={
          <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
            {total} Disbursements
          </span>
        }
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadPayouts}
              disabled={isLoading}
              className="h-8 text-xs bg-white border-slate-200 text-slate-700 hover:bg-slate-50 gap-1.5"
            >
              <RefreshCw className={`size-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </Button>
          </div>
        }
      />

      <DataTable
        columns={columns}
        data={payouts}
        isLoading={isLoading}
        keyExtractor={(p) => p.id}
        onRowClick={(p) => setSelectedPayout(p)}
        emptyTitle="No payouts recorded"
        emptyDescription="There are currently no outgoing mobile money payouts."
      />

      <DetailsDrawer
        isOpen={!!selectedPayout}
        onClose={() => setSelectedPayout(null)}
        title={selectedPayout?.id || 'Payout Inspector'}
        subtitle="B2C Mobile Money Settlement"
        badge={selectedPayout && <StatusBadge status={selectedPayout.status} />}
        rows={drawerRows}
        rawJson={selectedPayout as any}
      />
    </div>
  );
}
