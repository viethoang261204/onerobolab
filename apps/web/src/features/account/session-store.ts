import { create } from 'zustand';

/** The signed-in student (from the API; never contains a password or hash). */
export interface StudentUser {
  readonly id: string;
  readonly username: string;
  readonly displayName: string;
  readonly role: string;
  readonly avatarUrl: string | null;
  readonly mustChangePassword: boolean;
}

export type SessionStatus = 'restoring' | 'anonymous' | 'signed-in';

/*
 * Student session. The bearer token is kept in sessionStorage (ends with the
 * tab) — or in localStorage when the student ticks "Keep me signed in" on a
 * personal device. Separate from the admin console's session.
 */
const KEY = 'roboverse.session.v1';

interface Stored {
  token: string;
  remember: boolean;
}

function read(): Stored | null {
  for (const store of [() => sessionStorage, () => localStorage]) {
    try {
      const raw = store().getItem(KEY);
      if (!raw) continue;
      const v = JSON.parse(raw) as Partial<Stored>;
      if (typeof v.token === 'string' && v.token) return { token: v.token, remember: v.remember === true };
    } catch {
      // storage blocked / malformed: ignore
    }
  }
  return null;
}

function write(value: Stored | null): void {
  for (const s of [() => sessionStorage, () => localStorage]) {
    try {
      s().removeItem(KEY);
    } catch {
      // ignore
    }
  }
  if (!value) return;
  try {
    (value.remember ? localStorage : sessionStorage).setItem(KEY, JSON.stringify(value));
  } catch {
    // Storage unavailable: the session lives in memory for this page only.
  }
}

interface SessionState {
  readonly token: string | null;
  readonly remember: boolean;
  readonly user: StudentUser | null;
  readonly status: SessionStatus;
  /** Shown on the sign-in page (why the last session ended). */
  readonly notice: string | null;
  signedIn(token: string, user: StudentUser, remember: boolean): void;
  setUser(user: StudentUser): void;
  signedOut(notice?: string | null): void;
}

const stored = typeof window === 'undefined' ? null : read();

export const useStudentSession = create<SessionState>()((set, get) => ({
  token: stored?.token ?? null,
  remember: stored?.remember ?? false,
  user: null,
  status: stored ? 'restoring' : 'anonymous',
  notice: null,
  signedIn: (token, user, remember) => {
    write({ token, remember });
    set({ token, user, remember, status: 'signed-in', notice: null });
  },
  setUser: (user) => set({ user }),
  signedOut: (notice = null) => {
    write(null);
    if (get().status !== 'anonymous' || get().token) set({ token: null, user: null, status: 'anonymous', notice });
  },
}));
