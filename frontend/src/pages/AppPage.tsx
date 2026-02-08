import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MessageSquare, CalendarDays, ArrowRight, Trash2 } from 'lucide-react';
import {
  TradingSession,
  getSession,
  getSessions,
  getTodayDate,
  ensureTodaySession,
  deleteSession,
  deleteAllSessions,
} from '@/lib/sessions';

/** Flip to true to show developer helpers (clear all sessions, per-session delete). */
const DEV_MODE = true;

export function AppPage() {
  const navigate = useNavigate();
  const todayDate = getTodayDate();

  /* ── Reactive session state (re-read from localStorage on mutate) ── */
  const [sessionTick, setSessionTick] = useState(0);
  const refreshSessions = () => setSessionTick((t) => t + 1);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _tick = sessionTick; // used to force re-read below
  const todaySession = getSession(todayDate);
  const recentSessions = getSessions().slice(0, 3);

  /* ── Session creation modal ──────────────────────────── */
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  /* ── Delete confirmation state ──────────────────────── */
  const [deleteTarget, setDeleteTarget] = useState<TradingSession | null>(null);
  const [showClearAll, setShowClearAll] = useState(false);

  const handleOpenModal = () => {
    setName(todaySession?.name || '');
    setDescription(todaySession?.description || '');
    setShowModal(true);
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return;
    const session = ensureTodaySession({
      name: trimmedName,
      description: description.trim() || undefined,
    });
    setShowModal(false);
    navigate(`/sessions/${session.date}/chat`);
  };

  const handleContinue = () => {
    navigate(`/sessions/${todayDate}/chat`);
  };

  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    deleteSession(deleteTarget.date);
    setDeleteTarget(null);
    refreshSessions();
  };

  const handleConfirmClearAll = () => {
    deleteAllSessions();
    setShowClearAll(false);
    refreshSessions();
  };

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto w-full py-8 space-y-8">
        {/* ── Hero CTA ─────────────────────────────────────── */}
        <div className="text-center space-y-3">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
            <MessageSquare className="h-7 w-7 text-primary" />
          </div>
          <h2 className="text-2xl font-semibold text-foreground">
            Welcome to StonksGPT
          </h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Start a trading session to chat with your AI trading assistant.
            Sessions are saved daily so you can review your decisions and
            track your progress over time.
          </p>
        </div>

        {/* ── Action card ──────────────────────────────────── */}
        <Card className="border-border/60">
          <CardContent className="p-6 space-y-4">
            {todaySession ? (
              <>
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Today&rsquo;s session
                  </p>
                  <p className="text-sm font-semibold text-foreground">
                    {todaySession.name || todayDate}
                  </p>
                  {todaySession.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {todaySession.description}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <Button className="flex-1" onClick={handleContinue}>
                    Continue Today&rsquo;s Session
                    <ArrowRight className="h-4 w-4 ml-1" />
                  </Button>
                  <Button variant="outline" onClick={handleOpenModal}>
                    Update Session
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  You haven&rsquo;t started a session today. Create one to open the
                  chat workspace.
                </p>
                <Button className="w-full" size="lg" onClick={handleOpenModal}>
                  Start New Session
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* ── Recent sessions ──────────────────────────────── */}
        {recentSessions.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                Recent Sessions
              </h3>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground"
                onClick={() => navigate('/sessions')}
              >
                View all
              </Button>
            </div>
            <div className="space-y-2">
              {recentSessions.map((session) => (
                <Card
                  key={session.date}
                  className="border-border/40 hover:shadow-elevated transition-all duration-200 ease-out cursor-pointer"
                  onClick={() => navigate(`/sessions/${session.date}/chat`)}
                >
                  <CardContent className="p-3 flex items-center justify-between">
                    <div className="min-w-0 space-y-0.5">
                      <p className="text-sm font-medium truncate">
                        {session.name || session.date}
                      </p>
                      <p className="text-xs text-muted-foreground">{session.date}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/sessions/${session.date}/chat`);
                        }}
                      >
                        Open Chat
                      </Button>
                      {DEV_MODE && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-red-500"
                          title="Delete session"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteTarget(session);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* ── Dev: Clear all sessions ──────────────────────── */}
        {DEV_MODE && recentSessions.length > 0 && (
          <div className="pt-4 border-t border-border/40">
            <Button
              variant="outline"
              size="sm"
              className="text-xs text-red-500 border-red-500/30 hover:bg-red-500/10 hover:text-red-500"
              onClick={() => setShowClearAll(true)}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              Clear all sessions (dev)
            </Button>
          </div>
        )}
      </div>

      {/* ── Session creation modal ─────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <Card className="w-full max-w-lg shadow-modal border-border/30">
            <CardHeader className="space-y-2">
              <CardTitle>
                {todaySession ? 'Update Session' : 'Start New Trading Session'}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {todaySession
                  ? `Update your session for ${todayDate}.`
                  : `Create a session for ${todayDate}.`}
              </p>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Session name</label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Morning check-in"
                    autoFocus
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Description / Goals (optional)
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="What do you want to focus on today?"
                    className="min-h-[120px] w-full rounded-lg border border-input/60 bg-transparent px-3 py-2 text-sm shadow-sm transition-all duration-150 ease-out placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:border-ring/50"
                  />
                </div>
                <div className="flex items-center justify-end gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setShowModal(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={!name.trim()}>
                    {todaySession ? 'Save & Open Chat' : 'Start Session'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Delete single session confirmation ─────────────── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <Card className="w-full max-w-sm shadow-modal border-border/30">
            <CardHeader className="space-y-2">
              <CardTitle>Delete session?</CardTitle>
              <p className="text-sm text-muted-foreground">
                This will permanently remove the session
                <span className="font-medium text-foreground">
                  {' '}&ldquo;{deleteTarget.name || deleteTarget.date}&rdquo;{' '}
                </span>
                and its saved history.
              </p>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-end gap-2">
                <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
                  Cancel
                </Button>
                <Button variant="destructive" onClick={handleConfirmDelete}>
                  Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Clear all sessions confirmation ────────────────── */}
      {showClearAll && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <Card className="w-full max-w-sm shadow-modal border-border/30">
            <CardHeader className="space-y-2">
              <CardTitle>Clear all sessions?</CardTitle>
              <p className="text-sm text-muted-foreground">
                This will permanently remove every session. You&rsquo;ll see the
                empty &ldquo;Start New Session&rdquo; state on Home.
              </p>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-end gap-2">
                <Button variant="ghost" onClick={() => setShowClearAll(false)}>
                  Cancel
                </Button>
                <Button variant="destructive" onClick={handleConfirmClearAll}>
                  Delete All
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </DashboardLayout>
  );
}
