import { create } from 'zustand';
import type { SessionUser } from './access';

/**
 * The admin's session: the bearer token and the signed-in user.
 *
 * The token lives in sessionStorage (this tab only, gone when it closes) —
 * never in localStorage and never in a cookie. Storage failures (private
 * mode, blocked storage) just mean signing in again.
 */
const KEY = 'roboverse.admin.token';

function readToken(): string | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function writeToken(token: string | null): void {
  try {
    if (typeof sessionStorage === 'undefined') return;
    if (token) sessionStorage.setItem(KEY, token);
    else sessionStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

export type SessionStatus = 'restoring' | 'anonymous' | 'signed-in';

interface SessionState {
  readonly token: string | null;
  readonly user: SessionUser | null;
  readonly status: SessionStatus;
  /** Why the last session ended (shown on the sign-in page). */
  readonly notice: string | null;
  signedIn(token: string, user: SessionUser): void;
  setUser(user: SessionUser): void;
  signedOut(notice?: string | null): void;
}

export const useSessionStore = create<SessionState>()((set) => ({
  token: readToken(),
  user: null,
  status: readToken() ? 'restoring' : 'anonymous',
  notice: null,
  signedIn: (token, user) => {
    writeToken(token);
    set({ token, user, status: 'signed-in', notice: null });
  },
  setUser: (user) => set({ user }),
  signedOut: (notice = null) => {
    writeToken(null);
    set({ token: null, user: null, status: 'anonymous', notice });
  },
}));
