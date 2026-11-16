import { KeyRound, ShieldOff } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { ApiError } from '../../api/client';
import { authApi } from '../../api/endpoints';
import { refreshUser, signOut } from '../../session/session-actions';
import { Field, TextInput } from '../../ui/form';
import { Button, Notice } from '../../ui/primitives';

/** Signed in, but not a staff account (e.g. a student). Nothing of the console is shown. */
export function ForbiddenPage() {
  return (
    <div className="admin-root flex h-full items-center justify-center bg-adm-bg p-6">
      <div className="max-w-md rounded-xl border border-adm-line bg-adm-surface p-8 text-center shadow-adm">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-adm-bad-soft text-adm-bad">
          <ShieldOff className="h-6 w-6" aria-hidden />
        </span>
        <h1 className="mt-4 text-lg font-semibold text-adm-ink">No access</h1>
        <p className="mt-2 text-sm text-adm-muted">This area is for OneRoboLab administrators. Your account doesn’t have access to it.</p>
        <div className="mt-6 flex justify-center gap-2">
          <a href="/" className="inline-flex h-9 items-center rounded-lg border border-adm-line-strong px-3.5 text-sm font-medium text-adm-ink hover:bg-adm-subtle">
            Go to OneRoboLab
          </a>
          <Button variant="primary" onClick={() => void signOut()}>
            Sign out
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Forced first-login password change. */
export function ChangePasswordPage() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (next.length < 8) return setError('The new password needs at least 8 characters.');
    if (next !== repeat) return setError('The two new passwords are different.');
    setBusy(true);
    setError(null);
    try {
      await authApi.changePassword(current, next);
      await refreshUser();
    } catch (err) {
      setError(err instanceof ApiError && err.status === 401 ? 'The current password is wrong.' : err instanceof ApiError ? err.message : 'Could not change the password.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="admin-root flex h-full items-center justify-center bg-adm-bg p-6">
      <form onSubmit={submit} className="flex w-full max-w-sm flex-col gap-4 rounded-xl border border-adm-line bg-adm-surface p-6 shadow-adm">
        <div className="flex items-center gap-3">
          <KeyRound className="h-5 w-5 text-adm-accent" aria-hidden />
          <h1 className="text-base font-semibold text-adm-ink">Choose a new password</h1>
        </div>
        <Notice tone="info">Your account uses a temporary password. Choose your own before continuing.</Notice>
        {error && <Notice tone="danger">{error}</Notice>}
        <Field label="Current password">{(p) => <TextInput {...p} type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />}</Field>
        <Field label="New password" hint="At least 8 characters.">
          {(p) => <TextInput {...p} type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />}
        </Field>
        <Field label="Repeat new password">{(p) => <TextInput {...p} type="password" autoComplete="new-password" value={repeat} onChange={(e) => setRepeat(e.target.value)} />}</Field>
        <div className="flex justify-between gap-2">
          <Button variant="ghost" onClick={() => void signOut()}>
            Sign out
          </Button>
          <Button type="submit" variant="primary" busy={busy}>
            Save password
          </Button>
        </div>
      </form>
    </div>
  );
}
