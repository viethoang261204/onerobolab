import { Copy, Dices } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { ApiError } from '../../api/client';
import { studentsApi } from '../../api/endpoints';
import type { Student } from '../../api/types';
import { runAction } from '../../components/actions';
import { LevelSelect, useLevelOptions } from '../../components/pickers';
import { Checkbox, Field, TextArea, TextInput } from '../../ui/form';
import { Modal, toast } from '../../ui/overlay';
import { Button, Notice } from '../../ui/primitives';

/** A random, readable temporary password (no look-alike characters). */
export function generatePassword(length = 12): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

function PasswordField({ value, onChange, error, label = 'Temporary password' }: { value: string; onChange: (v: string) => void; error?: string | undefined; label?: string }) {
  return (
    <Field label={label} required error={error} hint="At least 8 characters. Share it with the student privately; they choose their own at first sign-in.">
      {(p) => (
        <div className="flex gap-2">
          <TextInput {...p} value={value} onChange={(e) => onChange(e.target.value)} autoComplete="new-password" className="font-mono" />
          <Button icon={Dices} onClick={() => onChange(generatePassword())} aria-label="Generate a password">
            Generate
          </Button>
          <Button
            icon={Copy}
            aria-label="Copy password"
            disabled={!value}
            onClick={() => void navigator.clipboard?.writeText(value).then(() => toast('Password copied.', 'info'), () => undefined)}
          />
        </div>
      )}
    </Field>
  );
}

export function CreateStudentModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (s: Student) => void }) {
  const [form, setForm] = useState({ username: '', displayName: '', classLabel: '', password: '', mustChange: true });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) {
      setForm({ username: '', displayName: '', classLabel: '', password: generatePassword(), mustChange: true });
      setErrors({});
    }
  }, [open]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      const res = await studentsApi.create({
        username: form.username.trim(),
        displayName: form.displayName.trim(),
        password: form.password,
        classLabel: form.classLabel.trim() || null,
        mustChangePassword: form.mustChange,
      });
      toast(`Student ${res.student.displayName} created.`);
      onCreated(res.student);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) setErrors({ username: 'This username is already taken.' });
      else if (err instanceof ApiError && Object.keys(err.fieldErrors()).length) setErrors(err.fieldErrors());
      else setErrors({ _: err instanceof ApiError ? err.message : 'Could not create the student.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      title="New student"
      description="Students sign in with a username and password — no email or phone number."
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" form="create-student" busy={busy}>
            Create student
          </Button>
        </>
      }
    >
      <form id="create-student" onSubmit={submit} className="grid grid-cols-2 gap-4" noValidate>
        {errors._ && <Notice tone="danger" className="col-span-2">{errors._}</Notice>}
        <Field label="Full name" required error={errors.displayName}>
          {(p) => <TextInput {...p} value={form.displayName} maxLength={80} onChange={(e) => setForm({ ...form, displayName: e.target.value })} data-autofocus />}
        </Field>
        <Field label="Username" required error={errors.username} hint="3–32 letters, digits, dot, dash or underscore.">
          {(p) => <TextInput {...p} value={form.username} maxLength={32} autoComplete="off" onChange={(e) => setForm({ ...form, username: e.target.value })} />}
        </Field>
        <Field label="Class" error={errors.classLabel} hint="Optional, e.g. 6A.">
          {(p) => <TextInput {...p} value={form.classLabel} maxLength={60} onChange={(e) => setForm({ ...form, classLabel: e.target.value })} />}
        </Field>
        <div />
        <div className="col-span-2">
          <PasswordField value={form.password} onChange={(password) => setForm({ ...form, password })} error={errors.password} />
        </div>
        <div className="col-span-2">
          <Checkbox label="Ask the student to choose a new password at first sign-in" checked={form.mustChange} onChange={(mustChange) => setForm({ ...form, mustChange })} />
        </div>
      </form>
    </Modal>
  );
}

export function ResetPasswordModal({ student, onClose }: { student: Pick<Student, 'id' | 'displayName'> | null; onClose: () => void }) {
  const [password, setPassword] = useState('');
  const [mustChange, setMustChange] = useState(true);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (student) {
      setPassword(generatePassword());
      setMustChange(true);
    }
  }, [student]);

  const submit = async () => {
    if (!student) return;
    setBusy(true);
    const ok = await runAction(() => studentsApi.resetPassword(student.id, password, mustChange), {
      success: `Password reset for ${student.displayName}. Their other sessions were signed out.`,
      tags: ['students', 'activity'],
    });
    setBusy(false);
    if (ok !== undefined) onClose();
  };

  return (
    <Modal
      open={!!student}
      title={`Reset password — ${student?.displayName ?? ''}`}
      description="The student is signed out everywhere and uses this password next time."
      onClose={onClose}
      size="md"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" busy={busy} disabled={password.length < 8} onClick={() => void submit()}>
            Reset password
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <PasswordField value={password} onChange={setPassword} label="New temporary password" />
        <Checkbox label="Ask the student to choose a new password at next sign-in" checked={mustChange} onChange={setMustChange} />
      </div>
    </Modal>
  );
}

/** Manually unlock one level for one student (optional reason and end date). */
export function UnlockLevelModal({
  student,
  initialLevelId = '',
  onClose,
}: {
  student: Pick<Student, 'id' | 'displayName'> | null;
  initialLevelId?: string;
  onClose: () => void;
}) {
  const levels = useLevelOptions();
  const [levelId, setLevelId] = useState(initialLevelId);
  const [reason, setReason] = useState('');
  const [until, setUntil] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (student) {
      setLevelId(initialLevelId);
      setReason('');
      setUntil('');
    }
  }, [student, initialLevelId]);

  const submit = async () => {
    if (!student || !levelId) return;
    setBusy(true);
    const level = levels.data?.levels.find((l) => l.id === levelId);
    const ok = await runAction(
      () => studentsApi.unlock(student.id, levelId, { ...(reason.trim() && { reason: reason.trim() }), ...(until && { expiresAt: new Date(`${until}T23:59:59`).toISOString() }) }),
      { success: `${level?.title ?? 'Level'} unlocked for ${student.displayName}.`, tags: ['students', 'access', 'activity'] },
    );
    setBusy(false);
    if (ok !== undefined) onClose();
  };

  return (
    <Modal
      open={!!student}
      title={`Unlock a level for ${student?.displayName ?? ''}`}
      description="The student can play it right away, whatever the prerequisites say. This is recorded in the audit log."
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" busy={busy} disabled={!levelId} onClick={() => void submit()}>
            Unlock level
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Level" required>
          {(p) => <LevelSelect {...p} levels={levels.data?.levels} value={levelId} onChange={setLevelId} />}
        </Field>
        <Field label="Reason" hint="Optional — shown in the audit log.">
          {(p) => <TextArea {...p} rows={2} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Catching up after an absence" />}
        </Field>
        <Field label="Unlocked until" hint="Optional. Leave empty to keep it unlocked.">
          {(p) => <TextInput {...p} type="date" min={new Date().toISOString().slice(0, 10)} value={until} onChange={(e) => setUntil(e.target.value)} className="w-48" />}
        </Field>
      </div>
    </Modal>
  );
}
