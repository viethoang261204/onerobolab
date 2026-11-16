import { Ban, CheckCircle2, KeyRound, Lock, RotateCcw, Save, Trophy, Unlock, UnlockKeyhole } from 'lucide-react';
import { useEffect, useState } from 'react';
import { adminPaths, type StudentTab } from '../../admin-routes';
import { activityApi, studentsApi } from '../../api/endpoints';
import type { Student, StudentLevelRow, StudentProgress } from '../../api/types';
import { runAction, useBusy } from '../../components/actions';
import { useResource } from '../../data/use-resource';
import { formatDate, formatDateTime, formatDuration, formatNumber, relativeTime } from '../../lib/format';
import { LEVEL_STATE, STATE_REASONS, USER_STATUS } from '../../lib/labels';
import { can } from '../../session/access';
import { useSessionStore } from '../../session/session-store';
import { DataTable, Pagination, type Column } from '../../ui/DataTable';
import { Field, TextArea, TextInput } from '../../ui/form';
import { PageHeader, Tabs } from '../../ui/layout';
import { confirmAction, RowMenu } from '../../ui/overlay';
import { Avatar, Badge, Button, Card, DescriptionList, EmptyState, ErrorState, Spinner, Stars } from '../../ui/primitives';
import { AttemptDrawer, attemptColumns, ProgramDrawer, programColumns } from '../activity/ActivityPages';
import { toggleStudentStatus } from './StudentsPage';
import { ResetPasswordModal, UnlockLevelModal } from './student-modals';

function ProfileTab({ student }: { student: Student }) {
  const manage = can(useSessionStore((s) => s.user), 'students.manage');
  const [form, setForm] = useState({ displayName: student.displayName, classLabel: student.classLabel ?? '', notes: student.notes ?? '' });
  const [busy, run] = useBusy();
  useEffect(() => setForm({ displayName: student.displayName, classLabel: student.classLabel ?? '', notes: student.notes ?? '' }), [student]);
  const dirty = form.displayName !== student.displayName || form.classLabel !== (student.classLabel ?? '') || form.notes !== (student.notes ?? '');

  const save = () =>
    run(() =>
      runAction(() => studentsApi.update(student.id, { displayName: form.displayName.trim(), classLabel: form.classLabel.trim() || null, notes: form.notes.trim() || null }), {
        success: 'Profile saved.',
        tags: ['students'],
      }),
    );

  return (
    <div className="grid grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-5">
      <Card title="Profile" actions={manage && <Button size="sm" variant="primary" icon={Save} busy={busy} disabled={!dirty || !form.displayName.trim()} onClick={() => void save()}>Save</Button>}>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Full name" required>
            {(p) => <TextInput {...p} disabled={!manage} maxLength={80} value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} />}
          </Field>
          <Field label="Class">{(p) => <TextInput {...p} disabled={!manage} maxLength={60} value={form.classLabel} onChange={(e) => setForm({ ...form, classLabel: e.target.value })} />}</Field>
          <Field label="Teacher notes" hint="Only staff can see these." className="col-span-2">
            {(p) => <TextArea {...p} disabled={!manage} rows={4} maxLength={2000} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />}
          </Field>
        </div>
      </Card>
      <div className="flex flex-col gap-5">
        <Card title="Account">
          <DescriptionList
            items={[
              ['Username', <span className="font-mono">{student.username}</span>],
              ['Status', <Badge tone={USER_STATUS[student.status].tone} dot>{USER_STATUS[student.status].label}</Badge>],
              ['Created', formatDate(student.createdAt)],
              ['Last sign-in', formatDateTime(student.lastLoginAt)],
              ['Last activity', relativeTime(student.lastActivityAt)],
              ['Password', student.mustChangePassword ? 'Temporary (must change)' : 'Set by the student'],
            ]}
          />
          {student.loginLocked && manage && (
            <div className="mt-4 flex items-center justify-between rounded-lg bg-adm-warn-soft px-3 py-2 text-sm text-adm-warn">
              Sign-in is locked after too many wrong passwords.
              <Button size="sm" icon={UnlockKeyhole} onClick={() => void runAction(() => studentsApi.update(student.id, { clearLoginLock: true }), { success: 'Sign-in lock cleared.', tags: ['students'] })}>
                Clear lock
              </Button>
            </div>
          )}
        </Card>
        <Card title="Totals">
          <DescriptionList
            columns={2}
            items={[
              ['XP', formatNumber(student.totalXp)],
              ['Stars', `${formatNumber(student.totalStars)} ★`],
              ['Levels completed', formatNumber(student.levelsCompleted)],
              ['Current streak', `${student.currentStreak} day${student.currentStreak === 1 ? '' : 's'}`],
            ]}
          />
        </Card>
      </div>
    </div>
  );
}

function ProgressTab({ student, progress, reload }: { student: Student; progress: StudentProgress; reload: () => void }) {
  const canUnlock = can(useSessionStore((s) => s.user), 'levels.unlock');
  const [unlockLevel, setUnlockLevel] = useState<string | null>(null);
  const overrides = new Map(progress.overrides.filter((o) => !o.revokedAt).map((o) => [o.levelId, o]));

  const lock = async (row: StudentLevelRow) => {
    if (!(await confirmAction({ title: `Lock ${row.title} for ${student.displayName}?`, message: 'They cannot play it until you unlock it or remove the override.', confirmLabel: 'Lock level', danger: true }))) return;
    await runAction(() => studentsApi.lock(student.id, row.levelId, {}), { success: `${row.title} locked for ${student.displayName}.`, tags: ['students', 'access', 'activity'] });
    reload();
  };
  const clear = async (row: StudentLevelRow) => {
    await runAction(() => studentsApi.clearAccess(student.id, row.levelId), { success: `${row.title} follows the normal unlock rules again.`, tags: ['students', 'access', 'activity'] });
    reload();
  };

  const columns: Column<StudentLevelRow>[] = [
    { key: 'world', header: 'World', cell: (r) => <span className="text-adm-muted">{r.worldName}</span> },
    {
      key: 'level',
      header: 'Level',
      cell: (r) => (
        <span className="flex items-center gap-2">
          <span className="text-adm-ink">{r.title}</span>
          {r.publishStatus !== 'PUBLISHED' && <Badge>{r.publishStatus.toLowerCase()}</Badge>}
        </span>
      ),
    },
    {
      key: 'state',
      header: 'State',
      cell: (r) =>
        r.state ? (
          <span className="flex flex-col items-start gap-0.5">
            <Badge tone={LEVEL_STATE[r.state].tone} dot>
              {LEVEL_STATE[r.state].label}
            </Badge>
            {r.reason && r.reason !== r.state && <span className="text-xs text-adm-muted">{STATE_REASONS[r.reason] ?? r.reason}</span>}
          </span>
        ) : (
          <span className="text-xs text-adm-faint">Not visible to students</span>
        ),
    },
    {
      key: 'override',
      header: 'Override',
      cell: (r) => {
        const o = overrides.get(r.levelId);
        return o ? (
          <span title={o.reason ?? undefined}>
            <Badge tone={o.status === 'AVAILABLE' ? 'info' : 'danger'}>{o.status === 'AVAILABLE' ? 'Unlocked manually' : 'Locked manually'}</Badge>
            {o.expiresAt && <span className="ml-1.5 text-xs text-adm-muted">until {formatDate(o.expiresAt)}</span>}
          </span>
        ) : (
          <span className="text-adm-faint">—</span>
        );
      },
    },
    { key: 'stars', header: 'Best', cell: (r) => (r.progressStatus === 'COMPLETED' ? <Stars value={r.bestStars} /> : <span className="text-adm-faint">—</span>) },
    { key: 'attempts', header: 'Attempts', align: 'right', cell: (r) => <span className="tabular">{formatNumber(r.attemptCount ?? 0)}</span> },
    { key: 'time', header: 'Best time', align: 'right', cell: (r) => <span className="tabular">{formatDuration(r.bestTimeSeconds)}</span> },
    { key: 'completed', header: 'Completed', cell: (r) => formatDate(r.completedAt) },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      align: 'right',
      cell: (r) =>
        canUnlock && (
          <RowMenu
            label={`Access actions for ${r.title}`}
            items={[
              { label: 'Unlock for this student', icon: Unlock, hidden: r.state === 'COMPLETED' || r.state === 'AVAILABLE' || r.state === 'IN_PROGRESS', onSelect: () => setUnlockLevel(r.levelId) },
              { label: 'Lock for this student', icon: Lock, danger: true, hidden: overrides.get(r.levelId)?.status === 'LOCKED', onSelect: () => void lock(r) },
              { label: 'Remove override', icon: RotateCcw, hidden: !overrides.has(r.levelId), onSelect: () => void clear(r) },
            ]}
          />
        ),
    },
  ];

  return (
    <Card padded={false}>
      <DataTable label="Level progress" rows={progress.levels} columns={columns} rowKey={(r) => r.levelId} />
      <UnlockLevelModal
        student={unlockLevel ? student : null}
        initialLevelId={unlockLevel ?? ''}
        onClose={() => {
          setUnlockLevel(null);
          reload();
        }}
      />
    </Card>
  );
}

function ProgramsTab({ studentId }: { studentId: string }) {
  const [open, setOpen] = useState<string | null>(null);
  const res = useResource(`student-programs:${studentId}`, () => activityApi.programs({ studentId, pageSize: 100 }), ['activity']);
  if (res.error) return <ErrorState error={res.error} onRetry={res.reload} />;
  return (
    <Card padded={false}>
      <DataTable
        label="Programs"
        rows={res.data?.programs}
        loading={res.loading}
        columns={programColumns(false)}
        rowKey={(p) => p.id}
        onRowClick={(p) => setOpen(p.id)}
        empty={<EmptyState title="No programs saved yet" />}
      />
      <ProgramDrawer programId={open} onClose={() => setOpen(null)} />
    </Card>
  );
}

function AttemptsTab({ studentId }: { studentId: string }) {
  const [open, setOpen] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const res = useResource(`student-attempts:${studentId}:${page}`, () => activityApi.attempts({ studentId, page, pageSize: 25 }), ['activity'], { keepPrevious: true });
  if (res.error) return <ErrorState error={res.error} onRetry={res.reload} />;
  return (
    <Card padded={false}>
      <DataTable
        label="Attempts"
        rows={res.data?.attempts}
        loading={res.refreshing}
        columns={attemptColumns(false)}
        rowKey={(a) => a.id}
        onRowClick={(a) => setOpen(a.id)}
        empty={<EmptyState title="No attempts yet" />}
      />
      {res.data && res.data.total > 25 && <Pagination page={page} pageSize={25} total={res.data.total} onPage={setPage} />}
      <AttemptDrawer attemptId={open} onClose={() => setOpen(null)} />
    </Card>
  );
}

function AchievementsTab({ progress }: { progress: StudentProgress }) {
  if (!progress.achievements.length) return <Card><EmptyState icon={Trophy} title="No achievements yet" /></Card>;
  return (
    <div className="grid grid-cols-3 gap-4 2xl:grid-cols-4">
      {progress.achievements.map((a) => (
        <div key={a.slug} className="flex items-center gap-3 rounded-xl border border-adm-line bg-adm-surface p-4 shadow-adm">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-adm-warn-soft text-adm-warn">
            <Trophy className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <p className="text-sm font-semibold text-adm-ink">{a.name}</p>
            <p className="text-xs text-adm-muted">Unlocked {formatDate(a.unlockedAt)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export function StudentDetailPage({ id, tab }: { id: string; tab: StudentTab }) {
  const user = useSessionStore((s) => s.user);
  const [resetOpen, setResetOpen] = useState(false);
  const [unlockOpen, setUnlockOpen] = useState(false);
  const progress = useResource(can(user, 'progress.view') ? `student-progress:${id}` : null, () => studentsApi.progress(id), ['students', 'access']);
  const basic = useResource(`student:${id}`, () => studentsApi.get(id), ['students']);
  const student = progress.data?.student ?? basic.data?.student;

  if (basic.error) return <ErrorState error={basic.error} onRetry={basic.reload} />;
  if (!student) return <Spinner />;

  const manage = can(user, 'students.manage');
  const tabs = [
    { id: 'profile' as const, label: 'Profile', href: adminPaths.student(id, 'profile') },
    ...(can(user, 'progress.view')
      ? [
          { id: 'progress' as const, label: 'Progress', href: adminPaths.student(id, 'progress'), count: student.levelsCompleted },
          { id: 'programs' as const, label: 'Programs', href: adminPaths.student(id, 'programs') },
          { id: 'attempts' as const, label: 'Attempts', href: adminPaths.student(id, 'attempts') },
          { id: 'achievements' as const, label: 'Achievements', href: adminPaths.student(id, 'achievements'), count: progress.data?.achievements.length ?? 0 },
        ]
      : []),
  ];

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Students', to: adminPaths.students() }, { label: student.displayName }]}
        title={
          <span className="flex items-center gap-3">
            <Avatar name={student.displayName} size={36} />
            {student.displayName}
          </span>
        }
        meta={
          <>
            <Badge tone={USER_STATUS[student.status].tone} dot>
              {USER_STATUS[student.status].label}
            </Badge>
            {student.classLabel && <Badge>Class {student.classLabel}</Badge>}
          </>
        }
        subtitle={
          <span>
            <span className="font-mono">{student.username}</span> · {formatNumber(student.totalXp)} XP · {formatNumber(student.totalStars)} ★ · {student.levelsCompleted} levels completed
          </span>
        }
        actions={
          <>
            {can(user, 'levels.unlock') && (
              <Button icon={Unlock} onClick={() => setUnlockOpen(true)}>
                Unlock level
              </Button>
            )}
            {manage && (
              <Button icon={KeyRound} onClick={() => setResetOpen(true)}>
                Reset password
              </Button>
            )}
            {manage && (
              <Button variant={student.status === 'ACTIVE' ? 'danger-ghost' : 'primary'} icon={student.status === 'ACTIVE' ? Ban : CheckCircle2} onClick={() => void toggleStudentStatus(student)}>
                {student.status === 'ACTIVE' ? 'Disable' : 'Enable'}
              </Button>
            )}
          </>
        }
      />
      <Tabs label="Student sections" tabs={tabs} active={tab} />
      {tab === 'profile' && <ProfileTab student={student} />}
      {tab === 'progress' && (progress.error ? <ErrorState error={progress.error} onRetry={progress.reload} /> : progress.data ? <ProgressTab student={student} progress={progress.data} reload={progress.reload} /> : <Spinner />)}
      {tab === 'programs' && <ProgramsTab studentId={id} />}
      {tab === 'attempts' && <AttemptsTab studentId={id} />}
      {tab === 'achievements' && (progress.data ? <AchievementsTab progress={progress.data} /> : <Spinner />)}
      <ResetPasswordModal student={resetOpen ? student : null} onClose={() => setResetOpen(false)} />
      <UnlockLevelModal
        student={unlockOpen ? student : null}
        onClose={() => {
          setUnlockOpen(false);
          progress.reload();
        }}
      />
    </>
  );
}
