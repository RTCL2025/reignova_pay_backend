import React, { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowUpDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from './EmptyState';
import { cn } from '@/lib/utils';

export interface Column<T> {
  key: string;
  header: string;
  render?: (item: T) => React.ReactNode;
  className?: string;
  sortable?: boolean;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  isLoading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  onRowClick?: (item: T) => void;
  keyExtractor: (item: T) => string;
  pageSize?: number;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
  currentPage?: number;
  onPageChange?: (page: number) => void;
  totalCount?: number;
  className?: string;
}

export function DataTable<T>({
  columns,
  data,
  isLoading = false,
  emptyTitle = 'No records found',
  emptyDescription = 'There are currently no items matching your criteria.',
  onRowClick,
  keyExtractor,
  pageSize: propPageSize,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50, 100],
  currentPage: propCurrentPage,
  onPageChange,
  totalCount: propTotalCount,
  className,
}: DataTableProps<T>) {
  const [internalPage, setInternalPage] = useState(1);
  const [internalPageSize, setInternalPageSize] = useState(propPageSize || 10);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const pageSize = propPageSize ?? internalPageSize;
  const page = propCurrentPage ?? internalPage;
  const isServerPaginated = propTotalCount !== undefined;

  // Sorting
  const sortedData = React.useMemo(() => {
    if (!sortKey) return data;
    return [...data].sort((a: any, b: any) => {
      const valA = a[sortKey];
      const valB = b[sortKey];
      if (valA === valB) return 0;
      if (valA === null || valA === undefined) return 1;
      if (valB === null || valB === undefined) return -1;
      const cmp = valA < valB ? -1 : 1;
      return sortOrder === 'asc' ? cmp : -cmp;
    });
  }, [data, sortKey, sortOrder]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
  };

  // Pagination bounds calculation
  const totalItems = isServerPaginated ? propTotalCount : sortedData.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  
  const displayData = isServerPaginated
    ? sortedData
    : sortedData.slice((page - 1) * pageSize, page * pageSize);

  const startItem = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, totalItems);

  const goToPage = (newPage: number) => {
    const target = Math.max(1, Math.min(totalPages, newPage));
    if (onPageChange) {
      onPageChange(target);
    } else {
      setInternalPage(target);
    }
  };

  const handlePageSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newSize = Number(e.target.value);
    if (onPageSizeChange) {
      onPageSizeChange(newSize);
    } else {
      setInternalPageSize(newSize);
      setInternalPage(1);
    }
  };

  return (
    <div className={cn('bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden flex flex-col', className)}>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/75 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn('px-4 py-3 select-none', col.className)}
                >
                  {col.sortable ? (
                    <button
                      type="button"
                      onClick={() => handleSort(col.key)}
                      className="inline-flex items-center gap-1 hover:text-slate-900 focus:outline-hidden"
                    >
                      <span>{col.header}</span>
                      <ArrowUpDown className="size-3 text-slate-400" />
                    </button>
                  ) : (
                    <span>{col.header}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
            {isLoading ? (
              Array.from({ length: pageSize > 5 ? 5 : pageSize }).map((_, rIdx) => (
                <tr key={`loading-row-${rIdx}`} className="animate-pulse">
                  {columns.map((col, cIdx) => (
                    <td key={`loading-col-${cIdx}`} className="px-4 py-3.5">
                      <Skeleton className="h-4 w-full max-w-[120px] bg-slate-100" />
                    </td>
                  ))}
                </tr>
              ))
            ) : displayData.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="p-8 text-center">
                  <EmptyState title={emptyTitle} description={emptyDescription} />
                </td>
              </tr>
            ) : (
              displayData.map((item) => (
                <tr
                  key={keyExtractor(item)}
                  onClick={() => onRowClick?.(item)}
                  className={cn(
                    'transition-colors duration-100 hover:bg-slate-50/80',
                    onRowClick && 'cursor-pointer'
                  )}
                >
                  {columns.map((col) => (
                    <td key={col.key} className={cn('px-4 py-3.5 align-middle', col.className)}>
                      {col.render ? col.render(item) : (item as any)[col.key] ?? '—'}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {!isLoading && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-slate-200 bg-slate-50/50 text-xs text-slate-500">
          <div className="flex items-center gap-4">
            <div>
              Showing <span className="font-semibold text-slate-900">{startItem}</span> to{' '}
              <span className="font-semibold text-slate-900">{endItem}</span> of{' '}
              <span className="font-semibold text-slate-900">{totalItems}</span> results
            </div>

            <div className="flex items-center gap-1.5 text-slate-600">
              <label htmlFor="pageSizeSelect" className="text-slate-500 text-[11px]">
                Rows per page:
              </label>
              <select
                id="pageSizeSelect"
                value={pageSize}
                onChange={handlePageSizeChange}
                className="h-7 px-2 py-0.5 rounded border border-slate-200 bg-white text-xs text-slate-800 font-medium focus:outline-hidden hover:border-slate-300"
              >
                {pageSizeOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => goToPage(1)}
              title="First Page"
              className="h-8 w-8 p-0 text-slate-700 bg-white border-slate-200 hover:bg-slate-50"
            >
              <ChevronsLeft className="size-3.5" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => goToPage(page - 1)}
              title="Previous Page"
              className="h-8 px-2.5 text-xs text-slate-700 bg-white border-slate-200 hover:bg-slate-50"
            >
              <ChevronLeft className="size-3.5 mr-1" />
              <span>Previous</span>
            </Button>

            <span className="px-3 font-mono text-xs text-slate-700 font-medium">
              {page} / {totalPages}
            </span>

            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => goToPage(page + 1)}
              title="Next Page"
              className="h-8 px-2.5 text-xs text-slate-700 bg-white border-slate-200 hover:bg-slate-50"
            >
              <span>Next</span>
              <ChevronRight className="size-3.5 ml-1" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => goToPage(totalPages)}
              title="Last Page"
              className="h-8 w-8 p-0 text-slate-700 bg-white border-slate-200 hover:bg-slate-50"
            >
              <ChevronsRight className="size-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

