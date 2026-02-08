import { Routes, Route, Navigate } from 'react-router-dom';
import { RequireAuth } from '@/components/Auth/RequireAuth';
import { LoginPage } from '@/pages/LoginPage';
import { AppPage } from '@/pages/AppPage';
import { AccountPage } from '@/pages/AccountPage';
import { SessionsPage } from '@/pages/SessionsPage';
import { SessionChatPage } from '@/pages/SessionChatPage';
import { NewsPage } from '@/pages/NewsPage';
import { isAuthed } from '@/lib/auth';

function App() {
  return (
    <Routes>
      <Route
        path="/"
        element={<Navigate to={isAuthed() ? '/app' : '/login'} replace />}
      />
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/app"
        element={
          <RequireAuth>
            <AppPage />
          </RequireAuth>
        }
      />
      <Route
        path="/account"
        element={
          <RequireAuth>
            <AccountPage />
          </RequireAuth>
        }
      />
      <Route
        path="/sessions"
        element={
          <RequireAuth>
            <SessionsPage />
          </RequireAuth>
        }
      />
      <Route
        path="/sessions/:date/chat"
        element={
          <RequireAuth>
            <SessionChatPage />
          </RequireAuth>
        }
      />
      <Route
        path="/news"
        element={
          <RequireAuth>
            <NewsPage />
          </RequireAuth>
        }
      />
      {/* Legacy routes → redirect to Home */}
      <Route path="/chat" element={<Navigate to="/app" replace />} />
      <Route path="/sessions/:date" element={<Navigate to="/sessions" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
