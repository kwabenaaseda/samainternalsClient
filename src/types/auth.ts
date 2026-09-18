// User & Authentication Types
// Based on Auth.js: Users sheet schema

export interface User {
  userId: string;
  staffId: string;
  email: string;
  role: string;
}

export interface AuthCheckResponse {
  authenticated: boolean;
  user: User;
  permission: string | null;
  allowed: boolean;
}

/**
 * Explicit authentication states for the whole application.
 *
 *   checking        `auth.me` is in flight — nothing may render yet
 *   authenticated   Google identity resolved to an Active Users row
 *   unauthenticated no Google identity / not signed in
 *   unauthorized    a Google identity exists but is not an Active registered user
 *   error           the backend is unreachable or returned an unusable response
 */
export type AuthStatus =
  | 'checking'
  | 'authenticated'
  | 'unauthenticated'
  | 'unauthorized'
  | 'error';

/** Every auth state except the transient `checking` state. */
export type ResolvedAuthStatus = Exclude<AuthStatus, 'checking'>;

/** The outcome of one `auth.me` attempt, already classified for the UI. */
export interface ResolvedAuth {
  status: ResolvedAuthStatus;
  user: User | null;
  message: string;
}

