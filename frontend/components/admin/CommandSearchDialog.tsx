'use client';

import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';

interface SearchItem {
  id: string;
  title: string;
  category: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

const SEARCH_ITEMS: SearchItem[] = [
  { id: '1', title: 'Overview Dashboard', category: 'Navigation', href: '/admin', icon: Layers },
  { id: '2', title: 'Merchants & Applications', category: 'Navigation', href: '/admin/merchants', icon: Building2 },
  { id: '3', title: 'Add New Merchant', category: 'Actions', href: '/admin/merchants?action=add', icon: Building2, badge: 'Action' },
  { id: '4', title: 'Payments Monitoring', category: 'Navigation', href: '/admin/payments', icon: CreditCard },
  { id: '5', title: 'Refund Requests & Approvals', category: 'Navigation', href: '/admin/refunds', icon: RotateCcw },
  { id: '6', title: 'Mobile Money Payouts', category: 'Navigation', href: '/admin/payouts', icon: Send },
  { id: '7', title: 'Checkout Sessions Traceability', category: 'Navigation', href: '/admin/checkout-sessions', icon: Layers },
  { id: '8', title: 'Audit Investigation Logs', category: 'Navigation', href: '/admin/audit-logs', icon: FileCode2 },
  { id: '9', title: 'Platform & RBAC Settings', category: 'Navigation', href: '/admin/settings', icon: Settings },
  { id: '10', title: 'Kipawa Logistics Express', category: 'Merchants', href: '/admin/merchants/e4a8b792-7102-4411-9a7c-86bf09121a01', icon: Building2 },
  { id: '11', title: 'Safari Air & Travel', category: 'Merchants', href: '/admin/merchants/b1c7d283-8411-4822-a98d-75cf18232b02', icon: Building2 },
  { id: '12', title: 'KP-ORD-20260918-091', category: 'Payments', href: '/admin/payments?ref=KP-ORD-20260918-091', icon: CreditCard },
];

interface CommandSearchDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CommandSearchDialog({ isOpen, onClose }: CommandSearchDialogProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
        else onClose(); // parent handles toggle
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filtered = SEARCH_ITEMS.filter((item) =>
    item.title.toLowerCase().includes(query.toLowerCase()) ||
    item.category.toLowerCase().includes(query.toLowerCase())
  );

  const handleSelect = (href: string) => {
    router.push(href);
    onClose();
    setQuery('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-slate-900/40 backdrop-blur-2xs p-4 animate-in fade-in duration-100">
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden flex flex-col">
        {/* Search Input */}
        <div className="flex items-center px-4 py-3 border-b border-slate-200 gap-2.5">
          <Search className="size-4 text-slate-400 shrink-0" />
          <input
            type="text"
            placeholder="Type a command, merchant, or reference..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            className="w-full text-sm bg-transparent border-none text-slate-900 placeholder:text-slate-400 focus:outline-hidden"
          />
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 focus:outline-hidden"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-2 divide-y divide-slate-100">
          {filtered.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500">
              No matching records or actions found.
            </div>
          ) : (
            filtered.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelect(item.href)}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left hover:bg-slate-50 focus:bg-slate-50 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="size-7 rounded-md bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 group-hover:text-slate-900">
                      <Icon className="size-3.5" />
                    </div>
                    <div>
                      <div className="text-xs font-medium text-slate-900 font-sans">
                        {item.title}
                      </div>
                      <div className="text-[11px] text-slate-500">{item.category}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {item.badge && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-sm bg-amber-50 text-amber-700 border border-amber-200">
                        {item.badge}
                      </span>
                    )}
                    <ArrowRight className="size-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="px-4 py-2 border-t border-slate-100 bg-slate-50/60 flex items-center justify-between text-[11px] text-slate-500">
          <span>Navigate with arrows</span>
          <span className="font-mono">ESC to close</span>
        </div>
      </div>
    </div>
  );
}
