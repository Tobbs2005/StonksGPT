import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageShell } from '@/components/layout/PageShell';
import { AccountInfo } from '@/components/Sidebar/AccountInfo';
import { PositionsList } from '@/components/Sidebar/PositionsList';
import { PendingOrdersList } from '@/components/Sidebar/PendingOrdersList';
import { SessionsList } from '@/components/Sessions/SessionsList';
import { TradingSession } from '@/lib/sessions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getAuth, logout } from '@/lib/auth';

type Tab = 'portfolio' | 'sessions';

export function AppPage() {
  const [tab, setTab] = useState<Tab>('portfolio');
  const navigate = useNavigate();
  const auth = getAuth();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleStartSession = (_session: TradingSession) => {
    navigate('/chat');
  };

  const handleViewSession = (date: string) => {
    navigate(`/sessions/${date}`);
  };

  return (
    <PageShell
      userName={auth?.username || 'Trader'}
      onGoHome={() => navigate('/app')}
      onLogout={handleLogout}
    >
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Dashboard</h2>
          <p className="text-sm text-muted-foreground">Overview of your trading activity.</p>
        </div>
        <div className="inline-flex rounded-md border border-input bg-muted/40 p-1">
          <Button
            variant={tab === 'portfolio' ? 'secondary' : 'ghost'}
            size="sm"
            className="rounded-sm px-3"
            onClick={() => setTab('portfolio')}
          >
            Portfolio
          </Button>
          <Button
            variant={tab === 'sessions' ? 'secondary' : 'ghost'}
            size="sm"
            className="rounded-sm px-3"
            onClick={() => setTab('sessions')}
          >
            Sessions
          </Button>
        </div>
      </div>

      {tab === 'portfolio' ? (
        <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          <Card>
            <CardHeader>
              <CardTitle>Account Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <AccountInfo />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Open Positions</CardTitle>
            </CardHeader>
            <CardContent>
              <PositionsList />
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Pending Orders</CardTitle>
            </CardHeader>
            <CardContent>
              <PendingOrdersList />
            </CardContent>
          </Card>
        </div>
      ) : (
        <SessionsList onStartSession={handleStartSession} onViewSession={handleViewSession} />
      )}
    </PageShell>
  );
}
