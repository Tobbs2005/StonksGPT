import { useLocation, useNavigate } from 'react-router-dom';
import { Home, User, CalendarDays, Newspaper, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const navItems = [
  { label: 'Home', icon: Home, path: '/app' },
  { label: 'Account', icon: User, path: '/account' },
  { label: 'Sessions', icon: CalendarDays, path: '/sessions' },
  { label: 'News', icon: Newspaper, path: '/news' },
] as const;

interface AppSidebarProps {
  /** Called when user closes the sidebar (X button or nav click). */
  onClose?: () => void;
}

export function AppSidebar({ onClose }: AppSidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (path: string) => {
    if (path === '/app') {
      return location.pathname === '/app';
    }
    return location.pathname.startsWith(path);
  };

  const handleNavClick = (path: string) => {
    onClose?.();
    // Wait for slide-out animation to finish before navigating
    const ANIMATION_MS = 220;
    setTimeout(() => navigate(path), ANIMATION_MS);
  };

  return (
    <aside className="w-full h-full border-r border-border/40 bg-card/80 backdrop-blur-xl flex flex-col shadow-[1px_0_8px_0_rgb(0_0_0/0.03)]">
      {/* Logo + close button */}
      <div className="flex items-center justify-between gap-2 px-4 py-5 border-b border-border/40 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <img
            src="/favicon.png"
            alt="StonksGPT"
            className="h-8 w-8 shrink-0 rounded-xl object-contain"
          />
          <h1 className="text-lg font-semibold text-foreground truncate">StonksGPT</h1>
        </div>
        {onClose && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={onClose}
            aria-label="Close sidebar"
            title="Close sidebar"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Nav items */}
      <nav className="flex-1 flex flex-col gap-0.5 px-3 py-4 overflow-y-auto">
        {navItems.map((item) => {
          const active = isActive(item.path);
          return (
            <Button
              key={item.path}
              variant={active ? 'secondary' : 'ghost'}
              size="sm"
              className={cn(
                'w-full justify-start gap-3 px-3 h-9 rounded-lg',
                active && 'font-semibold shadow-sm'
              )}
              onClick={() => handleNavClick(item.path)}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Button>
          );
        })}
      </nav>
    </aside>
  );
}
