'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  CreditCard,
  Download,
  RefreshCw,
  Search,
  SlidersHorizontal,
  ExternalLink,
} from 'lucide-react';
import { PageHeader } from '@/components/admin/PageHeader';
import { DataTable, Column } from '@/components/admin/DataTable';
import { DataTableToolbar } from '@/components/admin/DataTableToolbar';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { PaymentDetailsDrawer } from '@/components/admin/PaymentDetailsDrawer';
import { Button } from '@/components/ui/button';
import { adminApiClient } from '@/lib/admin-api';
import { Payment } from '@/types/admin';

export default function PaymentsMonitoringPage() {
  const searchParams = useSearchParams();
  const initialRef = searchParams.get('ref') || '';

  const [payments, setPayments] = useState<Payment[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState(initialRef);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);

  const loadPayments = async () => {
    setIsLoading(true);
    try {
      const res = await adminApiClient.payments.list();
      setPayments(res.payments);
      setTotal(res.total);

      if (initialRef) {
        const found = res.payments.find((p) => p.reference === initialRef);
        if (found) setSelectedPayment(found);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPayments();
  }, [initialRef]);

  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      const matchesStatus = statusFilter === 'ALL' || p.status === statusFilter;
      const q = search.toLowerCase();
      const matchesSearch =
        !search ||
        p.reference.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q) ||
        p.phoneNumber.includes(q) ||
        (p.applicationName && p.applicationName.toLowerCase().includes(q));
      return matchesStatus && matchesSearch;
    });
  }, [payments, search, statusFilter]);

  const handleExportCSV = () => {
    const headers = 'ID,Reference,Application,Amount,Currency,Status,Provider,Phone,Date\n';
    const rows = filteredPayments
      .map(
        (p) =>
          `"${p.id}","${p.reference}","${p.applicationName || p.applicationId}",${p.amount},"${p.currency}","${p.status}","${p.provider || ''}","${p.phoneNumber}","${p.createdAt}"`
      )
      .join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reignova-payments-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const columns: Column<Payment>[] = [
    {
      key: 'reference',
      header: 'Reference / ID',
      sortable: true,
      render: (p) => (
        <div className="flex flex-col">
          <span className="font-mono font-bold text-slate-900 hover:underline cursor-pointer">
            {p.reference}
          </span>
          <span className="font-mono text-[11px] text-slate-400 truncate max-w-[140px]">
            {p.id}
          </span>
        </div>
      ),
    },
    {
      key: 'applicationName',
      header: 'Merchant',
      sortable: true,
      render: (p) => (
        <span className="font-semibold text-slate-800 text-xs">
          {p.applicationName || 'Default Application'}
        </span>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      sortable: true,
      render: (p) => (
        <span className="font-mono font-bold text-slate-900 text-xs">
          {p.amount.toLocaleString()} {p.currency}
        </span>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      render: (p) => (
        <span className="font-mono text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
          {p.type}
        </span>
      ),
    },
    {
      key: 'provider',
      header: 'Carrier / Provider',
      render: (p) => <span className="text-xs text-slate-700">{p.provider || 'PawaPay'}</span>,
    },
    {
      key: 'phoneNumber',
      header: 'Customer Handset',
      render: (p) => (
        <span className="font-mono text-xs text-slate-500">
          {p.phoneNumber ? `${p.phoneNumber.substring(0, 5)} ••• ••${p.phoneNumber.slice(-2)}` : '—'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (p) => <StatusBadge status={p.status} />,
    },
    {
      key: 'createdAt',
      header: 'Timestamp',
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
            setSelectedPayment(p);
          }}
          className="h-7 px-2.5 text-xs text-slate-700 bg-white border-slate-200 hover:bg-slate-50"
        >
          Inspect
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payment Monitoring"
        description="Inspect incoming deposits, mobile money push requests, settlement timelines, and carrier failure diagnostics."
        badge={
          <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
            {total} Total Transactions
          </span>
        }
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadPayments}
              disabled={isLoading}
              className="h-8 text-xs bg-white border-slate-200 text-slate-700 hover:bg-slate-50 gap-1.5"
            >
              <RefreshCw className={`size-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              className="h-8 text-xs bg-white border-slate-200 text-slate-700 hover:bg-slate-50 gap-1.5"
            >
              <Download className="size-3.5" />
              <span>Export CSV</span>
            </Button>
          </div>
        }
      />

      <DataTableToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Filter by reference, ID, phone, or merchant..."
        statusFilter={{
          value: statusFilter,
          options: [
            { label: 'All Statuses', value: 'ALL' },
            { label: 'Completed Only', value: 'COMPLETED' },
            { label: 'Processing / USSD Pending', value: 'PROCESSING' },
            { label: 'Failed Transactions', value: 'FAILED' },
          ],
          onChange: setStatusFilter,
        }}
        hasActiveFilters={search !== '' || statusFilter !== 'ALL'}
        onReset={() => {
          setSearch('');
          setStatusFilter('ALL');
        }}
      />

      <DataTable
        columns={columns}
        data={filteredPayments}
        isLoading={isLoading}
        keyExtractor={(p) => p.id}
        onRowClick={(p) => setSelectedPayment(p)}
        emptyTitle="No payments match criteria"
        emptyDescription="Try adjusting your status filter or search parameters."
      />

      {/* Payment Inspector Drawer */}
      <PaymentDetailsDrawer
        payment={selectedPayment}
        isOpen={!!selectedPayment}
        onClose={() => setSelectedPayment(null)}
      />
    </div>
  );
}
