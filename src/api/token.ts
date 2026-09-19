/**
 * Google Identity Services (GIS) token management.
 *
 * Owns the OAuth access token that proves the caller's Google identity to the
 * backend. Rules enforced here:
 *
 * - MEMORY ONLY: the token lives in this module's variable for its ~1 hour
 *   lifetime. It is never written to localStorage, sessionStorage, cookies,
 *   or any store. A page reload simply re-runs sign-in.
 * - NO refresh token exists in this flow (GIS implicit/token model). When the
 *   token expires, a new one is obtained by calling requestAccessToken()
 *   again; Google may renew silently from the existing browser session, but
 *   callers must treat failure as "return to the sign-in screen", never as
 *   guaranteed.
 * - The token is attached by the API client as the reserved __auth.access_token
 *   field; the backend verifies it server-side against Google's userinfo
 *   endpoint. Google answers "who are you?"; the Users sheet answers "are you
 *   allowed to use SAMS?".
 *
 * Requires VITE_GOOGLE_CLIENT_ID (an OAuth 2.0 *Web* client whose Authorized
 * JavaScript origins include the app origin, e.g. http://localhost:5173).
 */
import { GOOGLE_CLIENT_ID, GOOGLE_OAUTH_SCOPES } from './config';

/** Minimal typing of the GIS objects we use. */
interface TokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
}

interface TokenClient {
  requestAccessToken: (options?: { prompt?: '' | 'none' | 'consent' | 'select_account' }) => void;
}

interface GoogleGlobal {
  accounts?: {
    oauth2?: {
      initTokenClient: (config: {
        client_id: string;
        scope: string;
        callback: (response: TokenResponse) => void;
      }) => TokenClient;
    };
  };
}

const GIS_SCRIPT_SRC = 'https://accounts.google.com/gsi/client';

/** In-memory token state. Deliberately not exported as mutable state. */
let accessToken: string | null = null;
let expiresAtMs = 0;
let tokenClient: TokenClient | null = null;
let scriptLoadPromise: Promise<void> | null = null;
/** Resolvers waiting on the callback fired by requestAccessToken(). */
let pendingCallback: ((response: TokenResponse) => void) | null = null;

/** True when a token exists and has not passed its expiry. */
export function hasValidToken(): boolean {
  return accessToken !== null && Date.now() < expiresAtMs;
}

/** The current valid token, or null. */
export function getToken(): string | null {
  return hasValidToken() ? accessToken : null;
}

/** Forget the token (used on sign-out, invalid-token responses, reloads). */
export function clearToken(): void {
  accessToken = null;
  expiresAtMs = 0;
}

/**
 * GIS `prompt` value per requestToken mode.
 *
 * `undefined` is passed straight through so Google chooses (it shows the
 * chooser when the browser has multiple signed-in accounts and consent is
 * already granted). `'select_account'` is the only way to force the picker
 * explicitly — which is exactly what account switching requires.
 */
const TOKEN_PROMPT_BY_MODE: Record<
  'interactive' | 'silent' | 'select_account',
  '' | 'none' | 'consent' | 'select_account' | undefined
> = {
  interactive: undefined,
  silent: 'none',
  select_account: 'select_account',
};

/** Load the GIS script once per page. */
function loadGisScript(): Promise<void> {
  if (scriptLoadPromise) return scriptLoadPromise;
  scriptLoadPromise = new Promise<void>((resolve, reject) => {
    const w = window as unknown as { google?: GoogleGlobal };
    if (w.google?.accounts?.oauth2) {
      resolve();
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${GIS_SCRIPT_SRC}"]`
    );
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Failed to load Google sign-in script.')));
      return;
    }
    const script = document.createElement('script');
    script.src = GIS_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google sign-in script.'));
    document.head.appendChild(script);
  });
  return scriptLoadPromise;
}

/** Build the token client once the GIS script is present. */
async function ensureTokenClient(): Promise<TokenClient> {
  if (tokenClient) return tokenClient;
  await loadGisScript();
  const w = window as unknown as { google?: GoogleGlobal };
  const oauth2 = w.google?.accounts?.oauth2;
  if (!oauth2) {
    throw new Error('Google sign-in library is unavailable.');
  }
  tokenClient = oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: GOOGLE_OAUTH_SCOPES,
    callback: (response) => {
      if (response && response.access_token) {
        accessToken = response.access_token;
        // expires_in is seconds; shave 30s off to avoid clock-edge failures.
        const lifetime = typeof response.expires_in === 'number' ? response.expires_in : 3600;
        expiresAtMs = Date.now() + Math.max(lifetime - 30, 0) * 1000;
      } else {
        clearToken();
      }
      const resolver = pendingCallback;
      pendingCallback = null;
      resolver?.(response);
    },
  });
  return tokenClient;
}

/**
 * Run the Google sign-in/consent flow and resolve with the new token state.
 *
 * `mode: 'interactive'` lets Google decide whether consent/chooser is needed
 * and must be called from a user gesture (the "Continue with Google" button).
 * `mode: 'select_account'` explicitly forces Google's account picker, which is
 * what "Choose a different Google account" needs — it is still the same GIS
 * flow and the same token, just with the chooser shown.
 * `mode: 'silent'` asks Google to renew without UI; it may still be blocked
 * by the browser or require fresh consent — callers MUST handle rejection by
 * falling back to the interactive flow rather than assuming it succeeds.
 *
 * Resolves to true when a valid token is now held; false when Google returned
 * an error (declined consent, popup blocked, missing client config).
 */
export async function requestToken(
  mode: 'interactive' | 'silent' | 'select_account' = 'interactive'
): Promise<boolean> {
  if (!GOOGLE_CLIENT_ID) {
    throw new Error('Google sign-in is not configured (missing VITE_GOOGLE_CLIENT_ID).');
  }
  const client = await ensureTokenClient();
  await new Promise<TokenResponse>((resolve) => {
    pendingCallback = resolve;
    client.requestAccessToken({ prompt: TOKEN_PROMPT_BY_MODE[mode] });
  });
  return hasValidToken();
}

export default {
  hasValidToken,
  getToken,
  clearToken,
  requestToken,
};