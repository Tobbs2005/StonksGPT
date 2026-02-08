import { useState, useCallback, useEffect } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { ChatInterface } from '@/components/Chat/ChatInterface';
import { PortfolioPanel } from '@/components/Chat/PortfolioPanel';
import { getSession } from '@/lib/sessions';
import { Button } from '@/components/ui/button';
import { ArrowLeft, PanelLeftOpen, X } from 'lucide-react';

/**
 * Session-specific chat workspace.
 *
 * Route: /sessions/:sessionId/chat
 *
 * Desktop: two-column layout — portfolio panel (left) + chat (right).
 * Mobile:  portfolio panel is hidden behind a toggle drawer.
 */
export function SessionChatPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const session = sessionId ? getSession(sessionId) : undefined;

  // Mobile portfolio drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const toggleDrawer = useCallback(() => setDrawerOpen((o) => !o), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  // Close drawer on Escape
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawerOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawerOpen]);

  // Lock body scroll when drawer is open
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [drawerOpen]);

  if (!sessionId || !session) {
    return <Navigate to="/app" replace />;
  }

  return (
    <DashboardLayout flush>
      <div className="h-full w-full flex flex-col overflow-hidden">
        {/* ── Session header (compact) ──────────────────────── */}
        <div className="shrink-0 flex items-center gap-3 px-4 py-2.5 border-b border-border/40 bg-card/60 backdrop-blur-xl">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={() => navigate('/sessions')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground truncate">
              {session.name || session.date}
            </p>
            {session.description && (
              <p className="text-xs text-muted-foreground truncate">
                {session.description}
              </p>
            )}
          </div>

          {/* Portfolio drawer toggle (visible on mobile / small screens) */}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 lg:hidden"
            onClick={toggleDrawer}
            aria-label="Toggle portfolio panel"
            title="Portfolio"
          >
            <PanelLeftOpen className="h-4 w-4" />
          </Button>

          <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
            {session.date}
          </span>
        </div>

        {/* ── Two-column area ─────────────────────────────── */}
        <div className="flex-1 flex overflow-hidden relative">
          {/* ── Desktop portfolio panel (persistent) ─────── */}
          <aside className="hidden lg:flex w-80 shrink-0 border-r border-border/40 bg-card/40 backdrop-blur-sm">
            <div className="w-full">
              <PortfolioPanel />
            </div>
          </aside>

          {/* ── Mobile portfolio drawer (overlay) ────────── */}
          {/* Backdrop */}
          <div
            className={`lg:hidden fixed inset-0 z-40 bg-black/40 transition-opacity duration-200 ${
              drawerOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
            onClick={closeDrawer}
          />
          {/* Drawer panel */}
          <aside
            className={`lg:hidden fixed top-0 left-0 z-50 h-full w-80 max-w-[85vw] bg-card border-r border-border/40 shadow-2xl transition-transform duration-200 ease-out ${
              drawerOpen ? 'translate-x-0' : '-translate-x-full'
            }`}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Portfolio</p>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={closeDrawer}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="h-[calc(100%-49px)] overflow-y-auto">
              <PortfolioPanel />
            </div>
          </aside>

          {/* ── Chat workspace ────────────────────────────── */}
          <div className="flex-1 overflow-hidden">
            <ChatInterface sessionId={sessionId} />
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
