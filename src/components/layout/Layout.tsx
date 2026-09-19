/**
 * Layout Component
 * Main application shell with sidebar and header
 */
import type { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="flex h-screen bg-gray-50 dark:bg-slate-950 overflow-hidden">
      {/* Sidebar */}
      <Sidebar />

      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Header */}
        <Header />

        {/* Page content */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6">
          <div className="max-w-full min-w-0">{children}</div>
        </main>
      </div>
    </div>
  );
}

export default Layout;
