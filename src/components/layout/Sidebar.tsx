/**
 * Sidebar Component
 * Navigation sidebar with grouped menu items
 */
import { NavLink, useLocation } from 'react-router-dom';
import { useApp } from '../../contexts';
import type { NavGroup } from '../../types';
import { getUserInitials } from '../../utils/user';

// Navigation structure - matches the brief's sidebar groups
const navGroups: NavGroup[] = [
  {
    id: 'overview',
    label: 'OVERVIEW',
    items: [
      { id: 'dashboard', label: 'Dashboard', href: '/dashboard' },
    ],
  },
  {
    id: 'people',
    label: 'PEOPLE',
    items: [
      { id: 'students', label: 'Students', href: '/students' },
      { id: 'staff', label: 'Staff', href: '/staff' },
    ],
  },
  {
    id: 'finance',
    label: 'FINANCE',
    items: [
      { id: 'schoolFees', label: 'School Fees', href: '/school-fees' },
      { id: 'feedingFees', label: 'Feeding Fees', href: '/feeding-fees' },
      { id: 'stationery', label: 'Stationery', href: '/stationery' },
    ],
  },
  {
    id: 'inventory',
    label: 'INVENTORY',
    items: [
      { id: 'inventory', label: 'Inventory', href: '/inventory' },
    ],
  },
  {
    id: 'system',
    label: 'SYSTEM',
    items: [
      { id: 'settings', label: 'Settings', href: '/settings' },
    ],
  },
];

export function Sidebar() {
  const location = useLocation();
  const { user } = useApp();

  return (
    <aside className="w-64 bg-sidebar flex flex-col">
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
          {navGroups.map((group) => (
            <div key={group.id}>
              {/* Group label */}
              <div className="px-3 py-2">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  {group.label}
                </span>
              </div>

              {/* Group items */}
              <div className="space-y-1">
                {group.items.map((item) => {
                  const isActive = location.pathname === item.href ||
                    (item.href !== '/dashboard' && location.pathname.startsWith(item.href));

                  return (
                    <NavLink
                      key={item.id}
                      to={item.href}
                      className={`
                        sidebar-link text-sm
                        ${isActive ? 'sidebar-link-active' : 'sidebar-link-inactive'}
                      `}
                    >
                      {item.label}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
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
  );
}

export default Sidebar;
