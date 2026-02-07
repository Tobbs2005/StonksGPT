import { Home, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/contexts/theme-context';

interface NavigationBarProps {
  userName: string;
  onGoHome: () => void;
}

export function NavigationBar({ userName, onGoHome }: NavigationBarProps) {
  const { theme, setTheme } = useTheme();

  const toggleTheme = () => {
    setTheme(theme === "light" ? "dark" : "light");
  };

  return (
    <nav className="sticky top-0 z-10 border-b border-border bg-background px-6 py-4">
      <div className="flex items-center justify-between">
        {/* Left: Logo and Title */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <div className="h-4 w-4 rounded-sm bg-primary-foreground" />
          </div>
          <h1 className="text-lg font-semibold text-foreground">Stock Trader</h1>
        </div>

        {/* Right: User greeting and actions */}
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground hidden sm:inline">
            Welcome, {userName}
          </span>

          <div className="flex items-center gap-2">
            {/* Theme Toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleTheme}
              className="gap-2"
              title={theme === "dark" ? "Light mode" : "Dark mode"}
            >
              {theme === "dark" ? (
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

            {/* Home Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={onGoHome}
              className="gap-2"
              title="Go home"
            >
              <Home className="h-4 w-4" />
              <span className="hidden sm:inline">Home</span>
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
}