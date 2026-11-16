import { CheckCircle2, Circle, XCircle } from 'lucide-react';
import { useState } from 'react';
import { RouteLink } from '../../../router/RouteLink';
import { navigate } from '../../../router/router-store';
import { adminPaths } from '../../admin-routes';
import { activityApi } from '../../api/endpoints';
import type { Attempt, AttemptStatus, ProgramSummary } from '../../api/types';
import { LevelSelect, useLevelOptions } from '../../components/pickers';
import { ProgramView } from '../../components/ProgramView';
import { useDebounced } from '../../data/use-debounced';
import { useResource } from '../../data/use-resource';
import { formatDateTime, formatDuration, formatNumber, relativeTime } from '../../lib/format';
import { ATTEMPT_STATUS, OBJECTIVE_TYPES } from '../../lib/labels';
import { DataTable, Pagination, type Column } from '../../ui/DataTable';
import { Select, SearchInput, Segmented, TextInput } from '../../ui/form';
import { FilterBar, PageHeader } from '../../ui/layout';
import { Drawer } from '../../ui/overlay';
import { Badge, Card, cx, DescriptionList, EmptyState, ErrorState, Notice, Spinner, Stars } from '../../ui/primitives';

const PAGE_SIZE = 25;

// ── drawers (also used from the student page) ───────────────────────────

export function AttemptDrawer({ attemptId, onClose }: { attemptId: string | null; onClose: () => void }) {
  const res = useResource(attemptId ? `attempt:${attemptId}` : null, () => activityApi.attempt(attemptId!));
  const d = res.data;
  const completed = new Set(d?.attempt.result.reported?.objectivesCompleted ?? []);
  const judged = new Map((d?.attempt.result.objectives ?? []).map((o) => [o.code, o.completed]));
  return (
    <Drawer
      open={!!attemptId}
      onClose={onClose}
      width={720}
      title={d ? `${d.attempt.studentName} · ${d.attempt.levelTitle}` : 'Attempt'}
      subtitle={d && `Attempt #${d.attempt.attemptNumber} · ${formatDateTime(d.attempt.startedAt)}`}
    >
      {res.error ? (
        <ErrorState error={res.error} onRetry={res.reload} />
      ) : !d ? (
        <Spinner />
      ) : (
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={ATTEMPT_STATUS[d.attempt.status].tone} dot>
              {ATTEMPT_STATUS[d.attempt.status].label}
            </Badge>
            {d.attempt.submissionId && <Badge tone="info">Submission</Badge>}
            <Stars value={d.attempt.stars} max={d.attempt.maxStars} />
          </div>
          <DescriptionList
            columns={3}
            items={[
              ['Student', <RouteLink to={adminPaths.student(d.attempt.studentId, 'attempts')} className="text-adm-accent hover:underline">{d.attempt.studentName}</RouteLink>],
              ['Level', `${d.attempt.levelTitle} (${d.attempt.worldName})`],
              ['Score', formatNumber(d.attempt.score)],
              ['Execution time', formatDuration(d.attempt.executionTimeSeconds)],
              ['Blocks used', formatNumber(d.attempt.blockCount)],
              ['Collisions', formatNumber(d.attempt.collisions)],
            ]}
          />
          {d.attempt.errorMessage && <Notice tone="danger" title="Error">{d.attempt.errorMessage}</Notice>}

          <section>
            <h3 className="mb-2 text-sm font-semibold text-adm-ink">Result</h3>
            <ul className="divide-y divide-adm-line rounded-lg border border-adm-line">
              {d.objectives.map((o) => {
                const ok = judged.get(o.code) ?? completed.has(o.code);
                const Icon = ok ? CheckCircle2 : o.required ? XCircle : Circle;
                return (
                  <li key={o.code} className="flex items-center gap-3 px-3 py-2 text-sm">
                    <Icon className={cx('h-4 w-4 shrink-0', ok ? 'text-adm-ok' : o.required ? 'text-adm-bad' : 'text-adm-faint')} aria-label={ok ? 'Completed' : 'Not completed'} />
                    <span className="flex-1 text-adm-ink">{o.title}</span>
                    <span className="text-xs text-adm-muted">{OBJECTIVE_TYPES[o.type]?.label}</span>
                    {!o.required && <Badge>optional</Badge>}
                  </li>
                );
              })}
            </ul>
            {(d.attempt.result.criteria?.length ?? 0) > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {d.attempt.result.criteria!.map((c) => (
                  <Badge key={c.id} tone={c.met ? 'success' : 'neutral'}>
                    {c.met ? '★' : '☆'} {c.label}
                  </Badge>
                ))}
              </div>
            )}
            {(d.attempt.result.reasons?.length ?? 0) > 0 && (
              <ul className="mt-3 list-disc pl-5 text-sm text-adm-body">
                {d.attempt.result.reasons!.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h3 className="mb-2 text-sm font-semibold text-adm-ink">
              Program {d.programVersion && <span className="font-normal text-adm-muted">· version {d.programVersion.versionNumber} ({d.programVersion.source.toLowerCase().replace('_', ' ')})</span>}
            </h3>
            {d.programVersion ? <ProgramView blockProgram={d.programVersion.blockProgram} pythonCode={d.programVersion.pythonCode} /> : <Notice>No program snapshot was stored for this attempt.</Notice>}
          </section>
        </div>
      )}
    </Drawer>
  );
}

export function ProgramDrawer({ programId, onClose }: { programId: string | null; onClose: () => void }) {
  const res = useResource(programId ? `program:${programId}` : null, () => activityApi.program(programId!));
  const [versionId, setVersionId] = useState<string>('current');
  const d = res.data;
  const version = versionId === 'current' ? null : d?.versions.find((v) => v.id === versionId);
  return (
    <Drawer
      open={!!programId}
      onClose={() => {
        setVersionId('current');
        onClose();
      }}
      width={720}
      title={d ? `${d.program.studentName} · ${d.program.levelTitle}` : 'Program'}
      subtitle={d && `Saved ${formatDateTime(d.program.updatedAt)} · version ${d.program.version}${d.program.isSubmitted ? ' · submitted' : ''}`}
    >
      {res.error ? (
        <ErrorState error={res.error} onRetry={res.reload} />
      ) : !d ? (
        <Spinner />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <label className="text-[13px] font-medium text-adm-ink" htmlFor="program-version">
              Version
            </label>
            <Select id="program-version" className="w-80" value={versionId} onChange={(e) => setVersionId(e.target.value)}>
              <option value="current">Latest saved program</option>
              {d.versions.map((v) => (
                <option key={v.id} value={v.id}>
                  v{v.versionNumber} · {v.source.toLowerCase().replace('_', ' ')} · {formatDateTime(v.createdAt)}
                </option>
              ))}
            </Select>
            <RouteLink to={`${adminPaths.attempts()}?program=${d.program.id}`} className="ml-auto text-[13px] font-medium text-adm-accent hover:underline" onClick={onClose}>
              Attempts with this program
            </RouteLink>
          </div>
          <ProgramView key={versionId} blockProgram={version ? version.blockProgram : d.program.blockProgram} pythonCode={version ? version.pythonCode : d.program.pythonCode} />
        </div>
      )}
    </Drawer>
  );
}

// ── attempts ────────────────────────────────────────────────────────────

export function attemptColumns(showStudent: boolean): Column<Attempt>[] {
  return [
    ...(showStudent
      ? [
          {
            key: 'student',
            header: 'Student',
            cell: (a: Attempt) => (
              <span className="block min-w-0">
                <span className="block truncate font-medium text-adm-ink">{a.studentName}</span>
                <span className="block font-mono text-xs text-adm-muted">{a.username}</span>
              </span>
            ),
          },
        ]
      : []),
    {
      key: 'level',
      header: 'Level',
      cell: (a) => (
        <span className="block min-w-0">
          <span className="block truncate text-adm-ink">{a.levelTitle}</span>
          <span className="block text-xs text-adm-muted">{a.worldName}</span>
        </span>
      ),
    },
    { key: 'n', header: '#', align: 'right', cell: (a) => <span className="tabular">{a.attemptNumber}</span> },
    {
      key: 'result',
      header: 'Result',
      cell: (a) => (
        <span className="flex items-center gap-1.5">
          <Badge tone={ATTEMPT_STATUS[a.status].tone} dot>
            {ATTEMPT_STATUS[a.status].label}
          </Badge>
          {a.submissionId && <Badge tone="info">Submitted</Badge>}
        </span>
      ),
    },
    { key: 'time', header: 'Execution time', align: 'right', cell: (a) => <span className="tabular">{formatDuration(a.executionTimeSeconds)}</span> },
    { key: 'score', header: 'Score', align: 'right', cell: (a) => <span className="tabular">{formatNumber(a.score)}</span> },
    { key: 'stars', header: 'Stars', cell: (a) => <Stars value={a.stars} /> },
    { key: 'date', header: 'Date', cell: (a) => <span title={formatDateTime(a.startedAt)}>{formatDateTime(a.startedAt)}</span> },
  ];
}

export function AttemptsPage({ openId }: { openId: string | null }) {
  const params = new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search);
  const levels = useLevelOptions();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'ALL' | AttemptStatus>('ALL');
  const [levelId, setLevelId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const q = useDebounced(search.trim(), 250);
  const reset = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setPage(1);
  };

  const programFilter = params.get('program');
  const query = {
    search: q,
    status: status === 'ALL' ? undefined : status,
    levelId: levelId || undefined,
    programId: programFilter ?? undefined,
    from: from || undefined,
    to: to || undefined,
    page,
    pageSize: PAGE_SIZE,
  };
  const res = useResource(`attempts:${JSON.stringify(query)}`, () => activityApi.attempts(query), ['activity'], { keepPrevious: true });
  const rows = res.data?.attempts;

  return (
    <>
      <PageHeader title="Attempts" subtitle="Every run and submission, with the exact program that ran and the server’s result." />
      <Card padded={false}>
        <FilterBar trailing={res.data && <span className="text-sm text-adm-muted">{formatNumber(res.data.total)} attempts</span>}>
          <SearchInput value={search} onChange={reset(setSearch)} placeholder="Student name or username" className="w-64" />
          <LevelSelect aria-label="Level" className="w-60" levels={levels.data?.levels} value={levelId} onChange={reset(setLevelId)} placeholder="All levels" />
          <Segmented
            label="Result"
            value={status}
            onChange={reset(setStatus)}
            options={[
              { value: 'ALL', label: 'All' },
              { value: 'PASSED', label: 'Passed' },
              { value: 'FAILED', label: 'Failed' },
              { value: 'ERROR', label: 'Error' },
            ]}
          />
          <span className="flex items-center gap-1.5 text-sm text-adm-muted">
            <TextInput type="date" aria-label="From date" value={from} onChange={(e) => reset(setFrom)(e.target.value)} className="w-38" />–
            <TextInput type="date" aria-label="To date" value={to} onChange={(e) => reset(setTo)(e.target.value)} className="w-38" />
          </span>
        </FilterBar>
        {programFilter && (
          <div className="border-b border-adm-line px-4 py-2 text-sm text-adm-muted">
            Showing the attempts of one program.{' '}
            <RouteLink to={adminPaths.attempts()} className="text-adm-accent hover:underline">
              Show all
            </RouteLink>
          </div>
        )}
        {res.error ? (
          <div className="p-4">
            <ErrorState error={res.error} onRetry={res.reload} />
          </div>
        ) : (
          <DataTable
            label="Attempts"
            rows={rows}
            columns={attemptColumns(true)}
            rowKey={(a) => a.id}
            loading={res.refreshing}
            onRowClick={(a) => navigate(adminPaths.attempts(a.id) + window.location.search)}
            empty={<EmptyState title="No attempts match these filters" />}
          />
        )}
        {res.data && res.data.total > PAGE_SIZE && <Pagination page={page} pageSize={PAGE_SIZE} total={res.data.total} onPage={setPage} />}
      </Card>
      <AttemptDrawer attemptId={openId} onClose={() => navigate(adminPaths.attempts() + window.location.search)} />
    </>
  );
}

// ── programs ────────────────────────────────────────────────────────────

export function programColumns(showStudent: boolean): Column<ProgramSummary>[] {
  return [
    ...(showStudent
      ? [
          {
            key: 'student',
            header: 'Student',
            cell: (p: ProgramSummary) => (
              <span className="block min-w-0">
                <span className="block truncate font-medium text-adm-ink">{p.studentName}</span>
                <span className="block font-mono text-xs text-adm-muted">{p.username}</span>
              </span>
            ),
          },
        ]
      : []),
    {
      key: 'level',
      header: 'Level',
      cell: (p) => (
        <span className="block min-w-0">
          <span className="block truncate text-adm-ink">{p.levelTitle}</span>
          <span className="block text-xs text-adm-muted">{p.worldName}</span>
        </span>
      ),
    },
    { key: 'version', header: 'Version', align: 'right', cell: (p) => <span className="tabular">v{p.version}</span> },
    { key: 'attempts', header: 'Attempts', align: 'right', cell: (p) => <span className="tabular">{formatNumber(p.attempts)}</span> },
    {
      key: 'last',
      header: 'Last result',
      cell: (p) => (p.lastAttemptStatus ? <Badge tone={ATTEMPT_STATUS[p.lastAttemptStatus].tone} dot>{ATTEMPT_STATUS[p.lastAttemptStatus].label}</Badge> : <span className="text-adm-faint">Not run</span>),
    },
    { key: 'submitted', header: 'Submitted', cell: (p) => (p.isSubmitted ? <Badge tone="success">Yes</Badge> : <span className="text-adm-faint">No</span>) },
    { key: 'updated', header: 'Last saved', cell: (p) => <span title={formatDateTime(p.updatedAt)}>{relativeTime(p.updatedAt)}</span> },
  ];
}

export function ProgramsPage({ openId }: { openId: string | null }) {
  const levels = useLevelOptions();
  const [search, setSearch] = useState('');
  const [levelId, setLevelId] = useState('');
  const [submitted, setSubmitted] = useState<'all' | 'true' | 'false'>('all');
  const [page, setPage] = useState(1);
  const q = useDebounced(search.trim(), 250);
  const query = { search: q, levelId: levelId || undefined, submitted: submitted === 'all' ? undefined : submitted, page, pageSize: PAGE_SIZE };
  const res = useResource(`programs:${JSON.stringify(query)}`, () => activityApi.programs(query), ['activity'], { keepPrevious: true });

  return (
    <>
      <PageHeader title="Programs" subtitle="Students’ saved block programs, readable as blocks or Python, with every saved version." />
      <Card padded={false}>
        <FilterBar trailing={res.data && <span className="text-sm text-adm-muted">{formatNumber(res.data.total)} programs</span>}>
          <SearchInput
            value={search}
            onChange={(v) => {
              setSearch(v);
              setPage(1);
            }}
            placeholder="Student or level"
            className="w-64"
          />
          <LevelSelect
            aria-label="Level"
            className="w-60"
            levels={levels.data?.levels}
            value={levelId}
            onChange={(v) => {
              setLevelId(v);
              setPage(1);
            }}
            placeholder="All levels"
          />
          <Segmented
            label="Submitted"
            value={submitted}
            onChange={(v) => {
              setSubmitted(v);
              setPage(1);
            }}
            options={[
              { value: 'all', label: 'All' },
              { value: 'true', label: 'Submitted' },
              { value: 'false', label: 'In progress' },
            ]}
          />
        </FilterBar>
        {res.error ? (
          <div className="p-4">
            <ErrorState error={res.error} onRetry={res.reload} />
          </div>
        ) : (
          <DataTable
            label="Programs"
            rows={res.data?.programs}
            columns={programColumns(true)}
            rowKey={(p) => p.id}
            loading={res.refreshing}
            onRowClick={(p) => navigate(adminPaths.programs(p.id))}
            empty={<EmptyState title="No programs match these filters" />}
          />
        )}
        {res.data && res.data.total > PAGE_SIZE && <Pagination page={page} pageSize={PAGE_SIZE} total={res.data.total} onPage={setPage} />}
      </Card>
      <ProgramDrawer programId={openId} onClose={() => navigate(adminPaths.programs())} />
    </>
  );
}
