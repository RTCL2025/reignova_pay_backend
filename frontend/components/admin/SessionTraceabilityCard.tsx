import React from 'react';
import { Building2, Layers, CreditCard, CheckCircle2 } from 'lucide-react';
import { StatusBadge } from './StatusBadge';
import { CheckoutSession } from '@/types/admin';

interface SessionTraceabilityCardProps {
  session: CheckoutSession;
}

export function SessionTraceabilityCard({ session }: SessionTraceabilityCardProps) {
  const maskedToken = `${session.publicToken.substring(0, 12)}••••••••`;

  return (
    <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-4 space-y-3.5 text-xs">
      <div className="flex items-center justify-between">
        <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px] font-mono">
          Operational Lifecycle Traceability
        </span>
        <span className="text-[10px] font-mono text-slate-400">4-Stage Pipeline</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Node 1: Merchant Origin */}
        <div className="bg-white border border-slate-200/80 rounded-xl p-3.5 shadow-2xs space-y-2 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-slate-600 font-bold text-[11px]">
              <div className="w-5 h-5 rounded-md bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 font-mono text-[10px]">
                1
              </div>
              <span>Merchant Origin</span>
            </div>
            <Building2 className="size-3.5 text-slate-400" />
          </div>
          <div>
            <div className="font-bold text-slate-900 text-xs truncate" title={session.applicationName}>
              {session.applicationName}
            </div>
            <div className="text-[10px] font-mono text-slate-400 mt-0.5">
              App ID: {session.applicationId.substring(0, 8)}...
            </div>
          </div>
        </div>

        {/* Node 2: Hosted Session */}
        <div className="bg-white border border-slate-200/80 rounded-xl p-3.5 shadow-2xs space-y-2 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 text-slate-600 font-bold text-[11px]">
              <div className="w-5 h-5 rounded-md bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 font-mono text-[10px]">
                2
              </div>
              <span>Hosted Session</span>
            </div>
            <StatusBadge status={session.sessionStatus} />
          </div>
          <div>
            <div className="font-bold font-mono text-slate-900 text-xs truncate" title={session.reference}>
              {session.reference}
            </div>
            <div className="text-[10px] font-mono text-slate-400 truncate mt-0.5" title={session.publicToken}>
              {maskedToken}
            </div>
          </div>
        </div>

        {/* Node 3: Payment Intent */}
        <div className="bg-white border border-slate-200/80 rounded-xl p-3.5 shadow-2xs space-y-2 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 text-slate-600 font-bold text-[11px]">
              <div className="w-5 h-5 rounded-md bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 font-mono text-[10px]">
                3
              </div>
              <span>Payment Intent</span>
            </div>
            <StatusBadge status={session.paymentStatus} />
          </div>
          <div>
            <div className="font-bold font-mono text-slate-900 text-xs">
              {session.amount.toLocaleString()} {session.currency}
            </div>
            <div className="text-[10px] text-slate-500 truncate mt-0.5">
              {session.customerPhone || session.customerName || 'Hosted Checkout'}
            </div>
          </div>
        </div>

        {/* Node 4: Telco Callback */}
        <div className="bg-white border border-slate-200/80 rounded-xl p-3.5 shadow-2xs space-y-2 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-slate-600 font-bold text-[11px]">
              <div className="w-5 h-5 rounded-md bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 font-mono text-[10px]">
                4
              </div>
              <span>Telco Callback</span>
            </div>
            <CheckCircle2 className="size-3.5 text-emerald-500" />
          </div>
          <div>
            <div className="font-bold font-mono text-slate-900 text-xs truncate" title={session.providerCheckoutId || 'PawaPay Sync Pending'}>
              {session.providerCheckoutId ? session.providerCheckoutId.substring(0, 16) + '...' : 'PawaPay Sync Pending'}
            </div>
            <div className="text-[10px] text-emerald-700 font-mono font-semibold mt-0.5">
              Corridor Confirmed
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
