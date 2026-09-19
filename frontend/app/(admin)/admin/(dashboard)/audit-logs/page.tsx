'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { FileCode2, RefreshCw, Download, ShieldCheck, Search } from 'lucide-react';
import { PageHeader } from '@/components/admin/PageHeader';
import { DataTable, Column } from '@/components/admin/DataTable';
import { DataTableToolbar } from '@/components/admin/DataTableToolbar';
import { DetailsDrawer } from '@/components/admin/DetailsDrawer';
import { AuditLogDiff } from '@/components/admin/AuditLogDiff';
import { Button } from '@/components/ui/button';
import { adminApiClient } from '@/lib/admin-api';
import { AuditLog } from '@/types/admin';

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const loadLogs = async (targetPage = page, targetPageSize = pageSize) => {
    setIsLoading(true);
    try {
      const res = await adminApiClient.auditLogs.list({
        page: targetPage,
        limit: targetPageSize,
        action: actionFilter,
        search: search,
      });
      setLogs(res.logs);
      setTotal(res.total);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadLogs(page, pageSize);
  }, [page, pageSize, actionFilter, search]);

  const filteredLogs = useMemo(() => {
    return logs.filter((l) => {
      const matchesAction = actionFilter === 'ALL' || l.action === actionFilter;
      const q = search.toLowerCase();
      const matchesSearch =
        !search ||
        l.action.toLowerCase().includes(q) ||
        l.actor.toLowerCase().includes(q) ||
        (l.resourceId && l.resourceId.toLowerCase().includes(q)) ||
        (l.applicationName && l.applicationName.toLowerCase().includes(q));
      return matchesAction && matchesSearch;
    });
  }, [logs, search, actionFilter]);

  const columns: Column<AuditLog>[] = [
    {
      key: 'createdAt',
      header: 'Timestamp',
      sortable: true,
      render: (l) => (
        <div className="flex flex-col font-mono text-xs">
          <span className="text-slate-900 font-semibold">
            {new Date(l.createdAt).toLocaleDateString()}
          </span>
          <span className="text-[11px] text-slate-400">
            {new Date(l.createdAt).toLocaleTimeString()}
          </span>
        </div>
      ),
    },
    {
      key: 'actor',
      header: 'Actor',
      sortable: true,
      render: (l) => (
        <span className="text-xs font-medium text-slate-900">{l.actor}</span>
      ),
    },
    {
      key: 'action',
      header: 'Action Event',
      sortable: true,
      render: (l) => (
        <span className="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
          {l.action}
        </span>
      ),
    },
    {
      key: 'resourceType',
      header: 'Resource',
      render: (l) => (
        <div className="flex flex-col text-xs">
          <span className="font-semibold text-slate-700">{l.resourceType}</span>
          <span className="font-mono text-[11px] text-slate-400 truncate max-w-[120px]">
            {l.resourceId}
          </span>
        </div>
      ),
    },
    {
      key: 'applicationName',
      header: 'Application',
      render: (l) => (
        <span className="text-xs text-slate-600 font-medium">
          {l.applicationName || 'System Platform'}
        </span>
      ),
    },
    {
      key: 'result',
      header: 'Result',
      render: (l) => (
        <span
          className={`inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-full font-semibold ${
            l.result === 'SUCCESS'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          <span className={`size-1.5 rounded-full ${l.result === 'SUCCESS' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
          <span>{l.result}</span>
        </span>
      ),
    },
    {
      key: 'ipAddress',
      header: 'Client IP',
      render: (l) => (
        <span className="font-mono text-xs text-slate-500">
          {l.ipAddress || 'Internal Call'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Action',
      className: 'text-right',
      render: (l) => (
        <Button
          variant="outline"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            setSelectedLog(l);
          }}
          className="h-7 px-2.5 text-xs text-slate-700 bg-white border-slate-200 hover:bg-slate-50"
        >
          Inspect Diff
        </Button>
      ),
    },
  ];

  const drawerRows = selectedLog
    ? [
        { label: 'Event ID', value: selectedLog.id, copyable: selectedLog.id, isMono: true },
        { label: 'Timestamp (ISO)', value: selectedLog.createdAt, isMono: true },
        { label: 'Executing Actor', value: selectedLog.actor },
        { label: 'Action Taken', value: selectedLog.action, isMono: true },
        { label: 'Resource Target', value: `${selectedLog.resourceType} (${selectedLog.resourceId})`, isMono: true },
        { label: 'Merchant Application', value: selectedLog.applicationName || 'System Platform' },
        { label: 'Request Correlation ID', value: selectedLog.correlationId || 'req_auto_sys_8192', copyable: selectedLog.correlationId || undefined, isMono: true },
        { label: 'Source IP Address', value: selectedLog.ipAddress || '127.0.0.1', isMono: true },
        { label: 'User Agent', value: selectedLog.userAgent || 'Mozilla/5.0 Admin Console', isMono: true },
      ]
    : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Logs & Security Trail"
        description="Immutable compliance logging tracking administrative credentials, policy modifications, merchant suspensions, and financial adjustments."
        badge={
          <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
            {total} Logged Events
          </span>
        }
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadLogs()}
            disabled={isLoading}
            className="h-8 text-xs bg-white border-slate-200 text-slate-700 hover:bg-slate-50 gap-1.5"
          >
            <RefreshCw className={`size-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>
        }
      />

      <DataTableToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Filter by action, actor, resource ID, or merchant..."
        statusFilter={{
          value: actionFilter,
          options: [
            { label: 'All Event Types', value: 'ALL' },
            { label: 'API Key Rotated', value: 'API_KEY_ROTATED' },
            { label: 'Refund Approved', value: 'REFUND_APPROVED' },
            { label: 'Merchant Suspended', value: 'MERCHANT_SUSPENDED' },
            { label: 'Merchant Created', value: 'MERCHANT_CREATED' },
          ],
          onChange: setActionFilter,
        }}
        hasActiveFilters={search !== '' || actionFilter !== 'ALL'}
        onReset={() => {
          setSearch('');
          setActionFilter('ALL');
        }}
      />

      <DataTable
        columns={columns}
        data={filteredLogs}
        isLoading={isLoading}
        keyExtractor={(l) => l.id}
        onRowClick={(l) => setSelectedLog(l)}
        currentPage={page}
        onPageChange={setPage}
        pageSize={pageSize}
        onPageSizeChange={(newSize) => {
          setPageSize(newSize);
          setPage(1);
        }}
        totalCount={total}
        emptyTitle="No audit records match filters"
        emptyDescription="Try resetting your search query or event type filter."
      />

      {/* Audit Log Drawer with Visual Diff */}
      <DetailsDrawer
        isOpen={!!selectedLog}
        onClose={() => setSelectedLog(null)}
        title={selectedLog?.action || 'Audit Record'}
        subtitle={`Security Event • ${selectedLog?.actor}`}
        rows={drawerRows}
        rawJson={selectedLog as any}
      >
        {selectedLog && (
          <div className="pt-2 border-t border-slate-100">
            <AuditLogDiff
              beforeState={selectedLog.beforeState}
              afterState={selectedLog.afterState}
            />
          </div>
        )}
      </DetailsDrawer>
    </div>
  );
}
