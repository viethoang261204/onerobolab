import { MapPin, Pencil, Plus, Save, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ApiError } from '../../api/client';
import { contentApi } from '../../api/endpoints';
import type { Checkpoint, LevelDetail } from '../../api/types';
import { runAction, useBusy } from '../../components/actions';
import { invalidate } from '../../data/use-resource';
import { Checkbox, Field, NumberInput, TextArea, TextInput } from '../../ui/form';
import { confirmAction, Modal, toast } from '../../ui/overlay';
import { Badge, Button, Card, EmptyState, IconButton, Notice } from '../../ui/primitives';

/*
 * Map data (advanced) and checkpoints. The map JSON is what the student app
 * renders and what the server scores against (start, finish, walls…); it is
 * normally produced from the level files, so edits here are for fixes.
 */

type JsonKey = 'mapDefinition' | 'sceneConfig' | 'missionSettings';
const JSON_FIELDS: readonly { key: JsonKey; label: string; hint: string }[] = [
  { key: 'mapDefinition', label: 'Map definition', hint: 'start {x, z, heading}, finish {center, size}, entities (walls, obstacles, checkpoints). Metres.' },
  { key: 'missionSettings', label: 'Mission settings', hint: 'failOnCollision, timeLimit (seconds or null), mission title and description.' },
  { key: 'sceneConfig', label: 'Scene', hint: 'Decoration around the course (road path, bridges, water). Visual only.' },
];

/** Parse an editor's JSON text; returns an error message instead of throwing. */
export function parseJsonObject(text: string): { value: Record<string, unknown> } | { error: string } {
  try {
    const v: unknown = JSON.parse(text);
    if (!v || typeof v !== 'object' || Array.isArray(v)) return { error: 'Must be a JSON object ({ … }).' };
    return { value: v as Record<string, unknown> };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Invalid JSON.' };
  }
}

function JsonEditors({ level }: { level: LevelDetail }) {
  const initial = () => Object.fromEntries(JSON_FIELDS.map((f) => [f.key, JSON.stringify(level[f.key], null, 2)])) as Record<JsonKey, string>;
  const [texts, setTexts] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, run] = useBusy();
  // Reload the editors when the level is saved or reloaded.
  useEffect(() => setTexts(initial()), [level]);

  const save = () =>
    run(async () => {
      const body: Record<string, unknown> = {};
      const errs: Record<string, string> = {};
      for (const f of JSON_FIELDS) {
        const parsed = parseJsonObject(texts[f.key]);
        if ('error' in parsed) errs[f.key] = parsed.error;
        else if (JSON.stringify(parsed.value) !== JSON.stringify(level[f.key])) body[f.key] = parsed.value;
      }
      setErrors(errs);
      if (Object.keys(errs).length || !Object.keys(body).length) return;
      try {
        await contentApi.updateLevel(level.id, body);
        toast('Map data saved. The content version was increased.');
        invalidate('levels');
      } catch (e) {
        setErrors({ _: e instanceof ApiError ? [e.message, ...e.problems(), ...Object.values(e.fieldErrors())].join(' ') : 'Could not save.' });
      }
    });

  return (
    <Card
      title="Map data (advanced)"
      actions={
        <Button size="sm" variant="primary" icon={Save} busy={busy} onClick={() => void save()}>
          Save map data
        </Button>
      }
    >
      <Notice tone="warning" className="mb-4">
        Changing the map changes how the level plays and how the server scores it. Test the level in the app after editing.
      </Notice>
      {errors._ && <Notice tone="danger" className="mb-4">{errors._}</Notice>}
      <div className="flex flex-col gap-4">
        {JSON_FIELDS.map((f) => (
          <Field key={f.key} label={f.label} hint={f.hint} error={errors[f.key]}>
            {(p) => (
              <TextArea
                {...p}
                spellCheck={false}
                rows={f.key === 'mapDefinition' ? 14 : 6}
                className="font-mono text-[12px] leading-5"
                value={texts[f.key]}
                onChange={(e) => setTexts({ ...texts, [f.key]: e.target.value })}
              />
            )}
          </Field>
        ))}
      </div>
    </Card>
  );
}

function CheckpointModal({ level, checkpoint, open, onClose }: { level: LevelDetail; checkpoint: Checkpoint | null; open: boolean; onClose: () => void }) {
  const [form, setForm] = useState({ code: '', name: '', x: 0 as number | null, z: 0 as number | null, radius: 0.22 as number | null, required: true });
  const [error, setError] = useState<string | null>(null);
  const [busy, run] = useBusy();
  useEffect(() => {
    if (!open) return;
    setError(null);
    setForm(
      checkpoint
        ? { code: checkpoint.code, name: checkpoint.name, x: checkpoint.position.x, z: checkpoint.position.z, radius: checkpoint.radius, required: checkpoint.required }
        : { code: `cp-${level.checkpoints.length + 1}`, name: '', x: 0, z: 0, radius: 0.22, required: true },
    );
  }, [open, checkpoint, level.checkpoints.length]);

  const save = () =>
    run(async () => {
      const body = { code: form.code, name: form.name.trim(), position: { x: form.x ?? 0, y: 0, z: form.z ?? 0 }, radius: form.radius ?? 0.22, required: form.required };
      try {
        if (checkpoint) await contentApi.updateCheckpoint(checkpoint.id, body);
        else await contentApi.createCheckpoint(level.id, body);
        toast(checkpoint ? 'Checkpoint saved.' : 'Checkpoint added.');
        invalidate('levels');
        onClose();
      } catch (e) {
        setError(e instanceof ApiError ? (e.status === 409 ? 'Another checkpoint uses this code.' : e.message) : 'Could not save.');
      }
    });

  return (
    <Modal
      open={open}
      title={checkpoint ? 'Edit checkpoint' : 'New checkpoint'}
      description="Position in metres on the course (x to the right, z towards the camera). Keep it in sync with the map’s checkpoint entity."
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" busy={busy} disabled={!form.name.trim() || !form.code} onClick={() => void save()}>
            Save
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-4">
        {error && <Notice tone="danger" className="col-span-2">{error}</Notice>}
        <Field label="Name" required>
          {(p) => <TextInput {...p} maxLength={120} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Bridge entrance" />}
        </Field>
        <Field label="Code" required hint="Map entity id, e.g. cp-1.">
          {(p) => <TextInput {...p} className="font-mono" maxLength={40} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />}
        </Field>
        <Field label="x (m)">{(p) => <NumberInput {...p} step={0.05} value={form.x} onValue={(x) => setForm({ ...form, x })} />}</Field>
        <Field label="z (m)">{(p) => <NumberInput {...p} step={0.05} value={form.z} onValue={(z) => setForm({ ...form, z })} />}</Field>
        <Field label="Radius (m)">{(p) => <NumberInput {...p} min={0.05} max={10} step={0.01} value={form.radius} onValue={(radius) => setForm({ ...form, radius })} />}</Field>
        <div className="flex items-end pb-2">
          <Checkbox label="Required" checked={form.required} onChange={(required) => setForm({ ...form, required })} />
        </div>
      </div>
    </Modal>
  );
}

function Checkpoints({ level }: { level: LevelDetail }) {
  const [editing, setEditing] = useState<Checkpoint | null>(null);
  const [creating, setCreating] = useState(false);
  const usedBy = (id: string) => level.objectives.filter((o) => o.checkpointId === id).map((o) => o.title);
  const remove = async (c: Checkpoint) => {
    if (!(await confirmAction({ title: `Delete checkpoint “${c.name}”?`, message: 'Objectives that use it must be changed first.', confirmLabel: 'Delete', danger: true }))) return;
    await runAction(() => contentApi.deleteCheckpoint(c.id), { success: 'Checkpoint deleted.', tags: ['levels'] });
  };
  return (
    <Card
      title="Checkpoints"
      padded={false}
      actions={
        <Button size="sm" icon={Plus} onClick={() => setCreating(true)}>
          Add checkpoint
        </Button>
      }
    >
      {level.checkpoints.length === 0 ? (
        <EmptyState icon={MapPin} title="No checkpoints">Add checkpoints to use “Reach a checkpoint” objectives.</EmptyState>
      ) : (
        <ol className="divide-y divide-adm-line">
          {level.checkpoints.map((c) => (
            <li key={c.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
              <MapPin className="h-4 w-4 text-adm-accent" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="font-medium text-adm-ink">{c.name}</span> <span className="font-mono text-xs text-adm-muted">{c.code}</span>
                <span className="block text-xs text-adm-muted">
                  x {c.position.x} · z {c.position.z} · r {c.radius} m{usedBy(c.id).length ? ` · used by: ${usedBy(c.id).join(', ')}` : ''}
                </span>
              </span>
              {!c.required && <Badge>Optional</Badge>}
              <IconButton icon={Pencil} label={`Edit ${c.name}`} onClick={() => setEditing(c)} />
              <IconButton icon={Trash2} variant="danger-ghost" label={`Delete ${c.name}`} onClick={() => void remove(c)} />
            </li>
          ))}
        </ol>
      )}
      <CheckpointModal level={level} checkpoint={editing} open={creating || !!editing} onClose={() => (setCreating(false), setEditing(null))} />
    </Card>
  );
}

export function MapTab({ level }: { level: LevelDetail }) {
  return (
    <div className="flex flex-col gap-5">
      <Checkpoints level={level} />
      <JsonEditors level={level} />
    </div>
  );
}
