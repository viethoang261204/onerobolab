import { CheckCircle2, KeyRound, LogOut, Server, ShieldCheck, XCircle } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { ApiError } from '../../api/client';
import { authApi, healthApi } from '../../api/endpoints';
import { useResource } from '../../data/use-resource';
import { roleLabel } from '../../layout/AdminShell';
import { ADMIN_PERMISSIONS } from '../../session/access';
import { signOut } from '../../session/session-actions';
import { useSessionStore } from '../../session/session-store';
import { Field, TextInput } from '../../ui/form';
import { PageHeader } from '../../ui/layout';
import { toast } from '../../ui/overlay';
import { Button, Card, DescriptionList, Notice } from '../../ui/primitives';

const PERMISSION_LABELS: Record<string, string> = {
  'students.view': 'View students',
  'students.manage': 'Create, disable and reset students',
  'progress.view': 'View progress, programs and attempts',
  'levels.unlock': 'Unlock / lock levels for students',
  'curriculum.manage': 'Edit curricula, worlds and levels',
  'levels.publish': 'Review and publish content',
  'content.manage': 'Edit lessons',
  'achievements.manage': 'Edit achievements',
  'statistics.view': 'View statistics',
  'audit.view': 'Read the audit log',
  'roles.manage': 'Manage roles',
};

function ChangePassword() {
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
      toast('Password changed. Your other sessions were signed out.');
      setCurrent('');
      setNext('');
      setRepeat('');
    } catch (err) {
      setError(err instanceof ApiError && err.status === 401 ? 'The current password is wrong.' : err instanceof ApiError ? err.message : 'Could not change the password.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      {error && <Notice tone="danger">{error}</Notice>}
      <Field label="Current password">{(p) => <TextInput {...p} type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />}</Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="New password" hint="At least 8 characters.">
          {(p) => <TextInput {...p} type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />}
        </Field>
        <Field label="Repeat new password">{(p) => <TextInput {...p} type="password" autoComplete="new-password" value={repeat} onChange={(e) => setRepeat(e.target.value)} />}</Field>
      </div>
      <div>
        <Button type="submit" variant="primary" icon={KeyRound} busy={busy} disabled={!current || !next}>
          Change password
        </Button>
      </div>
    </form>
  );
}

export function SettingsPage() {
  const user = useSessionStore((s) => s.user)!;
  const health = useResource('health', () => healthApi.check());
  const apiOrigin = (import.meta.env.VITE_API_URL as string | undefined) || window.location.origin;
  const ok = health.data?.status === 'ok';

  return (
    <>
      <PageHeader title="Settings" subtitle="Your account and the connection to the OneRoboLab API." />
      <div className="grid grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-5">
        <div className="flex flex-col gap-5">
          <Card title="My account">
            <DescriptionList
              items={[
                ['Name', user.displayName],
                ['Username', <span className="font-mono">{user.username}</span>],
                ['Role', roleLabel(user.role)],
              ]}
            />
          </Card>
          <Card title="Change password">
            <ChangePassword />
          </Card>
          <Card title="Session">
            <p className="mb-3 text-sm text-adm-body">
              Your session is kept only in this browser tab and ends when you close it or sign out. Sessions expire automatically; changing your password signs out your other devices.
            </p>
            <Button icon={LogOut} onClick={() => void signOut()}>
              Sign out
            </Button>
          </Card>
        </div>
        <div className="flex flex-col gap-5">
          <Card title="Permissions" actions={<ShieldCheck className="h-4 w-4 text-adm-accent" aria-hidden />}>
            <ul className="flex flex-col gap-1.5 text-sm">
              {ADMIN_PERMISSIONS.map((p) => {
                const has = user.permissions.includes(p);
                return (
                  <li key={p} className="flex items-center gap-2">
                    {has ? <CheckCircle2 className="h-4 w-4 text-adm-ok" aria-label="Granted" /> : <XCircle className="h-4 w-4 text-adm-line-strong" aria-label="Not granted" />}
                    <span className={has ? 'text-adm-ink' : 'text-adm-faint'}>{PERMISSION_LABELS[p] ?? p}</span>
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 text-xs text-adm-muted">Permissions come from your role and are checked by the server on every request.</p>
          </Card>
          <Card title="API connection" actions={<Server className="h-4 w-4 text-adm-muted" aria-hidden />}>
            <DescriptionList
              columns={1}
              items={[
                ['API', <span className="font-mono text-xs">{apiOrigin}</span>],
                [
                  'Status',
                  health.error ? (
                    <span className="text-adm-bad">Unreachable</span>
                  ) : !health.data ? (
                    'Checking…'
                  ) : ok ? (
                    <span className="text-adm-ok">Online · database connected</span>
                  ) : (
                    <span className="text-adm-warn">Degraded · database {health.data.database}</span>
                  ),
                ],
              ]}
            />
            <p className="mt-3 text-xs text-adm-muted">The console only talks to the API. Database credentials never reach the browser.</p>
          </Card>
        </div>
      </div>
    </>
  );
}
