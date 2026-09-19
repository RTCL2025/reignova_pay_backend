'use client';

import React from 'react';
import { Check } from 'lucide-react';
import type { SupportedProvider } from '@/types/checkout';

interface PaymentMethodSelectorProps {
  providers?: SupportedProvider[];
  selectedProvider: string;
  onSelectProvider: (providerId: string) => void;
  disabled?: boolean;
}

interface OperatorDef {
  id: string;
  name: string;
  shortName: string;
  subName: string;
  logoUrl: string;
  containerBg?: string;
  objectFit?: 'object-contain' | 'object-cover';
}

const OPERATOR_DEFS: OperatorDef[] = [
  {
    id: 'VODACOM_TZA',
    name: 'Vodacom M-Pesa',
    shortName: 'M-Pesa',
    subName: 'Vodacom TZ',
    logoUrl: '/providers/mpesa.png',
    containerBg: 'bg-white',
    objectFit: 'object-contain',
  },
  {
    id: 'AIRTEL_TZA',
    name: 'Airtel Money',
    shortName: 'Airtel Money',
    subName: 'Airtel TZ',
    logoUrl: '/providers/airtel.png',
    containerBg: 'bg-white',
    objectFit: 'object-contain',
  },
  {
    id: 'TIGO_TZA',
    name: 'Mixx by Yas',
    shortName: 'Mixx by Yas',
    subName: 'Tigo Pesa',
    logoUrl: '/providers/mixx.png',
    containerBg: 'bg-[#F9BC06]',
    objectFit: 'object-contain',
  },
  {
    id: 'HALOTEL_TZA',
    name: 'Halotel HaloPesa',
    shortName: 'HaloPesa',
    subName: 'Halotel TZ',
    logoUrl: '/providers/halopesa.png',
    containerBg: 'bg-white',
    objectFit: 'object-contain',
  },
];

export function PaymentMethodSelector({
  selectedProvider,
  onSelectProvider,
  disabled = false,
}: PaymentMethodSelectorProps) {
  const activeOperator = OPERATOR_DEFS.find((o) => o.id === selectedProvider) || OPERATOR_DEFS[0];

  return (
    <div className="flex flex-col gap-2">
      {/* Selector Header */}
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          Choose Tanzanian Operator
        </label>
        <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-600">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={activeOperator.logoUrl}
            alt={activeOperator.shortName}
            className="w-4 h-4 object-contain rounded-xs shadow-2xs"
          />
          <span>{activeOperator.shortName} Selected</span>
        </div>
      </div>

      {/* 4-Column Operator Grid with Official Logos */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {OPERATOR_DEFS.map((operator) => {
          const isSelected = selectedProvider === operator.id;

          return (
            <button
              key={operator.id}
              type="button"
              disabled={disabled}
              onClick={() => onSelectProvider(operator.id)}
              className={`relative text-left p-3 rounded-xl border transition-all duration-200 flex flex-col justify-between h-24 select-none ${
                isSelected
                  ? 'bg-amber-50/60 border-brand-gold ring-2 ring-brand-gold/30 shadow-sm'
                  : 'bg-white hover:bg-slate-50 border-slate-200 shadow-2xs'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              {/* Top row: Official Provider Logo & Radio Checkmark */}
              <div className="flex items-center justify-between w-full">
                <div
                  className={`w-10 h-8 rounded-lg ${operator.containerBg || 'bg-white'} border border-slate-200/80 p-0.5 flex items-center justify-center overflow-hidden shadow-2xs`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={operator.logoUrl}
                    alt={operator.name}
                    className={`w-full h-full ${operator.objectFit || 'object-contain'}`}
                  />
                </div>

                <div
                  className={`w-4 h-4 rounded-full flex items-center justify-center transition-all ${
                    isSelected
                      ? 'bg-brand-navy-900 text-white'
                      : 'bg-slate-100 border border-slate-200 text-transparent'
                  }`}
                >
                  <Check className="w-2.5 h-2.5 stroke-[3]" />
                </div>
              </div>

              {/* Bottom: Carrier Name & Network Subtitle */}
              <div>
                <span className="font-bold text-sm text-slate-900 block leading-tight truncate">
                  {operator.shortName}
                </span>
                <span className="text-[11px] text-slate-500 font-medium truncate block">
                  {operator.subName}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
