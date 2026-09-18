import React from 'react';
import { Building2, Layers, CreditCard, CheckCircle2, ArrowRight } from 'lucide-react';
import { StatusBadge } from './StatusBadge';
import { CheckoutSession } from '@/types/admin';

interface SessionTraceabilityCardProps {
  session: CheckoutSession;
}

export function SessionTraceabilityCard({ session }: SessionTraceabilityCardProps) {
  const maskedToken = `${session.publicToken.substring(0, 10)}••••••••••••••••`;

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 text-xs">
      <div className="font-semibold text-slate-800 uppercase tracking-wider text-[11px]">
        Operational Lifecycle Traceability
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5 relative">
        {/* Node 1: Merchant */}
        <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-2xs space-y-1">
          <div className="flex items-center gap-1.5 text-slate-500 font-semibold text-[11px]">
            <Building2 className="size-3.5 text-slate-600" />
            <span>1. Merchant Origin</span>
          </div>
          <div className="font-bold text-slate-900 truncate">
            {session.applicationName}
          </div>
          <div className="text-[10px] font-mono text-slate-400">
            ID: {session.applicationId.substring(0, 8)}...
          </div>
        </div>

        {/* Node 2: Session */}
        <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-2xs space-y-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-slate-500 font-semibold text-[11px]">
              <Layers className="size-3.5 text-slate-600" />
              <span>2. Hosted Session</span>
            </div>
            <StatusBadge status={session.sessionStatus} />
          </div>
          <div className="font-bold font-mono text-slate-900 truncate">
            {session.reference}
          </div>
          <div className="text-[10px] font-mono text-slate-400 truncate select-none">
            {maskedToken}
          </div>
        </div>

        {/* Node 3: Payment */}
        <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-2xs space-y-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-slate-500 font-semibold text-[11px]">
              <CreditCard className="size-3.5 text-slate-600" />
              <span>3. Payment Intent</span>
            </div>
            <StatusBadge status={session.paymentStatus} />
          </div>
          <div className="font-bold font-mono text-slate-900">
            {session.amount.toLocaleString()} {session.currency}
          </div>
          <div className="text-[10px] text-slate-500 truncate">
            {session.customerPhone || 'Direct Hosted'}
          </div>
        </div>

        {/* Node 4: Provider */}
        <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-2xs space-y-1">
          <div className="flex items-center gap-1.5 text-slate-500 font-semibold text-[11px]">
            <CheckCircle2 className="size-3.5 text-emerald-600" />
            <span>4. Telco Callback</span>
          </div>
          <div className="font-bold font-mono text-slate-900 truncate">
            {session.providerCheckoutId || 'PawaPay Sync Pending'}
          </div>
          <div className="text-[10px] text-emerald-700 font-mono">
            Corridor Confirmed
          </div>
        </div>
      </div>
    </div>
  );
}
