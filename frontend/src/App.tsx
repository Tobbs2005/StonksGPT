import { Routes, Route, Navigate } from 'react-router-dom';
import { AppPage } from '@/pages/AppPage';
import { AccountPage } from '@/pages/AccountPage';
import { SessionsPage } from '@/pages/SessionsPage';
import { SessionChatPage } from '@/pages/SessionChatPage';
import { NewsPage } from '@/pages/NewsPage';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/app" replace />} />
      <Route
        path="/app"
        element={<AppPage />}
      />
      <Route
        path="/account"
        element={<AccountPage />}
      />
      <Route
        path="/sessions"
        element={<SessionsPage />}
      />
      <Route
        path="/sessions/:sessionId/chat"
        element={<SessionChatPage />}
      />
      <Route
        path="/news"
        element={<NewsPage />}
      />
      {/* Legacy routes → redirect to Home */}
      <Route path="/chat" element={<Navigate to="/app" replace />} />
      <Route path="/sessions/:sessionId" element={<Navigate to="/sessions" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
