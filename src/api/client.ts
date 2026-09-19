import { API_BASE_URL, API_TIMEOUT, IS_EXEC_URL_CONFIGURED } from './config';
import { getToken, clearToken } from './token';
import type { ApiResponse } from '../types';

/**
 * Centralized API client
 * All API calls go through this function
 *
 * Backend contract (from Response.js):
 * - The application envelope always carries a `success` boolean
 * - Success: { success: true, message: string, data: T }
 * - Failure: { success: false, message: string, error: ErrorCode, details?: any }
 *
 * TRANSPORT: requests POST to the Apps Script *web app* /exec URL
 * (VITE_API_URL). The transport is deliberate and load-bearing: with the Web
 * App deployed `executeAs: USER_DEPLOYING`, SpreadsheetApp runs as the SCRIPT
 * OWNER, so a signed-in staff member never needs Drive access to the school
 * spreadsheet. The Execution API cannot do this — it has no `executeAs`
 * setting, so the script would run as the *caller* and fail with
 * PERMISSION_DENIED for every non-owner. `apiRun` / scripts.run remains
 * available in Api.js for other clients.
 *
 * The request is a CORS "simple request": Content-Type text/plain (so no
 * preflight is triggered) and NO Authorization header. The access token
 * therefore travels in the body as the reserved `payload.__auth.access_token`
 * field — never in a URL or query string, and never in localStorage or
 * sessionStorage. Router.js strips __auth before dispatch and Auth.js verifies
 * it server-side against Google's userinfo endpoint; the Users sheet decides
 * authorization.
 *
 * NOTE: /exec answers a POST with a 302 to script.googleusercontent.com, which
 * fetch follows transparently (redirect: 'follow').
 */

interface ApiRequestOptions {
  method?: 'GET' | 'POST';
  timeout?: number;
}

/** Error code carrier for the structured errors this client throws. */
type CodedError = Error & { code: string; details?: unknown };

function codedError(message: string, code: string, details?: unknown): CodedError {
  const error = new Error(message) as CodedError;
  error.code = code;
  if (details !== undefined) error.details = details;
  return error;
}

/**
 * Make an API request to the backend via the Apps Script web-app (/exec)
 * transport, which executes as the deploying user (the script owner).
 *
 * The request body is the SAME contract the router already parses:
 *   { "action": "...", "payload": { ..., "__auth": { "access_token": "..." } } }
 * so the route table, __auth stripping, and response envelopes are unchanged.
 */
export async function apiRequest<T>(
  action: string,
  payload?: unknown,
  options: ApiRequestOptions = {}
): Promise<T> {
  const { timeout = API_TIMEOUT } = options;

  if (!IS_EXEC_URL_CONFIGURED) {
    throw codedError(
      'The school management system endpoint is not configured (missing VITE_API_URL).',
      'SERVER_ERROR'
    );
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const token = getToken();
    if (!token) {
      // No valid GIS token: the caller must run the Google sign-in flow.
      // Throwing UNAUTHORIZED (not a generic network error) lets the auth
      // gate route the user to "Continue with Google".
      throw codedError(
        'No Google sign-in token is available. Continue with Google to use the system.',
        'UNAUTHORIZED',
        { reason: 'no-token' }
      );
    }

    // Payload must be a plain object: __auth travels INSIDE it, and Router.js
    // merges the body payload over any query parameters.
    const basePayload =
      payload !== null && typeof payload === 'object' && !Array.isArray(payload)
        ? (payload as Record<string, unknown>)
        : {};

    // A CORS "simple request" (text/plain => no preflight) with NO Authorization
    // header: the token's only channel is the reserved body field below.
    const response = await fetch(API_BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action,
        payload: Object.assign({}, basePayload, {
          __auth: { access_token: token },
        }),
      }),
      // /exec answers a POST with a 302 to script.googleusercontent.com.
      redirect: 'follow',
      signal: controller.signal,
    });

    // --- HTTP-layer errors (deployment / web-app auth layer / quota) ---
    // Google answers these with an HTML page rather than the SAMS envelope, so
    // only the HTTP status is usable here.
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        // Google's web-app auth layer rejected the caller, so this token is not
        // usable against the deployment. Drop it so the next resolveAuth starts
        // clean and sign-in can be re-offered.
        clearToken();
        throw codedError(
          'Google sign-in was rejected for this system. Sign in again.',
          'UNAUTHORIZED',
          { httpStatus: response.status, reason: 'exec-auth-rejected' }
        );
      }

      // 404 (wrong URL), 400, 429, 5xx, etc.
      throw codedError(
        `The school management system endpoint failed (HTTP ${response.status}).`,
        'SERVER_ERROR',
        { httpStatus: response.status }
      );
    }

    // --- Application envelope (the SAMS contract), returned verbatim ---
    // /exec returns the JSON that ContentService wrote, so the body IS the
    // envelope: { success, message, data } | { success, message, error, details }.
    const text = await response.text();
    let data: ApiResponse<T>;
    try {
      data = JSON.parse(text) as ApiResponse<T>;
    } catch {
      // An HTML page (wrong URL, deployment permission wall, Google error).
      throw codedError(
        'The school management system returned an unreadable response.',
        'SERVER_ERROR',
        { reason: 'non-json-response' }
      );
    }

    if (!data || typeof data.success !== 'boolean') {
      throw codedError(
        'The school management system returned an unreadable response.',
        'SERVER_ERROR'
      );
    }

    if (!data.success) {
      // Backend rejected the identity (Users sheet allowlist, expired token
      // detected server-side, etc.): drop the local token so the auth screen
      // can offer sign-in instead of looping on a dead identity.
      if (data.error === 'UNAUTHORIZED') {
        clearToken();
      }
      throw codedError(data.message, data.error || 'UNKNOWN', data.details);
    }

    return data.data as T;
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      throw new Error('Request timed out');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * GET request helper
 *
 * Transport note: the backend contract supports GET-shaped reads, but every
 * request reaches /exec as a POST (Apps Script's web-app entry point), so
 * there is no GET/POST distinction at the wire level. The action/payload
 * semantics are preserved exactly.
 */
export async function apiGet<T>(
  action: string,
  params?: Record<string, unknown>
): Promise<T> {
  return apiRequest<T>(action, params);
}

/**
 * POST request helper
 */
export async function apiPost<T>(
  action: string,
  payload?: unknown
): Promise<T> {
  return apiRequest<T>(action, payload, { method: 'POST' });
}

export default apiRequest;
