/**
 * API Client Configuration
 *
 * TRANSPORT (migrated): authenticated requests go through the Apps Script
 * *Execution API* (script.googleapis.com .../scripts/{id}:run), not the /exec
 * web-app URL. The /exec transport was abandoned because Google's web-app auth
 * layer rejects cross-origin SPA calls with a 302/401 before doPost executes
 * (and those responses carry no CORS headers). The Execution API accepts the
 * GIS OAuth bearer token and serves proper CORS headers.
 */

/**
 * Google Identity Services (GIS) OAuth access token for scripts.run calls.
 */
const EXECUTION_API_SCOPE = 'https://www.googleapis.com/auth/script.external_request';
/**
 * The script itself reads/writes the school spreadsheet; scripts.run requires
 * the caller's token to carry the scopes the script needs.
 */
const SPREADSHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';

/** Placeholder so an unconfigured build fails loudly instead of silently. */
const PLACEHOLDER_SCRIPT_ID = 'YOUR_SCRIPT_ID';

const configuredScriptId = import.meta.env.VITE_GOOGLE_SCRIPT_ID;

/**
 * Apps Script project ID (from .clasp.json / the Apps Script editor URL).
 * Set `VITE_GOOGLE_SCRIPT_ID` in `.env.local` (gitignored).
 */
export const GOOGLE_SCRIPT_ID =
  typeof configuredScriptId === 'string' ? configuredScriptId.trim() : '';

/**
 * True when the Execution API transport is actually configured.
 * The auth screen uses this to explain a misconfigured build rather than
 * showing a misleading generic network error.
 */
export const IS_API_CONFIGURED =
  GOOGLE_SCRIPT_ID !== '' && !GOOGLE_SCRIPT_ID.includes('YOUR_SCRIPT_ID');

/**
 * Execution API endpoint. Calls invoke the top-level `apiRun` adapter, which
 * delegates into the existing Router pipeline.
 */
export const EXECUTION_API_URL = `https://script.googleapis.com/v1/scripts/${GOOGLE_SCRIPT_ID}:run`;

/**
 * devMode: true runs the script's latest saved code (development/head), which
 * is convenient locally but requires the caller to be an editor of the script
 * project. Production builds use the deployed API-executable version so staff
 * accounts can execute it.
 */
export const EXECUTION_API_DEV_MODE = import.meta.env.DEV === true;

/**
 * Minimum OAuth scopes for GIS:
 * - openid email profile  → identity for backend verification
 * - script.external_request → the scope scripts.run itself requires
 * - spreadsheets → the scopes the backend script needs to do its work
 * Nothing broader is requested.
 */
export const GOOGLE_OAUTH_SCOPES = [
  'openid',
  'email',
  'profile',
  EXECUTION_API_SCOPE,
  SPREADSHEETS_SCOPE,
].join(' ');

/** Request timeout in milliseconds. */
export const API_TIMEOUT = 30000;

/**
 * OAuth client for Google Identity Services (frontend Google sign-in).
 * The backend verifies the token server-side against Google's userinfo
 * endpoint. Configure with VITE_GOOGLE_CLIENT_ID in .env.local (gitignored).
 */
const configuredClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
export const GOOGLE_CLIENT_ID =
  typeof configuredClientId === 'string' ? configuredClientId.trim() : '';
export const IS_GOOGLE_CLIENT_CONFIGURED =
  GOOGLE_CLIENT_ID !== '' && !GOOGLE_CLIENT_ID.includes('YOUR_CLIENT_ID');

/**
 * Legacy web-app URL, kept ONLY for display/reference (e.g. the account
 * chooser target). No authenticated API call uses /exec any more.
 */
const configuredUrl = import.meta.env.VITE_API_URL;
export const API_BASE_URL =
  typeof configuredUrl === 'string' && configuredUrl.trim() !== ''
    ? configuredUrl.trim()
    : `https://script.google.com/macros/s/${PLACEHOLDER_SCRIPT_ID}/exec`;

/**
 * Google's own sign-out endpoint.
 *
 * This is the only real sign-out that exists for this architecture: Google's
 * session outlives the SPA, so nothing inside the SPA can end it. Opening this
 * URL performs a genuine sign-out; the in-app action drops the in-memory token.
 */
export const GOOGLE_SIGN_OUT_URL = 'https://accounts.google.com/Logout';

/**
 * Google's own account chooser, pointed back at the deployed web app.
 * Lets the user switch which Google account is used.
 */
export const GOOGLE_ACCOUNT_CHOOSER_URL =
  'https://accounts.google.com/AccountChooser?continue=' + encodeURIComponent(API_BASE_URL);

