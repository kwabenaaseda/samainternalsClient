// API Response Envelope Types
// Based on Response.js from the backend

export interface SuccessResponse<T = unknown> {
  success: true;
  message: string;
  data: T;
}

export interface FailureResponse {
  success: false;
  message: string;
  error: ErrorCode;
  details?: unknown;
}

export type ApiResponse<T = unknown> = SuccessResponse<T> | FailureResponse;

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'SERVER_ERROR';
