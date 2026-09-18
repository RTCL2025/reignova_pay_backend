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
} from 'lucide-react';
import { PageHeader } from '@/components/admin/PageHeader';
import { MetricCard } from '@/components/admin/MetricCard';
import { VolumeTrendChart } from '@/components/admin/VolumeTrendChart';
import { ProviderDistributionWidget } from '@/components/admin/ProviderDistributionWidget';
import { OperationalAlertsBanner } from '@/components/admin/OperationalAlertsBanner';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { Button } from '@/components/ui/button';
import { adminApiClient } from '@/lib/admin-api';
import { Payment, Application } from '@/types/admin';

export default function AdminDashboardPage() {
  const router = useRouter();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [merchants, setMerchants] = useState<Application[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadDashboardData = async () => {
    setIsRefreshing(true);
    try {
      const [payRes, merchRes] = await Promise.all([
        adminApiClient.payments.list(),
        adminApiClient.merchants.list(1, 5),
      ]);
      setPayments(payRes.payments.slice(0, 5));
      setMerchants(merchRes.applications.slice(0, 4));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

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
              onClick={loadDashboardData}
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
      <OperationalAlertsBanner />

      {/* 6 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
        <MetricCard
          title="Total Volume"
          value="644.9M"
          subtitle="TZS settled (30d)"
          trend={{ value: 14.8, isPositiveGood: true }}
          icon={DollarSign}
          tooltip="Gross volume processed across all active merchant applications."
        />

        <MetricCard
          title="Successful Tx"
          value="19,730"
          subtitle="98.4% success rate"
          trend={{ value: 4.2, isPositiveGood: true }}
          icon={CheckCircle2}
          tooltip="Total deposits and collections marked completed by telco partners."
        />

        <MetricCard
          title="Pending Queue"
          value="14"
          subtitle="Active USSD prompts"
          trend={{ value: -2.1, isPositiveGood: true }}
          icon={Clock}
          tooltip="Transactions awaiting payer PIN entry on mobile phone."
        />

        <MetricCard
          title="Failed Tx"
          value="92"
          subtitle="0.46% failure rate"
          trend={{ value: -0.15, isPositiveGood: true }}
          icon={AlertOctagon}
          tooltip="Transactions declined, timed out, or cancelled by payer."
        />

        <MetricCard
          title="Active Merchants"
          value="18"
          subtitle="2 accounts suspended"
          icon={Building2}
          tooltip="Approved merchant applications with live API credentials."
        />

        <MetricCard
          title="Refund Volume"
          value="375K"
          subtitle="TZS total refunded"
          icon={RotateCcw}
          tooltip="Total approved refunds reversed back to original payer mobile wallets."
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <VolumeTrendChart className="lg:col-span-2" />
        <ProviderDistributionWidget />
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
              {payments.map((p) => (
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
                        {p.applicationName} • {p.provider}
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
              ))}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-400 flex items-center justify-between">
            <span>Encrypted Webhook Settlement</span>
            <span className="font-mono">PawaPay v1 Gateway</span>
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
              {merchants.map((m) => (
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
              ))}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-400 flex items-center justify-between">
            <span>Multi-tenant Isolation</span>
            <Link
              href="/admin/merchants"
              className="text-slate-600 hover:text-slate-900 flex items-center gap-1"
            >
              <span>Explore all merchants</span>
              <ExternalLink className="size-3" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
