'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface ProviderStatItem {
  provider: string;
  count: number;
  volume: number;
  share: number;
}

interface ProviderDistributionWidgetProps {
  className?: string;
  providers?: ProviderStatItem[];
}

const PROVIDER_META: Record<
  string,
  { name: string; color: string; textColor: string; bgLight: string }
> = {
  VODACOM_TZ: {
    name: 'Vodacom M-Pesa',
    color: '#00A859',
    textColor: 'text-emerald-800',
    bgLight: 'bg-emerald-50',
  },
  AIRTEL_TZ: {
    name: 'Airtel Money',
    color: '#E60000',
    textColor: 'text-rose-800',
    bgLight: 'bg-rose-50',
  },
  TIGO_TZ: {
    name: 'Tigo Pesa',
    color: '#00377B',
    textColor: 'text-sky-800',
    bgLight: 'bg-sky-50',
  },
  HALOTEL_TZ: {
    name: 'Halotel Money',
    color: '#FF6E00',
    textColor: 'text-orange-800',
    bgLight: 'bg-orange-50',
  },
};

export function ProviderDistributionWidget({
  className,
  providers = [],
}: ProviderDistributionWidgetProps) {
  const displayItems = providers.map((p) => {
    const key = p.provider.toUpperCase();
    const meta = PROVIDER_META[key] || {
      name: p.provider.replace(/_/g, ' '),
      color: '#64748B',
      textColor: 'text-slate-800',
      bgLight: 'bg-slate-100',
    };
    return {
      name: meta.name,
      share: p.share,
      count: p.count,
      volume: p.volume,
      color: meta.color,
      textColor: meta.textColor,
      bgLight: meta.bgLight,
    };
  });

  return (
    <div className={cn('bg-white rounded-xl border border-slate-200/90 p-5 shadow-xs flex flex-col justify-between', className)}>
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Provider Performance & Share
          </div>
          <span className="text-[11px] font-mono text-slate-400">Live Corridors</span>
        </div>

        {displayItems.length > 0 ? (
          <>
            {/* Stacked Share Bar */}
            <div className="h-3 w-full rounded-full overflow-hidden flex mb-5 bg-slate-100">
              {displayItems.map((prov) => (
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
              {displayItems.map((prov) => (
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
                    <span className="text-slate-500">{prov.count} tx</span>
                    <span className={cn('px-1.5 py-0.5 rounded-sm font-semibold', prov.textColor, prov.bgLight)}>
                      {prov.volume.toLocaleString()} TZS
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="py-8 text-center text-xs text-slate-400 font-mono">
            No live transactions recorded across providers yet.
          </div>
        )}
      </div>

      <div className="pt-3 mt-3 border-t border-slate-100 text-[11px] text-slate-400 flex items-center justify-between">
        <span>Settlement Gateway</span>
        <span className="font-mono text-emerald-700 font-medium">PawaPay Live API</span>
      </div>
    </div>
  );
}
