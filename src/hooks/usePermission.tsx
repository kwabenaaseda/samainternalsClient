/**
 * Permission Hook
 * Hook for checking user permissions
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
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
 * Check several permissions at once.
 *
 * The calls run in PARALLEL rather than one-after-another: the sidebar needs a
 * permission per nav item, and sequential round-trips to Apps Script would make
 * the menu appear item-by-item over several seconds.
 *
 * The hook keys off a stable signature of the requested codes rather than the
 * array identity, so passing an inline array literal does not re-trigger the
 * checks on every render.
 *
 * A code that could not be answered stays `null` (unknown) -- it is never
 * reported as `false` (denied). `permissionErrors` on AppContext carries the
 * reason for such a code.
 */
export function usePermissions(permissions: PermissionCode[]): Map<PermissionCode, boolean | null> {
  const { checkPermission, isAuthenticated } = useApp();
  const [results, setResults] = useState<Map<PermissionCode, boolean | null>>(new Map());

  const signature = useMemo(() => [...permissions].sort().join('|'), [permissions]);

  const checkAll = useCallback(async () => {
    const codes = (signature === '' ? [] : (signature.split('|') as PermissionCode[]));

    if (!isAuthenticated) {
      const emptyResults = new Map<PermissionCode, boolean | null>();
      codes.forEach((code) => emptyResults.set(code, null));
      setResults(emptyResults);
      return;
    }

    const settled = await Promise.all(
      codes.map(async (code) => {
        try {
          const allowed = await checkPermission(code);
          return [code, allowed] as const;
        } catch {
          // A failed check is not a denial: report "unknown" so callers can tell
          // the two apart. It is still never read as "allowed".
          return [code, null] as const;
        }
      })
    );

    setResults(new Map(settled));
  }, [signature, checkPermission, isAuthenticated]);

  useEffect(() => {
    void checkAll();
  }, [checkAll]);

  return results;
}

/**
 * Why a permission check could not be answered, or null when it was.
 *
 * `usePermission` returning `null` means "unknown"; this returns the backend's
 * own reason (e.g. a SERVER_ERROR about a missing Role_Permissions sheet), so a
 * failed check can be shown as a failure instead of as an authorization denial.
 */
export function usePermissionError(permission: PermissionCode): string | null {
  const { permissionErrors } = useApp();
  return permissionErrors.get(permission) ?? null;
}

/** Re-ask the backend for a permission whose check previously failed. */
export function usePermissionRetry(): (permission: PermissionCode) => Promise<boolean | null> {
  const { retryPermission } = useApp();
  return retryPermission;
}

/**
 * True once every requested permission has resolved to `true`.
 * Returns `null` while any check is still outstanding.
 */
export function useAllPermissions(permissions: PermissionCode[]): boolean | null {
  const results = usePermissions(permissions);

  return useMemo(() => {
    if (permissions.length === 0) return true;

    let pending = false;
    for (const code of permissions) {
      const value = results.get(code);
      if (value === null || value === undefined) {
        pending = true;
      } else if (value === false) {
        return false;
      }
    }

    return pending ? null : true;
  }, [permissions, results]);
}

/**
 * Component that renders children only if user has the required permission
 */

interface PermissionGateProps {
  permission: PermissionCode;
  children: ReactNode;
  fallback?: ReactNode;
  loading?: ReactNode;
  /**
   * Rendered when the backend could not answer the check at all (a failure, not
   * a denial). Defaults to `fallback`, because an action that cannot be verified
   * must not be offered -- the route guard is where the reason is explained.
   */
  errorFallback?: ReactNode;
}

export function PermissionGate({
  permission,
  children,
  fallback = null,
  loading = <div className="animate-pulse bg-gray-200 dark:bg-slate-700 h-4 w-24 rounded" />,
  errorFallback,
}: PermissionGateProps) {
  const hasPermission = usePermission(permission);
  const error = usePermissionError(permission);

  if (hasPermission === null) {
    // A failed check is neither a denial nor "still loading": resolve it
    // immediately instead of leaving the caller on a spinner that never ends.
    if (error !== null) {
      return <>{errorFallback ?? fallback}</>;
    }
    return <>{loading}</>;
  }

  if (hasPermission === false) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

/**
 * Like PermissionGate but requires EVERY listed permission.
 *
 * Used where the backend enforces more than one code for a single action —
 * notably `stationery.fulfill`, which checks STATIONERY.FULFILL and, inside
 * Inventory.js, INVENTORY.ADJUST as well. Rendering the action only when both
 * are granted is a UX courtesy; the backend still enforces both independently.
 */
interface MultiPermissionGateProps {
  permissions: PermissionCode[];
  children: ReactNode;
  fallback?: ReactNode;
  loading?: ReactNode;
}

export function MultiPermissionGate({
  permissions,
  children,
  fallback = null,
  loading = <div className="animate-pulse bg-gray-200 dark:bg-slate-700 h-4 w-24 rounded" />,
}: MultiPermissionGateProps) {
  const allowed = useAllPermissions(permissions);

  if (allowed === null) {
    return <>{loading}</>;
  }

  if (!allowed) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

export default { usePermission, usePermissions, useAllPermissions, PermissionGate, MultiPermissionGate };
