import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { useApp } from './contexts';
import { Layout } from './components/layout';
import { AuthScreen } from './pages/auth/AuthScreen';
import { Dashboard } from './pages/Dashboard';
import { Students } from './pages/students/Students';
import { StudentDetail } from './pages/students/StudentDetail';
import { CreateStudent } from './pages/students/CreateStudent';
import { EditStudent } from './pages/students/EditStudent';
import { SchoolFees } from './pages/fees/SchoolFees';
import { CreateSchoolFee } from './pages/fees/CreateSchoolFee';
import { FeedingFees } from './pages/fees/FeedingFees';
import { CreateFeedingFee } from './pages/fees/CreateFeedingFee';
import { Staff } from './pages/staff/Staff';
import { CreateStaff } from './pages/staff/CreateStaff';
import { EditStaff } from './pages/staff/EditStaff';
import { Stationery } from './pages/stationery/Stationery';
import { CreateStationery } from './pages/stationery/CreateStationery';
import { Inventory } from './pages/inventory/Inventory';
import { Settings } from './pages/Settings';
import { usePermission, usePermissionError, usePermissionRetry } from './hooks';
import type { PermissionCode } from './types';

/**
 * App
 *
 * The single authentication gate for the whole application.
 *
 * `authStatus` comes from one `auth.me` resolution in AppContext:
 *   checking        -> AuthScreen renders the checking card
 *   authenticated   -> the application shell (Layout + routes) renders
 *   unauthenticated -> AuthScreen renders the Google access screen
 *   unauthorized    -> AuthScreen renders "Access not authorized"
 *   error           -> AuthScreen renders the connection error with Retry
 *
 * Because the gate is evaluated BEFORE <Routes> is rendered, no application
 * route (Dashboard, Students, Finance, Stationery, Inventory, Staff, Settings)
 * can mount without a resolved, authenticated session.
 */
export function App() {
  const { authStatus } = useApp();

  // Auth gate: nothing in the shell renders until auth.me resolves.
  if (authStatus !== 'authenticated') {
    return <AuthScreen />;
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<RequirePermission permission="DASHBOARD.READ"><Dashboard /></RequirePermission>} />

        <Route path="/students" element={<RequirePermission permission="STUDENTS.READ"><Students /></RequirePermission>} />
        <Route path="/students/create" element={<RequirePermission permission="STUDENTS.CREATE"><CreateStudent /></RequirePermission>} />
        <Route path="/students/:id" element={<RequirePermission permission="STUDENTS.READ"><StudentDetail /></RequirePermission>} />
        <Route path="/students/:id/edit" element={<RequirePermission permission="STUDENTS.UPDATE"><EditStudent /></RequirePermission>} />

        <Route path="/school-fees" element={<RequirePermission permission="SCHOOL_FEES.READ"><SchoolFees /></RequirePermission>} />
        <Route path="/school-fees/new" element={<RequirePermission permission="SCHOOL_FEES.CREATE"><CreateSchoolFee /></RequirePermission>} />
        <Route path="/feeding-fees" element={<RequirePermission permission="FEEDING_FEES.READ"><FeedingFees /></RequirePermission>} />
        <Route path="/feeding-fees/new" element={<RequirePermission permission="FEEDING_FEES.CREATE"><CreateFeedingFee /></RequirePermission>} />

        <Route path="/staff" element={<RequirePermission permission="STAFF.READ"><Staff /></RequirePermission>} />
        <Route path="/staff/create" element={<RequirePermission permission="STAFF.CREATE"><CreateStaff /></RequirePermission>} />
        <Route path="/staff/:id/edit" element={<RequirePermission permission="STAFF.UPDATE"><EditStaff /></RequirePermission>} />
        <Route path="/stationery" element={<RequirePermission permission="STATIONERY.READ"><Stationery /></RequirePermission>} />
        <Route path="/stationery/new" element={<RequirePermission permission="STATIONERY.CREATE"><CreateStationery /></RequirePermission>} />
        <Route path="/inventory" element={<RequirePermission permission="INVENTORY.READ"><Inventory /></RequirePermission>} />
        {/* Settings has no backend permission code yet, so it is not gated here.
         * It remains available to every authenticated user. Add a SETTINGS.READ
         * (or similar) permission in the backend and declare it on the route
         * when that restriction is wanted. */}
        <Route path="/settings" element={<Settings />} />

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Layout>
  );
}

/** Route-level guard that reflects the backend's per-permission answer.
 *
 *   - `null` (still checking): renders a brief "checking access…" state so a
 *     forbidden page never mounts and flashes.
 *   - `false` (not allowed): renders a small "not authorized" card. Direct
 *     navigation to a forbidden route therefore produces a visible authorization
 *     response rather than silently mounting the page.
 *   - `true`: renders `children`.
 *
 *  The check goes through `checkPermission` in AppContext, which caches results
 *  against `permissionsCache`. In practice the sidebar pre-checks the same
 *  codes on session load, so navigating to a linked route usually resolves from
 *  cache immediately.
 *
 *  This is a UX layer on top of the backend enforcement. Every API call a page
 *  makes is still enforced server-side (FORBIDDEN responses surface through the
 *  page's own error state), so hiding the route here never weakens authorization.
 */
function RequirePermission({
  permission,
  children,
}: {
  permission: PermissionCode;
  children: React.ReactNode;
}) {
  const has = usePermission(permission);
  const navigate = useNavigate();

  if (has === null) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center text-gray-500">
          <p className="text-sm">Checking access…</p>
        </div>
      </div>
    );
  }

  if (has === false) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="max-w-sm text-center">
          <h2 className="text-lg font-medium text-gray-900 mb-2">Access not authorized</h2>
          <p className="text-gray-600 text-sm mb-6">
            You do not have permission to view this section. If you believe this
            is an error, contact your administrator.
          </p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => navigate('/dashboard')}
          >
            Return to dashboard
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export default App;
