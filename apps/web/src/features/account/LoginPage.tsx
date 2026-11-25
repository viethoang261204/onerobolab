import { AlertTriangle, KeyRound, Loader2, LogIn, User } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { BrandLogo } from '../../components/navigation/BrandLogo';
import { ApiError } from '../api/client';
import { LOCALES, setLocale, useLocale, useMessages } from '../i18n/i18n';
import { accountMessages } from './account.messages';
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
  const m = useMessages(accountMessages);
  const user = useStudentSession((s) => s.user);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (next.length < 8) return setError(m.pwTooShort);
    if (next !== repeat) return setError(m.pwMismatch);
    setBusy(true);
    setError(null);
    try {
      await changePassword(current, next);
    } catch (err) {
      setError(err instanceof ApiError && err.status === 401 ? m.tempWrong : err instanceof ApiError ? err.message : m.wentWrong);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <div>
        <h1 className="font-display text-[26px] font-black text-white">{m.hi({ name: user?.displayName ?? m.there })}</h1>
        <p className="mt-1 text-[14px] text-muted">{m.tempIntro}</p>
      </div>
      {error && <ErrorBox>{error}</ErrorBox>}
      <div>
        <Label htmlFor="pw-current">{m.tempPassword}</Label>
        <input id="pw-current" type="password" autoComplete="current-password" className={field} value={current} onChange={(e) => setCurrent(e.target.value)} />
      </div>
      <div>
        <Label htmlFor="pw-new">{m.newPassword}</Label>
        <input id="pw-new" type="password" autoComplete="new-password" className={field} value={next} onChange={(e) => setNext(e.target.value)} placeholder={m.atLeast8} />
      </div>
      <div>
        <Label htmlFor="pw-repeat">{m.typeAgain}</Label>
        <input id="pw-repeat" type="password" autoComplete="new-password" className={field} value={repeat} onChange={(e) => setRepeat(e.target.value)} />
      </div>
      <SubmitButton busy={busy} icon={KeyRound}>
        {m.savePassword}
      </SubmitButton>
      <button type="button" onClick={() => void signOut()} className="text-center text-[13px] text-muted hover:text-white">
        {m.notYou}
      </button>
    </form>
  );
}

function SignInForm() {
  const m = useMessages(accountMessages);
  const notice = useStudentSession((s) => s.notice);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState<ReactNode>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return setError(m.typeBoth);
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
              {m.openAdmin}
            </a>
          </>,
        );
      } else if (err instanceof ApiError && err.status === 401) setError(m.wrongLogin);
      else if (err instanceof ApiError && err.code === 'ACCOUNT_DISABLED') setError(m.disabled);
      else if (err instanceof ApiError && err.status === 429) setError(m.tooMany);
      else if (err instanceof ApiError && err.status === 0) setError(m.noConnection);
      else setError(m.wentWrongLater);
    } finally {
      setBusy(false);
      setPassword('');
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <div>
        <h1 className="font-display text-[28px] font-black text-white">{m.welcome}</h1>
        <p className="mt-1 text-[14.5px] text-muted">{m.welcomeSub}</p>
      </div>
      {notice && !error && <div className="rounded-[var(--radius-control)] border border-cyan/30 bg-cyan/10 px-3.5 py-3 text-[13.5px] text-[#cffafe]">{notice}</div>}
      {error && <ErrorBox>{error}</ErrorBox>}
      <div>
        <Label htmlFor="login-username">{m.username}</Label>
        <div className="relative">
          <User size={17} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-faint" />
          <input id="login-username" className={`${field} pl-11`} autoComplete="username" autoCapitalize="none" spellCheck={false} autoFocus value={username} onChange={(e) => setUsername(e.target.value)} />
        </div>
      </div>
      <div>
        <Label htmlFor="login-password">{m.password}</Label>
        <input id="login-password" type="password" className={field} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <label className="flex cursor-pointer items-center gap-2.5 text-[13.5px] text-[#cbd5e1]">
        <input type="checkbox" className="h-4 w-4 accent-[var(--color-cyan)]" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
        {m.keepSignedIn}
        <span className="text-faint">{m.notShared}</span>
      </label>
      <SubmitButton busy={busy} icon={LogIn}>
        {m.signIn}
      </SubmitButton>
      <p className="text-center text-[12.5px] text-faint">{m.forgot}</p>
    </form>
  );
}

/** `/login` — the door to OneRoboLab. Username + password only (no email, no phone). */
export function LoginPage() {
  const m = useMessages(accountMessages);
  const locale = useLocale();
  const user = useStudentSession((s) => s.user);
  const status = useStudentSession((s) => s.status);
  return (
    <main className="relative flex h-full items-start justify-center overflow-y-auto bg-bg p-4 sm:items-center sm:p-6" aria-label={m.signIn}>
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_10%,rgb(59_130_246/0.25),transparent_55%),radial-gradient(ellipse_at_85%_90%,rgb(139_92_246/0.22),transparent_50%)]" />
      <div role="group" aria-label={m.language} className="absolute right-3 top-3 z-10 flex rounded-[var(--radius-control)] border border-white/10 bg-white/[0.04] p-0.5 sm:right-5 sm:top-5">
        {LOCALES.map((l) => (
          <button
            key={l.id}
            type="button"
            aria-pressed={locale === l.id}
            onClick={() => setLocale(l.id)}
            className={`h-10 min-w-11 rounded-[8px] px-3 text-[13px] font-semibold transition-colors ${locale === l.id ? 'bg-white/15 text-white' : 'text-muted hover:text-white'}`}
          >
            {l.label}
          </button>
        ))}
      </div>
      <div className="relative mt-14 w-full max-w-[420px] animate-page-in sm:mt-0">
        <div className="mb-6 flex justify-center">
          <BrandLogo />
        </div>
        <div className="glass rounded-[var(--radius-dialog)] p-5 sm:p-7">{status === 'signed-in' && user?.mustChangePassword ? <ChangePasswordForm /> : <SignInForm />}</div>
      </div>
    </main>
  );
}
