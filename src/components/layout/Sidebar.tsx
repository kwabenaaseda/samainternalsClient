/**
 * Sidebar Component
 * Navigation sidebar with grouped menu items, filtered by permission.
 *
 * Visibility rules:
 *   - Each nav item declares an optional `permission` (a PermissionCode).
 *   - On mount (and whenever the session/user changes) the sidebar checks the
 *     declared permissions against the backend via `auth.check` and renders
 *     only the items whose permission resolved to `true`.
 *   - Items whose permission is still `null` (checking) are NOT rendered, so a
 *     forbidden section never flashes briefly before disappearing.
 *   - The backend `auth.check` remains the authorization boundary. Hiding a
 *     sidebar item is a UX courtesy; direct navigation to a forbidden route is
 *     enforced separately by the route guards in `App.tsx` and by the backend
 *     on every API call the page makes.
 *
 * Settings has no backend permission code yet, so it is intentionally not gated
 * here. See the notes in App.tsx / the post-fix report.
 */

import { useMemo } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { usePermissions } from '../../hooks';
import { useApp } from '../../contexts';
import type { NavGroup, PermissionCode } from '../../types';
import { getUserInitials } from '../../utils/user';

/** Highest-level section label text. */
const GROUP_LABELS: Record<string, string> = {
  overview: 'OVERVIEW',
  people: 'PEOPLE',
  finance: 'FINANCE',
  inventory: 'INVENTORY',
  system: 'SYSTEM',
};

/** Nav items with an explicit permission gate where the MVP1 role design gives
 *  a single clear gate for "can this role even see this section?".
 *
 *  A `permission` here is a UI visibility declaration, not a second permission
 *  system — the backend `auth.check` is what actually decides. If the backend
 *  seeds a role with a permission, the item appears; if not, it does not.
 */
const navGroups: NavGroup[] = [
  {
    id: 'overview',
    label: GROUP_LABELS.overview,
    items: [
      { id: 'dashboard', label: 'Dashboard', href: '/dashboard', permission: 'DASHBOARD.READ' },
    ],
  },
  {
    id: 'people',
    label: GROUP_LABELS.people,
    items: [
      { id: 'students', label: 'Students', href: '/students', permission: 'STUDENTS.READ' },
      { id: 'staff', label: 'Staff', href: '/staff', permission: 'STAFF.READ' },
    ],
  },
  {
    id: 'finance',
    label: GROUP_LABELS.finance,
    items: [
      { id: 'schoolFees', label: 'School Fees', href: '/school-fees', permission: 'SCHOOL_FEES.READ' },
      { id: 'feedingFees', label: 'Feeding Fees', href: '/feeding-fees', permission: 'FEEDING_FEES.READ' },
      { id: 'stationery', label: 'Stationery', href: '/stationery', permission: 'STATIONERY.READ' },
    ],
  },
  {
    id: 'inventory',
    label: GROUP_LABELS.inventory,
    items: [
      { id: 'inventory', label: 'Inventory', href: '/inventory', permission: 'INVENTORY.READ' },
    ],
  },
  {
    id: 'system',
    label: GROUP_LABELS.system,
    items: [
      // Settings has no backend permission code yet, so it is not gated on a
      // PermissionCode. It remains visible to every authenticated user until a
      // SETTINGS.READ (or similar) code exists in the backend.
      { id: 'settings', label: 'Settings', href: '/settings' },
    ],
  },
];

/** Permission codes that must be checked so the sidebar can decide what to show. */
const SIDEBAR_PERMISSION_CODES: PermissionCode[] = [
  'DASHBOARD.READ',
  'STUDENTS.READ',
  'STAFF.READ',
  'SCHOOL_FEES.READ',
  'FEEDING_FEES.READ',
  'STATIONERY.READ',
  'INVENTORY.READ',
];

interface SidebarProps {
  /** Whether the drawer is shown on small screens (controlled by Layout). */
  open?: boolean;
  /** Requests the Layout to hide the drawer. */
  onClose?: () => void;
}

export function Sidebar({ open = false, onClose }: SidebarProps) {
  const location = useLocation();
  const { user } = useApp();

  // Check every nav permission against the backend. While checking, items stay
  // hidden so a forbidden section never flashes.
  const perms = usePermissions(SIDEBAR_PERMISSION_CODES);

  // True once every requested permission has resolved (to true OR false).
  // While any is still `null`, the sidebar shows a brief loading placeholder
  // instead of rendering a partially-populated menu that then shifts as
  // permissions resolve one-by-one.
  const permsReady = useMemo(() => {
    if (perms.size === 0) return true;
    for (const value of perms.values()) {
      if (value === null || value === undefined) return false;
    }
    return true;
  }, [perms]);

  // No nav rendered until the session is classified AND all sidebar perms
  // have resolved. This prevents the "items appear one-by-one" effect after
  // login/refresh and prevents rendering nav for a user whose permissions are
  // still being checked.
  // No nav rendered until the session is classified AND all sidebar perms
  // have resolved. This prevents the "items appear one-by-one" effect after
  // login/refresh and prevents rendering nav for a user whose permissions are
  // still being checked.

  // Shared classes: off-canvas drawer on small screens, static column on md+.
  // The drawer slides in/out based on `open`; on md+ it is always visible.
  const drawerClasses = [
    'fixed inset-y-0 left-0 z-40 w-64 bg-sidebar flex flex-col',
    'transform transition-transform duration-200 ease-in-out',
    'md:static md:z-auto md:translate-x-0',
    open ? 'translate-x-0' : '-translate-x-full',
  ].join(' ');

  // Dark overlay behind the mobile drawer. Only rendered while the drawer
  // is open, and never on md+ where the sidebar is a persistent column.
  const backdrop = open && (
    <div
      className="fixed inset-0 z-30 bg-black/40 md:hidden"
      onClick={onClose}
      aria-hidden="true"
    />
  );

  if (!permsReady) {
    return (
      <>
        {backdrop}
        <aside id="app-sidebar" className={drawerClasses}>
        <div className="h-16 flex items-center px-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </div>
            <div>
              <h1 className="text-white font-semibold text-sm">SAMS</h1>
              <p className="text-gray-400 text-xs">School Management</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 py-4">
          <div className="flex items-center justify-center h-24">
            <div className="text-center text-gray-400 text-sm">Loading menu…</div>
          </div>
        </nav>
      </aside>
      </>
    );
  }

  return (
    <>
      {backdrop}
      <aside id="app-sidebar" className={drawerClasses}>
      {/* Logo/Header */}
      <div className="h-16 flex items-center px-6 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </div>
          <div>
            <h1 className="text-white font-semibold text-sm">SAMS</h1>
            <p className="text-gray-400 text-xs">School Management</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 overflow-y-auto">
        <div className="px-3 space-y-1">
          {navGroups.map((group) => {
            const visibleItems = group.items.filter((item) => {
              if (item.permission === undefined) return true;
              const resolved = perms.get(item.permission);
              return resolved === true;
            });

            if (visibleItems.length === 0) return null;

            return (
              <div key={group.id}>
                {/* Group label */}
                <div className="px-3 py-2">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    {group.label}
                  </span>
                </div>

                {/* Group items */}
                <div className="space-y-1">
                  {visibleItems.map((item) => {
                    const isActive =
                      location.pathname === item.href ||
                      (item.href !== '/dashboard' && location.pathname.startsWith(item.href));

                    return (
                      <NavLink
                        key={item.id}
                        to={item.href}
                        className={
                          isActive
                            ? 'sidebar-link sidebar-link-active text-sm'
                            : 'sidebar-link sidebar-link-inactive text-sm'
                        }
                      >
                        {item.label}
                      </NavLink>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </nav>

      {/* User section */}
      <div className="p-4 border-t border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-primary/20 rounded-full flex items-center justify-center">
            <span className="text-primary font-medium text-sm">
              {getUserInitials(user?.email)}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium truncate">
              {user?.email || 'Unknown User'}
            </p>
            <p className="text-gray-400 text-xs truncate">
              {user?.role || 'No Role'}
            </p>
          </div>
        </div>
      </div>
    </aside>
    </>
  );
}

export default Sidebar;
