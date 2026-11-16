import { BookOpen, FileText, Image as ImageIcon, Lightbulb, ListChecks, Pencil, Plus, Video } from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { RouteLink } from '../../../router/RouteLink';
import { adminPaths } from '../../admin-routes';
import { ApiError } from '../../api/client';
import { contentApi } from '../../api/endpoints';
import type { Curriculum, Lesson, World } from '../../api/types';
import { runAction } from '../../components/actions';
import { LessonDrawer, type LessonScope } from '../../components/LessonDrawer';
import { useLevelOptions } from '../../components/pickers';
import { ReorderButtons } from '../../components/ReorderButtons';
import { StatusBadge, WorkflowControl } from '../../components/WorkflowControl';
import { invalidate, useResource } from '../../data/use-resource';
import { lessonToBody, LESSON_KINDS, move, slugify, type LessonKind } from '../../lib/content';
import { formatDate } from '../../lib/format';
import { can } from '../../session/access';
import { useSessionStore } from '../../session/session-store';
import { Field, TextArea, TextInput } from '../../ui/form';
import { PageHeader, Tabs } from '../../ui/layout';
import { Modal, toast } from '../../ui/overlay';
import { Badge, Button, Card, EmptyState, ErrorState, IconButton, Notice, Spinner } from '../../ui/primitives';

// ── curriculum form ─────────────────────────────────────────────────────

function CurriculumModal({ open, curriculum, onClose }: { open: boolean; curriculum: Curriculum | null; onClose: () => void }) {
  const [form, setForm] = useState({ name: '', slug: '', description: '', thumbnail: '', slugTouched: false });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    setErrors({});
    setForm(
      curriculum
        ? { name: curriculum.name, slug: curriculum.slug, description: curriculum.description ?? '', thumbnail: curriculum.thumbnail ?? '', slugTouched: true }
        : { name: '', slug: '', description: '', thumbnail: '', slugTouched: false },
    );
  }, [open, curriculum]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const body = { name: form.name.trim(), slug: form.slug, description: form.description.trim() || null, thumbnail: form.thumbnail.trim() || null };
    setBusy(true);
    try {
      if (curriculum) await contentApi.updateCurriculum(curriculum.id, body);
      else await contentApi.createCurriculum(body);
      toast(curriculum ? 'Curriculum saved.' : 'Curriculum created as a draft.');
      invalidate('curriculum');
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) setErrors({ slug: 'This slug is already used.' });
      else if (err instanceof ApiError) setErrors({ ...err.fieldErrors(), ...(Object.keys(err.fieldErrors()).length ? {} : { _: err.message }) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      title={curriculum ? 'Edit curriculum' : 'New curriculum'}
      description={curriculum ? undefined : 'New curricula start as drafts. Publish them through review when they are ready.'}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" form="curriculum-form" busy={busy} disabled={!form.name.trim() || !form.slug}>
            {curriculum ? 'Save' : 'Create curriculum'}
          </Button>
        </>
      }
    >
      <form id="curriculum-form" onSubmit={submit} className="grid grid-cols-2 gap-4">
        {errors._ && <Notice tone="danger" className="col-span-2">{errors._}</Notice>}
        <Field label="Name" required error={errors.name}>
          {(p) => <TextInput {...p} data-autofocus maxLength={120} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value, slug: form.slugTouched ? form.slug : slugify(e.target.value) })} />}
        </Field>
        <Field label="Slug" required error={errors.slug}>
          {(p) => <TextInput {...p} className="font-mono" maxLength={80} value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value, slugTouched: true })} />}
        </Field>
        <Field label="Description" className="col-span-2" error={errors.description}>
          {(p) => <TextArea {...p} rows={3} maxLength={4000} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />}
        </Field>
        <Field label="Thumbnail URL" className="col-span-2" hint="Optional image link." error={errors.thumbnail}>
          {(p) => <TextInput {...p} type="url" placeholder="https://" value={form.thumbnail} onChange={(e) => setForm({ ...form, thumbnail: e.target.value })} />}
        </Field>
      </form>
    </Modal>
  );
}

// ── curricula tab ───────────────────────────────────────────────────────

function CurriculaTab() {
  const curricula = useResource('curriculums', () => contentApi.curriculums(), ['curriculum']);
  const worlds = useResource('worlds:all', () => contentApi.worlds(), ['worlds']);
  const [editing, setEditing] = useState<Curriculum | null>(null);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);

  const list = curricula.data?.curriculums ?? [];
  const reorder = async (index: number, delta: -1 | 1) => {
    setBusy(true);
    await runAction(() => contentApi.orderCurriculums(move(list, index, delta).map((c) => c.id)), { success: 'Order saved.', tags: ['curriculum'] });
    setBusy(false);
  };

  if (curricula.error) return <ErrorState error={curricula.error} onRetry={curricula.reload} />;
  if (!curricula.data) return <Spinner />;
  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button variant="primary" icon={Plus} onClick={() => setCreating(true)}>
          New curriculum
        </Button>
      </div>
      {list.length === 0 ? (
        <Card>
          <EmptyState icon={BookOpen} title="No curricula yet" />
        </Card>
      ) : (
        <ol className="flex flex-col gap-4">
          {list.map((c, i) => {
            const own = (worlds.data?.worlds ?? []).filter((w) => w.curriculumId === c.id);
            return (
              <li key={c.id}>
                <Card
                  title={
                    <div className="flex min-w-0 items-center gap-3">
                      <ReorderButtons index={i} count={list.length} onMove={(d) => void reorder(i, d)} label={c.name} disabled={busy} />
                      <div className="min-w-0">
                        <h2 className="truncate text-[15px] font-semibold text-adm-ink">{c.name}</h2>
                        <p className="font-mono text-xs text-adm-muted">{c.slug}</p>
                      </div>
                    </div>
                  }
                  actions={
                    <>
                      <WorkflowControl kind="curriculums" id={c.id} status={c.status} name={c.name} />
                      <IconButton icon={Pencil} label={`Edit ${c.name}`} onClick={() => setEditing(c)} />
                    </>
                  }
                >
                  {c.description && <p className="mb-3 max-w-3xl text-sm text-adm-body">{c.description}</p>}
                  <p className="mb-2 text-xs font-semibold tracking-wide text-adm-muted uppercase">Worlds ({own.length})</p>
                  {own.length === 0 ? (
                    <p className="text-sm text-adm-faint">No worlds yet.</p>
                  ) : (
                    <ol className="flex flex-wrap gap-2">
                      {own.map((w, wi) => (
                        <li key={w.id}>
                          <RouteLink
                            to={`${adminPaths.worlds()}?curriculum=${c.id}`}
                            className="inline-flex items-center gap-2 rounded-lg border border-adm-line bg-adm-subtle px-3 py-1.5 text-sm text-adm-ink hover:border-adm-accent/40"
                          >
                            <span className="tabular text-xs text-adm-faint">{wi + 1}</span>
                            <span className="h-2.5 w-2.5 rounded-full" style={{ background: w.accentColor ?? 'var(--color-adm-faint)' }} aria-hidden />
                            {w.name}
                            <span className="text-xs text-adm-muted">{w.levelCount} levels</span>
                            {w.status !== 'PUBLISHED' && <StatusBadge status={w.status} />}
                          </RouteLink>
                        </li>
                      ))}
                    </ol>
                  )}
                  <p className="mt-3 text-xs text-adm-faint">Updated {formatDate(c.updatedAt)}</p>
                </Card>
              </li>
            );
          })}
        </ol>
      )}
      <CurriculumModal open={creating || !!editing} curriculum={editing} onClose={() => (setCreating(false), setEditing(null))} />
    </>
  );
}

// ── lessons tab: Curriculum → World → Level → Lesson ────────────────────

const KIND_ICON: Record<LessonKind, typeof FileText> = { lesson: FileText, instructions: ListChecks, tip: Lightbulb, video: Video, image: ImageIcon };

function LessonRow({ lesson, onOpen }: { lesson: Lesson; onOpen: (l: Lesson) => void }) {
  const kind = lessonToBody(lesson.contentType, lesson.content).kind;
  const Icon = KIND_ICON[kind];
  return (
    <li>
      <button type="button" onClick={() => onOpen(lesson)} className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm hover:bg-adm-accent-soft/60">
        <Icon className="h-4 w-4 text-adm-muted" aria-hidden />
        <span className="flex-1 truncate text-adm-ink">{lesson.title}</span>
        <span className="text-xs text-adm-muted">{LESSON_KINDS[kind].label}</span>
        <StatusBadge status={lesson.status} />
      </button>
    </li>
  );
}

function AddLesson({ scope, onAdd, label }: { scope: LessonScope; onAdd: (s: LessonScope) => void; label: string }) {
  return (
    <button type="button" onClick={() => onAdd(scope)} className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium text-adm-accent hover:bg-adm-accent-soft" aria-label={label}>
      <Plus className="h-3.5 w-3.5" aria-hidden /> Lesson
    </button>
  );
}

export function LessonsTree({ onlyLevelId }: { onlyLevelId?: string }) {
  const curricula = useResource('curriculums', () => contentApi.curriculums(), ['curriculum']);
  const worlds = useResource('worlds:all', () => contentApi.worlds(), ['worlds']);
  const levels = useLevelOptions();
  const lessons = useResource('lessons:all', () => contentApi.lessons(), ['lessons']);
  const [open, setOpen] = useState<{ lesson: Lesson | null; scope: LessonScope | null } | null>(null);

  const byParent = useMemo(() => {
    const m = new Map<string, Lesson[]>();
    for (const l of lessons.data?.lessons ?? []) {
      const key = l.levelId ?? l.worldId ?? l.curriculumId;
      m.set(key, [...(m.get(key) ?? []), l]);
    }
    return m;
  }, [lessons.data]);

  const error = curricula.error ?? worlds.error ?? lessons.error ?? levels.error;
  if (error) return <ErrorState error={error} onRetry={() => (curricula.reload(), worlds.reload(), lessons.reload())} />;
  if (!curricula.data || !worlds.data || !lessons.data || !levels.data) return <Spinner />;

  const openLesson = (lesson: Lesson) => setOpen({ lesson, scope: null });
  const add = (scope: LessonScope) => setOpen({ lesson: null, scope });
  const list = (key: string) => (byParent.get(key) ?? []).map((l) => <LessonRow key={l.id} lesson={l} onOpen={openLesson} />);

  // In the level editor: just this level's lessons.
  if (onlyLevelId) {
    const level = levels.data.levels.find((l) => l.id === onlyLevelId);
    const own = byParent.get(onlyLevelId) ?? [];
    return (
      <Card title="Lessons for this level" actions={level && <Button size="sm" icon={Plus} onClick={() => add({ curriculumId: level.curriculumId, worldId: level.worldId, levelId: level.id })}>New lesson</Button>}>
        {own.length ? <ul className="flex flex-col">{list(onlyLevelId)}</ul> : <EmptyState title="No lessons for this level yet">Lessons appear to students next to the mission once published.</EmptyState>}
        <LessonDrawer open={!!open} lesson={open?.lesson ?? null} scope={open?.scope ?? null} onClose={() => setOpen(null)} />
      </Card>
    );
  }

  return (
    <>
      <Notice tone="info" className="mb-4">
        Lessons attach to a curriculum, a world or a single level. New lessons start as drafts; send them for review and publish them when ready.
      </Notice>
      <div className="flex flex-col gap-4">
        {curricula.data.curriculums.map((c) => {
          const cWorlds = worlds.data!.worlds.filter((w) => w.curriculumId === c.id);
          return (
            <Card
              key={c.id}
              title={
                <span className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-adm-accent" aria-hidden />
                  <span className="text-sm font-semibold text-adm-ink">{c.name}</span>
                  <StatusBadge status={c.status} />
                </span>
              }
              actions={<AddLesson scope={{ curriculumId: c.id }} onAdd={add} label={`Add a lesson to ${c.name}`} />}
            >
              <ul className="flex flex-col">{list(c.id)}</ul>
              <ol className="mt-1 flex flex-col gap-2">
                {cWorlds.map((w: World) => {
                  const wLevels = levels.data!.levels.filter((l) => l.worldId === w.id);
                  const count = (byParent.get(w.id)?.length ?? 0) + wLevels.reduce((n, l) => n + (byParent.get(l.id)?.length ?? 0), 0);
                  return (
                    <li key={w.id} className="rounded-lg border border-adm-line">
                      <div className="flex items-center gap-2 border-b border-adm-line bg-adm-subtle px-3 py-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: w.accentColor ?? 'var(--color-adm-faint)' }} aria-hidden />
                        <span className="text-sm font-medium text-adm-ink">{w.name}</span>
                        <Badge>{count} lessons</Badge>
                        <span className="ml-auto">
                          <AddLesson scope={{ curriculumId: c.id, worldId: w.id }} onAdd={add} label={`Add a lesson to ${w.name}`} />
                        </span>
                      </div>
                      <div className="px-2 py-1.5">
                        <ul className="flex flex-col">{list(w.id)}</ul>
                        <ul className="flex flex-col">
                          {wLevels.map((l) => (
                            <li key={l.id} className="py-0.5 pl-3">
                              <div className="flex items-center gap-2 py-1 text-[13px] text-adm-muted">
                                <span aria-hidden>↳</span>
                                <RouteLink to={adminPaths.level(l.id, 'lessons')} className="text-adm-body hover:text-adm-accent hover:underline">
                                  {l.title}
                                </RouteLink>
                                <AddLesson scope={{ curriculumId: c.id, worldId: w.id, levelId: l.id }} onAdd={add} label={`Add a lesson to ${l.title}`} />
                              </div>
                              <ul className="flex flex-col pl-5">{list(l.id)}</ul>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </Card>
          );
        })}
      </div>
      <LessonDrawer open={!!open} lesson={open?.lesson ?? null} scope={open?.scope ?? null} onClose={() => setOpen(null)} />
    </>
  );
}

export function CurriculumPage({ tab }: { tab: 'curricula' | 'lessons' }) {
  const user = useSessionStore((s) => s.user);
  const canCurricula = can(user, 'curriculum.manage');
  const canLessons = can(user, 'content.manage');
  const active = tab === 'lessons' && canLessons ? 'lessons' : canCurricula ? 'curricula' : 'lessons';
  return (
    <>
      <PageHeader title="Curriculum" subtitle="Curricula group worlds; worlds group levels; lessons explain the ideas at any level of the tree." />
      <Tabs
        label="Curriculum sections"
        active={active}
        tabs={[
          ...(canCurricula ? [{ id: 'curricula' as const, label: 'Curricula', href: adminPaths.curriculum() }] : []),
          ...(canLessons ? [{ id: 'lessons' as const, label: 'Lessons', href: adminPaths.lessons() }] : []),
        ]}
      />
      {active === 'curricula' ? <CurriculaTab /> : <LessonsTree />}
    </>
  );
}
