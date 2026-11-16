import { Globe2, Pencil, Plus } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { ApiError } from '../../api/client';
import { contentApi } from '../../api/endpoints';
import type { Difficulty, World } from '../../api/types';
import { runAction } from '../../components/actions';
import { ReorderButtons } from '../../components/ReorderButtons';
import { WorkflowControl } from '../../components/WorkflowControl';
import { invalidate, useResource } from '../../data/use-resource';
import { move, slugify } from '../../lib/content';
import { DIFFICULTIES, DIFFICULTY } from '../../lib/labels';
import { DataTable, type Column } from '../../ui/DataTable';
import { Checkbox, Field, Select, TextArea, TextInput } from '../../ui/form';
import { FilterBar, PageHeader } from '../../ui/layout';
import { Drawer, toast } from '../../ui/overlay';
import { Badge, Button, Card, EmptyState, ErrorState, IconButton, Notice } from '../../ui/primitives';

interface WorldForm {
  curriculumId: string;
  name: string;
  slug: string;
  slugTouched: boolean;
  shortDescription: string;
  description: string;
  theme: string;
  accentColor: string;
  skills: string;
  difficulty: Difficulty;
  thumbnail: string;
  mapPreview: string;
  environmentId: string;
  isVisible: boolean;
}

const fromWorld = (w: World): WorldForm => ({
  curriculumId: w.curriculumId,
  name: w.name,
  slug: w.slug,
  slugTouched: true,
  shortDescription: w.shortDescription ?? '',
  description: w.description ?? '',
  theme: w.theme,
  accentColor: w.accentColor ?? '#2563eb',
  skills: w.skills.join(', '),
  difficulty: w.difficulty,
  thumbnail: w.thumbnail ?? '',
  mapPreview: w.mapPreview ?? '',
  environmentId: w.environmentId ?? '',
  isVisible: w.isVisible,
});

function WorldDrawer({ open, world, curriculumId, onClose }: { open: boolean; world: World | null; curriculumId: string; onClose: () => void }) {
  const curricula = useResource(open ? 'curriculums' : null, () => contentApi.curriculums(), ['curriculum']);
  const environments = useResource(open ? 'environments' : null, () => contentApi.environments());
  const [form, setForm] = useState<WorldForm | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setForm(
      world
        ? fromWorld(world)
        : { curriculumId, name: '', slug: '', slugTouched: false, shortDescription: '', description: '', theme: 'starter', accentColor: '#2563eb', skills: '', difficulty: 'BEGINNER', thumbnail: '', mapPreview: '', environmentId: '', isVisible: true },
    );
  }, [open, world, curriculumId]);

  if (!form) return null;
  const set = (patch: Partial<WorldForm>) => setForm({ ...form, ...patch });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const body = {
      curriculumId: form.curriculumId,
      name: form.name.trim(),
      slug: form.slug,
      shortDescription: form.shortDescription.trim() || null,
      description: form.description.trim() || null,
      theme: form.theme.trim(),
      accentColor: form.accentColor || null,
      skills: form.skills.split(',').map((s) => s.trim()).filter(Boolean),
      difficulty: form.difficulty,
      thumbnail: form.thumbnail.trim() || null,
      mapPreview: form.mapPreview.trim() || null,
      environmentId: form.environmentId || null,
      isVisible: form.isVisible,
    };
    setBusy(true);
    setErrors({});
    try {
      if (world) await contentApi.updateWorld(world.id, body);
      else await contentApi.createWorld(body);
      toast(world ? 'World saved.' : 'World created as a draft.');
      invalidate('worlds', 'curriculum');
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) setErrors({ slug: 'This slug is already used by another world.' });
      else if (err instanceof ApiError && Object.keys(err.fieldErrors()).length) setErrors(err.fieldErrors());
      else setErrors({ _: err instanceof ApiError ? err.message : 'Could not save the world.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={640}
      title={world ? `Edit world` : 'New world'}
      subtitle={world?.name}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" form="world-form" busy={busy}>
            {world ? 'Save world' : 'Create world'}
          </Button>
        </>
      }
    >
      <form id="world-form" onSubmit={submit} className="grid grid-cols-2 gap-4">
        {errors._ && <Notice tone="danger" className="col-span-2">{errors._}</Notice>}
        {world && (
          <div className="col-span-2 rounded-lg border border-adm-line bg-adm-subtle p-3">
            <p className="mb-2 text-xs font-medium text-adm-muted">Publishing</p>
            <WorkflowControl kind="worlds" id={world.id} status={world.status} name={world.name} onChanged={onClose} />
          </div>
        )}
        <Field label="Curriculum" required className="col-span-2">
          {(p) => (
            <Select {...p} value={form.curriculumId} onChange={(e) => set({ curriculumId: e.target.value })}>
              {curricula.data?.curriculums.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Name" required error={errors.name}>
          {(p) => <TextInput {...p} maxLength={120} value={form.name} onChange={(e) => set({ name: e.target.value, slug: form.slugTouched ? form.slug : slugify(e.target.value) })} />}
        </Field>
        <Field label="Slug" required error={errors.slug}>
          {(p) => <TextInput {...p} className="font-mono" maxLength={80} value={form.slug} onChange={(e) => set({ slug: e.target.value, slugTouched: true })} />}
        </Field>
        <Field label="Tagline" hint="Up to 160 characters, shown on the world map." className="col-span-2" error={errors.shortDescription}>
          {(p) => <TextInput {...p} maxLength={160} value={form.shortDescription} onChange={(e) => set({ shortDescription: e.target.value })} />}
        </Field>
        <Field label="Description" className="col-span-2" error={errors.description}>
          {(p) => <TextArea {...p} rows={3} maxLength={4000} value={form.description} onChange={(e) => set({ description: e.target.value })} />}
        </Field>
        <Field label="Difficulty">
          {(p) => (
            <Select {...p} value={form.difficulty} onChange={(e) => set({ difficulty: e.target.value as Difficulty })}>
              {DIFFICULTIES.map((d) => (
                <option key={d} value={d}>
                  {DIFFICULTY[d]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Skills" hint="Comma-separated, e.g. Loops, Sensors.">
          {(p) => <TextInput {...p} value={form.skills} onChange={(e) => set({ skills: e.target.value })} />}
        </Field>
        <Field label="Environment (world-map diorama)" error={errors.environmentId}>
          {(p) => (
            <Select {...p} value={form.environmentId} onChange={(e) => set({ environmentId: e.target.value })}>
              <option value="">None</option>
              {environments.data?.environments
                .filter((env) => env.kind === 'WORLD_PREVIEW')
                .map((env) => (
                  <option key={env.id} value={env.id}>
                    {env.name}
                  </option>
                ))}
            </Select>
          )}
        </Field>
        <div className="grid grid-cols-[1fr_auto] gap-3">
          <Field label="Theme" hint="Visual theme id." error={errors.theme}>
            {(p) => <TextInput {...p} className="font-mono" maxLength={40} value={form.theme} onChange={(e) => set({ theme: e.target.value })} />}
          </Field>
          <Field label="Accent">
            {(p) => <input {...p} type="color" value={form.accentColor} onChange={(e) => set({ accentColor: e.target.value })} className="h-9 w-12 cursor-pointer rounded-lg border border-adm-line-strong bg-adm-surface p-1" />}
          </Field>
        </div>
        <Field label="Thumbnail URL" error={errors.thumbnail}>
          {(p) => <TextInput {...p} type="url" placeholder="https://" value={form.thumbnail} onChange={(e) => set({ thumbnail: e.target.value })} />}
        </Field>
        <Field label="Map preview URL" error={errors.mapPreview}>
          {(p) => <TextInput {...p} type="url" placeholder="https://" value={form.mapPreview} onChange={(e) => set({ mapPreview: e.target.value })} />}
        </Field>
        {/^https?:\/\//.test(form.thumbnail) && (
          <div className="col-span-2">
            <p className="mb-1.5 text-xs text-adm-muted">Thumbnail preview</p>
            <img src={form.thumbnail} alt="" className="h-28 rounded-lg border border-adm-line object-cover" />
          </div>
        )}
        <div className="col-span-2">
          <Checkbox label="Visible on the world map" hint="Hidden worlds stay out of the student app even when published." checked={form.isVisible} onChange={(isVisible) => set({ isVisible })} />
        </div>
      </form>
    </Drawer>
  );
}

export function WorldsPage() {
  const initial = new URLSearchParams(window.location.search).get('curriculum') ?? '';
  const curricula = useResource('curriculums', () => contentApi.curriculums(), ['curriculum']);
  const [curriculumId, setCurriculumId] = useState(initial);
  const selected = curriculumId || curricula.data?.curriculums[0]?.id || '';
  const worlds = useResource(selected ? `worlds:${selected}` : null, () => contentApi.worlds(selected), ['worlds']);
  const environments = useResource('environments', () => contentApi.environments());
  const [editing, setEditing] = useState<World | null>(null);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const list = worlds.data?.worlds ?? [];
  const envName = (id: string | null) => environments.data?.environments.find((e) => e.id === id)?.name ?? id ?? '—';

  const reorder = async (index: number, delta: -1 | 1) => {
    setBusy(true);
    await runAction(() => contentApi.orderWorlds(selected, move(list, index, delta).map((w) => w.id)), { success: 'Order saved.', tags: ['worlds', 'curriculum'] });
    setBusy(false);
  };

  const columns: Column<World>[] = [
    { key: 'order', header: 'Order', width: '84px', cell: (w) => <ReorderButtons index={list.indexOf(w)} count={list.length} onMove={(d) => void reorder(list.indexOf(w), d)} label={w.name} disabled={busy} /> },
    {
      key: 'world',
      header: 'World',
      cell: (w) => (
        <span className="flex items-center gap-3">
          {w.thumbnail ? (
            <img src={w.thumbnail} alt="" className="h-9 w-14 rounded-md border border-adm-line object-cover" />
          ) : (
            <span className="flex h-9 w-14 items-center justify-center rounded-md" style={{ background: `${w.accentColor ?? '#94a3b8'}22` }}>
              <Globe2 className="h-4 w-4" style={{ color: w.accentColor ?? '#64748b' }} aria-hidden />
            </span>
          )}
          <span className="min-w-0">
            <span className="block truncate font-medium text-adm-ink">{w.name}</span>
            <span className="block truncate text-xs text-adm-muted">{w.shortDescription ?? w.slug}</span>
          </span>
        </span>
      ),
    },
    { key: 'env', header: 'Environment', cell: (w) => <span className="text-adm-body">{envName(w.environmentId)}</span> },
    { key: 'difficulty', header: 'Difficulty', cell: (w) => DIFFICULTY[w.difficulty] },
    { key: 'levels', header: 'Levels', align: 'right', cell: (w) => <span className="tabular">{w.levelCount}</span> },
    { key: 'visible', header: 'On map', cell: (w) => (w.isVisible ? <Badge tone="info">Visible</Badge> : <Badge>Hidden</Badge>) },
    { key: 'status', header: 'Status', cell: (w) => <WorkflowControl kind="worlds" id={w.id} status={w.status} name={w.name} compact /> },
    { key: 'edit', header: <span className="sr-only">Edit</span>, align: 'right', cell: (w) => <IconButton icon={Pencil} label={`Edit ${w.name}`} onClick={() => setEditing(w)} /> },
  ];

  return (
    <>
      <PageHeader
        title="Worlds"
        subtitle="Themed islands on the world map. Each world holds an ordered list of levels."
        actions={
          <Button variant="primary" icon={Plus} disabled={!selected} onClick={() => setCreating(true)}>
            New world
          </Button>
        }
      />
      <Card padded={false}>
        <FilterBar>
          <label className="text-[13px] font-medium text-adm-ink" htmlFor="world-curriculum">
            Curriculum
          </label>
          <Select id="world-curriculum" className="w-72" value={selected} onChange={(e) => setCurriculumId(e.target.value)}>
            {curricula.data?.curriculums.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </FilterBar>
        {worlds.error ? (
          <div className="p-4">
            <ErrorState error={worlds.error} onRetry={worlds.reload} />
          </div>
        ) : (
          <DataTable label="Worlds" rows={worlds.data?.worlds} loading={worlds.loading} columns={columns} rowKey={(w) => w.id} empty={<EmptyState icon={Globe2} title="No worlds in this curriculum yet" />} />
        )}
      </Card>
      <WorldDrawer open={creating || !!editing} world={editing} curriculumId={selected} onClose={() => (setCreating(false), setEditing(null))} />
    </>
  );
}
