import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { SessionsList } from '@/components/Sessions/SessionsList';

export function SessionsPage() {
  const navigate = useNavigate();

  return (
    <DashboardLayout>
      <SessionsList
        onStartSession={(session) => navigate(`/sessions/${session.date}/chat`)}
      />
    </DashboardLayout>
  );
}
