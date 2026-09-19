/**
 * Header Component
 *
 * Top bar: breadcrumbs, search, notifications and the authenticated profile.
 *
 * Everything in the profile area comes from `auth.me` via AppContext. No name,
 * email, role or permission is hardcoded, and no role name is special-cased —
 * the backend remains the authorization boundary.
 */
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useApp } from '../../contexts';
import { SearchInput } from '../ui';
import { useTheme } from '../../hooks';
import { GOOGLE_SIGN_OUT_URL } from '../../api/config';
import { getUserInitials } from '../../utils/user';

/** Light/dark switch. The preference is local UI state only (see useTheme). */
function ThemeToggle() {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
    >
      {isDark ? (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
          />
        </svg>
      ) : (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
          />
        </svg>
      )}
    </button>
  );
}

interface Breadcrumb {
  label: string;
  href?: string;
}

export function Header() {
  const location = useLocation();
  const { user, refreshSession } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  // Close the profile menu when the user clicks anywhere outside it.
  useEffect(() => {
    const onDocumentMouseDown = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    };

    document.addEventListener('mousedown', onDocumentMouseDown);
    return () => document.removeEventListener('mousedown', onDocumentMouseDown);
  }, []);

  const breadcrumbs: Breadcrumb[] = useMemo(() => {
    const segments = location.pathname.split('/').filter(Boolean);
    const crumbs: Breadcrumb[] = [{ label: 'Dashboard', href: '/dashboard' }];

    let currentPath = '';
    for (const segment of segments) {
      currentPath += `/${segment}`;
      crumbs.push({
        label: segment.replace(/-/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase()),
        href: currentPath,
      });
    }

    return crumbs;
  }, [location.pathname]);

  /**
   * Re-ask the backend who the caller is. This is the only real "sign in"
   * action available to the SPA; it also re-validates an expired account.
   */
  const handleRefreshSession = async () => {
    setIsRefreshing(true);
    try {
      await refreshSession();
    } finally {
      setIsRefreshing(false);
      setIsProfileOpen(false);
    }
  };

  return (
    <header className="h-16 border-b border-gray-200 bg-white flex items-center px-6 gap-4 dark:border-slate-800 dark:bg-slate-900">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-2 text-sm flex-1 min-w-0">
        {breadcrumbs.map((crumb, index) => (
          <Fragment key={index}>
            {index > 0 && (
              <svg
                className="w-4 h-4 text-gray-400 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            )}
            {crumb.href && index < breadcrumbs.length - 1 ? (
              <Link
                to={crumb.href}
                className="text-gray-500 hover:text-gray-700 transition-colors truncate"
              >
                {crumb.label}
              </Link>
            ) : (
              <span className="text-gray-900 font-medium truncate">{crumb.label}</span>
            )}
          </Fragment>
        ))}
      </nav>

      {/* Search */}
      <div className="relative w-64 hidden md:block">
        <SearchInput
          value={searchQuery}
          onChange={(value) => setSearchQuery(value)}
          placeholder="Search students..."
          onClear={() => setSearchQuery('')}
        />
      </div>

      {/* Theme switch */}
      <ThemeToggle />

      {/* Notification icon */}
      <button className="relative p-2 text-gray-400 hover:text-gray-600 transition-colors dark:hover:text-slate-200">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
      </button>

      {/* Profile — driven entirely by auth.me */}
      <div ref={profileRef} className="relative">
        <button
          type="button"
          onClick={() => setIsProfileOpen((open) => !open)}
          className="flex items-center gap-2 p-1.5 sm:pl-3 rounded-lg hover:bg-gray-100 transition-colors dark:hover:bg-slate-800"
          aria-haspopup="menu"
          aria-expanded={isProfileOpen}
        >
          <span className="hidden sm:flex flex-col items-end leading-tight">
            <span className="text-sm text-gray-900 max-w-[14rem] truncate">
              {user?.email ?? 'Signed-in user'}
            </span>
            <span className="text-xs text-gray-500">{user?.role ?? 'No role'}</span>
          </span>
          <span className="w-9 h-9 bg-primary/20 rounded-full flex items-center justify-center text-primary text-sm font-medium">
            {getUserInitials(user?.email)}
          </span>
        </button>

        {isProfileOpen && (
          <div
            role="menu"
            className="absolute right-0 mt-2 w-72 bg-white border border-gray-200 rounded-lg shadow-lg py-2 z-50 dark:bg-slate-900 dark:border-slate-700"
          >
            <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center text-primary text-sm font-medium flex-shrink-0">
                  {getUserInitials(user?.email)}
                </span>
                <div className="min-w-0">
                  <p className="text-sm text-gray-900 truncate">{user?.email ?? '—'}</p>
                  <p className="text-xs text-gray-500 truncate">
                    Role: {user?.role ?? '—'}
                  </p>
                </div>
              </div>

              <dl className="mt-3 space-y-1 text-xs text-gray-500">
                <div className="flex justify-between gap-2">
                  <dt>User ID</dt>
                  <dd className="text-gray-700 truncate">{user?.userId || '—'}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt>Staff ID</dt>
                  <dd className="text-gray-700 truncate">{user?.staffId || '—'}</dd>
                </div>
              </dl>
            </div>

            <button
              type="button"
              onClick={handleRefreshSession}
              disabled={isRefreshing}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              {isRefreshing ? 'Refreshing session…' : 'Refresh session'}
            </button>

            {/*
              Real sign-out only. Apps Script identity comes from the Google
              session, so the genuine action is Google's own sign-out page. The
              SPA deliberately offers no "log out" that merely clears React state.
            */}
            <a
              href={GOOGLE_SIGN_OUT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Sign out of Google
            </a>
            <p className="px-4 pt-1 pb-2 text-xs text-gray-400">
              Signs out of your Google account, which is what actually ends this
              session. Nothing here pretends to be an app-level logout.
            </p>
          </div>
        )}
      </div>
    </header>
  );
}

export default Header;
