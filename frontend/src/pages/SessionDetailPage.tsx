import { useNavigate, useParams } from 'react-router-dom';
import { PageShell } from '@/components/layout/PageShell';
import { getAuth, logout } from '@/lib/auth';
import { getSession } from '@/lib/sessions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export function SessionDetailPage() {
  const { date } = useParams<{ date: string }>();
  const navigate = useNavigate();
  const auth = getAuth();
  const session = date ? getSession(date) : undefined;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <PageShell
      userName={auth?.username || 'Trader'}
      onGoHome={() => navigate('/app')}
      onLogout={handleLogout}
    >
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Session Detail</h2>
          <p className="text-sm text-muted-foreground">
            {date ? `Session for ${date}` : 'Session not found'}
          </p>
        </div>
        <Button variant="outline" onClick={() => navigate('/sessions')}>
          Back to Sessions
        </Button>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>{session?.name || date || 'Unknown session'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {session ? (
            <>
              {session.description && (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Description / Goals</p>
                  <p className="text-sm font-medium">{session.description}</p>
                </div>
              )}
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Created</p>
                <p className="text-sm font-medium">
                  {new Date(session.createdAt).toLocaleString()}
                </p>
              </div>
              <Button onClick={() => navigate('/chat')}>Open Chatbot</Button>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                This session does not exist. Start a new session to begin trading.
              </p>
              <Button onClick={() => navigate('/chat')}>Start Trading Session</Button>
            </>
          )}
        </CardContent>
      </Card>
    </PageShell>
  );
}
