import { Pencil, Plus, Trash2, Trophy } from 'lucide-react';
import { useEffect, useState } from 'react';
import { CATEGORIES, blockLabel } from '@robolab/blocks';
import { ApiError } from '../../api/client';
import { contentApi } from '../../api/endpoints';
import type { Achievement, AchievementCriteria } from '../../api/types';
import { runAction, useBusy } from '../../components/actions';
import { useLevelOptions } from '../../components/pickers';
import { StatusBadge, WorkflowControl } from '../../components/WorkflowControl';
import { invalidate, useResource } from '../../data/use-resource';
import { slugify } from '../../lib/content';
import { formatNumber } from '../../lib/format';
import { DataTable, type Column } from '../../ui/DataTable';
import { Checkbox, Field, NumberInput, Select, TextArea, TextInput } from '../../ui/form';
import { PageHeader } from '../../ui/layout';
import { confirmAction, Drawer, toast } from '../../ui/overlay';
import { Button, Card, EmptyState, ErrorState, IconButton, Notice } from '../../ui/primitives';

type CriteriaType = AchievementCriteria['type'];
const CRITERIA: Record<CriteriaType, string> = {
  complete_levels: 'Complete a number of levels',
  complete_level: 'Complete a specific level',
  complete_world: 'Complete a whole world',
  total_stars: 'Earn a number of stars',
  three_star_levels: 'Get 3 stars on a number of levels',
  streak_days: 'Practise several days in a row',
  use_block: 'Pass a level using a block',
};

/** "Complete 10 levels", "Complete level starter-03", "Use repeat … times". */
export function describeCriteria(c: AchievementCriteria): string {
  switch (c.type) {
    case 'complete_levels':
      return `Complete ${c.count} level${c.count === 1 ? '' : 's'}`;
    case 'complete_level':
      return `Complete level ${c.level}`;
    case 'complete_world':
      return `Complete world ${c.world}`;
    case 'total_stars':
      return `Earn ${c.count} stars`;
    case 'three_star_levels':
      return `3 stars on ${c.count} level${c.count === 1 ? '' : 's'}`;
    case 'streak_days':
      return `${c.count}-day streak`;
    case 'use_block':
      return `Pass a level using “${blockLabel(c.block as never)}”`;
  }
}

interface Draft {
  name: string;
  slug: string;
  slugTouched: boolean;
  description: string;
  icon: string;
  xpReward: number | null;
  isSecret: boolean;
  type: CriteriaType;
  count: number | null;
  level: string;
  world: string;
  block: string;
}

const toCriteria = (d: Draft): AchievementCriteria => {
  switch (d.type) {
    case 'complete_level':
      return { type: d.type, level: d.level };
    case 'complete_world':
      return { type: d.type, world: d.world };
    case 'use_block':
      return { type: d.type, block: d.block };
    default:
      return { type: d.type, count: d.count ?? 1 };
  }
};

function AchievementDrawer({ open, achievement, onClose }: { open: boolean; achievement: Achievement | null; onClose: () => void }) {
  const levels = useLevelOptions();
  const worlds = useResource(open ? 'worlds:all' : null, () => contentApi.worlds(), ['worlds']);
  const [d, setD] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, run] = useBusy();

  useEffect(() => {
    if (!open) return;
    setError(null);
    const c = achievement?.criteria;
    setD({
      name: achievement?.name ?? '',
      slug: achievement?.slug ?? '',
      slugTouched: !!achievement,
      description: achievement?.description ?? '',
      icon: achievement?.icon ?? 'trophy',
      xpReward: achievement?.xpReward ?? 20,
      isSecret: achievement?.isSecret ?? false,
      type: c?.type ?? 'complete_levels',
      count: c && 'count' in c ? c.count : 1,
      level: c?.type === 'complete_level' ? c.level : '',
      world: c?.type === 'complete_world' ? c.world : '',
      block: c?.type === 'use_block' ? c.block : 'control.repeat',
    });
  }, [open, achievement]);
  if (!d) return null;
  const set = (p: Partial<Draft>) => setD({ ...d, ...p });

  const save = () =>
    run(async () => {
      const body = { name: d.name.trim(), slug: d.slug, description: d.description.trim(), icon: d.icon.trim() || null, xpReward: d.xpReward ?? 0, isSecret: d.isSecret, criteria: toCriteria(d) };
      try {
        if (achievement) await contentApi.updateAchievement(achievement.id, body);
        else await contentApi.createAchievement(body);
        toast(achievement ? 'Achievement saved.' : 'Achievement created as a draft.');
        invalidate('achievements');
        onClose();
      } catch (e) {
        setError(e instanceof ApiError ? (e.status === 409 ? 'Another achievement uses this slug.' : [e.message, ...Object.values(e.fieldErrors())].join(' ')) : 'Could not save.');
      }
    });

  const remove = async () => {
    if (!achievement || !(await confirmAction({ title: `Delete “${achievement.name}”?`, message: 'Students who earned it keep it. It will no longer be awarded.', confirmLabel: 'Delete', danger: true }))) return;
    const ok = await runAction(() => contentApi.deleteAchievement(achievement.id), { success: 'Achievement deleted.', tags: ['achievements'] });
    if (ok !== undefined) onClose();
  };

  const counted = d.type !== 'complete_level' && d.type !== 'complete_world' && d.type !== 'use_block';
  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={600}
      title={achievement ? 'Edit achievement' : 'New achievement'}
      subtitle={achievement?.name}
      footer={
        <>
          {achievement && (
            <Button variant="danger-ghost" icon={Trash2} className="mr-auto" onClick={() => void remove()}>
              Delete
            </Button>
          )}
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" busy={busy} disabled={!d.name.trim() || !d.slug || !d.description.trim()} onClick={() => void save()}>
            Save
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-4">
        {error && <Notice tone="danger" className="col-span-2">{error}</Notice>}
        {achievement && (
          <div className="col-span-2 rounded-lg border border-adm-line bg-adm-subtle p-3">
            <WorkflowControl kind="achievements" id={achievement.id} status={achievement.status} name={achievement.name} onChanged={onClose} />
          </div>
        )}
        <Field label="Name" required>
          {(p) => <TextInput {...p} maxLength={120} value={d.name} onChange={(e) => set({ name: e.target.value, slug: d.slugTouched ? d.slug : slugify(e.target.value) })} />}
        </Field>
        <Field label="Slug" required>
          {(p) => <TextInput {...p} className="font-mono" maxLength={80} value={d.slug} onChange={(e) => set({ slug: e.target.value, slugTouched: true })} />}
        </Field>
        <Field label="Description" required className="col-span-2">
          {(p) => <TextArea {...p} rows={2} maxLength={1000} value={d.description} onChange={(e) => set({ description: e.target.value })} />}
        </Field>
        <Field label="XP reward" hint="Paid once when earned.">
          {(p) => <NumberInput {...p} min={0} max={100000} step={5} value={d.xpReward} onValue={(xpReward) => set({ xpReward })} />}
        </Field>
        <Field label="Icon" hint="Icon name, e.g. trophy, star, flame.">
          {(p) => <TextInput {...p} maxLength={80} value={d.icon} onChange={(e) => set({ icon: e.target.value })} />}
        </Field>
        <Field label="Earned when" className="col-span-2" hint="The server checks this after every passed submission.">
          {(p) => (
            <Select {...p} value={d.type} onChange={(e) => set({ type: e.target.value as CriteriaType })}>
              {(Object.keys(CRITERIA) as CriteriaType[]).map((t) => (
                <option key={t} value={t}>
                  {CRITERIA[t]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        {counted && <Field label={d.type === 'streak_days' ? 'Days' : 'How many'}>{(p) => <NumberInput {...p} min={1} step={1} value={d.count} onValue={(count) => set({ count })} />}</Field>}
        {d.type === 'complete_level' && (
          <Field label="Level" className="col-span-2">
            {(p) => (
              <Select {...p} value={d.level} onChange={(e) => set({ level: e.target.value })}>
                <option value="">Choose…</option>
                {levels.data?.levels.map((l) => (
                  <option key={l.id} value={l.slug}>
                    {l.worldName} · {l.title}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        )}
        {d.type === 'complete_world' && (
          <Field label="World" className="col-span-2">
            {(p) => (
              <Select {...p} value={d.world} onChange={(e) => set({ world: e.target.value })}>
                <option value="">Choose…</option>
                {worlds.data?.worlds.map((w) => (
                  <option key={w.id} value={w.slug}>
                    {w.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        )}
        {d.type === 'use_block' && (
          <Field label="Block" className="col-span-2">
            {(p) => (
              <Select {...p} value={d.block} onChange={(e) => set({ block: e.target.value })}>
                {CATEGORIES.map((c) => (
                  <optgroup key={c.id} label={c.label}>
                    {c.palette.map((t) => (
                      <option key={`${c.id}-${t}`} value={t}>
                        {blockLabel(t)}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </Select>
            )}
          </Field>
        )}
        <div className="col-span-2">
          <Checkbox label="Secret" hint="Hidden from students until they earn it." checked={d.isSecret} onChange={(isSecret) => set({ isSecret })} />
        </div>
      </div>
    </Drawer>
  );
}

export function AchievementsPage() {
  const res = useResource('achievements', () => contentApi.achievements(), ['achievements']);
  const [editing, setEditing] = useState<Achievement | null>(null);
  const [creating, setCreating] = useState(false);

  const columns: Column<Achievement>[] = [
    {
      key: 'name',
      header: 'Achievement',
      cell: (a) => (
        <span className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-adm-warn-soft text-adm-warn">
            <Trophy className="h-4 w-4" aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="block font-medium text-adm-ink">{a.name}</span>
            <span className="block truncate text-xs text-adm-muted">{a.description}</span>
          </span>
        </span>
      ),
    },
    { key: 'rule', header: 'Earned when', cell: (a) => describeCriteria(a.criteria) },
    { key: 'xp', header: 'XP', align: 'right', cell: (a) => <span className="tabular">{formatNumber(a.xpReward)}</span> },
    { key: 'earned', header: 'Earned by', align: 'right', cell: (a) => <span className="tabular">{formatNumber(a.unlockedBy)}</span> },
    { key: 'status', header: 'Status', cell: (a) => <StatusBadge status={a.status} /> },
    { key: 'edit', header: <span className="sr-only">Edit</span>, align: 'right', cell: (a) => <IconButton icon={Pencil} label={`Edit ${a.name}`} onClick={() => setEditing(a)} /> },
  ];

  return (
    <>
      <PageHeader
        title="Achievements"
        subtitle="Badges students earn automatically. The server checks the rules; students can’t award themselves anything."
        actions={
          <Button variant="primary" icon={Plus} onClick={() => setCreating(true)}>
            New achievement
          </Button>
        }
      />
      <Card padded={false}>
        {res.error ? (
          <div className="p-4">
            <ErrorState error={res.error} onRetry={res.reload} />
          </div>
        ) : (
          <DataTable label="Achievements" rows={res.data?.achievements} loading={res.loading} columns={columns} rowKey={(a) => a.id} onRowClick={setEditing} empty={<EmptyState icon={Trophy} title="No achievements yet" />} />
        )}
      </Card>
      <AchievementDrawer open={creating || !!editing} achievement={editing} onClose={() => (setCreating(false), setEditing(null))} />
    </>
  );
}
