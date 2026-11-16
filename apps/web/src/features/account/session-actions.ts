import { useCatalogStore } from '../catalog/catalog-store';
import { resetRunSession } from '../levels/run-session';
import { startProgramSync, stopProgramSync } from '../programming/state/program-sync';
import { useRobotStore } from '../garage/state/robot-store';
import { useStudentSession, type StudentUser } from './session-store';
import { studentApi } from './student-api';

/** Valid credentials that belong to a staff account: students use OneRoboLab, staff the admin console. */
export class StaffAccountError extends Error {
  constructor() {
    super('This is a staff account. Please use the admin console.');
    this.name = 'StaffAccountError';
  }
}

/** Revoke a token we are not going to keep (never stored anywhere). */
async function revoke(token: string): Promise<void> {
  const prev = useStudentSession.getState().token;
  useStudentSession.setState({ token });
  try {
    await studentApi.logout();
  } catch {
    // best effort
  } finally {
    useStudentSession.setState({ token: prev });
  }
}

/**
 * Sign in with username + password. Staff accounts are refused (their token
 * is revoked immediately). Returns the student; `mustChangePassword` means
 * the sign-in page asks for a new password before anything else.
 */
export async function signIn(username: string, password: string, remember: boolean): Promise<StudentUser> {
  const res = await studentApi.login(username, password);
  if (res.user.role !== 'STUDENT') {
    await revoke(res.token);
    throw new StaffAccountError();
  }
  const { permissions: _p, ...user } = res.user;
  useStudentSession.getState().signedIn(res.token, user, remember);
  return user;
}

/** Page reload with a stored token: check it's still a valid student session. */
export async function restoreSession(): Promise<void> {
  const s = useStudentSession.getState();
  if (!s.token) return s.signedOut();
  try {
    const { user } = await studentApi.me();
    if (user.role !== 'STUDENT') return s.signedOut();
    s.signedIn(s.token, user, s.remember);
  } catch (e) {
    // Offline: keep the token and try again later; anything else ends the session.
    if ((e as { status?: number }).status === 0) useStudentSession.setState({ status: 'anonymous', notice: 'Can’t reach OneRoboLab right now. Check your connection and sign in again.' });
    else s.signedOut();
  }
}

/** First sign-in with a temporary password. */
export async function changePassword(current: string, next: string): Promise<void> {
  await studentApi.changePassword(current, next);
  const { user } = await studentApi.me();
  useStudentSession.getState().setUser(user);
}

/** Start the signed-in experience: program sync for this student + their catalog. */
export function startStudentSession(user: StudentUser): Promise<void> {
  startProgramSync(user.id);
  useRobotStore.getState().setNamespace(user.id);
  return useCatalogStore.getState().load();
}

/** Sign out: revoke the token, forget the catalog; local program copies stay (per student) on this device. */
export async function signOut(notice: string | null = null): Promise<void> {
  try {
    await studentApi.logout();
  } catch {
    // The local session ends regardless.
  }
  endStudentSession();
  useStudentSession.getState().signedOut(notice);
}

/** Local teardown (also used when the session expires). */
export function endStudentSession(): void {
  resetRunSession();
  stopProgramSync();
  useRobotStore.getState().setNamespace(null);
  useCatalogStore.getState().clear();
}
