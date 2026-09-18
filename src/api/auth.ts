import { apiGet, apiPost } from './client';
import type {
  AuthCheckResponse,
  ResolvedAuth,
  User,
} from '../types';

/**
 * Authentication API
 *
 * Backend contract (from Auth.js):
 * - auth.me:    GET  ?action=auth.me
 * - auth.check: POST { action: "auth.check", payload: { permission?: string } }
 *
 * There is NO credential exchange here. The backend reads the caller's Google
 * identity from Session.getActiveUser().getEmail(), so the frontend can only ask
 * "who am I?" and react to the answer. No passwords, tokens or sessions exist,
 * and none may be invented client-side.
 */

/** Shape the API client attaches to a thrown error. */
interface ApiErrorLike {
  code?: unknown;
  message?: unknown;
  details?: unknown;
}

/**
 * Get the current authenticated user.
 * Resolves to the caller profile, or throws an error carrying `code`/`details`.
 */
export async function authMe(): Promise<User> {
  const response = await apiGet<{
    userId: string;
    staffId: string;
    email: string;
    role: string;
  }>('auth.me');

  return {
    userId: response.userId,
    staffId: response.staffId,
    email: response.email,
    role: response.role,
  };
}

/**
 * Check if current user has a specific permission.
 * Backend remains the authorization boundary; this is for UI decisions only.
 */
export async function authCheck(permission: string): Promise<AuthCheckResponse> {
  return apiPost<AuthCheckResponse>('auth.check', { permission });
}

/**
 * Check several permissions, one call each.
 */
export async function authCheckMultiple(
  permissions: string[]
): Promise<Map<string, boolean>> {
  const results = new Map<string, boolean>();

  for (const permission of permissions) {
    try {
      const result = await authCheck(permission);
      results.set(permission, result.allowed);
    } catch {
      results.set(permission, false);
    }
  }

  return results;
}

/**
 * Classify a failed `auth.me` call into a state the UI can act on.
 *
 * Backend reasons (Auth.js):
 *   no-google-identity -> no Google session at all    -> unauthenticated
 *   no-matching-user   -> Google session, not Active  -> unauthorized
 *
 * Anything else (network failure, SERVER_ERROR, unparseable body) is treated as
 * a connection/system error, so a user is never wrongly told they are signed out
 * or not authorised.
 */
export function classifyAuthFailure(error: unknown): ResolvedAuth {
  const apiError = (error ?? {}) as ApiErrorLike;
  const code = typeof apiError.code === 'string' ? apiError.code : '';
  const details = (apiError.details ?? {}) as { reason?: unknown };
  const reason = typeof details.reason === 'string' ? details.reason : '';

  if (code === 'UNAUTHORIZED') {
    if (reason === 'no-matching-user') {
      return {
        status: 'unauthorized',
        user: null,
        message:
          'Your Google account is not authorized to access this system. ' +
          'Please contact the school administrator.',
      };
    }
    if (reason === 'google-signin-redirect') {
      return {
        status: 'unauthenticated',
        user: null,
        message:
          'No authenticated Google session was attached to this browser. ' +
          'Continue with Google to sign in.',
      };
    }
    return {
      status: 'unauthenticated',
      user: null,
      message: 'No Google identity was detected for this browser session.',
    };
  }

  const fallbackMessage =
    typeof apiError.message === 'string' && apiError.message.trim() !== ''
      ? apiError.message
      : 'Unable to connect to the school management system.';

  return { status: 'error', user: null, message: fallbackMessage };
}

/**
 * Resolve the current authentication state in a single call.
 * Never throws: every outcome becomes a classified ResolvedAuth.
 */
export async function resolveAuth(): Promise<ResolvedAuth> {
  try {
    const user = await authMe();
    return { status: 'authenticated', user, message: 'Authenticated' };
  } catch (error) {
    return classifyAuthFailure(error);
  }
}

export default {
  authMe,
  authCheck,
  authCheckMultiple,
  classifyAuthFailure,
  resolveAuth,
};

