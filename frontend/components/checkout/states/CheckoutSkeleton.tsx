import React from 'react';

export function CheckoutSkeleton() {
  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-8 space-y-6 animate-pulse">
      {/* Top Banner Skeleton */}
      <div className="reignova-card rounded-2xl p-6 border border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-3.5">
          <div className="h-12 w-12 rounded-xl bg-white/10" />
          <div className="space-y-2">
            <div className="h-4 w-32 bg-white/10 rounded" />
            <div className="h-3 w-20 bg-white/5 rounded" />
          </div>
        </div>
        <div className="space-y-2 text-right">
          <div className="h-3 w-16 bg-white/5 rounded ml-auto" />
          <div className="h-6 w-28 bg-white/10 rounded" />
        </div>
      </div>

      {/* Main Grid Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Form Skeleton */}
        <div className="md:col-span-7 reignova-card rounded-2xl p-6 border border-white/10 space-y-5">
          <div className="h-5 w-48 bg-white/10 rounded mb-4" />
          <div className="grid grid-cols-2 gap-3">
            <div className="h-16 bg-white/5 rounded-xl" />
            <div className="h-16 bg-white/5 rounded-xl" />
            <div className="h-16 bg-white/5 rounded-xl" />
            <div className="h-16 bg-white/5 rounded-xl" />
          </div>
          <div className="h-12 bg-white/5 rounded-xl mt-4" />
          <div className="h-10 bg-white/5 rounded-xl" />
          <div className="h-12 bg-white/10 rounded-xl mt-6" />
        </div>

        {/* Sidebar Summary Skeleton */}
        <div className="md:col-span-5 reignova-card rounded-2xl p-6 border border-white/10 space-y-4">
          <div className="h-4 w-32 bg-white/10 rounded" />
          <div className="space-y-3 pt-2">
            <div className="h-4 bg-white/5 rounded" />
            <div className="h-4 bg-white/5 rounded" />
            <div className="h-4 bg-white/5 rounded" />
          </div>
          <div className="h-10 bg-white/10 rounded-xl mt-6" />
        </div>
      </div>
    </div>
  );
}
