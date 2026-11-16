import { AlertTriangle, KeyRound, Loader2, LogIn, User } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { BrandLogo } from '../../components/navigation/BrandLogo';
import { ApiError } from '../api/client';
import { changePassword, signIn, signOut, StaffAccountError } from './session-actions';
import { useStudentSession } from './session-store';
import { buttonClass } from '../../components/common/Button';

const field =
  'h-12 w-full rounded-[var(--radius-control)] border border-edge-strong bg-panel-2 px-4 text-[15px] text-white placeholder:text-faint outline-none transition-colors focus:border-cyan/70 focus:bg-panel-3';

function Label({ htmlFor, children }: { htmlFor: string; children: ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-[13px] font-semibold text-[#cbd5e1]">
      {children}
    </label>
  );
}

function ErrorBox({ children }: { children: ReactNode }) {
  return (
    <div role="alert" className="flex items-start gap-2.5 rounded-[var(--radius-control)] border border-danger/40 bg-danger/12 px-3.5 py-3 text-[13.5px] text-[#fecaca]">
      <AlertTriangle size={17} className="mt-px shrink-0 text-danger" />
      <div>{children}</div>
    </div>
  );
}

function SubmitButton({ busy, icon: Icon, children }: { busy: boolean; icon: typeof LogIn; children: ReactNode }) {
  return (
    <button
      type="submit"
      disabled={busy}
      className={buttonClass('go', 'mt-1 min-h-12 w-full text-[16px] disabled:opacity-60')}
    >
      {busy ? <Loader2 size={18} className="animate-spin" /> : <Icon size={18} />}
      {children}
    </button>
  );
}

/** First sign-in with a temporary password: the student picks their own. */
function ChangePasswordForm() {
  const user = useStudentSession((s) => s.user);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (next.length < 8) return setError('Your new password needs at least 8 characters.');
    if (next !== repeat) return setError('The two new passwords are not the same.');
    setBusy(true);
    setError(null);
    try {
      await changePassword(current, next);
    } catch (err) {
      setError(err instanceof ApiError && err.status === 401 ? 'The temporary password is not right.' : err instanceof ApiError ? err.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <div>
        <h1 className="font-display text-[26px] font-black text-white">Hi {user?.displayName ?? 'there'}!</h1>
        <p className="mt-1 text-[14px] text-muted">Your teacher gave you a temporary password. Choose your own secret password to continue.</p>
      </div>
      {error && <ErrorBox>{error}</ErrorBox>}
      <div>
        <Label htmlFor="pw-current">Temporary password</Label>
        <input id="pw-current" type="password" autoComplete="current-password" className={field} value={current} onChange={(e) => setCurrent(e.target.value)} />
      </div>
      <div>
        <Label htmlFor="pw-new">New password</Label>
        <input id="pw-new" type="password" autoComplete="new-password" className={field} value={next} onChange={(e) => setNext(e.target.value)} placeholder="At least 8 characters" />
      </div>
      <div>
        <Label htmlFor="pw-repeat">Type it again</Label>
        <input id="pw-repeat" type="password" autoComplete="new-password" className={field} value={repeat} onChange={(e) => setRepeat(e.target.value)} />
      </div>
      <SubmitButton busy={busy} icon={KeyRound}>
        Save my password
      </SubmitButton>
      <button type="button" onClick={() => void signOut()} className="text-center text-[13px] text-muted hover:text-white">
        Not you? Sign out
      </button>
    </form>
  );
}

function SignInForm() {
  const notice = useStudentSession((s) => s.notice);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState<ReactNode>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return setError('Type your username and password.');
    setBusy(true);
    setError(null);
    try {
      await signIn(username.trim(), password, remember);
    } catch (err) {
      if (err instanceof StaffAccountError) {
        setError(
          <>
            {err.message}{' '}
            <a href="/admin" className="font-semibold text-white underline">
              Open the admin console
            </a>
          </>,
        );
      } else if (err instanceof ApiError && err.status === 401) setError('Wrong username or password. Check them and try again.');
      else if (err instanceof ApiError && err.code === 'ACCOUNT_DISABLED') setError('Your account is switched off. Ask your teacher for help.');
      else if (err instanceof ApiError && err.status === 429) setError('Too many tries. Wait a few minutes, then try again.');
      else if (err instanceof ApiError && err.status === 0) setError('Can’t reach OneRoboLab. Check your internet connection.');
      else setError('Something went wrong. Try again in a moment.');
    } finally {
      setBusy(false);
      setPassword('');
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <div>
        <h1 className="font-display text-[28px] font-black text-white">Welcome, explorer!</h1>
        <p className="mt-1 text-[14.5px] text-muted">Sign in to continue your robotics journey.</p>
      </div>
      {notice && !error && <div className="rounded-[var(--radius-control)] border border-cyan/30 bg-cyan/10 px-3.5 py-3 text-[13.5px] text-[#cffafe]">{notice}</div>}
      {error && <ErrorBox>{error}</ErrorBox>}
      <div>
        <Label htmlFor="login-username">Username</Label>
        <div className="relative">
          <User size={17} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-faint" />
          <input id="login-username" className={`${field} pl-11`} autoComplete="username" autoCapitalize="none" spellCheck={false} autoFocus value={username} onChange={(e) => setUsername(e.target.value)} />
        </div>
      </div>
      <div>
        <Label htmlFor="login-password">Password</Label>
        <input id="login-password" type="password" className={field} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <label className="flex cursor-pointer items-center gap-2.5 text-[13.5px] text-[#cbd5e1]">
        <input type="checkbox" className="h-4 w-4 accent-[var(--color-cyan)]" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
        Keep me signed in on this device
        <span className="text-faint">(not on shared computers)</span>
      </label>
      <SubmitButton busy={busy} icon={LogIn}>
        Sign in
      </SubmitButton>
      <p className="text-center text-[12.5px] text-faint">Forgot your password? Ask your teacher to reset it.</p>
    </form>
  );
}

/** `/login` — the door to OneRoboLab. Username + password only (no email, no phone). */
export function LoginPage() {
  const user = useStudentSession((s) => s.user);
  const status = useStudentSession((s) => s.status);
  return (
    <main className="relative flex h-full items-center justify-center overflow-y-auto bg-bg p-6" aria-label="Sign in">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_10%,rgb(59_130_246/0.25),transparent_55%),radial-gradient(ellipse_at_85%_90%,rgb(139_92_246/0.22),transparent_50%)]" />
      <div className="relative w-full max-w-[420px] animate-page-in">
        <div className="mb-6 flex justify-center">
          <BrandLogo />
        </div>
        <div className="glass rounded-[var(--radius-dialog)] p-7">{status === 'signed-in' && user?.mustChangePassword ? <ChangePasswordForm /> : <SignInForm />}</div>
      </div>
    </main>
  );
}
