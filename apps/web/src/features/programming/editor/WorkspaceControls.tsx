import { AlertCircle, AlertTriangle, CheckCircle2, Eraser, Maximize2, Minus, Plus, Redo2, Trash2, Undo2, type LucideIcon } from 'lucide-react';
import type { PointerEvent } from 'react';
import { Tooltip } from '../../../components/common/Tooltip';
import { cn } from '../../../utils/cn';
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
      className="flex h-8 w-8 items-center justify-center rounded-[9px] text-[#cbd5e1] transition-colors hover:bg-white/10 hover:text-white disabled:pointer-events-none disabled:opacity-30"
    >
      <Icon size={16} />
    </button>
    </Tooltip>
  );
}

const stop = (e: PointerEvent) => e.stopPropagation();

/** Program status, trash drop zone, undo/redo and zoom — floating over the workspace. */
export function WorkspaceControls({ zoom, onZoomIn, onZoomOut, onReset }: { zoom: number; onZoomIn: () => void; onZoomOut: () => void; onReset: () => void }) {
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
      ? { icon: AlertCircle, text: `${errors} ${errors === 1 ? 'block needs' : 'blocks need'} fixing`, cls: 'text-[#fecaca] bg-danger/15 border-danger/30' }
      : warnings > 0
        ? { icon: AlertTriangle, text: `${warnings} ${warnings === 1 ? 'hint' : 'hints'}`, cls: 'text-[#fde68a] bg-warning/12 border-warning/30' }
        : { icon: CheckCircle2, text: 'Program ready', cls: 'text-[#bbf7d0] bg-success/12 border-success/30' };
  const StatusIcon = status.icon;

  return (
    <>
      <div
        className={cn('pointer-events-none absolute right-3 top-3 flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-semibold backdrop-blur', status.cls)}
        title="Selected blocks explain their problem next to them."
      >
        <StatusIcon size={13} />
        {status.text}
      </div>

      <div
        data-drop-delete
        title="Drag a block here to delete it"
        className={cn(
          'absolute bottom-3 left-3 flex h-11 w-11 items-center justify-center rounded-[12px] border transition-all duration-150',
          overTrash ? 'scale-110 border-danger/60 bg-danger/20 text-danger' : dragging ? 'border-white/15 bg-white/5 text-[#cbd5e1]' : 'border-transparent text-faint',
        )}
      >
        <Trash2 size={22} strokeWidth={1.8} />
      </div>

      <div onPointerDown={stop} className="absolute bottom-3 right-3 flex items-center gap-0.5 rounded-[12px] border border-white/8 bg-[#0b1526]/90 p-1 backdrop-blur">
        <Tool
          icon={Eraser}
          label="Clear program (blocks only)"
          onClick={() => {
            // Only the blocks: level progress and the robot are untouched; undo can bring them back.
            if (hasBlocks && !window.confirm('Reset your program? All blocks except “when program starts” will be removed. (You can undo this.)')) return;
            resetProgram();
          }}
          disabled={!hasBlocks}
        />
        <span className="mx-1 h-5 w-px bg-white/10" />
        <Tool icon={Undo2} label="Undo (Ctrl+Z)" onClick={undo} disabled={!canUndo} />
        <Tool icon={Redo2} label="Redo (Ctrl+Shift+Z)" onClick={redo} disabled={!canRedo} />
        <span className="mx-1 h-5 w-px bg-white/10" />
        <Tool icon={Minus} label="Zoom out" onClick={onZoomOut} />
        <button type="button" onClick={onReset} title="Reset view" className="h-8 min-w-[44px] rounded-[9px] px-1 font-mono text-[11.5px] text-muted hover:bg-white/10 hover:text-white">
          {zoom}%
        </button>
        <Tool icon={Plus} label="Zoom in" onClick={onZoomIn} />
        <Tool icon={Maximize2} label="Reset view" onClick={onReset} />
      </div>
    </>
  );
}
