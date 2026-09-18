import {
  EXECUTION_API_URL,
  EXECUTION_API_DEV_MODE,
  API_TIMEOUT,
  IS_API_CONFIGURED,
} from './config';
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
 * TRANSPORT (migrated): requests go to the Apps Script *Execution API*
 * (script.googleapis.com/v1/scripts/{id}:run), NOT the /exec web-app URL.
 * The /exec transport was abandoned: Google's web-app auth layer answers
 * cross-origin SPA calls with 302/401 before doPost executes, and those
 * responses carry no CORS headers. The Execution API accepts the GIS OAuth
 * bearer token (Authorization header) and serves proper CORS headers.
 *
 * The bearer token travels ONLY in the Authorization header — never in a URL
 * or query string. The backend's Auth.js verifies it server-side against
 * Google's userinfo endpoint; the Users sheet decides authorization.
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

/** Raw scripts.run HTTP failure body (error.code is a Google API int code). */
interface ScriptsRunErrorBody {
  error?: { code?: number; message?: string; status?: string };
}

/**
 * Make an API request to the backend via the Execution API.
 *
 * `scripts.run` invokes the backend adapter `apiRun(action, payload, auth)`
 * (Api.js), which synthesizes the same event object the existing Router
 * pipeline parses — so the route table, __auth stripping, and response
 * envelopes are identical to the web-app transport.
 */
export async function apiRequest<T>(
  action: string,
  payload?: unknown,
  options: ApiRequestOptions = {}
): Promise<T> {
  const { timeout = API_TIMEOUT } = options;

  if (!IS_API_CONFIGURED) {
    throw codedError(
      'The school management system endpoint is not configured (missing VITE_GOOGLE_SCRIPT_ID).',
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

    const response = await fetch(EXECUTION_API_URL, {
      method: 'POST',
      headers: {
        // Bearer token = caller identity. scripts.run requires both this and
        // the scopes the script itself needs (see config.GOOGLE_OAUTH_SCOPES).
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        function: 'apiRun',
        parameters: [action, payload ?? {}, { access_token: token }],
        // Runs the latest saved code in development; the deployed API
        // executable version in production (see config comment on devMode).
        devMode: EXECUTION_API_DEV_MODE,
      }),
      signal: controller.signal,
    });

    // --- HTTP-layer errors (token / deployment / quota problems) ---
    if (!response.ok) {
      let body: ScriptsRunErrorBody = {};
      try {
        body = (await response.json()) as ScriptsRunErrorBody;
      } catch {
        // non-JSON error body — fall through with defaults
      }
      const googleMessage =
        body.error?.message || `Execution API request failed (HTTP ${response.status}).`;

      if (response.status === 401 || response.status === 403) {
        // Expired/revoked/insufficient-scope token, or caller not permitted
        // to execute this script. The token is dead — drop it so the next
        // resolveAuth starts clean and sign-in can be re-offered.
        clearToken();
        throw codedError(googleMessage, 'UNAUTHORIZED', {
          httpStatus: response.status,
          googleStatus: body.error?.status,
        });
      }

      // 404 (script/function not found), 400 (bad request), 429, 5xx, etc.
      throw codedError(googleMessage, 'SERVER_ERROR', {
        httpStatus: response.status,
        googleStatus: body.error?.status,
      });
    }

    // --- scripts.run success wrapper: { done, response: { result } } ---
    interface ScriptsRunResponse {
      done?: boolean;
      response?: { result?: unknown };
      error?: ScriptsRunErrorBody['error'];
    }
    const runResponse = (await response.json()) as ScriptsRunResponse;

    // A completed script run that itself reported a script error (exception
    // thrown inside Apps Script). Google error codes: 3 = execution failure,
    // 1 = cancelled/timeout — never flatten these into app errors.
    if (runResponse.error) {
      throw codedError(
        runResponse.error.message ||
          'The school management system failed to execute the request.',
        'SERVER_ERROR',
        { googleCode: runResponse.error.code, googleStatus: runResponse.error.status }
      );
    }
    if (!runResponse.response || runResponse.response.result === undefined) {
      throw codedError(
        'The school management system returned an unreadable response.',
        'SERVER_ERROR'
      );
    }

    // --- Application envelope (the SAMS contract) ---
    const data = runResponse.response.result as ApiResponse<T>;
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
 * Transport note: the backend contract supports GET-shaped reads, but all
 * requests go through scripts.run with the token in the Authorization header,
 * so there is no GET/POST distinction at the wire level. The action/payload
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
