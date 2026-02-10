import { ReactNode, useState, useEffect, useCallback } from 'react';
import { AppSidebar } from '@/components/Navigation/AppSidebar';
import { TopBar } from '@/components/Navigation/TopBar';
import { cn } from '@/lib/utils';

interface DashboardLayoutProps {
  children: ReactNode;
  /** If true, content fills the entire area (no padding/scroll wrapper). Used by chat. */
  flush?: boolean;
}

export function DashboardLayout({ children, flush }: DashboardLayoutProps) {
  // Sidebar closed by default for full-width chat; user opens via hamburger
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const toggleSidebar = useCallback(() => setSidebarOpen((o) => !o), []);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  // Escape key closes sidebar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && sidebarOpen) {
        setSidebarOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [sidebarOpen]);

  // Prevent background scroll when sidebar open (mobile)
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [sidebarOpen]);

  return (
    <div className="h-screen flex bg-background">
      {/* Backdrop — visible when sidebar open */}
      <div
        role="presentation"
        aria-hidden="true"
        className={cn(
          'fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] transition-opacity duration-200 ease-out',
          sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
        onClick={closeSidebar}
      />

      {/* Sidebar drawer — overlay */}
      <div
        className={cn(
          'fixed top-0 left-0 z-50 h-full w-56 flex flex-col transition-transform duration-[220ms] ease-out',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <AppSidebar onClose={closeSidebar} />
      </div>

      {/* Main content — always full width */}
      <div className="flex-1 flex flex-col min-w-0 w-full">
        <TopBar
          userName="Trader"
          onToggleSidebar={toggleSidebar}
        />
        {flush ? (
          <div className="flex-1 overflow-hidden">{children}</div>
        ) : (
          <main className="flex-1 overflow-y-auto">
            <div className="w-full flex flex-col p-6 gap-6">{children}</div>
          </main>
        )}
      </div>
    </div>
  );
}
