import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TradingSession,
  ensureTodaySession,
  getSession,
  getSessions,
  getTodayDate,
  deleteSession,
} from '@/lib/sessions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { MessageSquare, Headphones, Trash2 } from 'lucide-react';

interface SessionsListProps {
  onStartSession: (session: TradingSession) => void;
}

export function SessionsList({ onStartSession }: SessionsListProps) {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<TradingSession[]>(getSessions());
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  /* ── Delete confirmation state ──────────────────────── */
  const [deleteTarget, setDeleteTarget] = useState<TradingSession | null>(null);

  const handleOpenModal = () => {
    const existing = getSession(getTodayDate());
    setName(existing?.name || '');
    setDescription(existing?.description || '');
    setShowModal(true);
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      return;
    }
    const session = ensureTodaySession({
      name: trimmedName,
      description: description.trim() || undefined,
    });
    setSessions(getSessions());
    setShowModal(false);
    onStartSession(session);
  };

  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    deleteSession(deleteTarget.date);
    const remaining = getSessions();
    setSessions(remaining);
    setDeleteTarget(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Trading Sessions</h3>
          <p className="text-sm text-muted-foreground">One session per day.</p>
        </div>
        <Button onClick={handleOpenModal}>Start New Trading Session</Button>
      </div>

      {sessions.length === 0 ? (
        <Card className="border border-border/60">
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">
              No sessions yet. Start your first trading session to begin.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {sessions.map((session) => (
            <Card key={session.date} className="border-border/40 hover:shadow-elevated transition-all duration-200 ease-out">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="space-y-1 min-w-0 flex-1">
                  <p className="text-sm font-semibold">
                    {session.name || session.date}
                  </p>
                  {session.description && (
                    <p className="text-xs text-muted-foreground truncate">{session.description}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Created {new Date(session.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs"
                    onClick={() => navigate(`/sessions/${session.date}/chat`)}
                  >
                    <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
                    Open Chat
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => {
                      // TODO: ElevenLabs session playback / summary
                    }}
                    title="Playback session summary"
                  >
                    <Headphones className="h-3.5 w-3.5 mr-1.5" />
                    Playback
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-red-500"
                    title="Delete session"
                    onClick={() => setDeleteTarget(session)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── Create session modal ──────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <Card className="w-full max-w-lg shadow-modal border-border/30">
            <CardHeader className="space-y-2">
              <CardTitle>Start New Trading Session</CardTitle>
              <p className="text-sm text-muted-foreground">
                Create a session for {getTodayDate()}.
              </p>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Session name</label>
                  <Input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Morning check-in"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Description / Goals (optional)</label>
                  <textarea
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
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
                    Start Session
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Delete confirmation modal ─────────────────────── */}
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
                <Button
                  variant="ghost"
                  onClick={() => setDeleteTarget(null)}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleConfirmDelete}
                >
                  Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
