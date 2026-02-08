export interface AuthState {
  username: string;
}

const AUTH_KEY = 'stonks.auth';

export function getAuth(): AuthState | null {
  const raw = localStorage.getItem(AUTH_KEY);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as AuthState;
  } catch {
    return null;
  }
}

export function isAuthed(): boolean {
  return !!getAuth();
}

export function login(username: string) {
  const payload: AuthState = { username };
  localStorage.setItem(AUTH_KEY, JSON.stringify(payload));
}

export function logout() {
  localStorage.removeItem(AUTH_KEY);
}
