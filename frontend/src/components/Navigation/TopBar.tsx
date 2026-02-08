import { LogOut, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/contexts/theme-context';

interface TopBarProps {
  userName: string;
  onLogout: () => void;
}

export function TopBar({ userName, onLogout }: TopBarProps) {
  const { theme, setTheme } = useTheme();

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  return (
    <header className="sticky top-0 z-10 border-b border-border/40 bg-background/80 backdrop-blur-xl px-6 py-3 shadow-[0_1px_3px_0_rgb(0_0_0/0.02)]">
      <div className="flex items-center justify-end gap-4">
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
        </div>
      </div>
    </header>
  );
}
