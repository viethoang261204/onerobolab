import { Lightbulb, Pencil, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ApiError } from '../../api/client';
import { contentApi } from '../../api/endpoints';
import type { Hint, LevelDetail } from '../../api/types';
import { runAction, useBusy } from '../../components/actions';
import { ReorderButtons } from '../../components/ReorderButtons';
import { invalidate } from '../../data/use-resource';
import { move } from '../../lib/content';
import { Field, NumberInput, TextArea, TextInput } from '../../ui/form';
import { confirmAction, Modal, toast } from '../../ui/overlay';
import { Badge, Button, Card, EmptyState, IconButton, Notice } from '../../ui/primitives';

function HintModal({ level, hint, open, onClose }: { level: LevelDetail; hint: Hint | null; open: boolean; onClose: () => void }) {
  const [form, setForm] = useState({ title: '', content: '', cost: 0 as number | null });
  const [error, setError] = useState<string | null>(null);
  const [busy, run] = useBusy();
  useEffect(() => {
    if (!open) return;
    setError(null);
    setForm(hint ? { title: hint.title, content: hint.content, cost: hint.cost } : { title: `Hint ${level.hints.length + 1}`, content: '', cost: 0 });
  }, [open, hint, level.hints.length]);

  const save = () =>
    run(async () => {
      const body = { title: form.title.trim(), content: form.content.trim(), cost: form.cost ?? 0 };
      try {
        if (hint) await contentApi.updateHint(hint.id, body);
        else await contentApi.createHint(level.id, body);
        toast(hint ? 'Hint saved.' : 'Hint added.');
        invalidate('levels');
        onClose();
      } catch (e) {
        setError(e instanceof ApiError ? e.message : 'Could not save the hint.');
      }
    });

  return (
    <Modal
      open={open}
      title={hint ? 'Edit hint' : 'New hint'}
      description="Hints are revealed one by one. Free hints show immediately; paid hints cost XP (once)."
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" busy={busy} disabled={!form.title.trim() || !form.content.trim()} onClick={() => void save()}>
            {hint ? 'Save hint' : 'Add hint'}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-[1fr_10rem] gap-4">
        {error && <Notice tone="danger" className="col-span-2">{error}</Notice>}
        <Field label="Title" required>
          {(p) => <TextInput {...p} maxLength={120} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />}
        </Field>
        <Field label="Cost (XP)" hint="0 = free.">
          {(p) => <NumberInput {...p} min={0} max={1000} step={5} value={form.cost} onValue={(cost) => setForm({ ...form, cost })} />}
        </Field>
        <Field label="Content" required className="col-span-2">
          {(p) => <TextArea {...p} rows={5} maxLength={4000} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} placeholder="e.g. Each paving slab is 50 cm long — count the slabs." />}
        </Field>
      </div>
    </Modal>
  );
}

export function HintsTab({ level }: { level: LevelDetail }) {
  const [editing, setEditing] = useState<Hint | null>(null);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const list = level.hints;

  const reorder = async (i: number, d: -1 | 1) => {
    setBusy(true);
    await runAction(() => contentApi.orderHints(level.id, move(list, i, d).map((h) => h.id)), { success: 'Order saved.', tags: ['levels'] });
    setBusy(false);
  };
  const remove = async (h: Hint) => {
    if (!(await confirmAction({ title: `Delete “${h.title}”?`, message: 'Students who already revealed it keep their record.', confirmLabel: 'Delete hint', danger: true }))) return;
    await runAction(() => contentApi.deleteHint(h.id), { success: 'Hint deleted.', tags: ['levels'] });
  };

  return (
    <Card
      title="Hints"
      padded={false}
      actions={
        <Button size="sm" variant="primary" icon={Plus} onClick={() => setCreating(true)}>
          Add hint
        </Button>
      }
    >
      {list.length === 0 ? (
        <EmptyState icon={Lightbulb} title="No hints yet">Most levels have three: a nudge, a strategy, and an almost-answer.</EmptyState>
      ) : (
        <ol className="divide-y divide-adm-line">
          {list.map((h, i) => (
            <li key={h.id} className="flex items-start gap-3 px-4 py-3">
              <ReorderButtons index={i} count={list.length} onMove={(d) => void reorder(i, d)} label={h.title} disabled={busy} />
              <span className="tabular mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-adm-warn-soft text-xs font-semibold text-adm-warn">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-adm-ink">{h.title}</p>
                <p className="mt-0.5 line-clamp-2 text-sm text-adm-body">{h.content}</p>
              </div>
              {h.cost > 0 ? <Badge tone="warning">{h.cost} XP</Badge> : <Badge tone="success">Free</Badge>}
              <IconButton icon={Pencil} label={`Edit ${h.title}`} onClick={() => setEditing(h)} />
              <IconButton icon={Trash2} variant="danger-ghost" label={`Delete ${h.title}`} onClick={() => void remove(h)} />
            </li>
          ))}
        </ol>
      )}
      <HintModal level={level} hint={editing} open={creating || !!editing} onClose={() => (setCreating(false), setEditing(null))} />
    </Card>
  );
}
