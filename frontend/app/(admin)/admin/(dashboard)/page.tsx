'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  DollarSign,
  CheckCircle2,
  Clock,
  AlertOctagon,
  Building2,
  RotateCcw,
  Plus,
  ArrowRight,
  ExternalLink,
  RefreshCw,
  Sparkles,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { PageHeader } from '@/components/admin/PageHeader';
import { MetricCard } from '@/components/admin/MetricCard';
import { VolumeTrendChart } from '@/components/admin/VolumeTrendChart';
import { ProviderDistributionWidget } from '@/components/admin/ProviderDistributionWidget';
import { OperationalAlertsBanner } from '@/components/admin/OperationalAlertsBanner';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { Button } from '@/components/ui/button';
import { adminApiClient } from '@/lib/admin-api';
import { Payment, Application, OverviewMetrics } from '@/types/admin';

export default function AdminDashboardPage() {
  const router = useRouter();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [paymentsTotal, setPaymentsTotal] = useState(0);
  const [paymentsPage, setPaymentsPage] = useState(1);

  const [merchants, setMerchants] = useState<Application[]>([]);
  const [merchantsTotal, setMerchantsTotal] = useState(0);
  const [merchantsPage, setMerchantsPage] = useState(1);

  const [metrics, setMetrics] = useState<OverviewMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadDashboardData = async (payPage = paymentsPage, merchPage = merchantsPage) => {
    setIsRefreshing(true);
    try {
      const [payRes, merchRes, metricsRes] = await Promise.all([
        adminApiClient.payments.list({ page: payPage, limit: 5 }),
        adminApiClient.merchants.list(merchPage, 4),
        adminApiClient.stats.getOverviewMetrics(),
      ]);
      setPayments(payRes.payments);
      setPaymentsTotal(payRes.total);
      setMerchants(merchRes.applications);
      setMerchantsTotal(merchRes.total);
      setMetrics(metricsRes);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadDashboardData(paymentsPage, merchantsPage);
  }, [paymentsPage, merchantsPage]);

  const formatVolume = (val: number) => {
    if (val >= 1_000_000_000) return `${(val / 1_000_000_000).toFixed(1)}B`;
    if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
    if (val >= 1_000) return `${(val / 1_000).toFixed(0)}K`;
    return `${val}`;
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <PageHeader
        title="Command Center"
        description="Real-time mobile money settlement orchestration, merchant volumes, and corridor uptime across East Africa."
        badge={
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-mono font-semibold bg-slate-900 text-white shadow-2xs">
            <Sparkles className="size-3 text-amber-400" />
            <span>Reignova v1.0</span>
          </span>
        }
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadDashboardData()}
              disabled={isRefreshing}
              className="h-8 text-xs bg-white border-slate-200 text-slate-700 hover:bg-slate-50 gap-1.5"
            >
              <RefreshCw className={`size-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </Button>

            <Button
              size="sm"
              onClick={() => router.push('/admin/merchants?action=add')}
              className="h-8 text-xs bg-slate-900 hover:bg-slate-800 text-white font-semibold gap-1.5 shadow-xs"
            >
              <Plus className="size-3.5" />
              <span>Add Merchant</span>
            </Button>
          </div>
        }
      />

      {/* Operational Alerts */}
      <OperationalAlertsBanner
        pendingRefundsCount={metrics?.pendingRefundsCount ?? 0}
        suspendedMerchantsCount={metrics?.suspendedMerchants ?? 0}
      />

      {/* 6 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
        <MetricCard
          title="Total Volume"
          value={metrics ? formatVolume(metrics.totalVolume) : '...'}
          subtitle="TZS settled (30d)"
          trend={{ value: metrics?.volumeTrend ?? 14.8, isPositiveGood: true }}
          icon={DollarSign}
          tooltip="Gross volume processed across all active merchant applications."
        />

        <MetricCard
          title="Successful Tx"
          value={metrics ? metrics.successfulTx.toLocaleString() : '...'}
          subtitle={`${metrics?.successRate ?? 100}% success rate`}
          trend={{ value: 4.2, isPositiveGood: true }}
          icon={CheckCircle2}
          tooltip="Total deposits and collections marked completed by telco partners."
        />

        <MetricCard
          title="Pending Queue"
          value={metrics ? metrics.pendingTx.toLocaleString() : '...'}
          subtitle="Active USSD prompts"
          trend={{ value: -2.1, isPositiveGood: true }}
          icon={Clock}
          tooltip="Transactions awaiting payer PIN entry on mobile phone."
        />

        <MetricCard
          title="Failed Tx"
          value={metrics ? metrics.failedTx.toLocaleString() : '...'}
          subtitle={`${metrics?.failureRate ?? 0}% failure rate`}
          trend={{ value: -0.15, isPositiveGood: true }}
          icon={AlertOctagon}
          tooltip="Transactions declined, timed out, or cancelled by payer."
        />

        <MetricCard
          title="Active Merchants"
          value={metrics ? metrics.activeMerchants.toLocaleString() : '...'}
          subtitle={`${metrics?.suspendedMerchants ?? 0} accounts suspended`}
          icon={Building2}
          tooltip="Approved merchant applications with live API credentials."
        />

        <MetricCard
          title="Refund Volume"
          value={metrics ? formatVolume(metrics.totalRefundVolume) : '...'}
          subtitle="TZS total refunded"
          icon={RotateCcw}
          tooltip="Total approved refunds reversed back to original payer mobile wallets."
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <VolumeTrendChart
          className="lg:col-span-2"
          trend={metrics?.trend}
          totalVolume={metrics?.totalVolume}
        />
        <ProviderDistributionWidget providers={metrics?.providers} />
      </div>

      {/* Bottom Summary Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Recent Transactions */}
        <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900 font-sans">
                  Recent Payment Stream
                </h3>
                <p className="text-xs text-slate-500">Live incoming deposit stream</p>
              </div>

              <Link
                href="/admin/payments"
                className="text-xs font-semibold text-slate-700 hover:text-slate-900 inline-flex items-center gap-1"
              >
                <span>View all</span>
                <ArrowRight className="size-3" />
              </Link>
            </div>

            <div className="divide-y divide-slate-100">
              {payments.length > 0 ? (
                payments.map((p) => (
                  <div
                    key={p.id}
                    className="py-2.5 flex items-center justify-between hover:bg-slate-50/75 rounded-md px-1 transition-colors text-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="flex flex-col min-w-0">
                        <span className="font-semibold text-slate-900 font-mono truncate">
                          {p.reference}
                        </span>
                        <span className="text-[11px] text-slate-500 truncate">
                          {p.applicationName || 'Application'} • {p.provider || 'Direct'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-mono font-bold text-slate-900">
                        {p.amount.toLocaleString()} {p.currency}
                      </span>
                      <StatusBadge status={p.status} />
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-xs text-slate-400 font-mono">
                  No live payments recorded yet.
                </div>
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
            <span className="font-mono">Page {paymentsPage} of {Math.max(1, Math.ceil(paymentsTotal / 5))} ({paymentsTotal} total)</span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={paymentsPage <= 1}
                onClick={() => setPaymentsPage((p) => Math.max(1, p - 1))}
                className="h-6 w-6 p-0 text-slate-700 bg-white border-slate-200 hover:bg-slate-50"
              >
                <ChevronLeft className="size-3" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={paymentsPage >= Math.max(1, Math.ceil(paymentsTotal / 5))}
                onClick={() => setPaymentsPage((p) => p + 1)}
                className="h-6 w-6 p-0 text-slate-700 bg-white border-slate-200 hover:bg-slate-50"
              >
                <ChevronRight className="size-3" />
              </Button>
            </div>
          </div>
        </div>

        {/* Top Active Merchants */}
        <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900 font-sans">
                  Top Active Merchants
                </h3>
                <p className="text-xs text-slate-500">Highest settling applications</p>
              </div>

              <Link
                href="/admin/merchants"
                className="text-xs font-semibold text-slate-700 hover:text-slate-900 inline-flex items-center gap-1"
              >
                <span>Manage</span>
                <ArrowRight className="size-3" />
              </Link>
            </div>

            <div className="divide-y divide-slate-100">
              {merchants.length > 0 ? (
                merchants.map((m) => (
                  <div
                    key={m.id}
                    className="py-2.5 flex items-center justify-between hover:bg-slate-50/75 rounded-md px-1 transition-colors text-xs"
                  >
                    <div className="flex flex-col min-w-0">
                      <Link
                        href={`/admin/merchants/${m.id}`}
                        className="font-semibold text-slate-900 hover:underline truncate"
                      >
                        {m.name}
                      </Link>
                      <span className="text-[11px] text-slate-400 font-mono truncate">
                        {m.apiKeyPrefix}••••
                      </span>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-mono text-slate-600 font-medium text-[11px]">
                        {((m.totalVolume || 0) / 1000000).toFixed(1)}M TZS
                      </span>
                      <StatusBadge status={m.status} />
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-xs text-slate-400 font-mono">
                  No merchant applications registered yet.
                </div>
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
            <span className="font-mono">Page {merchantsPage} of {Math.max(1, Math.ceil(merchantsTotal / 4))} ({merchantsTotal} total)</span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={merchantsPage <= 1}
                onClick={() => setMerchantsPage((p) => Math.max(1, p - 1))}
                className="h-6 w-6 p-0 text-slate-700 bg-white border-slate-200 hover:bg-slate-50"
              >
                <ChevronLeft className="size-3" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={merchantsPage >= Math.max(1, Math.ceil(merchantsTotal / 4))}
                onClick={() => setMerchantsPage((p) => p + 1)}
                className="h-6 w-6 p-0 text-slate-700 bg-white border-slate-200 hover:bg-slate-50"
              >
                <ChevronRight className="size-3" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
