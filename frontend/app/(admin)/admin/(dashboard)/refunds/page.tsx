'use client';

import React, { useState, useEffect } from 'react';
import { RotateCcw, Check, X, RefreshCw } from 'lucide-react';
import { PageHeader } from '@/components/admin/PageHeader';
import { DataTable, Column } from '@/components/admin/DataTable';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { RefundApprovalModal } from '@/components/admin/RefundApprovalModal';
import { RefundRejectModal } from '@/components/admin/RefundRejectModal';
import { PermissionGate } from '@/components/admin/PermissionGate';
import { Button } from '@/components/ui/button';
import { adminApiClient } from '@/lib/admin-api';
import { Refund } from '@/types/admin';

export default function RefundsOperationsPage() {
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Modals
  const [approveRefund, setApproveRefund] = useState<Refund | null>(null);
  const [rejectRefund, setRejectRefund] = useState<Refund | null>(null);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const loadRefunds = async (targetPage = page, targetPageSize = pageSize) => {
    setIsLoading(true);
    try {
      const res = await adminApiClient.refunds.list(targetPage, targetPageSize);
      setRefunds(res.refunds);
      setTotal(res.total);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRefunds(page, pageSize);
  }, [page, pageSize]);

  const handleApproveConfirm = async () => {
    if (!approveRefund) return;
    await adminApiClient.refunds.approve(approveRefund.id);
    setRefunds((prev) =>
      prev.map((r) => (r.id === approveRefund.id ? { ...r, status: 'APPROVED' } : r))
    );
  };

  const handleRejectConfirm = async (reason: string) => {
    if (!rejectRefund) return;
    await adminApiClient.refunds.reject(rejectRefund.id, reason);
    setRefunds((prev) =>
      prev.map((r) =>
        r.id === rejectRefund.id ? { ...r, status: 'REJECTED', rejectionReason: reason } : r
      )
    );
  };

  const columns: Column<Refund>[] = [
    {
      key: 'id',
      header: 'Refund ID',
      sortable: true,
      render: (r) => (
        <span className="font-mono text-xs font-semibold text-slate-900">
          {r.id}
        </span>
      ),
    },
    {
      key: 'originalPaymentRef',
      header: 'Original Payment',
      render: (r) => (
        <span className="font-mono text-xs text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
          {r.originalPaymentRef}
        </span>
      ),
    },
    {
      key: 'applicationName',
      header: 'Merchant',
      sortable: true,
      render: (r) => <span className="font-semibold text-slate-800 text-xs">{r.applicationName}</span>,
    },
    {
      key: 'amount',
      header: 'Amount',
      sortable: true,
      render: (r) => (
        <span className="font-mono font-bold text-slate-900 text-xs">
          {r.amount.toLocaleString()} {r.currency}
        </span>
      ),
    },
    {
      key: 'reason',
      header: 'Reason',
      render: (r) => (
        <span className="text-xs text-slate-600 max-w-xs truncate inline-block" title={r.reason}>
          {r.reason}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (r) => <StatusBadge status={r.status} />,
    },
    {
      key: 'requestedBy',
      header: 'Requested By',
      render: (r) => (
        <div className="flex flex-col text-xs text-slate-500 font-mono">
          <span>{r.requestedBy}</span>
          {r.approvedBy && (
            <span className="text-[10px] text-emerald-700">Appr: {r.approvedBy}</span>
          )}
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      className: 'text-right',
      render: (r) => {
        const isPending = r.status === 'UNDER_REVIEW' || r.status === 'REQUESTED';
        if (!isPending) {
          return (
            <span className="text-xs text-slate-400 font-mono">
              {r.status === 'APPROVED' || r.status === 'COMPLETED' ? 'Settled' : 'Closed'}
            </span>
          );
        }

        return (
          <div className="flex items-center justify-end gap-1.5">
            <PermissionGate permission="refunds.approve" renderDisabled>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setApproveRefund(r)}
                className="h-7 px-2 text-xs text-emerald-700 border-emerald-200 bg-emerald-50 hover:bg-emerald-100 gap-1"
              >
                <Check className="size-3" />
                <span>Approve</span>
              </Button>
            </PermissionGate>

            <PermissionGate permission="refunds.approve" renderDisabled>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRejectRefund(r)}
                className="h-7 px-2 text-xs text-rose-700 border-rose-200 bg-rose-50 hover:bg-rose-100 gap-1"
              >
                <X className="size-3" />
                <span>Decline</span>
              </Button>
            </PermissionGate>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Refund Operations"
        description="Authorize payment reversals, inspect refund eligibility against merchant settlement accounts, and review dispute notes."
        badge={
          <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
            {total} Requests
          </span>
        }
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadRefunds()}
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
        data={refunds}
        isLoading={isLoading}
        keyExtractor={(r) => r.id}
        currentPage={page}
        onPageChange={setPage}
        pageSize={pageSize}
        onPageSizeChange={(newSize) => {
          setPageSize(newSize);
          setPage(1);
        }}
        totalCount={total}
        emptyTitle="No refunds in queue"
        emptyDescription="All refund and reversal requests have been reviewed and processed."
      />

      <RefundApprovalModal
        refund={approveRefund}
        isOpen={!!approveRefund}
        onClose={() => setApproveRefund(null)}
        onConfirm={handleApproveConfirm}
      />

      <RefundRejectModal
        refund={rejectRefund}
        isOpen={!!rejectRefund}
        onClose={() => setRejectRefund(null)}
        onConfirm={handleRejectConfirm}
      />
    </div>
  );
}
