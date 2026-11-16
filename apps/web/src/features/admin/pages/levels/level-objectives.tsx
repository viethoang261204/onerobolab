import { ListChecks, Pencil, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ApiError } from '../../api/client';
import { contentApi } from '../../api/endpoints';
import type { LevelDetail, Objective, ObjectiveType } from '../../api/types';
import { runAction, useBusy } from '../../components/actions';
import { ReorderButtons } from '../../components/ReorderButtons';
import { invalidate } from '../../data/use-resource';
import { move, slugify } from '../../lib/content';
import { OBJECTIVE_TYPES } from '../../lib/labels';
import { Checkbox, Field, NumberInput, Select, TextArea, TextInput } from '../../ui/form';
import { confirmAction, Modal, toast } from '../../ui/overlay';
import { Badge, Button, Card, EmptyState, IconButton, Notice } from '../../ui/primitives';

/** The config number each objective type uses, if any. */
const CONFIG_FIELD: Partial<Record<ObjectiveType, { key: string; label: string; min: number; max: number; step: number; def: number }>> = {
  AVOID_COLLISIONS: { key: 'maxCollisions', label: 'Collisions allowed', min: 0, max: 100, step: 1, def: 0 },
  FINISH_WITHIN: { key: 'seconds', label: 'Time limit (seconds)', min: 1, max: 3600, step: 1, def: 30 },
  USE_MAX_BLOCKS: { key: 'count', label: 'Maximum blocks', min: 1, max: 500, step: 1, def: 10 },
};

export function describeObjective(o: Pick<Objective, 'type' | 'config'>, checkpointName?: string): string {
  const cfg = CONFIG_FIELD[o.type];
  const value = cfg ? o.config[cfg.key] : undefined;
  if (o.type === 'REACH_CHECKPOINT') return `Reach ${checkpointName ?? 'a checkpoint'}`;
  if (cfg && typeof value === 'number') return `${OBJECTIVE_TYPES[o.type].label} · ${cfg.label.toLowerCase()}: ${value}`;
  return OBJECTIVE_TYPES[o.type].label;
}

interface ObjectiveForm {
  code: string;
  codeTouched: boolean;
  title: string;
  description: string;
  type: ObjectiveType;
  checkpointId: string;
  configValue: number | null;
  required: boolean;
}

function ObjectiveModal({ level, objective, open, onClose }: { level: LevelDetail; objective: Objective | null; open: boolean; onClose: () => void }) {
  const [form, setForm] = useState<ObjectiveForm | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, run] = useBusy();
  useEffect(() => {
    if (!open) return;
    setErrors({});
    if (objective) {
      const cfg = CONFIG_FIELD[objective.type];
      setForm({
        code: objective.code,
        codeTouched: true,
        title: objective.title,
        description: objective.description ?? '',
        type: objective.type,
        checkpointId: objective.checkpointId ?? '',
        configValue: cfg && typeof objective.config[cfg.key] === 'number' ? (objective.config[cfg.key] as number) : (cfg?.def ?? null),
        required: objective.required,
      });
    } else {
      setForm({ code: '', codeTouched: false, title: '', description: '', type: 'REACH_CHECKPOINT', checkpointId: '', configValue: null, required: true });
    }
  }, [open, objective]);
  if (!form) return null;
  const cfg = CONFIG_FIELD[form.type];
  const set = (patch: Partial<ObjectiveForm>) => setForm({ ...form, ...patch });

  const save = () =>
    run(async () => {
      if (form.type === 'REACH_CHECKPOINT' && !form.checkpointId) return setErrors({ checkpointId: 'Choose the checkpoint.' });
      const body = {
        code: form.code,
        title: form.title.trim(),
        description: form.description.trim() || null,
        type: form.type,
        checkpointId: form.type === 'REACH_CHECKPOINT' ? form.checkpointId : null,
        config: cfg && form.configValue !== null ? { ...(objective?.config ?? {}), [cfg.key]: form.configValue } : cfg ? {} : (objective?.config ?? {}),
        required: form.required,
      };
      try {
        if (objective) await contentApi.updateObjective(objective.id, body);
        else await contentApi.createObjective(level.id, body);
        toast(objective ? 'Objective saved.' : 'Objective added.');
        invalidate('levels');
        onClose();
      } catch (e) {
        if (e instanceof ApiError && e.status === 409) setErrors({ code: 'Another objective of this level uses this code.' });
        else if (e instanceof ApiError && Object.keys(e.fieldErrors()).length) setErrors(e.fieldErrors());
        else setErrors({ _: e instanceof ApiError ? [e.message, ...e.problems()].join(' ') : 'Could not save.' });
      }
    });

  return (
    <Modal
      open={open}
      title={objective ? 'Edit objective' : 'New objective'}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" busy={busy} disabled={!form.title.trim() || !form.code} onClick={() => void save()}>
            {objective ? 'Save objective' : 'Add objective'}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-4">
        {errors._ && <Notice tone="danger" className="col-span-2">{errors._}</Notice>}
        <Field label="Type" className="col-span-2" hint={OBJECTIVE_TYPES[form.type].help}>
          {(p) => (
            <Select {...p} value={form.type} onChange={(e) => set({ type: e.target.value as ObjectiveType, configValue: CONFIG_FIELD[e.target.value as ObjectiveType]?.def ?? null })}>
              {(Object.keys(OBJECTIVE_TYPES) as ObjectiveType[]).map((t) => (
                <option key={t} value={t}>
                  {OBJECTIVE_TYPES[t].label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Title (shown to students)" required error={errors.title}>
          {(p) => <TextInput {...p} maxLength={160} value={form.title} onChange={(e) => set({ title: e.target.value, code: form.codeTouched ? form.code : slugify(e.target.value).slice(0, 40) })} placeholder="e.g. Cross the bridge" />}
        </Field>
        <Field label="Code" required error={errors.code} hint="Id the simulator reports, e.g. “goal”, “cp-1”.">
          {(p) => <TextInput {...p} className="font-mono" maxLength={40} value={form.code} onChange={(e) => set({ code: e.target.value, codeTouched: true })} />}
        </Field>
        {form.type === 'REACH_CHECKPOINT' && (
          <Field label="Checkpoint" required error={errors.checkpointId} className="col-span-2" hint={level.checkpoints.length ? undefined : 'Add checkpoints on the “Map & checkpoints” tab first.'}>
            {(p) => (
              <Select {...p} value={form.checkpointId} onChange={(e) => set({ checkpointId: e.target.value })}>
                <option value="">Choose…</option>
                {level.checkpoints.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </Select>
            )}
          </Field>
        )}
        {cfg && (
          <Field label={cfg.label}>
            {(p) => <NumberInput {...p} min={cfg.min} max={cfg.max} step={cfg.step} value={form.configValue} onValue={(v) => set({ configValue: v })} />}
          </Field>
        )}
        <Field label="Description" className="col-span-2" hint="Optional extra explanation.">
          {(p) => <TextArea {...p} rows={2} maxLength={1000} value={form.description} onChange={(e) => set({ description: e.target.value })} />}
        </Field>
        <div className="col-span-2">
          <Checkbox label="Required to pass the level" hint="Optional objectives are shown but don’t block completion." checked={form.required} onChange={(required) => set({ required })} />
        </div>
      </div>
    </Modal>
  );
}

export function ObjectivesTab({ level }: { level: LevelDetail }) {
  const [editing, setEditing] = useState<Objective | null>(null);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const list = level.objectives;
  const checkpointName = (id: string | null) => level.checkpoints.find((c) => c.id === id)?.name;

  const reorder = async (i: number, d: -1 | 1) => {
    setBusy(true);
    await runAction(() => contentApi.orderObjectives(level.id, move(list, i, d).map((o) => o.id)), { success: 'Order saved.', tags: ['levels'] });
    setBusy(false);
  };
  const toggleRequired = (o: Objective) => runAction(() => contentApi.updateObjective(o.id, { required: !o.required }), { success: o.required ? 'Marked optional.' : 'Marked required.', tags: ['levels'] });
  const remove = async (o: Objective) => {
    if (!(await confirmAction({ title: `Delete “${o.title}”?`, message: 'Students will no longer see or complete this objective.', confirmLabel: 'Delete objective', danger: true }))) return;
    await runAction(() => contentApi.deleteObjective(o.id), { success: 'Objective deleted.', tags: ['levels'] });
  };

  return (
    <Card
      title="Objectives"
      padded={false}
      actions={
        <Button size="sm" variant="primary" icon={Plus} onClick={() => setCreating(true)}>
          Add objective
        </Button>
      }
    >
      {level.status === 'PUBLISHED' && <Notice className="m-4 mb-0">This level is live. Changes apply to students immediately and bump the content version.</Notice>}
      {list.length === 0 ? (
        <EmptyState icon={ListChecks} title="No objectives yet">Every published level needs at least a “Reach the goal” objective.</EmptyState>
      ) : (
        <ol className="divide-y divide-adm-line">
          {list.map((o, i) => (
            <li key={o.id} className="flex items-center gap-3 px-4 py-3">
              <ReorderButtons index={i} count={list.length} onMove={(d) => void reorder(i, d)} label={o.title} disabled={busy} />
              <span className="tabular flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-adm-subtle text-xs font-semibold text-adm-body ring-1 ring-adm-line">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-adm-ink">{o.title}</p>
                <p className="text-xs text-adm-muted">
                  {describeObjective(o, checkpointName(o.checkpointId))} · <span className="font-mono">{o.code}</span>
                </p>
              </div>
              <button type="button" onClick={() => void toggleRequired(o)} title="Toggle required">
                {o.required ? <Badge tone="info">Required</Badge> : <Badge>Optional</Badge>}
              </button>
              <IconButton icon={Pencil} label={`Edit ${o.title}`} onClick={() => setEditing(o)} />
              <IconButton icon={Trash2} variant="danger-ghost" label={`Delete ${o.title}`} onClick={() => void remove(o)} />
            </li>
          ))}
        </ol>
      )}
      <ObjectiveModal level={level} objective={editing} open={creating || !!editing} onClose={() => (setCreating(false), setEditing(null))} />
    </Card>
  );
}
