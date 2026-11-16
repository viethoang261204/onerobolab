import { GitBranch, Layers, Plus, Table2 } from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { navigate } from '../../../router/router-store';
import { adminPaths } from '../../admin-routes';
import { ApiError } from '../../api/client';
import { contentApi } from '../../api/endpoints';
import type { ContentStatus, Difficulty, LevelSummary } from '../../api/types';
import { runAction } from '../../components/actions';
import { DependencyGraphView } from '../../components/DependencyGraphView';
import { useLevelOptions } from '../../components/pickers';
import { ReorderButtons } from '../../components/ReorderButtons';
import { StatusBadge } from '../../components/WorkflowControl';
import { useDebounced } from '../../data/use-debounced';
import { useResource } from '../../data/use-resource';
import { move, slugify } from '../../lib/content';
import { formatDate, formatNumber, percentOf } from '../../lib/format';
import { DIFFICULTIES, DIFFICULTY } from '../../lib/labels';
import { describeUnlock } from '../../lib/unlock-rules';
import { DataTable, Pagination, type Column } from '../../ui/DataTable';
import { Field, SearchInput, Segmented, Select, TextInput } from '../../ui/form';
import { FilterBar, PageHeader } from '../../ui/layout';
import { Modal } from '../../ui/overlay';
import { Button, Card, EmptyState, ErrorState, Notice } from '../../ui/primitives';

const PAGE_SIZE = 50;

function CreateLevelModal({ open, worldId, onClose }: { open: boolean; worldId: string; onClose: () => void }) {
  const worlds = useResource(open ? 'worlds:all' : null, () => contentApi.worlds(), ['worlds']);
  const environments = useResource(open ? 'environments' : null, () => contentApi.environments());
  const [form, setForm] = useState({ worldId: '', title: '', slug: '', slugTouched: false, environmentId: '', difficulty: 'BEGINNER' as Difficulty });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) {
      setForm({ worldId, title: '', slug: '', slugTouched: false, environmentId: '', difficulty: 'BEGINNER' });
      setErrors({});
    }
  }, [open, worldId]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await contentApi.createLevel({ worldId: form.worldId, title: form.title.trim(), slug: form.slug, environmentId: form.environmentId, difficulty: form.difficulty });
      onClose();
      navigate(adminPaths.level(res.level.id));
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) setErrors({ slug: 'Another level uses this slug.' });
      else if (err instanceof ApiError && Object.keys(err.fieldErrors()).length) setErrors(err.fieldErrors());
      else setErrors({ _: err instanceof ApiError ? err.message : 'Could not create the level.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      title="New level"
      description="Levels start as drafts. Add objectives, hints and the map in the editor, then send the level for review."
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" form="create-level" busy={busy} disabled={!form.worldId || !form.title.trim() || !form.slug || !form.environmentId}>
            Create and edit
          </Button>
        </>
      }
    >
      <form id="create-level" onSubmit={submit} className="grid grid-cols-2 gap-4">
        {errors._ && <Notice tone="danger" className="col-span-2">{errors._}</Notice>}
        <Field label="Title" required error={errors.title} className="col-span-2">
          {(p) => <TextInput {...p} data-autofocus maxLength={120} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value, slug: form.slugTouched ? form.slug : slugify(e.target.value) })} />}
        </Field>
        <Field label="Slug" required error={errors.slug} hint="Used in the level’s URL.">
          {(p) => <TextInput {...p} className="font-mono" maxLength={80} value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value, slugTouched: true })} />}
        </Field>
        <Field label="Difficulty">
          {(p) => (
            <Select {...p} value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value as Difficulty })}>
              {DIFFICULTIES.map((d) => (
                <option key={d} value={d}>
                  {DIFFICULTY[d]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="World" required error={errors.worldId}>
          {(p) => (
            <Select {...p} value={form.worldId} onChange={(e) => setForm({ ...form, worldId: e.target.value })}>
              <option value="">Choose…</option>
              {worlds.data?.worlds.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Environment" required error={errors.environmentId} hint="The 3D scene this level is played in.">
          {(p) => (
            <Select {...p} value={form.environmentId} onChange={(e) => setForm({ ...form, environmentId: e.target.value })}>
              <option value="">Choose…</option>
              {environments.data?.environments
                .filter((env) => env.kind === 'LEVEL')
                .map((env) => (
                  <option key={env.id} value={env.id}>
                    {env.name}
                  </option>
                ))}
            </Select>
          )}
        </Field>
      </form>
    </Modal>
  );
}

function CompletionCell({ l }: { l: LevelSummary }) {
  const pct = percentOf(l.studentsCompleted, l.studentsStarted);
  return (
    <span className="flex min-w-32 items-center gap-2" title={`${l.studentsCompleted} of ${l.studentsStarted} students who started`}>
      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-adm-line">
        <span className="block h-full rounded-full bg-adm-ok" style={{ width: `${pct}%` }} />
      </span>
      <span className="tabular w-16 text-right text-xs text-adm-body">
        {l.studentsCompleted}/{l.studentsStarted}
      </span>
    </span>
  );
}

export function LevelsPage() {
  const worlds = useResource('worlds:all', () => contentApi.worlds(), ['worlds']);
  const graph = useLevelOptions();
  const [view, setView] = useState<'table' | 'graph'>('table');
  const [worldId, setWorldId] = useState('');
  const [status, setStatus] = useState<'ALL' | ContentStatus>('ALL');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const q = useDebounced(search.trim(), 250);
  const query = { worldId: worldId || undefined, status: status === 'ALL' ? undefined : status, search: q, page, pageSize: PAGE_SIZE };
  const res = useResource(`levels:${JSON.stringify(query)}`, () => contentApi.levels(query), ['levels'], { keepPrevious: true });
  const rows = res.data?.levels ?? [];
  // Reordering only makes sense for one whole world.
  const canReorder = !!worldId && status === 'ALL' && !q && (res.data?.total ?? 0) <= PAGE_SIZE;

  const reorder = async (index: number, delta: -1 | 1) => {
    setBusy(true);
    await runAction(() => contentApi.orderLevels(worldId, move(rows, index, delta).map((l) => l.id)), { success: 'Level order saved.', tags: ['levels'] });
    setBusy(false);
  };

  // One graph per curriculum (prerequisites never cross curricula in practice); a world filter keeps its curriculum.
  const graphGroups = useMemo(() => {
    const all = graph.data?.levels ?? [];
    const keep = worldId ? all.find((l) => l.worldId === worldId)?.curriculumId : undefined;
    const groups = new Map<string, { name: string; levels: typeof all }>();
    for (const l of all) {
      if (keep && l.curriculumId !== keep) continue;
      const g = groups.get(l.curriculumId) ?? { name: l.curriculumName, levels: [] };
      g.levels = [...g.levels, l];
      groups.set(l.curriculumId, g);
    }
    return [...groups.entries()];
  }, [graph.data, worldId]);

  const columns: Column<LevelSummary>[] = [
    ...(canReorder
      ? [{ key: 'order', header: 'Order', width: '84px', cell: (l: LevelSummary) => <ReorderButtons index={rows.indexOf(l)} count={rows.length} label={l.title} disabled={busy} onMove={(d) => void reorder(rows.indexOf(l), d)} /> }]
      : []),
    {
      key: 'level',
      header: 'Level',
      cell: (l) => (
        <span className="block min-w-0">
          <span className="block truncate font-medium text-adm-ink">{l.title}</span>
          <span className="block font-mono text-xs text-adm-muted">{l.slug}</span>
        </span>
      ),
    },
    { key: 'world', header: 'World', cell: (l) => l.worldName },
    { key: 'difficulty', header: 'Difficulty', cell: (l) => DIFFICULTY[l.difficulty] },
    { key: 'status', header: 'Status', cell: (l) => <StatusBadge status={l.status} /> },
    { key: 'published', header: 'Published', cell: (l) => (l.status === 'PUBLISHED' ? formatDate(l.publishedAt) : <span className="text-adm-faint">—</span>) },
    { key: 'unlock', header: 'Unlock rule', cell: (l) => <span className="line-clamp-2 max-w-72 text-[13px] text-adm-body">{describeUnlock(l.accessMode, l.prerequisites)}</span> },
    { key: 'attempts', header: 'Attempts', align: 'right', cell: (l) => <span className="tabular">{formatNumber(l.attempts)}</span> },
    { key: 'completion', header: 'Completion', cell: (l) => <CompletionCell l={l} /> },
  ];

  return (
    <>
      <PageHeader
        title="Levels"
        subtitle="Missions students play. Open a level to edit its details, objectives, hints and unlock rules."
        actions={
          <>
            <Segmented
              label="View"
              value={view}
              onChange={setView}
              options={[
                { value: 'table', label: 'Table' },
                { value: 'graph', label: 'Dependency graph' },
              ]}
            />
            <Button variant="primary" icon={Plus} onClick={() => setCreating(true)}>
              New level
            </Button>
          </>
        }
      />
      <Card padded={false}>
        <FilterBar trailing={view === 'table' && res.data && <span className="text-sm text-adm-muted">{formatNumber(res.data.total)} levels</span>}>
          {view === 'table' ? <Table2 className="h-4 w-4 text-adm-faint" aria-hidden /> : <GitBranch className="h-4 w-4 text-adm-faint" aria-hidden />}
          <Select
            aria-label="World"
            className="w-60"
            value={worldId}
            onChange={(e) => {
              setWorldId(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All worlds</option>
            {worlds.data?.worlds.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </Select>
          {view === 'table' && (
            <>
              <Segmented
                label="Status"
                value={status}
                onChange={(v) => {
                  setStatus(v);
                  setPage(1);
                }}
                options={[
                  { value: 'ALL', label: 'All' },
                  { value: 'DRAFT', label: 'Draft' },
                  { value: 'REVIEW', label: 'In review' },
                  { value: 'PUBLISHED', label: 'Published' },
                  { value: 'ARCHIVED', label: 'Archived' },
                ]}
              />
              <SearchInput
                value={search}
                onChange={(v) => {
                  setSearch(v);
                  setPage(1);
                }}
                placeholder="Title or slug"
                className="w-56"
              />
            </>
          )}
        </FilterBar>
        {view === 'graph' ? (
          <div className="p-4">
            {graph.error ? (
              <ErrorState error={graph.error} onRetry={graph.reload} />
            ) : (
              <div className="flex flex-col gap-5">
                {graphGroups.map(([id, g]) => (
                  <section key={id}>
                    <h2 className="mb-2 text-sm font-semibold text-adm-ink">{g.name}</h2>
                    <DependencyGraphView levels={g.levels} />
                  </section>
                ))}
              </div>
            )}
          </div>
        ) : res.error ? (
          <div className="p-4">
            <ErrorState error={res.error} onRetry={res.reload} />
          </div>
        ) : (
          <>
            {!canReorder && worldId === '' && <p className="border-b border-adm-line px-4 py-2 text-xs text-adm-muted">Choose one world (no other filters) to reorder its levels.</p>}
            <DataTable
              label="Levels"
              rows={res.data?.levels}
              loading={res.refreshing}
              columns={columns}
              rowKey={(l) => l.id}
              onRowClick={(l) => navigate(adminPaths.level(l.id))}
              empty={<EmptyState icon={Layers} title="No levels match these filters" />}
            />
          </>
        )}
        {view === 'table' && res.data && res.data.total > PAGE_SIZE && <Pagination page={page} pageSize={PAGE_SIZE} total={res.data.total} onPage={setPage} />}
      </Card>
      <CreateLevelModal open={creating} worldId={worldId} onClose={() => setCreating(false)} />
    </>
  );
}
