'use client';

import React, { useState, useEffect } from 'react';
import { Layers, RefreshCw, Eye } from 'lucide-react';
import { PageHeader } from '@/components/admin/PageHeader';
import { DataTable, Column } from '@/components/admin/DataTable';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { DetailsDrawer } from '@/components/admin/DetailsDrawer';
import { SessionTraceabilityCard } from '@/components/admin/SessionTraceabilityCard';
import { Button } from '@/components/ui/button';
import { adminApiClient } from '@/lib/admin-api';
import { CheckoutSession } from '@/types/admin';

export default function CheckoutSessionsPage() {
  const [sessions, setSessions] = useState<CheckoutSession[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<CheckoutSession | null>(null);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const loadSessions = async (targetPage = page, targetPageSize = pageSize) => {
    setIsLoading(true);
    try {
      const res = await adminApiClient.checkoutSessions.list(targetPage, targetPageSize);
      setSessions(res.sessions);
      setTotal(res.total);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSessions(page, pageSize);
  }, [page, pageSize]);

  const columns: Column<CheckoutSession>[] = [
    {
      key: 'reference',
      header: 'Session Reference',
      sortable: true,
      render: (s) => (
        <div className="flex flex-col">
          <span className="font-mono font-bold text-slate-900">{s.reference}</span>
          <span className="font-mono text-[11px] text-slate-400 select-none">
            {s.publicToken ? `${s.publicToken.substring(0, 10)}••••••••` : '—'}
          </span>
        </div>
      ),
    },
    {
      key: 'applicationName',
      header: 'Merchant',
      sortable: true,
      render: (s) => <span className="font-semibold text-slate-800 text-xs">{s.applicationName}</span>,
    },
    {
      key: 'amount',
      header: 'Amount',
      sortable: true,
      render: (s) => (
        <span className="font-mono font-bold text-slate-900 text-xs">
          {s.amount.toLocaleString()} {s.currency}
        </span>
      ),
    },
    {
      key: 'customerName',
      header: 'Customer Details',
      render: (s) => (
        <div className="flex flex-col text-xs text-slate-600">
          <span className="font-medium text-slate-800">{s.customerName || 'Anonymous Customer'}</span>
          <span className="text-[11px] text-slate-400 truncate max-w-[150px]">{s.customerEmail || s.customerPhone || '—'}</span>
        </div>
      ),
    },
    {
      key: 'sessionStatus',
      header: 'Session Status',
      sortable: true,
      render: (s) => <StatusBadge status={s.sessionStatus} />,
    },
    {
      key: 'paymentStatus',
      header: 'Payment Status',
      sortable: true,
      render: (s) => <StatusBadge status={s.paymentStatus} />,
    },
    {
      key: 'expiresAt',
      header: 'Expiration',
      render: (s) => (
        <span className="font-mono text-xs text-slate-500">
          {new Date(s.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Action',
      className: 'text-right',
      render: (s) => (
        <Button
          variant="outline"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            setSelectedSession(s);
          }}
          className="h-7 px-2.5 text-xs text-slate-700 bg-white border-slate-200 hover:bg-slate-50"
        >
          Trace
        </Button>
      ),
    },
  ];

  const drawerRows = selectedSession
    ? [
        { label: 'Session ID', value: selectedSession.id, copyable: selectedSession.id, isMono: true },
        { label: 'Merchant', value: selectedSession.applicationName },
        { label: 'Reference', value: selectedSession.reference, copyable: selectedSession.reference, isMono: true },
        {
          label: 'Total Intent',
          value: `${selectedSession.amount.toLocaleString()} ${selectedSession.currency}`,
          isMono: true,
        },
        { label: 'Customer Name', value: selectedSession.customerName || 'None provided' },
        { label: 'Customer Phone', value: selectedSession.customerPhone || 'None provided', isMono: true },
        {
          label: 'Masked Token',
          value: `${selectedSession.publicToken.substring(0, 10)}••••••••••••••••`,
          isMono: true,
        },
        {
          label: 'Created At',
          value: new Date(selectedSession.createdAt).toLocaleString(),
          isMono: true,
        },
        {
          label: 'Expires At',
          value: new Date(selectedSession.expiresAt).toLocaleString(),
          isMono: true,
        },
      ]
    : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Checkout Sessions"
        description="Monitor hosted checkout sessions, inspect token lifecycles, and audit session-to-payment conversion rates."
        badge={
          <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
            {total} Sessions
          </span>
        }
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadSessions()}
            disabled={isLoading}
            className="h-8 text-xs bg-white border-slate-200 text-slate-700 hover:bg-slate-50 gap-1.5"
          >
            <RefreshCw className={`size-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={sessions}
        isLoading={isLoading}
        keyExtractor={(s) => s.id}
        onRowClick={(s) => setSelectedSession(s)}
        currentPage={page}
        onPageChange={setPage}
        pageSize={pageSize}
        onPageSizeChange={(newSize) => {
          setPageSize(newSize);
          setPage(1);
        }}
        totalCount={total}
        emptyTitle="No checkout sessions recorded"
        emptyDescription="There are currently no active or expired checkout sessions."
      />

      <DetailsDrawer
        isOpen={!!selectedSession}
        onClose={() => setSelectedSession(null)}
        title={selectedSession?.reference || 'Checkout Session Trace'}
        subtitle={`Hosted Session • ${selectedSession?.applicationName}`}
        badge={selectedSession && <StatusBadge status={selectedSession.sessionStatus} />}
        rows={drawerRows}
        rawJson={selectedSession as any}
      >
        {selectedSession && (
          <div className="pt-2 border-t border-slate-100">
            <SessionTraceabilityCard session={selectedSession} />
          </div>
        )}
      </DetailsDrawer>
    </div>
  );
}
