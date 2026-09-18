import React from 'react';
import { TrendingUp, TrendingDown, HelpCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: {
    value: number;
    label?: string;
    isPositiveGood?: boolean;
  };
  icon?: React.ComponentType<{ className?: string }>;
  tooltip?: string;
  className?: string;
}

export function MetricCard({
  title,
  value,
  subtitle,
  trend,
  icon: Icon,
  tooltip,
  className,
}: MetricCardProps) {
  const isPositive = trend ? trend.value >= 0 : false;
  const isGood = trend?.isPositiveGood !== false ? isPositive : !isPositive;

  return (
    <div
      className={cn(
        'bg-white rounded-xl border border-slate-200/90 p-5 shadow-xs transition-all duration-150 hover:border-slate-300 hover:shadow-sm flex flex-col justify-between',
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            {title}
          </span>
          {tooltip && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label="Information"
                  className="text-slate-400 hover:text-slate-600 focus:outline-hidden"
                >
                  <HelpCircle className="size-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="bg-slate-900 text-white text-xs max-w-xs p-2">
                {tooltip}
              </TooltipContent>
            </Tooltip>
          )}
        </div>
        {Icon && (
          <div className="size-8 rounded-lg bg-slate-50 border border-slate-200/60 flex items-center justify-center text-slate-600">
            <Icon className="size-4" />
          </div>
        )}
      </div>

      <div className="mt-3">
        <div className="text-2xl font-bold font-mono tracking-tight text-slate-900">
          {value}
        </div>

        <div className="mt-2 flex items-center gap-2 flex-wrap text-xs">
          {trend && (
            <span
              className={cn(
                'inline-flex items-center gap-1 font-mono font-medium px-1.5 py-0.5 rounded-md text-[11px]',
                isGood
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                  : 'bg-rose-50 text-rose-700 border border-rose-200/60'
              )}
            >
              {isPositive ? (
                <TrendingUp className="size-3 shrink-0" />
              ) : (
                <TrendingDown className="size-3 shrink-0" />
              )}
              <span>
                {isPositive ? '+' : ''}
                {trend.value}%
              </span>
            </span>
          )}
          {subtitle && <span className="text-slate-500 text-xs">{subtitle}</span>}
        </div>
      </div>
    </div>
  );
}
