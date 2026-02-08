import { useNavigate, useParams } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { getSession } from '@/lib/sessions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MessageSquare } from 'lucide-react';

export function SessionDetailPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const session = sessionId ? getSession(sessionId) : undefined;

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Session Detail</h2>
          <p className="text-sm text-muted-foreground">
            {session ? `Session: ${session.name || session.date}` : 'Session not found'}
          </p>
        </div>
        <Button variant="outline" onClick={() => navigate('/sessions')}>
          Back to Sessions
        </Button>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>{session?.name || sessionId || 'Unknown session'}</CardTitle>
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
              <Button onClick={() => navigate(`/sessions/${sessionId}/chat`)}>
                <MessageSquare className="h-4 w-4 mr-2" />
                Open Chat
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                This session does not exist. Start a new session to begin trading.
              </p>
              <Button onClick={() => navigate('/app')}>
                Go to Home
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
