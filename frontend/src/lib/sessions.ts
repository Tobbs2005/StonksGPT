import { format } from 'date-fns';
import { clearSessionMessages, clearAllSessionMessages } from './sessionChatStorage';

export interface TradingSession {
  date: string; // YYYY-MM-DD
  createdAt: string;
  name?: string;
  description?: string;
}

const SESSIONS_KEY = 'stonks.sessions';

function readSessions(): TradingSession[] {
  const raw = localStorage.getItem(SESSIONS_KEY);
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed as TradingSession[];
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
  return readSessions().sort((a, b) => b.date.localeCompare(a.date));
}

export function getSession(date: string): TradingSession | undefined {
  return readSessions().find((session) => session.date === date);
}

export function getTodayDate(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

export function deleteSession(date: string): void {
  const sessions = readSessions().filter((s) => s.date !== date);
  writeSessions(sessions);
  clearSessionMessages(date);
}

export function deleteAllSessions(): void {
  writeSessions([]);
  clearAllSessionMessages();
}

export function ensureTodaySession(details?: { name?: string; description?: string }): TradingSession {
  const sessions = readSessions();
  const today = getTodayDate();
  const existing = sessions.find((session) => session.date === today);
  if (existing) {
    if (details?.name || details?.description) {
      const updated = {
        ...existing,
        ...(details?.name ? { name: details.name } : {}),
        ...(details?.description !== undefined ? { description: details.description } : {}),
      };
      const next = sessions.map((session) => (session.date === today ? updated : session));
      writeSessions(next);
      return updated;
    }
    return existing;
  }
  const created: TradingSession = {
    date: today,
    createdAt: new Date().toISOString(),
    ...(details?.name ? { name: details.name } : {}),
    ...(details?.description ? { description: details.description } : {}),
  };
  sessions.push(created);
  writeSessions(sessions);
  return created;
}
