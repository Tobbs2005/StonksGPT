import { useNavigate } from 'react-router-dom';
import { PageShell } from '@/components/layout/PageShell';
import { SessionsList } from '@/components/Sessions/SessionsList';
import { getAuth, logout } from '@/lib/auth';
import { TradingSession } from '@/lib/sessions';

export function SessionsPage() {
  const navigate = useNavigate();
  const auth = getAuth();

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
      <SessionsList
        onStartSession={(_session: TradingSession) => navigate('/chat')}
        onViewSession={(date) => navigate(`/sessions/${date}`)}
      />
    </PageShell>
  );
}
