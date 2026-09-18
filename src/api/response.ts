import type { ApiResponse, ErrorCode } from '../types';

/**
 * Handle API response envelope
 * The backend always returns HTTP 200, so we must check success field
 */
export function isSuccessResponse<T>(
  response: ApiResponse<T>
): response is { success: true; message: string; data: T } {
  return response.success === true;
}

/**
 * Extract error message from failure response
 */
export function getErrorMessage(response: ApiResponse): string {
  return response.message || 'An unknown error occurred';
}

/**
 * Extract error code from failure response
 */
export function getErrorCode(response: ApiResponse): string {
  return (response as { error?: string }).error || 'UNKNOWN_ERROR';
}

/**
 * Check if response indicates unauthorized (should redirect to login)
 */
export function isUnauthorized(response: ApiResponse): boolean {
  return (response as { error?: string }).error === 'UNAUTHORIZED';
}

/**
 * Check if response indicates forbidden (permission denied)
 */
export function isForbidden(response: ApiResponse): boolean {
  return (response as { error?: string }).error === 'FORBIDDEN';
}

/* ==========================================================================
 * Thrown-error helpers
 *
 * The API client (client.ts) does not resolve failures -- it THROWS coded
 * errors carrying `code`, `message` and `details` from the backend envelope.
 * The helpers above operate on resolved envelopes; the ones below operate on
 * the errors that actually reach a page's catch block.
 * ======================================================================== */

/** Shape the API client attaches to the errors it throws. */
export interface ApiErrorLike {
  code?: unknown;
  message?: unknown;
  details?: unknown;
}

/** The backend error code carried by a thrown error, or '' when absent. */
export function getThrownErrorCode(error: unknown): ErrorCode | '' {
  const apiError = (error ?? {}) as ApiErrorLike;
  return typeof apiError.code === 'string' ? (apiError.code as ErrorCode) : '';
}

/** A displayable message for a thrown error. Never returns an empty string. */
export function getThrownErrorMessage(
  error: unknown,
  fallback = 'Something went wrong. Please try again.'
): string {
  const apiError = (error ?? {}) as ApiErrorLike;
  return typeof apiError.message === 'string' && apiError.message.trim() !== ''
    ? apiError.message
    : fallback;
}

/**
 * Required-field names reported by a backend VALIDATION_ERROR.
 *
 * Utils.js `assertRequired_` reports `details.missingFields`. Returns [] for
 * any other error shape, so callers can merge it into field-level errors
 * without guarding.
 */
export function getMissingFields(error: unknown): string[] {
  const apiError = (error ?? {}) as ApiErrorLike;
  const details = (apiError.details ?? {}) as { missingFields?: unknown };
  if (!Array.isArray(details.missingFields)) return [];
  return details.missingFields.filter((field): field is string => typeof field === 'string');
}
