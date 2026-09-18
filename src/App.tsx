import { Navigate, Route, Routes } from 'react-router-dom';
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
import { Inventory } from './pages/inventory/Inventory';
import { Settings } from './pages/Settings';

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
        <Route path="/dashboard" element={<Dashboard />} />

        <Route path="/students" element={<Students />} />
        <Route path="/students/create" element={<CreateStudent />} />
        <Route path="/students/:id" element={<StudentDetail />} />
        <Route path="/students/:id/edit" element={<EditStudent />} />

        <Route path="/school-fees" element={<SchoolFees />} />
        <Route path="/school-fees/new" element={<CreateSchoolFee />} />
        <Route path="/feeding-fees" element={<FeedingFees />} />
        <Route path="/feeding-fees/new" element={<CreateFeedingFee />} />

        <Route path="/staff" element={<Staff />} />
        <Route path="/staff/create" element={<CreateStaff />} />

        <Route path="/inventory" element={<Inventory />} />
        <Route path="/settings" element={<Settings />} />

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Layout>
  );
}

export default App;
