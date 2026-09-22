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

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { authCheck, resolveAuth } from '../api/auth';
import { getThrownErrorMessage } from '../api/response';
import { hasValidToken, requestToken } from '../api/token';
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
  /** Backend-driven permission check. UX only; the backend is the boundary.
   *
   *  Resolves to:
   *    true  - the backend granted the permission
   *    false - the backend DENIED it
   *    null  - it could not be answered (no session yet, or the check failed).
   *            Never treat null as a denial; see `permissionErrors`.
   */
  checkPermission: (permission: PermissionCode) => Promise<boolean | null>;
  /** Permissions already answered by `auth.check`, keyed by permission code. */
  permissionsCache: Map<string, boolean>;
  /**
   * Why a permission check could not be answered, keyed by permission code.
   *
   * A code missing from `permissionsCache` and present here is UNKNOWN, not
   * denied: the answer never arrived. Without this map the UI cannot tell a
   * denied permission from a backend/transport failure, and a structural
   * problem (e.g. an unseeded Role_Permissions sheet) is presented to the user
   * as "Access not authorized".
   */
  permissionErrors: Map<string, string>;
  /** Forget a failed check and ask the backend again. */
  retryPermission: (permission: PermissionCode) => Promise<boolean | null>;
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
  const [permissionErrors, setPermissionErrors] = useState<Map<string, string>>(
    new Map()
  );

  /**
   * Live mirrors of the two maps above.
   *
   * `checkPermission` reads through these refs rather than the state values so
   * its IDENTITY does not change when a check resolves. That matters: the
   * permission hooks keep `checkPermission` in their dependency arrays, so a
   * callback that changed on every cache write would re-create every consumer's
   * effect closure and re-fire the entire batch of checks. The sidebar's seven
   * codes would then issue 7+6+5+4+3+2+1 = 28 `auth.check` requests instead of 7,
   * with each mounted PermissionGate adding its own repeats -- a request storm
   * against Apps Script whose rate-limit/timeout failures were then cached as
   * denials (see `checkPermission`).
   */
  const permissionsCacheRef = useRef<Map<string, boolean>>(new Map());
  const permissionErrorsRef = useRef<Map<string, string>>(new Map());
  /** Checks in flight, so N concurrent callers share ONE request per code. */
  const inFlightChecksRef = useRef<Map<string, Promise<boolean | null>>>(new Map());

  /**
   * Ask the backend who the caller is and store the classified result.
   * Never throws: `resolveAuth` maps every outcome to an explicit state.
   *
   * On page load / refresh, the GIS access token is memory-only and therefore
   * cleared. Before calling `auth.me`, attempt a SILENT token refresh via the
   * existing Google browser session. If the browser still has an active Google
   * session, GIS renews the token without user interaction and `auth.me` succeeds.
   * If silent refresh fails (no Google session, consent required, etc.), fall
   * through to the normal auth.me classification, which will surface the proper
   * "Continue with Google" screen.
   */
  const refreshSession = useCallback(async () => {
    setAuthStatus('checking');
    setAuthMessage(null);
    setUser(null);
    setPermissionsCache(new Map());
    setPermissionErrors(new Map());
    permissionsCacheRef.current = new Map();
    permissionErrorsRef.current = new Map();
    inFlightChecksRef.current = new Map();

    // Try to restore the token from the existing Google browser session before
    // asking the backend who the caller is. This turns a "you are signed out"
    // refresh into a silent re-entry when the browser still holds a Google
    // session. It is deliberately best-effort AND non-throwing: GIS can abort
    // the hidden-iframe silent request (Firefox surfaces this as
    // NS_ERROR_ABORT, e.g. when the OAuth endpoint requires interaction or the
    // request is cancelled during page teardown). That must never escape as an
    // uncaught rejection — the auth.me call below classifies the outcome
    // normally either way.
    if (!hasValidToken()) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          requestToken('silent'),
          new Promise<boolean>((resolve) => {
            timer = setTimeout(() => resolve(false), 4000);
          }),
        ]);
      } catch {
        // Silent refresh failed — fall through to auth.me classification.
      } finally {
        if (timer) clearTimeout(timer);
      }
    }

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

      const cached = permissionsCacheRef.current.get(permission);
      if (cached !== undefined) return cached;

      // Share one request between concurrent callers (the sidebar batch, route
      // guards and PermissionGates routinely ask for the same code at once).
      const inFlight = inFlightChecksRef.current.get(permission);
      if (inFlight) return inFlight;

      const request = (async (): Promise<boolean | null> => {
        try {
          const result = await authCheck(permission);
          permissionsCacheRef.current.set(permission, result.allowed);
          setPermissionsCache(new Map(permissionsCacheRef.current));
          if (permissionErrorsRef.current.delete(permission)) {
            setPermissionErrors(new Map(permissionErrorsRef.current));
          }
          return result.allowed;
        } catch (error) {
          // A FAILED check is not a denial. Caching it as `false` (the previous
          // behaviour) turned a transport/rate-limit/timeout failure -- or the
          // backend's own "Role_Permissions sheet is missing; run
          // setupRolePermissions()" SERVER_ERROR -- into a permanent, silent
          // "Access not authorized" for the whole session. Record WHY and report
          // "unknown" instead, so the UI can say so and the user can retry.
          permissionsCacheRef.current.delete(permission);
          setPermissionsCache(new Map(permissionsCacheRef.current));
          permissionErrorsRef.current.set(
            permission,
            getThrownErrorMessage(
              error,
              'The authorization service could not be reached.'
            )
          );
          setPermissionErrors(new Map(permissionErrorsRef.current));
          return null;
        } finally {
          inFlightChecksRef.current.delete(permission);
        }
      })();

      inFlightChecksRef.current.set(permission, request);
      return request;
    },
    [user]
  );

  /**
   * Drop a failed/known answer for one permission and ask the backend again.
   * A no-op for a permission that is already answered (the cache wins), so this
   * is safe to wire to a "Try again" control.
   */
  const retryPermission = useCallback(
    async (permission: PermissionCode): Promise<boolean | null> => {
      permissionsCacheRef.current.delete(permission);
      permissionErrorsRef.current.delete(permission);
      setPermissionsCache(new Map(permissionsCacheRef.current));
      setPermissionErrors(new Map(permissionErrorsRef.current));
      inFlightChecksRef.current.delete(permission);
      return checkPermission(permission);
    },
    [checkPermission]
  );

  // Resolve the session once on mount. refreshSession is non-throwing by
  // design; the catch here is a final guarantee against uncaught promise
  // rejections during page load/refresh.
  useEffect(() => {
    refreshSession().catch(() => {
      /* state already classified as a non-authenticated outcome */
    });
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
        permissionErrors,
        retryPermission,
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

