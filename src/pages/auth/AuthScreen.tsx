/**
 * AuthScreen
 *
 * The single gate in front of the application shell. It renders every
 * non-authenticated auth state — checking, unauthenticated, unauthorized and
 * connection error — so no protected page can mount while the session is
 * unresolved.
 *
 * IMPORTANT: this is NOT a username/password login. Authentication is Google
 * identity: Google Identity Services issues a short-lived access token in the
 * browser (memory only), the API client attaches it as __auth.access_token,
 * and the Apps Script backend verifies it against Google's userinfo endpoint
 * before resolving the caller in the Users sheet. Real actions available here:
 *   (a) running the GIS sign-in/consent flow ("Continue with Google"),
 *   (b) re-asking the backend who the caller is (`refreshSession`), and
 *   (c) opening Google's own account chooser.
 * There is deliberately no local credential handling and no fake login API.
 */
import { useState } from 'react';
import type { ReactNode } from 'react';
import { useApp } from '../../contexts';
import { Button } from '../../components/ui';
import {
  GOOGLE_ACCOUNT_CHOOSER_URL,
  IS_API_CONFIGURED,
} from '../../api/config';
import { clearToken, requestToken } from '../../api/token';

/** Google's four-colour mark, used only as a sign-in affordance. */
function GoogleMark({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

/** School / system branding shown on every auth state. */
function BrandHeader() {
  return (
    <div className="flex flex-col items-center text-center mb-6">
      <div className="w-14 h-14 rounded-2xl bg-sidebar flex items-center justify-center shadow-sm mb-3">
        <svg
          className="w-7 h-7 text-white"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 6h16M4 12h16M4 18h10"
          />
        </svg>
      </div>
      <p className="text-xs font-semibold tracking-[0.2em] text-gray-400 uppercase">
        SAMS
      </p>
      <h1 className="text-xl font-semibold text-gray-900 mt-1">
        School Management System
      </h1>
    </div>
  );
}

/** The white card that holds every auth state. */
function AuthCard({ children }: { children: ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-6 py-7 sm:px-8">
      {children}
    </div>
  );
}

/** Round icon badge used by the non-happy states. */
function StatusIcon({
  tone,
  children,
}: {
  tone: 'danger' | 'warning';
  children: ReactNode;
}) {
  const toneClass =
    tone === 'danger' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600';

  return (
    <div
      className={`w-11 h-11 rounded-full flex items-center justify-center mb-4 ${toneClass}`}
    >
      {children}
    </div>
  );
}

/** Small heading block reused by every state. */
function StatusHeading({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <>
      <h2 className="text-base font-semibold text-gray-900">{title}</h2>
      {description && <p className="mt-2 text-sm text-gray-600">{description}</p>}
    </>
  );
}

/** Shown when the build has no real Apps Script deployment URL. */
function ConfigNotice() {
  return (
    <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
      <p className="font-medium">This build is not pointed at a deployment.</p>
      <p className="mt-1">
        Set{' '}
        <code className="font-mono text-xs bg-amber-100 px-1 rounded">VITE_API_URL</code>{' '}
        to the deployed Apps Script web-app URL (ending in{' '}
        <code className="font-mono text-xs bg-amber-100 px-1 rounded">/exec</code>) and
        rebuild. Authentication cannot resolve until then.
      </p>
    </div>
  );
}

/** The `checking` state. */
function CheckingBody() {
  return (
    <div className="flex flex-col items-center py-4">
      <div className="animate-spin rounded-full h-10 w-10 border-4 border-gray-200 border-t-primary" />
      <p className="mt-4 text-sm text-gray-600">Checking your access…</p>
      <p className="mt-1 text-xs text-gray-400">Contacting the school system</p>
    </div>
  );
}

const UNAUTHORIZED_MESSAGE =
  'Your Google account is not authorized to access this system. ' +
  'Please contact the school administrator.';

const CONNECTION_MESSAGE = 'Unable to connect to the school management system.';

/**
 * AuthScreen — renders exactly one auth state.
 */
export function AuthScreen() {
  const { authStatus, authMessage, refreshSession } = useApp();
  const [isRetrying, setIsRetrying] = useState(false);

  /** Re-run auth.me. This is the only "sign in" action the SPA can perform. */
  const retry = async () => {
    setIsRetrying(true);
    try {
      await refreshSession();
    } finally {
      setIsRetrying(false);
    }
  };

  /**
   * "Continue with Google": run the GIS sign-in/consent flow to obtain a fresh
   * access token (memory only), then re-resolve the session. If Google returns
   * an error (declined, popup blocked, misconfigured client) the app simply
   * re-renders the sign-in state; there is no fake fallback.
   */
  const signInWithGoogle = async () => {
    setIsRetrying(true);
    try {
      const gotToken = await requestToken('interactive');
      if (gotToken) {
        await refreshSession();
      }
    } finally {
      setIsRetrying(false);
    }
  };

  /** Drop the current token and restart the flow with Google's chooser. */
  const switchAccount = () => {
    clearToken();
    openAccountChooser();
  };

  /** Hand the browser to Google so its own account flow can run. */
  const openAccountChooser = () => {
    window.open(GOOGLE_ACCOUNT_CHOOSER_URL, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <BrandHeader />

        {!IS_API_CONFIGURED && <ConfigNotice />}

        <AuthCard>
          {authStatus === 'checking' && <CheckingBody />}

          {authStatus === 'unauthenticated' && (
            <div>
              <StatusHeading
                title="Sign in to continue"
                description="Access to SAMS is granted through the school's authorized Google account. There is no password to enter on this page."
              />

              <div className="mt-6 space-y-3">
                <Button
                  variant="primary"
                  size="lg"
                  className="w-full"
                  onClick={signInWithGoogle}
                  loading={isRetrying}
                  icon={<GoogleMark />}
                >
                  Continue with Google
                </Button>
                <Button
                  variant="secondary"
                  size="lg"
                  className="w-full"
                  onClick={openAccountChooser}
                >
                  Choose a different Google account
                </Button>
              </div>

              <p className="mt-4 text-xs text-gray-500">
                You will sign in with your school Google account through Google's
                own sign-in window. No password is entered on this page.
              </p>
            </div>
          )}

          {authStatus === 'unauthorized' && (
            <div>
              <StatusIcon tone="danger">
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
              </StatusIcon>

              <StatusHeading
                title="Access not authorized"
                description={UNAUTHORIZED_MESSAGE}
              />

              {authMessage && authMessage !== UNAUTHORIZED_MESSAGE && (
                <p className="mt-3 text-xs text-gray-400">
                  System response: {authMessage}
                </p>
              )}

              <div className="mt-6 space-y-3">
                <Button
                  variant="secondary"
                  size="lg"
                  className="w-full"
                  onClick={switchAccount}
                >
                  Use a different Google account
                </Button>
                <Button
                  variant="ghost"
                  size="md"
                  className="w-full"
                  onClick={retry}
                  loading={isRetrying}
                >
                  Try again
                </Button>
              </div>
            </div>
          )}

          {authStatus === 'error' && (
            <div>
              <StatusIcon tone="warning">
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M18.364 5.636a9 9 0 010 12.728M15.536 8.464a5 5 0 010 7.072M6.343 6.343l11.314 11.314"
                  />
                </svg>
              </StatusIcon>

              <StatusHeading title={CONNECTION_MESSAGE} />

              <p className="mt-3 text-sm text-gray-600">
                The school system could not be reached, so your access could not be
                verified. Check your connection and try again.
              </p>

              {authMessage && authMessage !== CONNECTION_MESSAGE && (
                <details className="mt-3">
                  <summary className="text-xs text-gray-500 cursor-pointer">
                    View technical detail
                  </summary>
                  <pre className="mt-2 p-3 bg-gray-100 rounded text-xs text-gray-700 overflow-x-auto whitespace-pre-wrap">
                    {authMessage}
                  </pre>
                </details>
              )}

              <div className="mt-6">
                <Button
                  variant="primary"
                  size="lg"
                  className="w-full"
                  onClick={retry}
                  loading={isRetrying}
                >
                  Retry
                </Button>
              </div>
            </div>
          )}
        </AuthCard>

        <p className="mt-6 text-center text-xs text-gray-400">
          Internal school tool. Access is limited to authorized staff accounts.
        </p>
      </div>
    </div>
  );
}

export default AuthScreen;