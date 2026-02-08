import { ReactNode } from 'react';
import { NavigationBar } from '@/components/Navigation/NavigationBar';

interface PageShellProps {
  userName: string;
  onGoHome: () => void;
  onLogout: () => void;
  children: ReactNode;
}

export function PageShell({ userName, onGoHome, onLogout, children }: PageShellProps) {
  return (
    <div className="h-screen flex flex-col bg-background">
      <NavigationBar userName={userName} onGoHome={onGoHome} onLogout={onLogout} />
      <main className="flex-1 overflow-hidden bg-background">
        <div className="h-full w-full flex flex-col p-6 gap-6 overflow-hidden">
          {children}
        </div>
      </main>
    </div>
  );
}
