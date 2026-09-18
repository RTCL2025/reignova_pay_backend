'use client';

import React from 'react';
import { useAdminAuth } from '@/context/AdminAuthContext';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface PermissionGateProps {
  permission: string | string[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
  renderDisabled?: boolean;
  disabledReason?: string;
}

export function PermissionGate({
  permission,
  children,
  fallback = null,
  renderDisabled = false,
  disabledReason,
}: PermissionGateProps) {
  const { hasPermission, role } = useAdminAuth();

  const perms = Array.isArray(permission) ? permission : [permission];
  const allowed = perms.every((p) => hasPermission(p));

  if (allowed) {
    return <>{children}</>;
  }

  if (renderDisabled) {
    const reasonText =
      disabledReason ||
      `Restricted: Your role (${role.replace(/_/g, ' ')}) lacks permission: ${perms.join(', ')}`;

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-block cursor-not-allowed opacity-50 select-none pointer-events-auto">
            <div className="pointer-events-none">{children}</div>
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="bg-slate-900 text-white text-xs max-w-xs p-2">
          {reasonText}
        </TooltipContent>
      </Tooltip>
    );
  }

  return <>{fallback}</>;
}
