'use client';

import React from 'react';
import { Smartphone, Check } from 'lucide-react';
import { PROVIDER_MAP } from '@/lib/formatters';
import type { SupportedProvider } from '@/types/checkout';

interface PaymentMethodSelectorProps {
  providers: SupportedProvider[];
  selectedProvider: string;
  onSelectProvider: (providerId: string) => void;
  disabled?: boolean;
}

export function PaymentMethodSelector({
  providers,
  selectedProvider,
  onSelectProvider,
  disabled = false,
}: PaymentMethodSelectorProps) {
  // If no providers provided from API, fall back to the standard 4
  const list = providers.length > 0 ? providers : [
    { id: 'VODACOM_TZA', name: 'Vodacom M-Pesa' },
    { id: 'TIGO_TZA', name: 'Tigo Pesa' },
    { id: 'AIRTEL_TZA', name: 'Airtel Money' },
    { id: 'HALOTEL_TZA', name: 'Halotel HaloPesa' },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-semibold uppercase tracking-wider text-brand-slate-300">
          Select Mobile Money Network
        </label>
        <span className="text-xs text-brand-slate-400">Instant Push STK</span>
      </div>

      <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Mobile Money Network">
        {list.map((p) => {
          const isSelected = selectedProvider === p.id;
          const meta = PROVIDER_MAP[p.id] || {
            id: p.id,
            name: p.name,
            shortName: p.name,
            color: '#F3A221',
            textColor: '#FFFFFF',
            borderActive: 'border-brand-accent ring-brand-accent/30',
            bgLight: 'bg-brand-accent/10',
            promptInstructions: 'Enter your PIN to confirm payment.',
          };

          return (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              disabled={disabled}
              onClick={() => onSelectProvider(p.id)}
              className={`relative p-3.5 rounded-xl text-left transition-all duration-200 border flex flex-col justify-between ${
                isSelected
                  ? `reignova-card-inner border-brand-accent ring-2 ring-brand-accent/40 shadow-lg shadow-brand-accent/5`
                  : 'bg-brand-navy-900/40 hover:bg-brand-navy-800/60 border-white/10 hover:border-white/20'
              } ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              {/* Top row with Radio icon and network name */}
              <div className="flex items-center justify-between w-full mb-2">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: meta.color }}
                  />
                  <span className="text-sm font-semibold text-white tracking-tight">
                    {meta.shortName}
                  </span>
                </div>

                {isSelected ? (
                  <div className="w-5 h-5 rounded-full bg-brand-accent text-brand-navy-950 flex items-center justify-center">
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </div>
                ) : (
                  <div className="w-5 h-5 rounded-full border border-white/20" />
                )}
              </div>

              {/* Sub-label */}
              <span className="text-[11px] text-brand-slate-400">
                {p.name.includes(' ') ? p.name : `${meta.shortName} Tanzania`}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
