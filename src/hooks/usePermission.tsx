/**
 * Permission Hook
 * Hook for checking user permissions
 */
import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useApp } from '../contexts';
import type { PermissionCode } from '../types';

export function usePermission(permission: PermissionCode): boolean | null {
  const { checkPermission, isAuthenticated } = useApp();
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  const check = useCallback(async () => {
    if (!isAuthenticated) {
      setHasPermission(null);
      return;
    }

    const result = await checkPermission(permission);
    setHasPermission(result);
  }, [permission, checkPermission, isAuthenticated]);

  useEffect(() => {
    void check();
  }, [check]);

  return hasPermission;
}

/**
 * Hook to check multiple permissions
 */
export function usePermissions(permissions: PermissionCode[]): Map<PermissionCode, boolean | null> {
  const { checkPermission, isAuthenticated } = useApp();
  const [results, setResults] = useState<Map<PermissionCode, boolean | null>>(new Map());

  const checkAll = useCallback(async () => {
    if (!isAuthenticated) {
      const emptyResults = new Map<PermissionCode, boolean | null>();
      permissions.forEach((p) => emptyResults.set(p, null));
      setResults(emptyResults);
      return;
    }

    const newResults = new Map<PermissionCode, boolean | null>();
    for (const permission of permissions) {
      try {
        const result = await checkPermission(permission);
        newResults.set(permission, result);
      } catch {
        newResults.set(permission, false);
      }
    }
    setResults(newResults);
  }, [permissions, checkPermission, isAuthenticated]);

  useEffect(() => {
    void checkAll();
  }, [checkAll]);

  return results;
}

/**
 * Component that renders children only if user has the required permission
 */

interface PermissionGateProps {
  permission: PermissionCode;
  children: ReactNode;
  fallback?: ReactNode;
  loading?: ReactNode;
}

export function PermissionGate({
  permission,
  children,
  fallback = null,
  loading = <div className="animate-pulse bg-gray-200 h-4 w-24 rounded" />,
}: PermissionGateProps) {
  const hasPermission = usePermission(permission);

  if (hasPermission === null) {
    return <>{loading}</>;
  }

  if (hasPermission === false) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

export default { usePermission, usePermissions, PermissionGate };
