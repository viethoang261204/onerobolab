import type { LessonContentType } from '../api/types';

/*
 * Content helpers: slugs, reordering, lesson kinds.
 */

/** "Cầu Treo — Bridge 2!" → "cau-treo-bridge-2" (matches the API's slug rule). */
export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '');
}

export const isSlug = (s: string) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(s) && s.length <= 80;

/** Move item `index` by `delta` (−1 up, +1 down); returns a new array, unchanged when out of range. */
export function move<T>(items: readonly T[], index: number, delta: number): T[] {
  const to = index + delta;
  if (index < 0 || index >= items.length || to < 0 || to >= items.length) return [...items];
  const copy = [...items];
  const [item] = copy.splice(index, 1);
  copy.splice(to, 0, item as T);
  return copy;
}

/** What admins pick when writing a lesson; stored as content_type + content JSON. */
export type LessonKind = 'lesson' | 'instructions' | 'tip' | 'video' | 'image';

export const LESSON_KINDS: Record<LessonKind, { label: string; help: string }> = {
  lesson: { label: 'Lesson text', help: 'Explanations with formatting (Markdown).' },
  instructions: { label: 'Instructions', help: 'Step-by-step directions for a level.' },
  tip: { label: 'Tip', help: 'A short hint or good practice.' },
  video: { label: 'Video', help: 'A link to a video (e.g. YouTube or a school server).' },
  image: { label: 'Image', help: 'A link to a picture or diagram.' },
};

export interface LessonBody {
  kind: LessonKind;
  text: string;
  url: string;
  caption: string;
}

export function lessonToBody(contentType: LessonContentType, content: Record<string, unknown>): LessonBody {
  const str = (k: string) => (typeof content[k] === 'string' ? (content[k] as string) : '');
  switch (contentType) {
    case 'VIDEO':
      return { kind: 'video', text: '', url: str('url'), caption: str('caption') };
    case 'IMAGE':
      return { kind: 'image', text: '', url: str('url'), caption: str('caption') || str('alt') };
    case 'TEXT':
      return { kind: content.variant === 'tip' ? 'tip' : 'instructions', text: str('text'), url: '', caption: '' };
    default:
      return { kind: 'lesson', text: str('markdown') || str('text'), url: '', caption: '' };
  }
}

export function bodyToLesson(b: LessonBody): { contentType: LessonContentType; content: Record<string, unknown> } {
  switch (b.kind) {
    case 'video':
      return { contentType: 'VIDEO', content: { url: b.url.trim(), ...(b.caption.trim() && { caption: b.caption.trim() }) } };
    case 'image':
      return { contentType: 'IMAGE', content: { url: b.url.trim(), ...(b.caption.trim() && { alt: b.caption.trim() }) } };
    case 'instructions':
    case 'tip':
      return { contentType: 'TEXT', content: { text: b.text, variant: b.kind } };
    case 'lesson':
      return { contentType: 'MARKDOWN', content: { markdown: b.text } };
  }
}

/** Only http(s) links are accepted for media (no javascript:, data: …). */
export const isSafeUrl = (url: string) => /^https?:\/\/[^\s]+$/i.test(url.trim());

export function lessonBodyProblem(b: LessonBody): string | null {
  if (b.kind === 'video' || b.kind === 'image') return isSafeUrl(b.url) ? null : 'Enter a link that starts with https:// (or http://).';
  return b.text.trim() ? null : 'Write the content.';
}
