'use client';

import React, { useState } from 'react';
import { X, Copy, Check, Code, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface DrawerRow {
  label: string;
  value: React.ReactNode;
  copyable?: string;
  isMono?: boolean;
}

interface DetailsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  rows?: DrawerRow[];
  rawJson?: Record<string, unknown> | null;
  children?: React.ReactNode;
  footerActions?: React.ReactNode;
  widthClass?: string;
}

export function DetailsDrawer({
  isOpen,
  onClose,
  title,
  subtitle,
  badge,
  rows,
  rawJson,
  children,
  footerActions,
  widthClass = 'max-w-xl',
}: DetailsDrawerProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'details' | 'json'>('details');

  if (!isOpen) return null;

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Blurred Backdrop Overlay */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity animate-in fade-in duration-150"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div
          className={cn(
            'w-screen bg-white border-l border-slate-200 shadow-2xl flex flex-col z-10 animate-in slide-in-from-right duration-200',
            widthClass
          )}
        >
          {/* Header */}
          <div className="px-6 py-5 border-b border-slate-200 bg-slate-50/70 flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-lg font-bold text-slate-900 tracking-tight font-sans">
                  {title}
                </h2>
                {badge}
              </div>
              {subtitle && (
                <p className="text-xs text-slate-500 font-mono tracking-tight">{subtitle}</p>
              )}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 focus:outline-hidden transition-colors"
            >
              <X className="size-5" />
            </button>
          </div>

          {/* Subheader tabs if rawJson provided */}
          {rawJson && (
            <div className="px-6 py-2 border-b border-slate-200/80 bg-slate-50/50 flex items-center">
              <div className="inline-flex p-1 bg-slate-200/60 rounded-xl gap-1 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setActiveTab('details')}
                  className={cn(
                    'px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer',
                    activeTab === 'details'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  )}
                >
                  <FileText className="size-3.5" />
                  <span>Overview</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('json')}
                  className={cn(
                    'px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer',
                    activeTab === 'json'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  )}
                >
                  <Code className="size-3.5" />
                  <span>Raw JSON</span>
                </button>
              </div>
            </div>
          )}

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {activeTab === 'details' ? (
              <>
                {rows && rows.length > 0 && (
                  <div className="rounded-lg border border-slate-200/80 divide-y divide-slate-100 overflow-hidden bg-white text-xs">
                    {rows.map((row, idx) => (
                      <div
                        key={row.label + idx}
                        className="flex items-center justify-between p-3 hover:bg-slate-50/50"
                      >
                        <span className="text-slate-500 font-medium">{row.label}</span>
                        <div className="flex items-center gap-1.5 text-right font-medium text-slate-900">
                          <span className={cn(row.isMono && 'font-mono text-slate-800')}>
                            {row.value}
                          </span>
                          {row.copyable && (
                            <button
                              type="button"
                              onClick={() => handleCopy(row.copyable!, `row-${idx}`)}
                              className="p-1 text-slate-400 hover:text-slate-700 focus:outline-hidden"
                            >
                              {copiedKey === `row-${idx}` ? (
                                <Check className="size-3 text-emerald-600" />
                              ) : (
                                <Copy className="size-3" />
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {children}
              </>
            ) : (
              <div className="relative">
                <div className="absolute right-3 top-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      handleCopy(JSON.stringify(rawJson, null, 2), 'raw-json')
                    }
                    className="h-7 text-xs bg-white border-slate-200 gap-1"
                  >
                    {copiedKey === 'raw-json' ? (
                      <>
                        <Check className="size-3 text-emerald-600" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="size-3" />
                        <span>Copy JSON</span>
                      </>
                    )}
                  </Button>
                </div>
                <pre className="p-4 rounded-xl bg-slate-900 text-slate-100 font-mono text-xs overflow-x-auto leading-relaxed max-h-[600px]">
                  {JSON.stringify(rawJson, null, 2)}
                </pre>
              </div>
            )}
          </div>

          {/* Footer */}
          {footerActions && (
            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50/80 flex items-center justify-end gap-2.5">
              {footerActions}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
