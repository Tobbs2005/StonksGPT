import { LogOut, Menu, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/contexts/theme-context';

interface TopBarProps {
  userName: string;
  onLogout?: () => void;
  onToggleSidebar?: () => void;
}

export function TopBar({ userName, onLogout, onToggleSidebar }: TopBarProps) {
  const { theme, setTheme } = useTheme();

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  return (
    <header className="sticky top-0 z-10 border-b border-border/40 bg-background/80 backdrop-blur-xl px-4 sm:px-6 py-3 shadow-[0_1px_3px_0_rgb(0_0_0/0.02)]">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          {onToggleSidebar && (
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0"
              onClick={onToggleSidebar}
              aria-label="Toggle sidebar"
              title="Toggle sidebar"
            >
              <Menu className="h-5 w-5" />
            </Button>
          )}
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground hidden sm:inline">
            Welcome, {userName}
          </span>
          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleTheme}
              className="gap-2"
              title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="h-4 w-4" />
                  <span className="hidden sm:inline">Light</span>
                </>
              ) : (
                <>
                  <Moon className="h-4 w-4" />
                  <span className="hidden sm:inline">Dark</span>
                </>
              )}
            </Button>
            {onLogout && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onLogout}
                className="gap-2"
                title="Log out"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Logout</span>
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
