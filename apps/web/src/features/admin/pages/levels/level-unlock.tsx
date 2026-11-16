import { Lock, Plus, RotateCcw, Save, Trash2, Unlock, UserPlus, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { RouteLink } from '../../../router/RouteLink';
import { adminPaths } from '../../admin-routes';
import { contentApi, studentsApi } from '../../api/endpoints';
import type { AccessMode, LevelDetail, LevelOverride, PrerequisiteGroup, Requirement, RequirementType } from '../../api/types';
import { runAction, useBusy } from '../../components/actions';
import { DependencyGraphView } from '../../components/DependencyGraphView';
import { LevelSelect, StudentPicker, useLevelOptions } from '../../components/pickers';
import { useResource } from '../../data/use-resource';
import { formatDate } from '../../lib/format';
import { ACCESS_MODE } from '../../lib/labels';
import { describeUnlock, draftProblems, emptyGroup, emptyRequirement, fromDraft, REQUIREMENT_TYPES, toDraft, type GroupDraft, type RequirementDraft } from '../../lib/unlock-rules';
import { can } from '../../session/access';
import { useSessionStore } from '../../session/session-store';
import { DataTable, type Column } from '../../ui/DataTable';
import { Field, NumberInput, Select, TextInput } from '../../ui/form';
import { confirmAction, Modal } from '../../ui/overlay';
import { Badge, Button, Card, cx, EmptyState, IconButton, Notice } from '../../ui/primitives';

// ── access mode ─────────────────────────────────────────────────────────

function AccessModePicker({ level }: { level: LevelDetail }) {
  const canPublish = can(useSessionStore((s) => s.user), 'levels.publish');
  const [busy, run] = useBusy();
  const choose = (mode: AccessMode) =>
    run(async () => {
      if (mode === level.accessMode) return;
      await runAction(() => contentApi.updateLevel(level.id, { accessMode: mode }), { success: `Unlock mode: ${ACCESS_MODE[mode].label.toLowerCase()}.`, tags: ['levels'] });
    });
  return (
    <fieldset>
      <legend className="sr-only">Who can play this level</legend>
      <div className="grid grid-cols-3 gap-3">
        {(['AUTO', 'UNLOCKED', 'LOCKED'] as const).map((mode) => {
          const active = level.accessMode === mode;
          return (
            <label
              key={mode}
              className={cx(
                'flex cursor-pointer flex-col gap-1 rounded-lg border p-3.5 transition-colors',
                active ? 'border-adm-accent bg-adm-accent-soft ring-1 ring-adm-accent/30' : 'border-adm-line hover:border-adm-line-strong',
                (!canPublish || busy) && 'cursor-not-allowed opacity-70',
              )}
            >
              <span className="flex items-center gap-2 text-sm font-semibold text-adm-ink">
                <input type="radio" name="access-mode" className="accent-[var(--color-adm-accent)]" checked={active} disabled={!canPublish || busy} onChange={() => void choose(mode)} />
                {ACCESS_MODE[mode].label}
              </span>
              <span className="pl-5 text-xs text-adm-muted">{ACCESS_MODE[mode].help}</span>
            </label>
          );
        })}
      </div>
      {!canPublish && <p className="mt-2 text-xs text-adm-muted">Changing this needs publishing rights.</p>}
    </fieldset>
  );
}

// ── rule groups editor ──────────────────────────────────────────────────

function RequirementRow({
  req,
  onChange,
  onRemove,
  selfId,
  levels,
  worlds,
  achievements,
}: {
  req: RequirementDraft;
  onChange: (r: RequirementDraft) => void;
  onRemove: () => void;
  selfId: string;
  levels: ReturnType<typeof useLevelOptions>['data'];
  worlds: readonly { id: string; name: string }[];
  achievements: readonly { id: string; name: string }[];
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-adm-line bg-adm-surface px-2.5 py-2">
      <Select aria-label="Requirement type" className="w-52" value={req.type} onChange={(e) => onChange({ ...emptyRequirement(e.target.value as RequirementType), levelId: req.levelId })}>
        {(Object.keys(REQUIREMENT_TYPES) as RequirementType[]).map((t) => (
          <option key={t} value={t}>
            {REQUIREMENT_TYPES[t]}
          </option>
        ))}
      </Select>
      {(req.type === 'LEVEL_COMPLETED' || req.type === 'LEVEL_STARS') && (
        <div className="w-64">
          <LevelSelect aria-label="Level" levels={levels?.levels} exclude={selfId} value={req.levelId} onChange={(levelId) => onChange({ ...req, levelId })} />
        </div>
      )}
      {req.type === 'WORLD_COMPLETED' && (
        <Select aria-label="World" className="w-64" value={req.worldId} onChange={(e) => onChange({ ...req, worldId: e.target.value })}>
          <option value="">Choose a world…</option>
          {worlds.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </Select>
      )}
      {req.type === 'ACHIEVEMENT' && (
        <Select aria-label="Achievement" className="w-64" value={req.achievementId} onChange={(e) => onChange({ ...req, achievementId: e.target.value })}>
          <option value="">Choose an achievement…</option>
          {achievements.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </Select>
      )}
      {(req.type === 'LEVEL_STARS' || req.type === 'TOTAL_STARS') && (
        <span className="flex items-center gap-1.5 text-sm text-adm-muted">
          at least
          <NumberInput aria-label="Stars" className="w-20" min={0} max={req.type === 'LEVEL_STARS' ? 5 : 100000} step={1} value={req.stars} onValue={(v) => onChange({ ...req, stars: v ?? 0 })} />★
        </span>
      )}
      {req.type === 'TOTAL_XP' && (
        <span className="flex items-center gap-1.5 text-sm text-adm-muted">
          at least
          <NumberInput aria-label="XP" className="w-28" min={0} step={10} value={req.xp} onValue={(v) => onChange({ ...req, xp: v ?? 0 })} />
          XP
        </span>
      )}
      <IconButton icon={X} label="Remove requirement" className="ml-auto" onClick={onRemove} />
    </div>
  );
}

function RulesEditor({ level }: { level: LevelDetail }) {
  const levels = useLevelOptions();
  const worlds = useResource('worlds:all', () => contentApi.worlds(), ['worlds']);
  const achievements = useResource('achievements', () => contentApi.achievements(), ['achievements']);
  const [groups, setGroups] = useState<GroupDraft[]>(() => toDraft(level.prerequisites as PrerequisiteGroup[]));
  const [busy, run] = useBusy();
  useEffect(() => setGroups(toDraft(level.prerequisites as PrerequisiteGroup[])), [level]);
  const problems = draftProblems(groups, level.id);
  const saved = JSON.stringify(fromDraft(toDraft(level.prerequisites as PrerequisiteGroup[])));
  const dirty = JSON.stringify(fromDraft(groups)) !== saved;

  // Human sentence of the draft, with names resolved.
  const preview = useMemo(() => {
    const levelById = new Map((levels.data?.levels ?? []).map((l) => [l.id, l.title]));
    const worldById = new Map((worlds.data?.worlds ?? []).map((w) => [w.id, w.name]));
    const achById = new Map((achievements.data?.achievements ?? []).map((a) => [a.id, a.name]));
    const named: PrerequisiteGroup[] = groups.map((g, i) => ({
      groupId: g.key,
      name: null,
      sortOrder: i + 1,
      requirements: g.requirements.map((r): Requirement => ({
        type: r.type,
        ...(r.levelId && { levelId: r.levelId, levelTitle: levelById.get(r.levelId) ?? '?' }),
        ...(r.worldId && { worldId: r.worldId, worldName: worldById.get(r.worldId) ?? '?' }),
        ...(r.achievementId && { achievementId: r.achievementId, achievementName: achById.get(r.achievementId) ?? '?' }),
        stars: r.stars,
        xp: r.xp,
      })),
    }));
    return describeUnlock('AUTO', named);
  }, [groups, levels.data, worlds.data, achievements.data]);

  const update = (gi: number, fn: (g: GroupDraft) => GroupDraft) => setGroups(groups.map((g, i) => (i === gi ? fn(g) : g)));
  const save = () =>
    run(async () => {
      await runAction(() => contentApi.setPrerequisites(level.id, fromDraft(groups)), { success: 'Unlock rules saved.', tags: ['levels'] });
    });

  return (
    <Card
      title="Prerequisites"
      actions={
        <>
          <Button size="sm" disabled={!dirty} onClick={() => setGroups(toDraft(level.prerequisites as PrerequisiteGroup[]))}>
            Discard
          </Button>
          <Button size="sm" variant="primary" icon={Save} busy={busy} disabled={!dirty || problems.length > 0} onClick={() => void save()}>
            Save rules
          </Button>
        </>
      }
    >
      {level.accessMode !== 'AUTO' && (
        <Notice tone="warning" className="mb-4">
          These rules only apply in “{ACCESS_MODE.AUTO.label}” mode. Right now the level is {ACCESS_MODE[level.accessMode].label.toLowerCase()}.
        </Notice>
      )}
      <p className="mb-3 text-sm text-adm-body">
        <span className="font-medium text-adm-ink">Students unlock this level: </span>
        {groups.length ? preview.replace(/^After /, 'after ') : 'immediately (no prerequisites).'}
      </p>
      <div className="flex flex-col gap-2">
        {groups.map((g, gi) => (
          <div key={g.key}>
            {gi > 0 && (
              <div className="my-2 flex items-center gap-3 text-xs font-semibold tracking-wider text-adm-review uppercase">
                <span className="h-px flex-1 bg-adm-line" /> or <span className="h-px flex-1 bg-adm-line" />
              </div>
            )}
            <div className="rounded-xl border border-adm-line bg-adm-subtle p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold tracking-wide text-adm-muted uppercase">
                  Rule {gi + 1} · {g.requirements.length > 1 ? 'all of these' : 'requires'}
                </p>
                <IconButton icon={Trash2} variant="danger-ghost" label={`Remove rule ${gi + 1}`} onClick={() => setGroups(groups.filter((_, i) => i !== gi))} />
              </div>
              <div className="flex flex-col gap-2">
                {g.requirements.map((r, ri) => (
                  <div key={ri}>
                    {ri > 0 && <p className="my-1 pl-2 text-[11px] font-semibold text-adm-muted uppercase">and</p>}
                    <RequirementRow
                      req={r}
                      selfId={level.id}
                      levels={levels.data}
                      worlds={worlds.data?.worlds ?? []}
                      achievements={achievements.data?.achievements ?? []}
                      onChange={(nr) => update(gi, (x) => ({ ...x, requirements: x.requirements.map((y, i) => (i === ri ? nr : y)) }))}
                      onRemove={() => update(gi, (x) => ({ ...x, requirements: x.requirements.filter((_, i) => i !== ri) }))}
                    />
                  </div>
                ))}
              </div>
              <Button size="sm" variant="ghost" icon={Plus} className="mt-2" onClick={() => update(gi, (x) => ({ ...x, requirements: [...x.requirements, emptyRequirement()] }))}>
                And…
              </Button>
            </div>
          </div>
        ))}
      </div>
      <Button size="sm" icon={Plus} className="mt-3" onClick={() => setGroups([...groups, emptyGroup()])}>
        {groups.length ? 'Add an alternative rule (or)' : 'Add a prerequisite'}
      </Button>
      {problems.length > 0 && dirty && (
        <Notice tone="warning" className="mt-3">
          <ul className="list-disc pl-4">
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </Notice>
      )}
      <p className="mt-4 text-xs text-adm-muted">Admins can always unlock the level manually for specific students below, whatever these rules say.</p>
    </Card>
  );
}

// ── manual overrides ────────────────────────────────────────────────────

function Overrides({ level }: { level: LevelDetail }) {
  const res = useResource(`level-access:${level.id}`, () => contentApi.levelAccess(level.id), ['access']);
  const [adding, setAdding] = useState(false);
  const [student, setStudent] = useState<{ id: string; name: string } | null>(null);
  const [reason, setReason] = useState('');
  const [busy, run] = useBusy();

  const add = () =>
    run(async () => {
      if (!student) return;
      const ok = await runAction(() => studentsApi.unlock(student.id, level.id, reason.trim() ? { reason: reason.trim() } : {}), {
        success: `${level.title} unlocked for ${student.name}.`,
        tags: ['access', 'students', 'activity'],
      });
      if (ok !== undefined) {
        setAdding(false);
        setStudent(null);
        setReason('');
      }
    });
  const clear = (o: LevelOverride) => runAction(() => studentsApi.clearAccess(o.studentId, level.id), { success: `Override removed for ${o.displayName}.`, tags: ['access', 'students', 'activity'] });
  const lock = async (o: LevelOverride) => {
    if (!(await confirmAction({ title: `Lock for ${o.displayName}?`, message: 'They cannot play this level until you unlock it again.', confirmLabel: 'Lock', danger: true }))) return;
    await runAction(() => studentsApi.lock(o.studentId, level.id, {}), { success: `Locked for ${o.displayName}.`, tags: ['access', 'students', 'activity'] });
  };

  const columns: Column<LevelOverride>[] = [
    { key: 'student', header: 'Student', cell: (o) => <RouteLink to={adminPaths.student(o.studentId, 'progress')} className="font-medium text-adm-ink hover:text-adm-accent hover:underline">{o.displayName}</RouteLink> },
    { key: 'override', header: 'Override', cell: (o) => <Badge tone={o.status === 'AVAILABLE' ? 'info' : 'danger'}>{o.status === 'AVAILABLE' ? 'Unlocked' : o.status === 'LOCKED' ? 'Locked' : o.status}</Badge> },
    { key: 'reason', header: 'Reason', cell: (o) => <span className="text-adm-body">{o.reason ?? '—'}</span> },
    { key: 'until', header: 'Until', cell: (o) => (o.expiresAt ? <span className={o.expired ? 'text-adm-faint line-through' : undefined}>{formatDate(o.expiresAt)}</span> : 'No end') },
    { key: 'by', header: 'By', cell: (o) => o.grantedBy ?? '—' },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      align: 'right',
      cell: (o) => (
        <span className="inline-flex gap-1">
          {o.status === 'AVAILABLE' && <IconButton icon={Lock} label={`Lock for ${o.displayName}`} onClick={() => void lock(o)} />}
          {o.status !== 'AVAILABLE' && <IconButton icon={Unlock} label={`Unlock for ${o.displayName}`} onClick={() => void runAction(() => studentsApi.unlock(o.studentId, level.id, {}), { success: 'Unlocked.', tags: ['access', 'students'] })} />}
          <IconButton icon={RotateCcw} label={`Remove override for ${o.displayName}`} onClick={() => void clear(o)} />
        </span>
      ),
    },
  ];

  return (
    <Card
      title="Manual unlocks for specific students"
      padded={false}
      actions={
        <Button size="sm" icon={UserPlus} onClick={() => setAdding(true)}>
          Unlock for a student
        </Button>
      }
    >
      <DataTable
        label="Student overrides"
        rows={res.data?.overrides}
        loading={res.loading}
        columns={columns}
        rowKey={(o) => o.studentId}
        empty={<EmptyState title="No manual overrides">Every student follows the unlock rules above.</EmptyState>}
      />
      <Modal
        open={adding}
        title={`Unlock “${level.title}” for a student`}
        onClose={() => setAdding(false)}
        footer={
          <>
            <Button onClick={() => setAdding(false)}>Cancel</Button>
            <Button variant="primary" busy={busy} disabled={!student} onClick={() => void add()}>
              Unlock
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Student" required>
            {() => <StudentPicker value={student} onChange={setStudent} />}
          </Field>
          <Field label="Reason" hint="Optional — recorded in the audit log.">
            {(p) => <TextInput {...p} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />}
          </Field>
        </div>
      </Modal>
    </Card>
  );
}

export function UnlockTab({ level }: { level: LevelDetail }) {
  const user = useSessionStore((s) => s.user);
  const graph = useLevelOptions();
  const curriculumId = graph.data?.levels.find((l) => l.id === level.id)?.curriculumId;
  const sameCurriculum = (graph.data?.levels ?? []).filter((l) => l.curriculumId === curriculumId);
  return (
    <div className="flex flex-col gap-5">
      <Card title="Who can play this level">
        <AccessModePicker level={level} />
      </Card>
      <RulesEditor level={level} />
      {can(user, 'levels.unlock') && <Overrides level={level} />}
      <Card title="Dependency graph" actions={<span className="text-xs text-adm-muted">This level is outlined; related levels are highlighted.</span>}>
        {graph.data ? <DependencyGraphView levels={sameCurriculum} focusId={level.id} /> : null}
      </Card>
    </div>
  );
}
