import React from 'react';
import { cn } from '@/lib/utils';

export type BadgeStatusType =
  | 'ACTIVE'
  | 'COMPLETED'
  | 'APPROVED'
  | 'SUCCESS'
  | 'PENDING'
  | 'PROCESSING'
  | 'WAITING_PAYMENT'
  | 'WAITING PAYMENT'
  | 'UNDER_REVIEW'
  | 'REQUESTED'
  | 'OPEN'
  | 'FAILED'
  | 'SUSPENDED'
  | 'REVOKED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'EXPIRED';

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const normalized = (status || '').toUpperCase() as BadgeStatusType;

  // Semantic styles for light theme financial portal
  let dotColor = 'bg-slate-400';
  let badgeStyle = 'bg-slate-100 text-slate-700 border-slate-200';

  switch (normalized) {
    case 'ACTIVE':
    case 'COMPLETED':
    case 'APPROVED':
    case 'SUCCESS':
      dotColor = 'bg-emerald-500';
      badgeStyle = 'bg-emerald-50 text-emerald-800 border-emerald-200/80';
      break;

    case 'PENDING':
    case 'PROCESSING':
    case 'WAITING_PAYMENT':
    case 'WAITING PAYMENT':
    case 'UNDER_REVIEW':
    case 'REQUESTED':
    case 'OPEN':
      dotColor = 'bg-amber-500 animate-pulse';
      badgeStyle = 'bg-amber-50 text-amber-800 border-amber-200/80';
      break;

    case 'FAILED':
    case 'SUSPENDED':
    case 'REVOKED':
    case 'REJECTED':
      dotColor = 'bg-rose-500';
      badgeStyle = 'bg-rose-50 text-rose-800 border-rose-200/80';
      break;

    case 'CANCELLED':
    case 'EXPIRED':
      dotColor = 'bg-slate-400';
      badgeStyle = 'bg-slate-100 text-slate-600 border-slate-200';
      break;
  }

  const label = normalized.replace(/_/g, ' ');

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold border font-mono tracking-tight whitespace-nowrap shrink-0 shadow-2xs',
        badgeStyle,
        className
      )}
    >
      <span className={cn('size-1.5 rounded-full shrink-0', dotColor)} />
      <span>{label}</span>
    </span>
  );
}
