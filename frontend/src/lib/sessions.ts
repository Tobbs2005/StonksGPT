import { format } from 'date-fns';
import { clearSessionMessages, clearAllSessionMessages } from './sessionChatStorage';

export interface TradingSession {
  /** Unique session identifier (used in routes + localStorage keys). */
  id: string;
  date: string; // YYYY-MM-DD (for display)
  createdAt: string;
  name?: string;
  description?: string;
}

const SESSIONS_KEY = 'stonks.sessions';

/** Generate a short unique ID: date + timestamp suffix */
function generateSessionId(): string {
  const today = format(new Date(), 'yyyy-MM-dd');
  const suffix = Date.now().toString(36);
  return `${today}-${suffix}`;
}

function readSessions(): TradingSession[] {
  const raw = localStorage.getItem(SESSIONS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      // Migrate legacy sessions that used `date` as the key and had no `id`
      return parsed.map((s: any) => ({
        ...s,
        id: s.id || s.date, // fallback for old sessions
      })) as TradingSession[];
    }
    return [];
  } catch {
    return [];
  }
}

function writeSessions(sessions: TradingSession[]) {
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
}

export function getSessions(): TradingSession[] {
  return readSessions().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getSession(id: string): TradingSession | undefined {
  return readSessions().find((session) => session.id === id);
}

export function getTodayDate(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

export function deleteSession(id: string): void {
  const sessions = readSessions().filter((s) => s.id !== id);
  writeSessions(sessions);
  clearSessionMessages(id);
}

export function deleteAllSessions(): void {
  const sessions = readSessions();
  writeSessions([]);
  // Clear chat storage for all sessions
  for (const s of sessions) {
    clearSessionMessages(s.id);
  }
  clearAllSessionMessages();
}

/**
 * Create a new session. Always creates a fresh session (multiple per day allowed).
 */
export function createSession(details?: { name?: string; description?: string }): TradingSession {
  const sessions = readSessions();
  const session: TradingSession = {
    id: generateSessionId(),
    date: getTodayDate(),
    createdAt: new Date().toISOString(),
    ...(details?.name ? { name: details.name } : {}),
    ...(details?.description ? { description: details.description } : {}),
  };
  sessions.push(session);
  writeSessions(sessions);
  return session;
}

/**
 * @deprecated Use createSession() instead. Kept for backward compat during migration.
 */
export function ensureTodaySession(details?: { name?: string; description?: string }): TradingSession {
  return createSession(details);
}
