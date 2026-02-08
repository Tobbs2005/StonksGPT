/**
 * Per-session chat persistence using localStorage.
 *
 * Each session's messages are stored under:
 *   stonks.chat:<sessionDate>  →  SerializedMessage[]
 *
 * Keeps the same Message shape used by ChatInterface / MessageList,
 * serializing Date fields to ISO strings for storage.
 */

const KEY_PREFIX = 'stonks.chat:';
const MAX_MESSAGES = 100;

/** Minimal serializable shape (matches Message but with string timestamp). */
interface StoredMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string; // ISO string
  isError?: boolean;
  chartData?: any;
  /** Multiple charts for comparison view. */
  charts?: any[];
  newsData?: any;
  /** Voice call transcript data. */
  transcriptData?: any;
}

function storageKey(sessionId: string): string {
  return `${KEY_PREFIX}${sessionId}`;
}

/**
 * Read all stored messages for a session.
 * Returns an empty array on missing/corrupted data.
 */
export function getSessionMessages(sessionId: string): StoredMessage[] {
  try {
    const raw = localStorage.getItem(storageKey(sessionId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as StoredMessage[];
  } catch {
    return [];
  }
}

/**
 * Overwrite all messages for a session (capped to MAX_MESSAGES).
 */
export function setSessionMessages(sessionId: string, messages: StoredMessage[]): void {
  try {
    const trimmed = messages.slice(-MAX_MESSAGES);
    localStorage.setItem(storageKey(sessionId), JSON.stringify(trimmed));
  } catch (err) {
    console.warn('[sessionChatStorage] Failed to write messages:', err);
  }
}

/**
 * Append a single message and persist immediately.
 */
export function appendSessionMessage(sessionId: string, message: StoredMessage): void {
  const existing = getSessionMessages(sessionId);
  existing.push(message);
  setSessionMessages(sessionId, existing);
}

/**
 * Remove all chat messages for a session.
 */
export function clearSessionMessages(sessionId: string): void {
  try {
    localStorage.removeItem(storageKey(sessionId));
  } catch {
    // noop
  }
}

/**
 * Remove chat messages for ALL sessions (used when clearing all sessions).
 */
export function clearAllSessionMessages(): void {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(KEY_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key));
  } catch {
    // noop
  }
}

/**
 * Serialize a live Message (with Date timestamp) into the storable shape.
 */
export function serializeMessage(msg: {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isError?: boolean;
  chartData?: any;
  charts?: any[];
  newsData?: any;
  transcriptData?: any;
}): StoredMessage {
  return {
    id: msg.id,
    role: msg.role,
    content: msg.content,
    timestamp: msg.timestamp.toISOString(),
    ...(msg.isError ? { isError: true } : {}),
    ...(msg.chartData ? { chartData: msg.chartData } : {}),
    ...(msg.charts && msg.charts.length > 0 ? { charts: msg.charts } : {}),
    ...(msg.newsData ? { newsData: msg.newsData } : {}),
    ...(msg.transcriptData ? { transcriptData: msg.transcriptData } : {}),
  };
}

/**
 * Deserialize a stored message back into the live shape (with Date timestamp).
 */
export function deserializeMessage(stored: StoredMessage): {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isError?: boolean;
  chartData?: any;
  charts?: any[];
  newsData?: any;
  transcriptData?: any;
} {
  return {
    ...stored,
    timestamp: new Date(stored.timestamp),
  };
}
