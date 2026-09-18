'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface ProviderStats {
  name: string;
  share: number;
  successRate: number;
  latencyMs: number;
  color: string;
  textColor: string;
  bgLight: string;
}

const PROVIDERS: ProviderStats[] = [
  {
    name: 'Vodacom M-Pesa',
    share: 48,
    successRate: 99.1,
    latencyMs: 1820,
    color: '#00A859',
    textColor: 'text-emerald-800',
    bgLight: 'bg-emerald-50',
  },
  {
    name: 'Airtel Money',
    share: 32,
    successRate: 98.4,
    latencyMs: 2140,
    color: '#E60000',
    textColor: 'text-rose-800',
    bgLight: 'bg-rose-50',
  },
  {
    name: 'Tigo Pesa',
    share: 16,
    successRate: 97.8,
    latencyMs: 2380,
    color: '#00377B',
    textColor: 'text-sky-800',
    bgLight: 'bg-sky-50',
  },
  {
    name: 'Halotel Money',
    share: 4,
    successRate: 96.5,
    latencyMs: 2910,
    color: '#FF6E00',
    textColor: 'text-orange-800',
    bgLight: 'bg-orange-50',
  },
];

export function ProviderDistributionWidget({ className }: { className?: string }) {
  return (
    <div className={cn('bg-white rounded-xl border border-slate-200/90 p-5 shadow-xs flex flex-col justify-between', className)}>
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Provider Performance & Share
          </div>
          <span className="text-[11px] font-mono text-slate-400">Pawapay Corridors</span>
        </div>

        {/* Stacked Share Bar */}
        <div className="h-3 w-full rounded-full overflow-hidden flex mb-5 bg-slate-100">
          {PROVIDERS.map((prov) => (
            <div
              key={prov.name}
              style={{ width: `${prov.share}%`, backgroundColor: prov.color }}
              className="h-full transition-all duration-300"
              title={`${prov.name}: ${prov.share}%`}
            />
          ))}
        </div>

        {/* Provider Rows */}
        <div className="space-y-3">
          {PROVIDERS.map((prov) => (
            <div
              key={prov.name}
              className="flex items-center justify-between text-xs py-1 border-b border-slate-50 last:border-0"
            >
              <div className="flex items-center gap-2">
                <span
                  className="size-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: prov.color }}
                />
                <span className="font-semibold text-slate-800">{prov.name}</span>
                <span className="text-slate-400 font-mono text-[11px]">({prov.share}%)</span>
              </div>

              <div className="flex items-center gap-3 font-mono text-[11px]">
                <span className="text-slate-500">{prov.latencyMs}ms avg</span>
                <span className={cn('px-1.5 py-0.5 rounded-sm font-semibold', prov.textColor, prov.bgLight)}>
                  {prov.successRate}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="pt-3 mt-3 border-t border-slate-100 text-[11px] text-slate-400 flex items-center justify-between">
        <span>Global PawaPay SLA</span>
        <span className="font-mono text-emerald-700 font-medium">99.0% Target Met</span>
      </div>
    </div>
  );
}
