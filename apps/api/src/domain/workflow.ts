/**
 * Publishing workflow shared by curricula, worlds, levels, lessons and
 * achievements:
 *
 *   DRAFT ──review──▶ REVIEW ──publish──▶ PUBLISHED
 *     ▲  ◀──reject───   │                    │
 *     │                 └──archive──┐        ├─unpublish─▶ DRAFT
 *     └───restore──── ARCHIVED ◀────┴────────┘ (archive)
 *
 * Nothing goes live straight from DRAFT: content is reviewed first.
 */
export const CONTENT_STATUSES = ['DRAFT', 'REVIEW', 'PUBLISHED', 'ARCHIVED'] as const;
export type ContentStatus = (typeof CONTENT_STATUSES)[number];

export type WorkflowVerb = 'REVIEW' | 'REJECT' | 'PUBLISH' | 'UNPUBLISH' | 'ARCHIVE' | 'RESTORE';

const TRANSITIONS: Readonly<Record<ContentStatus, Partial<Record<ContentStatus, WorkflowVerb>>>> = {
  DRAFT: { REVIEW: 'REVIEW', ARCHIVED: 'ARCHIVE' },
  REVIEW: { DRAFT: 'REJECT', PUBLISHED: 'PUBLISH', ARCHIVED: 'ARCHIVE' },
  PUBLISHED: { DRAFT: 'UNPUBLISH', ARCHIVED: 'ARCHIVE' },
  ARCHIVED: { DRAFT: 'RESTORE' },
};

/** The verb for `from → to`, or null when the move isn't allowed. */
export function transitionVerb(from: ContentStatus, to: ContentStatus): WorkflowVerb | null {
  return TRANSITIONS[from][to] ?? null;
}

/** Statuses reachable from `from` (for UIs and error messages). */
export const nextStatuses = (from: ContentStatus): ContentStatus[] => Object.keys(TRANSITIONS[from]) as ContentStatus[];

/** Moves that change what students can see need the publishing permission. */
export const touchesLiveContent = (from: ContentStatus, to: ContentStatus) => from === 'PUBLISHED' || to === 'PUBLISHED';
