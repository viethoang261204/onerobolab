import { Lock, ShieldAlert } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { navigate } from '../../../router/router-store';
import { ApiError } from '../../api/client';
import { NotStaffError, signIn } from '../../session/session-actions';
import { useSessionStore } from '../../session/session-store';
import { safeNext } from '../../admin-routes';
import { Field, TextInput } from '../../ui/form';
import { Button, Notice } from '../../ui/primitives';

/** Username + password sign-in for staff. Student accounts are refused and signed out at once. */
export function LoginPage() {
  const notice = useSessionStore((s) => s.notice);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return setError('Enter your username and password.');
    setBusy(true);
    setError(null);
    try {
      await signIn(username.trim(), password);
      navigate(safeNext(window.location.search), { replace: true });
    } catch (err) {
      setError(
        err instanceof NotStaffError
          ? err.message
          : err instanceof ApiError && err.status === 429
          ? 'Too many sign-in attempts. Wait a few minutes and try again.'
          : err instanceof ApiError && err.status === 401
            ? 'Wrong username or password.'
            : err instanceof ApiError
              ? err.message
              : 'Cannot sign in right now.',
      );
    } finally {
      setBusy(false);
      setPassword('');
    }
  };

  return (
    <div className="admin-root flex h-full items-center justify-center overflow-y-auto bg-adm-bg p-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-adm-nav text-white" aria-hidden>
            <Lock className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-lg font-semibold text-adm-ink">OneRoboLab Admin</h1>
            <p className="text-sm text-adm-muted">Sign in with your staff account.</p>
          </div>
        </div>
        <form onSubmit={submit} className="flex flex-col gap-4 rounded-xl border border-adm-line bg-adm-surface p-6 shadow-adm" noValidate>
          {notice && !error && <Notice tone="info">{notice}</Notice>}
          {error && (
            <div role="alert" className="flex items-start gap-2 rounded-lg bg-adm-bad-soft px-3 py-2.5 text-sm text-adm-bad ring-1 ring-adm-bad/20 ring-inset">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              {error}
            </div>
          )}
          <Field label="Username">
            {(p) => <TextInput {...p} autoComplete="username" autoFocus value={username} onChange={(e) => setUsername(e.target.value)} />}
          </Field>
          <Field label="Password">
            {(p) => <TextInput {...p} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />}
          </Field>
          <Button type="submit" variant="primary" busy={busy} className="mt-1 w-full">
            Sign in
          </Button>
        </form>
        <p className="mt-4 text-center text-xs text-adm-faint">Access is limited to administrators and staff. Every action is logged.</p>
      </div>
    </div>
  );
}
