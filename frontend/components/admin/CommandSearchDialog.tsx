'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  Building2,
  CreditCard,
  RotateCcw,
  Send,
  Layers,
  FileCode2,
  Settings,
  ArrowRight,
  X,
  Loader2,
  PlusCircle,
} from 'lucide-react';
import { adminApiClient } from '@/lib/admin-api';

interface SearchItem {
  id: string;
  title: string;
  subtitle?: string;
  category: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  isLive?: boolean;
}

const STATIC_SYSTEM_ITEMS: SearchItem[] = [
  { id: 'sys-1', title: 'Overview Dashboard', category: 'Quick Actions & Navigation', href: '/admin', icon: Layers, badge: 'Nav' },
  { id: 'sys-2', title: 'Merchants & Applications', category: 'Quick Actions & Navigation', href: '/admin/merchants', icon: Building2, badge: 'Nav' },
  { id: 'sys-3', title: 'Add New Merchant', category: 'Quick Actions & Navigation', href: '/admin/merchants?action=add', icon: PlusCircle, badge: 'Action' },
  { id: 'sys-4', title: 'Payments Monitoring', category: 'Quick Actions & Navigation', href: '/admin/payments', icon: CreditCard, badge: 'Nav' },
  { id: 'sys-5', title: 'Refund Requests & Approvals', category: 'Quick Actions & Navigation', href: '/admin/refunds', icon: RotateCcw, badge: 'Nav' },
  { id: 'sys-6', title: 'Mobile Money Payouts', category: 'Quick Actions & Navigation', href: '/admin/payouts', icon: Send, badge: 'Nav' },
  { id: 'sys-7', title: 'Checkout Sessions Traceability', category: 'Quick Actions & Navigation', href: '/admin/checkout-sessions', icon: Layers, badge: 'Nav' },
  { id: 'sys-8', title: 'Audit Investigation Logs', category: 'Quick Actions & Navigation', href: '/admin/audit-logs', icon: FileCode2, badge: 'Nav' },
  { id: 'sys-9', title: 'Platform & RBAC Settings', category: 'Quick Actions & Navigation', href: '/admin/settings', icon: Settings, badge: 'Nav' },
];

function getCategoryIcon(category: string): React.ComponentType<{ className?: string }> {
  switch (category) {
    case 'Merchants':
      return Building2;
    case 'Payments':
      return CreditCard;
    case 'Refunds':
      return RotateCcw;
    case 'Payouts':
      return Send;
    case 'Checkout Sessions':
      return Layers;
    case 'Audit Logs':
      return FileCode2;
    default:
      return Layers;
  }
}

function getBadgeStyle(badge?: string) {
  if (!badge) return 'bg-slate-100 text-slate-600 border-slate-200';
  const upper = badge.toUpperCase();
  if (['ACTIVE', 'COMPLETED', 'SUCCESS', 'SUCCESSFUL'].includes(upper)) {
    return 'bg-emerald-50 text-emerald-700 border-emerald-200/80';
  }
  if (['PENDING', 'PROCESSING', 'ACTION'].includes(upper)) {
    return 'bg-amber-50 text-amber-700 border-amber-200/80';
  }
  if (['FAILED', 'SUSPENDED', 'CANCELLED', 'EXPIRED', 'REJECTED'].includes(upper)) {
    return 'bg-rose-50 text-rose-700 border-rose-200/80';
  }
  return 'bg-slate-100 text-slate-600 border-slate-200';
}

interface CommandSearchDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CommandSearchDialog({ isOpen, onClose }: CommandSearchDialogProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [liveResults, setLiveResults] = useState<SearchItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Debounced search query to backend
  useEffect(() => {
    if (!query.trim()) {
      setLiveResults([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const timer = setTimeout(async () => {
      try {
        const results = await adminApiClient.search.query(query);
        const mapped: SearchItem[] = results.map((res) => ({
          id: res.id,
          title: res.title,
          subtitle: res.subtitle,
          category: res.category,
          href: res.href,
          badge: res.badge,
          icon: getCategoryIcon(res.category),
          isLive: true,
        }));
        setLiveResults(mapped);
      } catch (err) {
        console.error('Search error:', err);
        setLiveResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 180);

    return () => clearTimeout(timer);
  }, [query]);

  // Combine static navigation/actions matching query with live search items
  const filteredItems = useMemo(() => {
    const qLower = query.toLowerCase().trim();

    const matchedStatic = STATIC_SYSTEM_ITEMS.filter(
      (item) =>
        item.title.toLowerCase().includes(qLower) ||
        item.category.toLowerCase().includes(qLower)
    );

    if (!qLower) {
      return STATIC_SYSTEM_ITEMS;
    }

    return [...liveResults, ...matchedStatic];
  }, [query, liveResults]);

  // Reset selected index when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredItems.length, query]);

  // Scroll selected item into view
  useEffect(() => {
    if (itemRefs.current[selectedIndex]) {
      itemRefs.current[selectedIndex]?.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth',
      });
    }
  }, [selectedIndex]);

  // Keyboard navigation & Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        onClose();
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
      if (!isOpen || filteredItems.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % filteredItems.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % filteredItems.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const selected = filteredItems[selectedIndex];
        if (selected) {
          handleSelect(selected.href);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredItems, selectedIndex, onClose]);

  if (!isOpen) return null;

  const handleSelect = (href: string) => {
    router.push(href);
    onClose();
    setQuery('');
  };

  // Group items by category for visual sections
  const categoriesMap = new Map<string, SearchItem[]>();
  filteredItems.forEach((item) => {
    const list = categoriesMap.get(item.category) || [];
    list.push(item);
    categoriesMap.set(item.category, list);
  });

  let globalIndexCounter = 0;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-md transition-opacity animate-in fade-in duration-150"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Dialog */}
      <div className="relative z-10 bg-white/95 backdrop-blur-xl rounded-2xl border border-slate-200/90 shadow-2xl max-w-xl w-full overflow-hidden flex flex-col animate-in zoom-in-95 duration-150 ring-1 ring-slate-900/5">
        {/* Search Header Input */}
        <div className="flex items-center px-4 py-3.5 border-b border-slate-100 gap-3 bg-white/80">
          <Search className="size-4.5 text-slate-400 shrink-0" />
          <input
            type="text"
            placeholder="Type a command or search live records..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            className="w-full text-sm bg-transparent border-0 outline-none ring-0 focus:outline-none focus:ring-0 focus:border-none focus-visible:outline-none focus-visible:ring-0 text-slate-900 placeholder:text-slate-400 font-medium"
          />
          {isLoading && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-indigo-50 border border-indigo-100 text-[11px] text-indigo-600 font-mono shrink-0 animate-pulse">
              <Loader2 className="size-3 animate-spin" />
              <span>Searching</span>
            </div>
          )}
          {query && !isLoading && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 focus:outline-hidden transition-colors"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        {/* Search Results / Categorized List */}
        <div className="max-h-96 overflow-y-auto p-2 space-y-3 divide-y divide-slate-100 scroll-smooth">
          {filteredItems.length === 0 ? (
            <div className="p-8 text-center flex flex-col items-center justify-center">
              <div className="size-12 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 mb-3">
                <Search className="size-5" />
              </div>
              <div className="text-sm font-semibold text-slate-900 mb-1">No matching results found</div>
              <div className="text-xs text-slate-500 max-w-xs">
                Try searching for a merchant name, payment reference, phone number, or action like <span className="font-mono bg-slate-100 px-1 py-0.5 rounded text-slate-700">Safari</span> or <span className="font-mono bg-slate-100 px-1 py-0.5 rounded text-slate-700">KP-</span>.
              </div>
            </div>
          ) : (
            Array.from(categoriesMap.entries()).map(([category, items]) => (
              <div key={category} className="pt-2 first:pt-0">
                <div className="px-3 py-1 flex items-center justify-between text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  <span>{category}</span>
                  <span className="font-mono text-[10px] bg-slate-100 px-1.5 py-0.2 rounded text-slate-500">
                    {items.length}
                  </span>
                </div>
                <div className="mt-1 space-y-1">
                  {items.map((item) => {
                    const currentIndex = globalIndexCounter++;
                    const isSelected = currentIndex === selectedIndex;
                    const Icon = item.icon;

                    return (
                      <button
                        key={item.id}
                        ref={(el) => {
                          itemRefs.current[currentIndex] = el;
                        }}
                        type="button"
                        onClick={() => handleSelect(item.href)}
                        onMouseEnter={() => setSelectedIndex(currentIndex)}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-all duration-100 group ${
                          isSelected
                            ? 'bg-slate-900 text-white shadow-md shadow-slate-900/10'
                            : 'hover:bg-slate-100/80 text-slate-900'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`size-8 rounded-lg flex items-center justify-center shrink-0 border transition-colors ${
                              isSelected
                                ? 'bg-slate-800 border-slate-700 text-white'
                                : 'bg-slate-100 border-slate-200/70 text-slate-600 group-hover:bg-white group-hover:text-slate-900'
                            }`}
                          >
                            <Icon className="size-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span
                                className={`text-xs font-semibold truncate font-sans ${
                                  isSelected ? 'text-white' : 'text-slate-900'
                                }`}
                              >
                                {item.title}
                              </span>
                              {item.isLive && (
                                <span
                                  className={`text-[9px] font-mono px-1 py-0.2 rounded ${
                                    isSelected
                                      ? 'bg-indigo-500/30 text-indigo-200 border border-indigo-400/30'
                                      : 'bg-indigo-50 text-indigo-600 border border-indigo-200/60'
                                  }`}
                                >
                                  Live DB
                                </span>
                              )}
                            </div>
                            {item.subtitle && (
                              <div
                                className={`text-[11px] truncate mt-0.5 ${
                                  isSelected ? 'text-slate-300' : 'text-slate-500'
                                }`}
                              >
                                {item.subtitle}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 ml-3">
                          {item.badge && (
                            <span
                              className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md border ${
                                isSelected
                                  ? 'bg-white/10 text-white border-white/20'
                                  : getBadgeStyle(item.badge)
                              }`}
                            >
                              {item.badge}
                            </span>
                          )}
                          <ArrowRight
                            className={`size-3.5 transition-transform ${
                              isSelected
                                ? 'text-white translate-x-0.5'
                                : 'text-slate-400 opacity-0 group-hover:opacity-100'
                            }`}
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer shortcuts & helper info */}
        <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50/80 flex items-center justify-between text-[11px] text-slate-500">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 font-medium">
              <kbd className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200 text-slate-700 shadow-2xs">
                ↑
              </kbd>
              <kbd className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200 text-slate-700 shadow-2xs">
                ↓
              </kbd>{' '}
              Navigate
            </span>
            <span className="flex items-center gap-1 font-medium">
              <kbd className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200 text-slate-700 shadow-2xs">
                ↵
              </kbd>{' '}
              Select
            </span>
          </div>
          <div className="flex items-center gap-2 font-mono text-[10px] text-slate-400">
            <kbd className="bg-white px-1.5 py-0.5 rounded border border-slate-200 text-slate-600 shadow-2xs">
              ESC
            </kbd>{' '}
            Close
          </div>
        </div>
      </div>
    </div>
  );
}
