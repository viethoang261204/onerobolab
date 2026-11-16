import { Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { ApiError } from '../api/client';
import { contentApi } from '../api/endpoints';
import type { Lesson } from '../api/types';
import { invalidate, useResource } from '../data/use-resource';
import { bodyToLesson, LESSON_KINDS, lessonBodyProblem, lessonToBody, slugify, type LessonBody, type LessonKind } from '../lib/content';
import { Field, Select, TextArea, TextInput } from '../ui/form';
import { confirmAction, Drawer, toast } from '../ui/overlay';
import { Button, Notice } from '../ui/primitives';
import { runAction } from './actions';
import { useLevelOptions } from './pickers';
import { WorkflowControl } from './WorkflowControl';

export interface LessonScope {
  readonly curriculumId: string;
  readonly worldId?: string | null;
  readonly levelId?: string | null;
}

/**
 * Create or edit a lesson: where it belongs (curriculum → world → level),
 * what kind it is (text, instructions, tip, video, image) and its content.
 * New lessons start as drafts and are published through the workflow.
 */
export function LessonDrawer({ open, lesson, scope, onClose }: { open: boolean; lesson: Lesson | null; scope: LessonScope | null; onClose: () => void }) {
  const curricula = useResource(open ? 'curriculums' : null, () => contentApi.curriculums(), ['curriculum']);
  const worlds = useResource(open ? 'worlds:all' : null, () => contentApi.worlds(), ['worlds']);
  const levels = useLevelOptions();

  const [form, setForm] = useState({ curriculumId: '', worldId: '', levelId: '', title: '', slug: '', description: '', slugTouched: false });
  const [body, setBody] = useState<LessonBody>({ kind: 'lesson', text: '', url: '', caption: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    if (lesson) {
      setForm({ curriculumId: lesson.curriculumId, worldId: lesson.worldId ?? '', levelId: lesson.levelId ?? '', title: lesson.title, slug: lesson.slug, description: lesson.description ?? '', slugTouched: true });
      setBody(lessonToBody(lesson.contentType, lesson.content));
    } else {
      setForm({ curriculumId: scope?.curriculumId ?? '', worldId: scope?.worldId ?? '', levelId: scope?.levelId ?? '', title: '', slug: '', description: '', slugTouched: false });
      setBody({ kind: 'lesson', text: '', url: '', caption: '' });
    }
  }, [open, lesson, scope]);

  const worldOptions = useMemo(() => (worlds.data?.worlds ?? []).filter((w) => w.curriculumId === form.curriculumId), [worlds.data, form.curriculumId]);
  const levelOptions = useMemo(() => (levels.data?.levels ?? []).filter((l) => l.worldId === form.worldId), [levels.data, form.worldId]);

  const save = async () => {
    const problems: Record<string, string> = {};
    if (!form.curriculumId) problems.curriculumId = 'Choose a curriculum.';
    if (!form.title.trim()) problems.title = 'Enter a title.';
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(form.slug)) problems.slug = 'Lower-case letters, digits and dashes.';
    const bodyProblem = lessonBodyProblem(body);
    if (bodyProblem) problems.content = bodyProblem;
    setErrors(problems);
    if (Object.keys(problems).length) return;

    const payload = {
      curriculumId: form.curriculumId,
      worldId: form.worldId || null,
      levelId: form.worldId && form.levelId ? form.levelId : null,
      title: form.title.trim(),
      slug: form.slug,
      description: form.description.trim() || null,
      ...bodyToLesson(body),
    };
    setBusy(true);
    try {
      if (lesson) await contentApi.updateLesson(lesson.id, payload);
      else await contentApi.createLesson(payload);
      toast(lesson ? 'Lesson saved.' : 'Lesson created as a draft.');
      invalidate('lessons');
      onClose();
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) setErrors({ slug: 'Another lesson in this curriculum uses this slug.' });
      else if (e instanceof ApiError && Object.keys(e.fieldErrors()).length) setErrors(e.fieldErrors());
      else setErrors({ _: e instanceof ApiError ? e.message : 'Could not save the lesson.' });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!lesson || !(await confirmAction({ title: `Delete “${lesson.title}”?`, message: 'The lesson is removed for everyone. This is recorded in the audit log.', confirmLabel: 'Delete lesson', danger: true }))) return;
    const ok = await runAction(() => contentApi.deleteLesson(lesson.id), { success: 'Lesson deleted.', tags: ['lessons'] });
    if (ok !== undefined) onClose();
  };

  const media = body.kind === 'video' || body.kind === 'image';
  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={640}
      title={lesson ? `Edit lesson` : 'New lesson'}
      subtitle={lesson?.title}
      footer={
        <>
          {lesson && (
            <Button variant="danger-ghost" icon={Trash2} className="mr-auto" onClick={() => void remove()}>
              Delete
            </Button>
          )}
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" busy={busy} onClick={() => void save()}>
            {lesson ? 'Save lesson' : 'Create lesson'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {errors._ && <Notice tone="danger">{errors._}</Notice>}
        {lesson && (
          <div className="rounded-lg border border-adm-line bg-adm-subtle p-3">
            <p className="mb-2 text-xs font-medium text-adm-muted">Publishing</p>
            <WorkflowControl kind="lessons" id={lesson.id} status={lesson.status} name={lesson.title} onChanged={onClose} />
          </div>
        )}
        <fieldset className="grid grid-cols-3 gap-3">
          <legend className="mb-2 text-[13px] font-medium text-adm-ink">Where it belongs</legend>
          <Field label="Curriculum" required error={errors.curriculumId}>
            {(p) => (
              <Select {...p} value={form.curriculumId} onChange={(e) => setForm({ ...form, curriculumId: e.target.value, worldId: '', levelId: '' })}>
                <option value="">Choose…</option>
                {curricula.data?.curriculums.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="World" hint="Optional">
            {(p) => (
              <Select {...p} value={form.worldId} disabled={!form.curriculumId} onChange={(e) => setForm({ ...form, worldId: e.target.value, levelId: '' })}>
                <option value="">Whole curriculum</option>
                {worldOptions.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Level" hint="Optional">
            {(p) => (
              <Select {...p} value={form.levelId} disabled={!form.worldId} onChange={(e) => setForm({ ...form, levelId: e.target.value })}>
                <option value="">Whole world</option>
                {levelOptions.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.title}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </fieldset>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Title" required error={errors.title}>
            {(p) => (
              <TextInput
                {...p}
                maxLength={160}
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value, slug: form.slugTouched ? form.slug : slugify(e.target.value) })}
              />
            )}
          </Field>
          <Field label="Slug" required error={errors.slug} hint="Used in links.">
            {(p) => <TextInput {...p} className="font-mono" maxLength={80} value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value, slugTouched: true })} />}
          </Field>
        </div>
        <Field label="Short description" hint="Optional — shown in lesson lists.">
          {(p) => <TextInput {...p} maxLength={2000} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />}
        </Field>
        <Field label="Type" hint={LESSON_KINDS[body.kind].help}>
          {(p) => (
            <Select {...p} value={body.kind} onChange={(e) => setBody({ ...body, kind: e.target.value as LessonKind })}>
              {(Object.keys(LESSON_KINDS) as LessonKind[]).map((k) => (
                <option key={k} value={k}>
                  {LESSON_KINDS[k].label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        {media ? (
          <div className="grid grid-cols-2 gap-3">
            <Field label={body.kind === 'video' ? 'Video link' : 'Image link'} required error={errors.content}>
              {(p) => <TextInput {...p} type="url" placeholder="https://" value={body.url} onChange={(e) => setBody({ ...body, url: e.target.value })} />}
            </Field>
            <Field label={body.kind === 'video' ? 'Caption' : 'Alt text'} hint={body.kind === 'image' ? 'Describe the picture for screen readers.' : undefined}>
              {(p) => <TextInput {...p} maxLength={300} value={body.caption} onChange={(e) => setBody({ ...body, caption: e.target.value })} />}
            </Field>
          </div>
        ) : (
          <Field label="Content" required error={errors.content} hint={body.kind === 'lesson' ? 'Markdown: **bold**, lists with “-”, headings with “#”.' : undefined}>
            {(p) => <TextArea {...p} rows={body.kind === 'tip' ? 4 : 12} value={body.text} onChange={(e) => setBody({ ...body, text: e.target.value })} className="font-mono text-[13px]" />}
          </Field>
        )}
      </div>
    </Drawer>
  );
}
