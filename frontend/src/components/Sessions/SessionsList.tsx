import { useState } from 'react';
import { TradingSession, ensureTodaySession, getSession, getSessions, getTodayDate } from '@/lib/sessions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

interface SessionsListProps {
  onStartSession: (session: TradingSession) => void;
  onViewSession: (date: string) => void;
}

export function SessionsList({ onStartSession, onViewSession }: SessionsListProps) {
  const [sessions, setSessions] = useState<TradingSession[]>(getSessions());
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

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
            <Card key={session.date} className="border border-border/60">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-semibold">
                    {session.name || session.date}
                  </p>
                  {session.description && (
                    <p className="text-xs text-muted-foreground">{session.description}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Created {new Date(session.createdAt).toLocaleString()}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => onViewSession(session.date)}>
                  View
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <Card className="w-full max-w-lg">
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
                    className="min-h-[120px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
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
    </div>
  );
}
