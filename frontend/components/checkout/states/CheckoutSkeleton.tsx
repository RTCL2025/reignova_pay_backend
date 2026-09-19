import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { ReignovaLogo } from '@/components/brand/ReignovaLogo';

export function CheckoutSkeleton() {
  return (
    <div className="w-full bg-white rounded-2xl border border-slate-200/80 shadow-xl shadow-slate-900/5 overflow-hidden flex flex-col">
      {/* Brand Header Skeleton */}
      <div className="px-5 sm:px-6 py-3.5 bg-slate-50/90 border-b border-slate-200/80 flex items-center justify-between">
        <ReignovaLogo size={28} textClassName="text-slate-900" />
        <Skeleton className="h-5 w-20 bg-slate-200 rounded-full" />
      </div>

      {/* Banner Skeleton */}
        <div className="p-6 border-b border-slate-200 bg-slate-50/70 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Skeleton className="w-10 h-10 rounded-xl bg-slate-200" />
              <div className="flex flex-col gap-1.5">
                <Skeleton className="h-4 w-32 bg-slate-200 rounded" />
                <Skeleton className="h-3 w-20 bg-slate-200 rounded" />
              </div>
            </div>
            <Skeleton className="h-6 w-28 bg-slate-200 rounded-full" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center bg-white p-4 rounded-xl border border-slate-200">
            <div className="md:col-span-7 flex gap-3.5 items-center">
              <Skeleton className="w-16 h-16 rounded-xl bg-slate-200 shrink-0" />
              <div className="flex flex-col gap-2 flex-1">
                <Skeleton className="h-3 w-24 bg-slate-200 rounded" />
                <Skeleton className="h-4 w-40 bg-slate-200 rounded" />
                <Skeleton className="h-3 w-32 bg-slate-200 rounded" />
              </div>
            </div>
            <div className="md:col-span-5 flex flex-col md:items-end gap-2">
              <Skeleton className="h-3 w-20 bg-slate-200 rounded" />
              <Skeleton className="h-7 w-36 bg-slate-200 rounded" />
              <Skeleton className="h-3 w-28 bg-slate-200 rounded" />
            </div>
          </div>
        </div>

        {/* Stepped Body Skeleton */}
        <div className="p-6 flex flex-col gap-6">
          {/* Step 1 */}
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 flex flex-col gap-3">
            <Skeleton className="h-5 w-32 bg-slate-200 rounded" />
            <div className="grid grid-cols-2 gap-3">
              <Skeleton className="h-11 bg-slate-200 rounded-lg" />
              <Skeleton className="h-11 bg-slate-200 rounded-lg" />
            </div>
          </div>

          {/* Step 2 */}
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 flex flex-col gap-4">
            <Skeleton className="h-5 w-48 bg-slate-200 rounded" />
            <div className="grid grid-cols-4 gap-3">
              <Skeleton className="h-24 bg-slate-200 rounded-xl" />
              <Skeleton className="h-24 bg-slate-200 rounded-xl" />
              <Skeleton className="h-24 bg-slate-200 rounded-xl" />
              <Skeleton className="h-24 bg-slate-200 rounded-xl" />
            </div>
            <Skeleton className="h-13 bg-slate-200 rounded-xl" />
          </div>

          <Skeleton className="h-14 w-full bg-slate-200 rounded-xl" />
        </div>
      </div>
  );
}
