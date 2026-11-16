import { AlertTriangle, CheckCircle2, ExternalLink, Save, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { navigate } from '../../../router/router-store';
import { CATEGORIES, blockLabel } from '../../../programming/blocks/block-registry';
import type { BlockType } from '../../../programming/blocks/block-types';
import { adminPaths, type LevelTab } from '../../admin-routes';
import { ApiError } from '../../api/client';
import { contentApi } from '../../api/endpoints';
import type { Difficulty, LevelDetail } from '../../api/types';
import { runAction, useBusy } from '../../components/actions';
import { WorkflowControl, WorkflowSteps } from '../../components/WorkflowControl';
import { invalidate, useResource } from '../../data/use-resource';
import { formatDateTime } from '../../lib/format';
import { DIFFICULTIES, DIFFICULTY } from '../../lib/labels';
import { can } from '../../session/access';
import { useSessionStore } from '../../session/session-store';
import { Checkbox, Field, NumberInput, Select, TextArea, TextInput } from '../../ui/form';
import { PageHeader, Tabs } from '../../ui/layout';
import { confirmAction, toast } from '../../ui/overlay';
import { Button, Card, cx, ErrorState, Notice, Spinner } from '../../ui/primitives';
import { LessonsTree } from '../curriculum/CurriculumPage';
import { HintsTab } from './level-hints';
import { MapTab } from './level-map';
import { ObjectivesTab } from './level-objectives';
import { UnlockTab } from './level-unlock';

// ── details form ────────────────────────────────────────────────────────

interface DetailsForm {
  title: string;
  slug: string;
  briefDescription: string;
  description: string;
  difficulty: Difficulty;
  worldId: string;
  environmentId: string;
  thumbnail: string;
  previewImage: string;
  estimatedMinutes: number | null;
  xpReward: number | null;
  maxStars: number | null;
  parBlocks: number | null;
  parSeconds: number | null;
  sortOrder: number | null;
  visibility: 'VISIBLE' | 'HIDDEN';
  introSteps: string;
  restrictBlocks: boolean;
  allowedBlocks: string[];
}

const toForm = (l: LevelDetail): DetailsForm => ({
  title: l.title,
  slug: l.slug,
  briefDescription: l.briefDescription ?? '',
  description: l.description ?? '',
  difficulty: l.difficulty,
  worldId: l.worldId,
  environmentId: l.environmentId,
  thumbnail: l.thumbnail ?? '',
  previewImage: l.previewImage ?? '',
  estimatedMinutes: l.estimatedMinutes,
  xpReward: l.xpReward,
  maxStars: l.maxStars,
  parBlocks: l.parBlocks,
  parSeconds: l.parSeconds,
  sortOrder: l.sortOrder,
  visibility: l.visibility,
  introSteps: l.introSteps.join('\n'),
  restrictBlocks: l.allowedBlocks !== null,
  allowedBlocks: [...(l.allowedBlocks ?? [])],
});

/** Only the fields that changed, in API shape. */
export function changedFields(level: LevelDetail, f: DetailsForm): Record<string, unknown> {
  const next: Record<string, unknown> = {
    title: f.title.trim(),
    slug: f.slug.trim(),
    briefDescription: f.briefDescription.trim() || null,
    description: f.description.trim() || null,
    difficulty: f.difficulty,
    worldId: f.worldId,
    environmentId: f.environmentId,
    thumbnail: f.thumbnail.trim() || null,
    previewImage: f.previewImage.trim() || null,
    estimatedMinutes: f.estimatedMinutes,
    xpReward: f.xpReward ?? 0,
    maxStars: f.maxStars ?? 3,
    parBlocks: f.parBlocks,
    parSeconds: f.parSeconds,
    sortOrder: f.sortOrder ?? 0,
    visibility: f.visibility,
    introSteps: f.introSteps.split('\n').map((s) => s.trim()).filter(Boolean),
    allowedBlocks: f.restrictBlocks ? f.allowedBlocks : null,
  };
  const current = level as unknown as Record<string, unknown>;
  return Object.fromEntries(Object.entries(next).filter(([k, v]) => JSON.stringify(v) !== JSON.stringify(current[k] ?? null)));
}

function DetailsTab({ level }: { level: LevelDetail }) {
  const user = useSessionStore((s) => s.user);
  const canPublish = can(user, 'levels.publish');
  const worlds = useResource('worlds:all', () => contentApi.worlds(), ['worlds']);
  const environments = useResource('environments', () => contentApi.environments());
  const [form, setForm] = useState(() => toForm(level));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, run] = useBusy();
  useEffect(() => setForm(toForm(level)), [level]);
  const changes = useMemo(() => changedFields(level, form), [level, form]);
  const dirty = Object.keys(changes).length > 0;
  const set = (patch: Partial<DetailsForm>) => setForm({ ...form, ...patch });

  const save = () =>
    run(async () => {
      setErrors({});
      try {
        await contentApi.updateLevel(level.id, changes);
        toast('Level saved.');
        invalidate('levels');
      } catch (e) {
        if (e instanceof ApiError && e.status === 409) setErrors({ slug: 'Another level uses this slug.' });
        else if (e instanceof ApiError && Object.keys(e.fieldErrors()).length) setErrors(e.fieldErrors());
        else setErrors({ _: e instanceof ApiError ? [e.message, ...e.problems()].join(' ') : 'Could not save.' });
      }
    });

  const toggleBlock = (type: string, on: boolean) => set({ allowedBlocks: on ? [...new Set([...form.allowedBlocks, type])] : form.allowedBlocks.filter((t) => t !== type) });

  return (
    <div className="flex flex-col gap-5">
      <div className="sticky top-0 z-10 -mx-1 flex items-center justify-end gap-2 bg-adm-bg/90 px-1 py-2 backdrop-blur">
        {dirty && <span className="mr-auto text-sm text-adm-warn">Unsaved changes</span>}
        <Button disabled={!dirty} onClick={() => (setForm(toForm(level)), setErrors({}))}>
          Discard
        </Button>
        <Button variant="primary" icon={Save} busy={busy} disabled={!dirty || !form.title.trim()} onClick={() => void save()}>
          Save changes
        </Button>
      </div>
      {errors._ && <Notice tone="danger">{errors._}</Notice>}
      <Card title="Basics">
        <div className="grid grid-cols-3 gap-4">
          <Field label="Title" required error={errors.title} className="col-span-2">
            {(p) => <TextInput {...p} maxLength={120} value={form.title} onChange={(e) => set({ title: e.target.value })} />}
          </Field>
          <Field label="Slug" required error={errors.slug}>
            {(p) => <TextInput {...p} className="font-mono" maxLength={80} value={form.slug} onChange={(e) => set({ slug: e.target.value })} />}
          </Field>
          <Field label="Short description" hint="One line on mission cards (200 characters)." error={errors.briefDescription} className="col-span-3">
            {(p) => <TextInput {...p} maxLength={200} value={form.briefDescription} onChange={(e) => set({ briefDescription: e.target.value })} />}
          </Field>
          <Field label="Description" error={errors.description} className="col-span-3">
            {(p) => <TextArea {...p} rows={4} maxLength={8000} value={form.description} onChange={(e) => set({ description: e.target.value })} />}
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
          <Field label="World" error={errors.worldId}>
            {(p) => (
              <Select {...p} value={form.worldId} onChange={(e) => set({ worldId: e.target.value })}>
                {worlds.data?.worlds.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Environment" hint="The level’s own 3D scene." error={errors.environmentId}>
            {(p) => (
              <Select {...p} value={form.environmentId} onChange={(e) => set({ environmentId: e.target.value })}>
                {environments.data?.environments
                  .filter((env) => env.kind === 'LEVEL' || env.id === form.environmentId)
                  .map((env) => (
                    <option key={env.id} value={env.id}>
                      {env.name}
                    </option>
                  ))}
              </Select>
            )}
          </Field>
          <Field label="Sort order" hint="Position in the world (or use ↑↓ on the Levels page).">
            {(p) => <NumberInput {...p} step={1} value={form.sortOrder} onValue={(v) => set({ sortOrder: v })} />}
          </Field>
          <Field label="Estimated time (minutes)" error={errors.estimatedMinutes}>
            {(p) => <NumberInput {...p} min={1} max={600} step={1} value={form.estimatedMinutes} onValue={(v) => set({ estimatedMinutes: v })} />}
          </Field>
          <Field label="Visibility" hint={canPublish ? 'Hidden levels never appear to students.' : 'Needs publishing rights.'}>
            {(p) => (
              <Select {...p} disabled={!canPublish} value={form.visibility} onChange={(e) => set({ visibility: e.target.value as 'VISIBLE' | 'HIDDEN' })}>
                <option value="VISIBLE">Visible</option>
                <option value="HIDDEN">Hidden</option>
              </Select>
            )}
          </Field>
        </div>
      </Card>

      <Card title="Rewards and star targets">
        <div className="grid grid-cols-4 gap-4">
          <Field label="XP reward" hint="Paid once, on first completion." error={errors.xpReward}>
            {(p) => <NumberInput {...p} min={0} max={10000} step={5} value={form.xpReward} onValue={(v) => set({ xpReward: v })} />}
          </Field>
          <Field label="Max stars" error={errors.maxStars}>
            {(p) => <NumberInput {...p} min={0} max={5} step={1} value={form.maxStars} onValue={(v) => set({ maxStars: v })} />}
          </Field>
          <Field label="Par blocks" hint="★ for using this many blocks or fewer." error={errors.parBlocks}>
            {(p) => <NumberInput {...p} min={1} max={500} step={1} value={form.parBlocks} onValue={(v) => set({ parBlocks: v })} />}
          </Field>
          <Field label="Par time (seconds)" hint="★ for finishing this fast." error={errors.parSeconds}>
            {(p) => <NumberInput {...p} min={1} max={3600} step={0.5} value={form.parSeconds} onValue={(v) => set({ parSeconds: v })} />}
          </Field>
        </div>
      </Card>

      <Card title="Images">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Thumbnail URL" hint="Optional. Without one, the app renders a preview of the environment." error={errors.thumbnail}>
            {(p) => <TextInput {...p} type="url" placeholder="https://" value={form.thumbnail} onChange={(e) => set({ thumbnail: e.target.value })} />}
          </Field>
          <Field label="Preview image URL" error={errors.previewImage}>
            {(p) => <TextInput {...p} type="url" placeholder="https://" value={form.previewImage} onChange={(e) => set({ previewImage: e.target.value })} />}
          </Field>
          {/^https?:\/\//.test(form.thumbnail) && <img src={form.thumbnail} alt="Thumbnail preview" className="h-28 rounded-lg border border-adm-line object-cover" />}
        </div>
      </Card>

      <Card title="Student briefing">
        <Field label="Intro steps" hint="One step per line, shown before the mission starts.">
          {(p) => <TextArea {...p} rows={4} value={form.introSteps} onChange={(e) => set({ introSteps: e.target.value })} />}
        </Field>
      </Card>

      <Card title="Blocks in the toolbox">
        <Checkbox
          label="Only allow some blocks in this level"
          hint="Leave off to allow every block. The server refuses programs that use other blocks."
          checked={form.restrictBlocks}
          onChange={(restrictBlocks) => set({ restrictBlocks, allowedBlocks: restrictBlocks && !form.allowedBlocks.length ? ['event.start', 'motion.forward'] : form.allowedBlocks })}
        />
        {form.restrictBlocks && (
          <div className="mt-4 grid grid-cols-4 gap-4">
            {CATEGORIES.map((c) => (
              <fieldset key={c.id} className="rounded-lg border border-adm-line p-3">
                <legend className="flex items-center gap-1.5 px-1 text-xs font-semibold text-adm-ink">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ background: c.color }} aria-hidden />
                  {c.label}
                </legend>
                <div className="flex flex-col gap-1.5">
                  {c.palette.map((type: BlockType) => (
                    <label key={type} className="flex cursor-pointer items-center gap-2 text-[13px] text-adm-body">
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5 accent-[var(--color-adm-accent)]"
                        checked={type === 'event.start' || form.allowedBlocks.includes(type)}
                        disabled={type === 'event.start'}
                        onChange={(e) => toggleBlock(type, e.target.checked)}
                      />
                      {blockLabel(type)}
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// ── readiness ───────────────────────────────────────────────────────────

function Readiness({ level }: { level: LevelDetail }) {
  const checks = [
    { ok: level.objectives.some((o) => o.type === 'REACH_GOAL'), label: 'Has a “reach the goal” objective', tab: 'objectives' as const },
    { ok: !!(level.mapDefinition as { start?: unknown }).start, label: 'Map has a start position', tab: 'map' as const },
    { ok: !!(level.mapDefinition as { finish?: unknown }).finish, label: 'Map has a finish zone', tab: 'map' as const },
    { ok: level.hints.length > 0, label: 'Has at least one hint (recommended)', tab: 'hints' as const, optional: true },
  ];
  return (
    <ul className="flex flex-col gap-1.5">
      {checks.map((c) => (
        <li key={c.label}>
          <button type="button" onClick={() => navigate(adminPaths.level(level.id, c.tab))} className="flex items-center gap-2 text-left text-[13px] hover:underline">
            {c.ok ? (
              <CheckCircle2 className="h-4 w-4 text-adm-ok" aria-label="Done" />
            ) : (
              <AlertTriangle className={cx('h-4 w-4', c.optional ? 'text-adm-faint' : 'text-adm-warn')} aria-label="Missing" />
            )}
            <span className={c.ok ? 'text-adm-body' : 'text-adm-ink'}>{c.label}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

// ── page ────────────────────────────────────────────────────────────────

export function LevelEditorPage({ id, tab }: { id: string; tab: LevelTab }) {
  const res = useResource(`level:${id}`, () => contentApi.level(id), ['levels']);
  const level = res.data?.level;

  if (res.error) return <ErrorState error={res.error} onRetry={res.reload} />;
  if (!level) return <Spinner />;

  const remove = async () => {
    if (!(await confirmAction({ title: `Delete “${level.title}”?`, message: 'The level disappears from the admin lists. Students’ history is kept. Levels that other levels require cannot be deleted.', confirmLabel: 'Delete level', danger: true }))) return;
    const ok = await runAction(() => contentApi.deleteLevel(level.id), { success: 'Level deleted.', tags: ['levels'] });
    if (ok !== undefined) navigate(adminPaths.levels());
  };

  const tabs = [
    { id: 'details' as const, label: 'Details' },
    { id: 'objectives' as const, label: 'Objectives', count: level.objectives.length },
    { id: 'hints' as const, label: 'Hints', count: level.hints.length },
    { id: 'unlock' as const, label: 'Unlock rules' },
    { id: 'lessons' as const, label: 'Lessons' },
    { id: 'map' as const, label: 'Map & checkpoints', count: level.checkpoints.length },
  ].map((t) => ({ ...t, href: adminPaths.level(id, t.id) }));

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Levels', to: adminPaths.levels() }, { label: level.worldSlug }, { label: level.title }]}
        title={level.title}
        meta={<WorkflowSteps status={level.status} />}
        subtitle={
          <span>
            <span className="font-mono">{level.slug}</span> · content version {level.contentVersion} · updated {formatDateTime(level.updatedAt)}
            {level.status === 'PUBLISHED' && level.publishedAt && ` · published ${formatDateTime(level.publishedAt)}`}
          </span>
        }
        actions={
          <>
            {level.status === 'PUBLISHED' && (
              <a href={`/studio/${level.slug}`} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-adm-body hover:bg-adm-line/60">
                <ExternalLink className="h-4 w-4" aria-hidden /> Open in app
              </a>
            )}
            {level.status !== 'PUBLISHED' && (
              <Button variant="danger-ghost" icon={Trash2} onClick={() => void remove()}>
                Delete
              </Button>
            )}
          </>
        }
      />
      <div className="mb-5 flex flex-wrap items-start gap-5 rounded-xl border border-adm-line bg-adm-surface p-4 shadow-adm">
        <div className="min-w-72 flex-1">
          <p className="mb-2 text-xs font-semibold tracking-wide text-adm-muted uppercase">Publishing</p>
          <WorkflowControl kind="levels" id={level.id} status={level.status} name={level.title} blockers={level.publishProblems} onChanged={res.reload} />
          {level.publishProblems.length > 0 && level.status !== 'PUBLISHED' && (
            <p className="mt-2 text-xs text-adm-warn">Before it can be published: {level.publishProblems.join(' ')}</p>
          )}
        </div>
        <div className="min-w-64">
          <p className="mb-2 text-xs font-semibold tracking-wide text-adm-muted uppercase">Checklist</p>
          <Readiness level={level} />
        </div>
      </div>
      <Tabs label="Level editor sections" tabs={tabs} active={tab} />
      {tab === 'details' && <DetailsTab level={level} />}
      {tab === 'objectives' && <ObjectivesTab level={level} />}
      {tab === 'hints' && <HintsTab level={level} />}
      {tab === 'unlock' && <UnlockTab level={level} />}
      {tab === 'lessons' && <LessonsTree onlyLevelId={level.id} />}
      {tab === 'map' && <MapTab level={level} />}
    </>
  );
}
