import { authApi } from '../api/endpoints';
import { adminAccess } from './access';
import { useSessionStore } from './session-store';

/** Thrown when valid credentials belong to a non-staff account (e.g. a student). */
export class NotStaffError extends Error {
  constructor() {
    super('This account cannot use the admin console.');
    this.name = 'NotStaffError';
  }
}

/**
 * Sign in. A student (or any non-staff) account is refused *before* the
 * session is stored: its token is revoked on the server at once and never
 * reaches sessionStorage.
 */
export async function signIn(username: string, password: string): Promise<void> {
  const res = await authApi.login(username, password);
  if (adminAccess(res.user) === 'forbidden') {
    // Revoke with this token only; the store stays anonymous throughout.
    useSessionStore.setState({ token: res.token });
    try {
      await authApi.logout();
    } catch {
      // Best effort — the token is not kept anywhere.
    } finally {
      useSessionStore.setState({ token: null });
    }
    throw new NotStaffError();
  }
  useSessionStore.getState().signedIn(res.token, res.user);
}

/** Re-load the user for a token found in sessionStorage (page reload). */
export async function restoreSession(): Promise<void> {
  const { token, signedIn, signedOut } = useSessionStore.getState();
  if (!token) return signedOut();
  try {
    const { user } = await authApi.me();
    signedIn(token, user);
  } catch {
    signedOut();
  }
}

/** Sign out on the server (revokes the token) and locally. */
export async function signOut(): Promise<void> {
  try {
    await authApi.logout();
  } catch {
    // The local session ends regardless.
  }
  useSessionStore.getState().signedOut();
}

/** Refresh the user after a password change (clears mustChangePassword). */
export async function refreshUser(): Promise<void> {
  const { user } = await authApi.me();
  useSessionStore.getState().setUser(user);
}
