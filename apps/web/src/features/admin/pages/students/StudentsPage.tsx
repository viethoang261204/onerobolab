import { Ban, CheckCircle2, Eye, KeyRound, Plus, Unlock } from 'lucide-react';
import { useState } from 'react';
import { navigate } from '../../../router/router-store';
import { adminPaths } from '../../admin-routes';
import { studentsApi } from '../../api/endpoints';
import type { Student, UserStatus } from '../../api/types';
import { runAction } from '../../components/actions';
import { useResource } from '../../data/use-resource';
import { useDebounced } from '../../data/use-debounced';
import { formatNumber, relativeTime } from '../../lib/format';
import { USER_STATUS } from '../../lib/labels';
import { can } from '../../session/access';
import { useSessionStore } from '../../session/session-store';
import { DataTable, Pagination, type Column, type SortState } from '../../ui/DataTable';
import { SearchInput, Segmented } from '../../ui/form';
import { FilterBar, PageHeader } from '../../ui/layout';
import { confirmAction, RowMenu } from '../../ui/overlay';
import { Avatar, Badge, Button, Card, EmptyState, ErrorState } from '../../ui/primitives';
import { CreateStudentModal, ResetPasswordModal, UnlockLevelModal } from './student-modals';

const PAGE_SIZE = 25;

/** Disable (signs the student out everywhere) or re-enable an account. */
export async function toggleStudentStatus(s: Pick<Student, 'id' | 'displayName' | 'status'>): Promise<void> {
  const disabling = s.status === 'ACTIVE';
  if (
    disabling &&
    !(await confirmAction({
      title: `Disable ${s.displayName}?`,
      message: 'They are signed out immediately and cannot sign in until you enable the account again. Their progress is kept.',
      confirmLabel: 'Disable account',
      danger: true,
    }))
  ) {
    return;
  }
  await runAction(() => studentsApi.update(s.id, { status: disabling ? 'DISABLED' : 'ACTIVE' }), {
    success: `${s.displayName} ${disabling ? 'disabled' : 'enabled'}.`,
    tags: ['students', 'activity'],
  });
}

export function StudentsPage() {
  const user = useSessionStore((s) => s.user);
  const manage = can(user, 'students.manage');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'ALL' | UserStatus>('ALL');
  const [sort, setSort] = useState<SortState>({ key: 'username', dir: 'asc' });
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [resetFor, setResetFor] = useState<Student | null>(null);
  const [unlockFor, setUnlockFor] = useState<Student | null>(null);
  const q = useDebounced(search.trim(), 250);

  const query = { search: q, status: status === 'ALL' ? undefined : status, sort: sort.key, dir: sort.dir, page, pageSize: PAGE_SIZE };
  const res = useResource(`students:${JSON.stringify(query)}`, () => studentsApi.list(query), ['students'], { keepPrevious: true });

  const columns: Column<Student>[] = [
    {
      key: 'student',
      header: 'Student',
      sortKey: 'name',
      cell: (s) => (
        <span className="flex items-center gap-2.5">
          <Avatar name={s.displayName} />
          <span className="min-w-0">
            <span className="block truncate font-medium text-adm-ink">{s.displayName}</span>
            {s.classLabel && <span className="block text-xs text-adm-muted">Class {s.classLabel}</span>}
          </span>
        </span>
      ),
    },
    { key: 'username', header: 'Username', sortKey: 'username', cell: (s) => <span className="font-mono text-[13px]">{s.username}</span> },
    {
      key: 'status',
      header: 'Status',
      cell: (s) => (
        <span className="flex items-center gap-1.5">
          <Badge tone={USER_STATUS[s.status].tone} dot>
            {USER_STATUS[s.status].label}
          </Badge>
          {s.loginLocked && <Badge tone="warning">Sign-in locked</Badge>}
        </span>
      ),
    },
    { key: 'xp', header: 'XP', sortKey: 'xp', align: 'right', cell: (s) => <span className="tabular">{formatNumber(s.totalXp)}</span> },
    { key: 'stars', header: 'Stars', sortKey: 'stars', align: 'right', cell: (s) => <span className="tabular">{formatNumber(s.totalStars)} ★</span> },
    { key: 'levels', header: 'Levels completed', sortKey: 'levels', align: 'right', cell: (s) => <span className="tabular">{formatNumber(s.levelsCompleted)}</span> },
    { key: 'activity', header: 'Last activity', sortKey: 'activity', cell: (s) => <span title={s.lastActivityAt ?? undefined}>{relativeTime(s.lastActivityAt)}</span> },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      align: 'right',
      width: '56px',
      cell: (s) => (
        <RowMenu
          label={`Actions for ${s.displayName}`}
          items={[
            { label: 'View', icon: Eye, onSelect: () => navigate(adminPaths.student(s.id)) },
            { label: s.status === 'ACTIVE' ? 'Disable' : 'Enable', icon: s.status === 'ACTIVE' ? Ban : CheckCircle2, danger: s.status === 'ACTIVE', hidden: !manage, onSelect: () => void toggleStudentStatus(s) },
            { label: 'Reset password', icon: KeyRound, hidden: !manage, onSelect: () => setResetFor(s) },
            { label: 'Unlock level', icon: Unlock, hidden: !can(user, 'levels.unlock'), onSelect: () => setUnlockFor(s) },
          ]}
        />
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Students"
        subtitle="Accounts, progress and access for every student."
        actions={
          manage && (
            <Button variant="primary" icon={Plus} onClick={() => setCreating(true)}>
              New student
            </Button>
          )
        }
      />
      <Card padded={false}>
        <FilterBar trailing={res.data && <span className="text-sm text-adm-muted">{formatNumber(res.data.total)} students</span>}>
          <SearchInput
            value={search}
            onChange={(v) => {
              setSearch(v);
              setPage(1);
            }}
            placeholder="Search name, username or class"
            className="w-80"
          />
          <Segmented
            label="Status"
            value={status}
            onChange={(v) => {
              setStatus(v);
              setPage(1);
            }}
            options={[
              { value: 'ALL', label: 'All' },
              { value: 'ACTIVE', label: 'Active' },
              { value: 'DISABLED', label: 'Disabled' },
            ]}
          />
        </FilterBar>
        {res.error ? (
          <div className="p-4">
            <ErrorState error={res.error} onRetry={res.reload} />
          </div>
        ) : (
          <DataTable
            label="Students"
            rows={res.data?.students}
            columns={columns}
            rowKey={(s) => s.id}
            loading={res.refreshing}
            sort={sort}
            onSort={(s) => {
              setSort(s);
              setPage(1);
            }}
            onRowClick={(s) => navigate(adminPaths.student(s.id))}
            empty={<EmptyState title={q || status !== 'ALL' ? 'No students match these filters' : 'No students yet'}>{manage && !q ? 'Create the first student account.' : undefined}</EmptyState>}
          />
        )}
        {res.data && res.data.total > PAGE_SIZE && <Pagination page={page} pageSize={PAGE_SIZE} total={res.data.total} onPage={setPage} />}
      </Card>

      <CreateStudentModal
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(s) => {
          setCreating(false);
          res.reload();
          navigate(adminPaths.student(s.id));
        }}
      />
      <ResetPasswordModal student={resetFor} onClose={() => setResetFor(null)} />
      <UnlockLevelModal student={unlockFor} onClose={() => setUnlockFor(null)} />
    </>
  );
}
