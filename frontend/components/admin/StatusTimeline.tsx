import React from 'react';
import { Check, Clock, AlertCircle, XCircle } from 'lucide-react';
import { PaymentStatus } from '@/types/admin';
import { cn } from '@/lib/utils';

interface StatusTimelineProps {
  status: PaymentStatus;
  createdAt: string;
  completedAt?: string | null;
  failedAt?: string | null;
  failureReason?: string | null;
  className?: string;
}

export function StatusTimeline({
  status,
  createdAt,
  completedAt,
  failedAt,
  failureReason,
  className,
}: StatusTimelineProps) {
  const isFailed = status === 'FAILED' || status === 'CANCELLED' || status === 'EXPIRED';
  const isCompleted = status === 'COMPLETED';
  const isProcessing = status === 'PROCESSING';

  const steps = [
    {
      label: 'Session Created',
      description: 'Transaction record initialized in database',
      timestamp: new Date(createdAt).toLocaleTimeString(),
      state: 'done' as const,
    },
    {
      label: 'USSD Push Initiated',
      description: 'Dispatched to PawaPay telco aggregator network',
      timestamp: new Date(new Date(createdAt).getTime() + 1500).toLocaleTimeString(),
      state: 'done' as const,
    },
    {
      label: 'Mobile Handset Processing',
      description: 'Awaiting customer PIN entry on mobile phone',
      timestamp: isProcessing ? 'Pending response' : 'Received callback',
      state: isProcessing ? 'active' as const : 'done' as const,
    },
    {
      label: isFailed ? `Transaction ${status}` : 'Settlement Completed',
      description: isFailed
        ? failureReason || 'Transaction declined by mobile carrier or payer'
        : 'Funds confirmed and ledger balance updated',
      timestamp: isCompleted && completedAt
        ? new Date(completedAt).toLocaleTimeString()
        : isFailed && failedAt
        ? new Date(failedAt).toLocaleTimeString()
        : '—',
      state: isCompleted
        ? 'done' as const
        : isFailed
        ? 'failed' as const
        : 'waiting' as const,
    },
  ];

  return (
    <div className={cn('space-y-4 text-xs', className)}>
      <div className="font-semibold text-slate-900 uppercase tracking-wider text-[11px]">
        Status Progression Lifecycle
      </div>

      <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
        {steps.map((step, idx) => (
          <div key={step.label + idx} className="relative flex items-start gap-3">
            {/* Step Icon */}
            <div
              className={cn(
                'absolute -left-6 size-5 rounded-full flex items-center justify-center text-[10px] font-bold ring-4 ring-white shrink-0',
                step.state === 'done'
                  ? 'bg-emerald-600 text-white'
                  : step.state === 'active'
                  ? 'bg-amber-500 text-white animate-pulse'
                  : step.state === 'failed'
                  ? 'bg-rose-600 text-white'
                  : 'bg-slate-200 text-slate-500'
              )}
            >
              {step.state === 'done' ? (
                <Check className="size-3" />
              ) : step.state === 'active' ? (
                <Clock className="size-3" />
              ) : step.state === 'failed' ? (
                <XCircle className="size-3" />
              ) : (
                <div className="size-1.5 rounded-full bg-slate-400" />
              )}
            </div>

            {/* Step Content */}
            <div className="flex-1 -mt-0.5">
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    'font-semibold',
                    step.state === 'failed'
                      ? 'text-rose-700'
                      : step.state === 'done'
                      ? 'text-slate-900'
                      : 'text-slate-600'
                  )}
                >
                  {step.label}
                </span>
                <span className="font-mono text-[11px] text-slate-400">
                  {step.timestamp}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                {step.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
