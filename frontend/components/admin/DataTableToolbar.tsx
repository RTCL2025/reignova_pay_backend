'use client';

import React from 'react';
import { Search, X, Filter } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface FilterOption {
  label: string;
  value: string;
}

interface DataTableToolbarProps {
  search?: string;
  onSearchChange?: (val: string) => void;
  searchPlaceholder?: string;
  statusFilter?: {
    value: string;
    options: FilterOption[];
    onChange: (val: string) => void;
  };
  extraFilters?: React.ReactNode;
  hasActiveFilters?: boolean;
  onReset?: () => void;
  actions?: React.ReactNode;
  className?: string;
}

export function DataTableToolbar({
  search,
  onSearchChange,
  searchPlaceholder = 'Search records...',
  statusFilter,
  extraFilters,
  hasActiveFilters,
  onReset,
  actions,
  className,
}: DataTableToolbarProps) {
  return (
    <div
      className={cn(
        'flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4',
        className
      )}
    >
      <div className="flex items-center gap-2.5 flex-1 flex-wrap">
        {onSearchChange !== undefined && (
          <div className="relative w-full sm:w-64 md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
            <Input
              type="text"
              placeholder={searchPlaceholder}
              value={search || ''}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-9 h-9 text-xs bg-white border-slate-200 focus-visible:ring-1 focus-visible:ring-slate-900 rounded-lg"
            />
            {search && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-hidden"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        )}

        {statusFilter && (
          <div className="flex items-center gap-1.5">
            <select
              value={statusFilter.value}
              onChange={(e) => statusFilter.onChange(e.target.value)}
              className="h-9 px-3 text-xs bg-white border border-slate-200 text-slate-700 rounded-lg hover:border-slate-300 focus:outline-hidden focus:ring-1 focus:ring-slate-900 font-medium cursor-pointer"
            >
              {statusFilter.options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {extraFilters}

        {hasActiveFilters && onReset && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onReset}
            className="h-9 px-2 text-xs text-slate-500 hover:text-slate-900 gap-1"
          >
            <X className="size-3" />
            <span>Reset filters</span>
          </Button>
        )}
      </div>

      {actions && (
        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
          {actions}
        </div>
      )}
    </div>
  );
}
