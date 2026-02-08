import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { ChatInterface } from '@/components/Chat/ChatInterface';
import { getSession } from '@/lib/sessions';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

/**
 * Session-specific chat workspace.
 *
 * Route: /sessions/:date/chat
 *
 * Uses the DashboardLayout in `flush` mode for a full-height,
 * borderless chat experience. A small session header sits at
 * the top with the session name and a back link.
 */
export function SessionChatPage() {
  const { date } = useParams<{ date: string }>();
  const navigate = useNavigate();
  const session = date ? getSession(date) : undefined;

  // If the session doesn't exist, redirect to Home to start one
  if (!date || !session) {
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
              {session.name || date}
            </p>
            {session.description && (
              <p className="text-xs text-muted-foreground truncate">
                {session.description}
              </p>
            )}
          </div>
          <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
            {date}
          </span>
        </div>

        {/* ── Chat workspace (borderless, full area) ─────── */}
        <div className="flex-1 overflow-hidden">
          <ChatInterface />
        </div>
      </div>
    </DashboardLayout>
  );
}
