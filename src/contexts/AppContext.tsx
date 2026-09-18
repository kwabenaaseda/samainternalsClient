/**
 * App Context
 *
 * Owns the single authentication state machine for the application and the
 * permission lookups used for UX decisions.
 *
 * AUTHENTICATION
 *   Google identity, resolved server-side by Apps Script via `auth.me`. There is
 *   no login form, no password, no token and no client-side session — so there is
 *   deliberately no `logout` here. The only real actions are re-asking the
 *   backend who the caller is (`refreshSession`) and, in the UI, sending the user
 *   to Google's own sign-out page.
 *
 * STATUS MACHINE
 *   checking -> authenticated | unauthenticated | unauthorized | error
 *
 *   The application shell must not render while `authStatus` is anything other
 *   than 'authenticated'.
 */

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { authCheck, resolveAuth } from '../api/auth';
import type { AuthStatus, PermissionCode, User } from '../types';

interface AppContextValue {
  /** The authenticated user, or null in every non-authenticated state. */
  user: User | null;
  /** The explicit authentication state. */
  authStatus: AuthStatus;
  /** Human-readable detail for the current non-authenticated state. */
  authMessage: string | null;
  /** True only when authStatus === 'authenticated'. */
  isAuthenticated: boolean;
  /** True only while authStatus === 'checking'. */
  isLoading: boolean;
  /** Backend-driven permission check. UX only; the backend is the boundary. */
  checkPermission: (permission: PermissionCode) => Promise<boolean | null>;
  /** Permissions already answered by `auth.check`, keyed by permission code. */
  permissionsCache: Map<string, boolean>;
  /** Re-run `auth.me` and re-derive the auth state. */
  refreshSession: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authStatus, setAuthStatus] = useState<AuthStatus>('checking');
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [permissionsCache, setPermissionsCache] = useState<Map<string, boolean>>(
    new Map()
  );

  /**
   * Ask the backend who the caller is and store the classified result.
   * Never throws: `resolveAuth` maps every outcome to an explicit state.
   */
  const refreshSession = useCallback(async () => {
    setAuthStatus('checking');
    setAuthMessage(null);
    setUser(null);
    setPermissionsCache(new Map());

    const result = await resolveAuth();

    if (result.status === 'authenticated' && result.user) {
      setUser(result.user);
      setAuthStatus('authenticated');
      setAuthMessage(null);
      return;
    }

    setUser(null);
    setAuthStatus(result.status);
    setAuthMessage(result.status === 'authenticated' ? null : result.message);
  }, []);

  const checkPermission = useCallback(
    async (permission: PermissionCode): Promise<boolean | null> => {
      if (!user) return null;

      if (permissionsCache.has(permission)) {
        return permissionsCache.get(permission) ?? null;
      }

      try {
        const result = await authCheck(permission);
        setPermissionsCache((prev) => new Map(prev).set(permission, result.allowed));
        return result.allowed;
      } catch {
        // A failed check must never be read as "allowed".
        setPermissionsCache((prev) => new Map(prev).set(permission, false));
        return false;
      }
    },
    [user, permissionsCache]
  );

  // Resolve the session once on mount.
  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  return (
    <AppContext.Provider
      value={{
        user,
        authStatus,
        authMessage,
        isAuthenticated: authStatus === 'authenticated',
        isLoading: authStatus === 'checking',
        checkPermission,
        permissionsCache,
        refreshSession,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}

