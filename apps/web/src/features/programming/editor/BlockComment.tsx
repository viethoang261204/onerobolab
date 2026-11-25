import { MessageSquare, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import type { BlockId } from '@robolab/blocks';
import { useMessages } from '../../i18n/i18n';
import { programmingMessages } from '../programming.messages';
import { useProgramStore } from '../state/program-store';

interface BlockCommentProps {
  id: BlockId;
  text: string;
  editing: boolean;
  onDone: () => void;
}

/** Subtle note attached to a block ("Move toward the blue checkpoint"). */
export function BlockComment({ id, text, editing, onDone }: BlockCommentProps) {
  const m = useMessages(programmingMessages);
  const setComment = useProgramStore((s) => s.setComment);
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (editing) ref.current?.focus();
  }, [editing]);

  if (editing) {
    return (
      <div className="flex items-start gap-1 rounded-lg border border-white/10 bg-[#101c30] p-1.5 shadow-lg" onPointerDown={(e) => e.stopPropagation()}>
        <MessageSquare size={13} className="mt-1 shrink-0 text-muted" />
        <textarea
          ref={ref}
          value={text}
          rows={2}
          placeholder={m.commentPlaceholder}
          onChange={(e) => setComment(id, e.target.value)}
          onBlur={() => {
            if (!text.trim()) setComment(id, null);
            onDone();
          }}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Escape' || (e.key === 'Enter' && !e.shiftKey)) e.currentTarget.blur();
          }}
          className="w-[190px] resize-none bg-transparent font-sans text-[12px] leading-snug text-text outline-none placeholder:text-faint"
        />
        <button
          type="button"
          aria-label={m.removeComment}
          title={m.removeComment}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setComment(id, null)}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-faint hover:bg-white/10 hover:text-danger"
        >
          <X size={14} />
        </button>
      </div>
    );
  }
  if (!text) return null;
  return (
    <div className="flex max-w-[220px] items-start gap-1.5 rounded-lg bg-white/[0.06] px-2 py-1 font-sans text-[12px] leading-snug text-[#cbd5e1]">
      <MessageSquare size={12} className="mt-[2px] shrink-0 text-muted" />
      <span>{text}</span>
    </div>
  );
}
