import { useLocation, useNavigate } from 'react-router-dom';
import { Home, User, CalendarDays, Newspaper } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const navItems = [
  { label: 'Home', icon: Home, path: '/app' },
  { label: 'Account', icon: User, path: '/account' },
  { label: 'Sessions', icon: CalendarDays, path: '/sessions' },
  { label: 'News', icon: Newspaper, path: '/news' },
] as const;

export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (path: string) => {
    if (path === '/app') {
      return location.pathname === '/app';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <aside className="w-56 shrink-0 border-r border-border bg-card h-full flex flex-col">
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-border">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
          <div className="h-4 w-4 rounded-sm bg-primary-foreground" />
        </div>
        <h1 className="text-lg font-semibold text-foreground">StonksGPT</h1>
      </div>

      {/* Nav items */}
      <nav className="flex-1 flex flex-col gap-1 px-3 py-4">
        {navItems.map((item) => {
          const active = isActive(item.path);
          return (
            <Button
              key={item.path}
              variant={active ? 'secondary' : 'ghost'}
              size="sm"
              className={cn(
                'w-full justify-start gap-3 px-3 h-9',
                active && 'font-semibold'
              )}
              onClick={() => navigate(item.path)}
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
