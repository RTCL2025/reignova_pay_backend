import React from 'react';
import { cn } from '@/lib/utils';

interface AuditLogDiffProps {
  beforeState?: Record<string, unknown> | null;
  afterState?: Record<string, unknown> | null;
  className?: string;
}

function maskSensitive(key: string, val: unknown): string {
  if (val === null || val === undefined) return 'null';
  const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
  const lower = key.toLowerCase();
  if (
    lower.includes('key') ||
    lower.includes('secret') ||
    lower.includes('token') ||
    lower.includes('password') ||
    lower.includes('hash')
  ) {
    return str.length > 8 ? `${str.substring(0, 6)}••••••••` : '••••••••';
  }
  return str;
}

export function AuditLogDiff({
  beforeState,
  afterState,
  className,
}: AuditLogDiffProps) {
  if (!beforeState && !afterState) {
    return (
      <div className="text-xs text-slate-400 italic p-3 bg-slate-50 rounded-lg border border-slate-100">
        No state diff recorded for this administrative event.
      </div>
    );
  }

  const allKeys = Array.from(
    new Set([...Object.keys(beforeState || {}), ...Object.keys(afterState || {})])
  );

  return (
    <div className={cn('space-y-3 text-xs', className)}>
      <div className="font-semibold text-slate-800 uppercase tracking-wider text-[11px] flex items-center justify-between">
        <span>State Diff Inspection</span>
        <span className="text-slate-400 font-mono text-[10px]">Sensitive credentials masked</span>
      </div>

      <div className="rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-100 bg-white font-mono">
        <div className="grid grid-cols-12 bg-slate-50/80 px-3 py-2 font-sans text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
          <div className="col-span-4">Attribute</div>
          <div className="col-span-4">Before State</div>
          <div className="col-span-4">After State</div>
        </div>

        {allKeys.map((key) => {
          const beforeVal = beforeState ? beforeState[key] : undefined;
          const afterVal = afterState ? afterState[key] : undefined;
          const isChanged = JSON.stringify(beforeVal) !== JSON.stringify(afterVal);

          return (
            <div
              key={key}
              className={cn(
                'grid grid-cols-12 px-3 py-2 items-center text-xs transition-colors',
                isChanged ? 'bg-amber-50/30' : 'hover:bg-slate-50/50'
              )}
            >
              <div className="col-span-4 font-semibold text-slate-800 truncate pr-2 font-sans">
                {key}
              </div>

              <div className="col-span-4 pr-2">
                {beforeVal !== undefined ? (
                  <span
                    className={cn(
                      'px-1.5 py-0.5 rounded text-[11px] break-all',
                      isChanged
                        ? 'bg-rose-50 text-rose-800 border border-rose-200/60 line-through'
                        : 'text-slate-600'
                    )}
                  >
                    {maskSensitive(key, beforeVal)}
                  </span>
                ) : (
                  <span className="text-slate-400 italic">None</span>
                )}
              </div>

              <div className="col-span-4">
                {afterVal !== undefined ? (
                  <span
                    className={cn(
                      'px-1.5 py-0.5 rounded text-[11px] break-all',
                      isChanged
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200/60 font-semibold'
                        : 'text-slate-600'
                    )}
                  >
                    {maskSensitive(key, afterVal)}
                  </span>
                ) : (
                  <span className="text-slate-400 italic">Deleted</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
