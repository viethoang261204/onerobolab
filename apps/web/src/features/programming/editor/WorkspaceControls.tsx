import { AlertCircle, AlertTriangle, CheckCircle2, Eraser, Maximize2, Minus, Plus, Redo2, Trash2, Undo2, type LucideIcon } from 'lucide-react';
import type { PointerEvent } from 'react';
import { Tooltip } from '../../../components/common/Tooltip';
import { cn } from '../../../utils/cn';
import { useMessages } from '../../i18n/i18n';
import { programmingMessages } from '../programming.messages';
import { useDragStore } from '../state/drag-store';
import { useProgramStore } from '../state/program-store';

function Tool({ icon: Icon, label, onClick, disabled }: { icon: LucideIcon; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <Tooltip label={label} side="top">
      <button
        type="button"
        aria-label={label}
        disabled={disabled}
        onClick={onClick}
        className="flex h-11 w-11 items-center justify-center rounded-[9px] text-[#cbd5e1] transition-colors hover:bg-white/10 hover:text-white active:bg-white/15 disabled:pointer-events-none disabled:opacity-30 lg:h-8 lg:w-8"
      >
        <Icon size={17} className="lg:h-4 lg:w-4" />
      </button>
    </Tooltip>
  );
}

const stop = (e: PointerEvent) => e.stopPropagation();

/** Program status, trash drop zone, undo/redo and zoom — floating over the workspace. */
export function WorkspaceControls({ zoom, onZoomIn, onZoomOut, onReset }: { zoom: number; onZoomIn: () => void; onZoomOut: () => void; onReset: () => void }) {
  const m = useMessages(programmingMessages);
  const canUndo = useProgramStore((s) => s.history.past.length > 0);
  const canRedo = useProgramStore((s) => s.history.future.length > 0);
  const undo = useProgramStore((s) => s.undo);
  const resetProgram = useProgramStore((s) => s.resetProgram);
  const hasBlocks = useProgramStore((s) => Object.keys(s.program.blocks).length > 1);
  const redo = useProgramStore((s) => s.redo);
  const errors = useProgramStore((s) => s.errorCount);
  const warnings = useProgramStore((s) => s.warningCount);
  const dragging = useDragStore((s) => s.session?.sourceId != null);
  const overTrash = useDragStore((s) => s.overTrash);

  const status =
    errors > 0
      ? { icon: AlertCircle, text: m.blocksNeedFixing({ n: errors }), cls: 'text-[#fecaca] bg-danger/15 border-danger/30' }
      : warnings > 0
        ? { icon: AlertTriangle, text: m.hintsCount({ n: warnings }), cls: 'text-[#fde68a] bg-warning/12 border-warning/30' }
        : { icon: CheckCircle2, text: m.programReady, cls: 'text-[#bbf7d0] bg-success/12 border-success/30' };
  const StatusIcon = status.icon;

  return (
    <>
      <div
        className={cn('pointer-events-none absolute right-2 top-2 flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-semibold backdrop-blur sm:right-3 sm:top-3', status.cls)}
        title={m.statusExplainTitle}
      >
        <StatusIcon size={13} />
        {status.text}
      </div>

      <div
        data-drop-delete
        title={m.trashTitle}
        className={cn(
          'absolute bottom-2 left-2 flex h-12 w-12 items-center justify-center rounded-[12px] border transition-all duration-150 sm:bottom-3 sm:left-3 lg:h-11 lg:w-11',
          overTrash ? 'scale-110 border-danger/60 bg-danger/20 text-danger' : dragging ? 'border-white/15 bg-white/5 text-[#cbd5e1]' : 'border-transparent text-faint',
        )}
      >
        <Trash2 size={22} strokeWidth={1.8} />
      </div>

      <div onPointerDown={stop} className="absolute bottom-2 right-2 flex max-w-[calc(100%-64px)] items-center gap-0.5 overflow-x-auto rounded-[12px] border border-white/8 bg-[#0b1526]/90 p-1 backdrop-blur sm:bottom-3 sm:right-3">
        <Tool
          icon={Eraser}
          label={m.clearProgramLabel}
          onClick={() => {
            // Only the blocks: level progress and the robot are untouched; undo can bring them back.
            if (hasBlocks && !window.confirm(m.clearProgramConfirm)) return;
            resetProgram();
          }}
          disabled={!hasBlocks}
        />
        <span className="mx-0.5 h-5 w-px shrink-0 bg-white/10 lg:mx-1" />
        <Tool icon={Undo2} label={m.undoLabel} onClick={undo} disabled={!canUndo} />
        <Tool icon={Redo2} label={m.redoLabel} onClick={redo} disabled={!canRedo} />
        <span className="mx-0.5 hidden h-5 w-px shrink-0 bg-white/10 sm:block lg:mx-1" />
        <div className="hidden items-center gap-0.5 sm:flex">
          <Tool icon={Minus} label={m.zoomOut} onClick={onZoomOut} />
          <button
            type="button"
            onClick={onReset}
            title={m.resetView}
            className="h-11 min-w-[44px] rounded-[9px] px-1 font-mono text-[11.5px] text-muted hover:bg-white/10 hover:text-white lg:h-8"
          >
            {zoom}%
          </button>
          <Tool icon={Plus} label={m.zoomIn} onClick={onZoomIn} />
          <Tool icon={Maximize2} label={m.resetView} onClick={onReset} />
        </div>
      </div>
    </>
  );
}
