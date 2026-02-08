import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppSidebar } from '@/components/Navigation/AppSidebar';
import { TopBar } from '@/components/Navigation/TopBar';
import { getAuth, logout } from '@/lib/auth';

interface DashboardLayoutProps {
  children: ReactNode;
  /** If true, content fills the entire area (no padding/scroll wrapper). Used by chat. */
  flush?: boolean;
}

export function DashboardLayout({ children, flush }: DashboardLayoutProps) {
  const navigate = useNavigate();
  const auth = getAuth();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="h-screen flex bg-background">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar userName={auth?.username || 'Trader'} onLogout={handleLogout} />
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
