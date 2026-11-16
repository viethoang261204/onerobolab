import { ArrowRight } from 'lucide-react';
import { useState } from 'react';
import { contentApi, type WorkflowKind } from '../api/endpoints';
import type { ContentStatus } from '../api/types';
import type { Tag } from '../data/use-resource';
import { CONTENT_STATUS, workflowActions, type WorkflowAction } from '../lib/labels';
import { can } from '../session/access';
import { useSessionStore } from '../session/session-store';
import { TextArea } from '../ui/form';
import { Modal } from '../ui/overlay';
import { Badge, Button, cx } from '../ui/primitives';
import { runAction } from './actions';

export function StatusBadge({ status }: { status: ContentStatus }) {
  const meta = CONTENT_STATUS[status];
  return (
    <Badge tone={meta.tone} dot>
      {meta.label}
    </Badge>
  );
}

/** Publishing permission per content kind (matches the API). */
const PUBLISH_PERMISSION = {
  curriculums: 'levels.publish',
  worlds: 'levels.publish',
  levels: 'levels.publish',
  lessons: 'content.manage',
  achievements: 'achievements.manage',
} as const;

const TAGS: Record<WorkflowKind, Tag[]> = {
  curriculums: ['curriculum', 'worlds', 'levels'],
  worlds: ['worlds', 'curriculum', 'levels'],
  levels: ['levels', 'activity'],
  lessons: ['lessons'],
  achievements: ['achievements'],
};

/** The four stages as a stepper (DRAFT → REVIEW → PUBLISHED, ARCHIVED aside). */
export function WorkflowSteps({ status }: { status: ContentStatus }) {
  const steps: ContentStatus[] = ['DRAFT', 'REVIEW', 'PUBLISHED'];
  const reached = status === 'ARCHIVED' ? -1 : steps.indexOf(status);
  return (
    <ol className="flex items-center gap-1.5 text-xs" aria-label="Publishing stage">
      {steps.map((s, i) => (
        <li key={s} className="flex items-center gap-1.5">
          {i > 0 && <ArrowRight className="h-3 w-3 text-adm-faint" aria-hidden />}
          <span
            aria-current={s === status ? 'step' : undefined}
            className={cx('rounded-full px-2 py-0.5 font-medium', i < reached ? 'text-adm-ok' : s === status ? 'bg-adm-accent-soft text-adm-accent-strong ring-1 ring-adm-accent/25' : 'text-adm-faint')}
          >
            {CONTENT_STATUS[s].label}
          </span>
        </li>
      ))}
      {status === 'ARCHIVED' && <Badge tone="warning">Archived</Badge>}
    </ol>
  );
}

/**
 * Status badge + the moves allowed from the current status. Moves that
 * change what students see are only offered to reviewers with the publishing
 * permission; the API enforces the same rules.
 */
export function WorkflowControl({
  kind,
  id,
  status,
  name,
  blockers = [],
  compact = false,
  onChanged,
}: {
  kind: WorkflowKind;
  id: string;
  status: ContentStatus;
  name: string;
  /** Problems that block publishing (shown instead of the publish button). */
  blockers?: readonly string[];
  compact?: boolean;
  onChanged?: () => void;
}) {
  const user = useSessionStore((s) => s.user);
  const [pending, setPending] = useState<WorkflowAction | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const canPublish = can(user, PUBLISH_PERMISSION[kind]);
  const actions = workflowActions(status).filter((a) => !a.live || canPublish);

  const apply = async (action: WorkflowAction) => {
    setBusy(true);
    const res = await runAction(() => contentApi.setStatus(kind, id, action.to, note.trim() || undefined), {
      success: `${name}: ${CONTENT_STATUS[action.to].label.toLowerCase()}.`,
      tags: TAGS[kind],
    });
    setBusy(false);
    setPending(null);
    setNote('');
    if (res) onChanged?.();
  };

  return (
    <div className={cx('flex flex-wrap items-center gap-2', compact && 'gap-1.5')}>
      {!compact && <StatusBadge status={status} />}
      {actions.map((a) => {
        const blocked = a.to === 'PUBLISHED' && blockers.length > 0;
        return (
          <Button
            key={a.to}
            size="sm"
            variant={a.tone === 'primary' ? 'primary' : a.tone === 'danger' ? 'danger-ghost' : 'secondary'}
            disabled={blocked}
            title={blocked ? `Fix first: ${blockers.join(' ')}` : undefined}
            onClick={() => setPending(a)}
          >
            {a.label}
          </Button>
        );
      })}
      {status === 'REVIEW' && !canPublish && <span className="text-xs text-adm-muted">Waiting for a reviewer to publish.</span>}
      <Modal
        open={!!pending}
        title={pending ? `${pending.label}: ${name}` : ''}
        description={pending?.confirm ?? `Move from ${CONTENT_STATUS[status].label} to ${pending ? CONTENT_STATUS[pending.to].label : ''}.`}
        onClose={() => setPending(null)}
        size="sm"
        footer={
          <>
            <Button onClick={() => setPending(null)}>Cancel</Button>
            <Button variant={pending?.tone === 'danger' ? 'danger' : 'primary'} busy={busy} onClick={() => pending && void apply(pending)}>
              {pending?.label}
            </Button>
          </>
        }
      >
        <label className="flex flex-col gap-1.5 text-[13px] font-medium text-adm-ink">
          Note for the audit log (optional)
          <TextArea rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Checked the map and hints" />
        </label>
      </Modal>
    </div>
  );
}
