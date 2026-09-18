'use client';

import React from 'react';
import Link from 'next/link';
import { ShieldAlert, ArrowLeft, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAdminAuth } from '@/context/AdminAuthContext';

interface PermissionDeniedBannerProps {
  requiredPermission?: string | string[];
  actionTitle?: string;
  onReturn?: () => void;
}

export function PermissionDeniedBanner({
  requiredPermission = 'settings.update',
  actionTitle = 'Administrative Operation',
  onReturn,
}: PermissionDeniedBannerProps) {
  const { role } = useAdminAuth();
  const perms = Array.isArray(requiredPermission) ? requiredPermission : [requiredPermission];

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-xs max-w-xl mx-auto text-center space-y-5 my-8">
      <div className="size-14 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto shadow-2xs">
        <ShieldAlert className="size-7" />
      </div>

      <div className="space-y-1.5">
        <h3 className="text-lg font-bold text-slate-900 font-sans tracking-tight">
          Permission Restricted (403 Forbidden)
        </h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
          Your current administrative persona (<span className="font-semibold text-slate-800">{role.replace(/_/g, ' ')}</span>) lacks the necessary permission token to access or execute <span className="font-semibold text-slate-800">{actionTitle}</span>.
        </p>
      </div>

      <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-left max-w-md mx-auto space-y-2">
        <div className="flex items-center justify-between text-slate-500 font-medium text-[11px]">
          <span>Required RBAC Tokens:</span>
          <span className="font-mono text-rose-600">Access Denied</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {perms.map((p) => (
            <span
              key={p}
              className="font-mono text-[11px] font-semibold bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-800"
            >
              {p}
            </span>
          ))}
        </div>
      </div>

      <div className="pt-2 flex items-center justify-center gap-3">
        {onReturn ? (
          <Button
            variant="outline"
            size="sm"
            onClick={onReturn}
            className="text-xs bg-white border-slate-200"
          >
            Back to Overview
          </Button>
        ) : (
          <Button asChild size="sm" className="text-xs bg-slate-900 text-white">
            <Link href="/admin">
              <ArrowLeft className="size-3.5 mr-1" />
              <span>Return to Command Center</span>
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}
