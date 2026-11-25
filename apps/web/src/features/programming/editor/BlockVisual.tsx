import { AlertCircle, AlertTriangle, Flag, Lock, Play } from 'lucide-react';
import type { CSSProperties, MouseEvent, PointerEvent, ReactNode, Ref } from 'react';
import { cn } from '../../../utils/cn';
import { START_ID, categoryOf } from '@robolab/blocks';
import type { ArgDef, BlockInstance, BlockIssue, SlotDef } from '@robolab/blocks';
import { useLocale, useMessages } from '../../i18n/i18n';
import { localizedBlockDef } from '../blocks-vi';
import { localizeBlockIssue, programmingMessages } from '../programming.messages';
import { ConnectorSocket, ConnectorTab } from './BlockConnection';

export interface BlockVisualProps {
  block: BlockInstance;
  /** Workspace blocks expose connection points and interaction; static ones don't. */
  interactive: boolean;
  selected?: boolean;
  issue?: BlockIssue | undefined;
  /** Ghosted while its stack is being dragged. */
  ghost?: boolean;
  /** Renders an argument (field editor, socket, or nested value block). */
  renderArg: (name: string, arg: ArgDef) => ReactNode;
  /** Renders the stack inside a C-block slot. */
  renderSlot?: (slot: SlotDef) => ReactNode;
  onPointerDown?: (e: PointerEvent<HTMLElement>) => void;
  onContextMenu?: (e: MouseEvent<HTMLElement>) => void;
  /** Floating action menu (selected block). */
  menu?: ReactNode;
  /** Comment bubble below the block. */
  comment?: ReactNode;
  rowRef?: Ref<HTMLDivElement>;
  /** This block is executing right now (runtime highlight). */
  running?: boolean;
  /** The run stopped on this block (crash / runtime error / compile error). */
  failed?: boolean;
}

const text = 'font-display text-[14.5px] font-extrabold leading-none text-white [text-shadow:0_1px_0_rgb(0_0_0/0.2)] whitespace-nowrap';

export const blockColors = (block: BlockInstance): CSSProperties => {
  const color = categoryOf(block.type).color;
  return { ['--blk' as string]: color, ['--blk-edge' as string]: `color-mix(in srgb, ${color} 70%, black)` };
};

function IssueBadge({ issue, message }: { issue: BlockIssue; message: string }) {
  if (issue.severity === 'info') return null;
  const Icon = issue.severity === 'error' ? AlertCircle : AlertTriangle;
  return (
    <span
      title={message}
      className={cn(
        'ml-1 flex h-[20px] w-[20px] shrink-0 items-center justify-center rounded-full',
        issue.severity === 'error' ? 'bg-danger text-white' : 'bg-warning text-[#3b2400]',
      )}
    >
      <Icon size={13} strokeWidth={2.6} />
    </span>
  );
}

/**
 * Pure block renderer (shape, colours, connectors, labels). Used for the
 * workspace, the toolbox palette and the drag preview. It knows nothing
 * about the robot — blocks only describe the program.
 */
export function BlockVisual(props: BlockVisualProps) {
  const { block, interactive, selected, issue, ghost, renderArg, renderSlot, onPointerDown, onContextMenu, menu, comment, rowRef, running, failed } = props;
  const locale = useLocale();
  const m = useMessages(programmingMessages);
  const def = localizedBlockDef(block.type, locale);
  const isStart = block.id === START_ID;
  const issueMessage = issue ? localizeBlockIssue(issue.message, locale) : undefined;

  const parts = def.template.map((part, i) =>
    typeof part === 'string' ? (
      <span key={i} className="px-0.5">
        {part}
      </span>
    ) : (
      <span key={i} className="flex items-center">
        {renderArg(part.arg, def.args[part.arg] as ArgDef)}
      </span>
    ),
  );

  const state = cn(
    running && 'blk-running outline outline-[3px] outline-offset-2 outline-[#4ade80]',
    !running && failed && 'blk-failed outline outline-[3px] outline-offset-2 outline-danger',
    !running && !failed && selected && 'outline outline-[2.5px] outline-offset-2 outline-cyan shadow-[0_0_22px_-2px_rgb(34_211_238/0.75)]',
    !running && !failed && !selected && issue?.severity === 'error' && 'outline outline-2 outline-offset-1 outline-danger',
    !selected && interactive && 'hover:brightness-[1.08]',
    issue?.severity === 'info' && 'opacity-70 saturate-[0.6]',
    block.disabled && 'blk-disabled',
  );
  const surface = 'bg-[var(--blk)] shadow-[inset_0_-3px_0_var(--blk-edge),inset_0_1px_0_rgb(255_255_255/0.25),0_3px_8px_-4px_rgb(0_0_0/0.6)]';
  const showMessage = interactive && selected && issue && issue.severity !== 'info';
  const helpTitle = issueMessage ?? def.help;

  // ── Value blocks: round (number) or hexagonal (boolean) ──
  if (def.shape === 'reporter' || def.shape === 'boolean') {
    const hex = def.shape === 'boolean';
    return (
      <span
        data-block-root={block.id}
        className={cn('relative inline-flex', ghost && 'opacity-35', selected && 'drop-shadow-[0_0_6px_rgb(34_211_238)]')}
        title={helpTitle}
      >
        <span
          ref={rowRef as unknown as Ref<HTMLSpanElement>}
          onPointerDown={onPointerDown}
          onContextMenu={onContextMenu}
          className={cn(
            'inline-flex h-[34px] lg:h-[32px] items-center gap-1 select-none',
            hex ? 'hex px-4' : 'rounded-full px-2.5',
            surface,
            text,
            interactive && 'cursor-grab touch-none active:cursor-grabbing',
            issue?.severity === 'error' && !selected && 'ring-2 ring-danger',
            block.disabled && 'blk-disabled',
          )}
          style={blockColors(block)}
        >
          {parts}
        </span>
        {menu}
      </span>
    );
  }

  const hasNext = def.hasNext;
  const conn = interactive && hasNext ? { 'data-conn': 'after', 'data-block-id': block.id } : {};
  const row = (extra: string, children: ReactNode, tab: boolean) => (
    <div
      ref={rowRef}
      onPointerDown={onPointerDown}
      onContextMenu={onContextMenu}
      title={helpTitle}
      className={cn(
        'relative flex min-h-[44px] lg:min-h-[40px] items-center gap-1 py-1.5 pl-3 pr-3 select-none',
        surface,
        text,
        interactive && 'touch-none',
        interactive && !isStart && 'cursor-grab active:cursor-grabbing',
        state,
        extra,
      )}
    >
      {def.shape !== 'hat' && <ConnectorSocket />}
      {isStart && <Flag size={16} strokeWidth={2.6} className="mr-1 text-[#3b2400]" />}
      {children}
      {isStart && (
        <span title={m.startBlockLockHint} className="ml-1 flex items-center text-[#3b2400]/70">
          <Lock size={12} strokeWidth={2.6} />
        </span>
      )}
      {issue && issueMessage && <IssueBadge issue={issue} message={issueMessage} />}
      {tab && <ConnectorTab offset={def.shape === 'c' ? 30 : 14} />}
      {(running || failed) && (
        <span
          aria-label={running ? m.runningNow : m.stoppedHere}
          className={cn(
            'absolute -left-[26px] top-1/2 flex h-[20px] w-[20px] -translate-y-1/2 items-center justify-center rounded-full text-white shadow-lg',
            running ? 'bg-[#22c55e] shadow-[0_0_12px_#4ade80]' : 'bg-danger',
          )}
        >
          {running ? <Play size={11} strokeWidth={3} fill="currentColor" /> : <AlertCircle size={13} strokeWidth={2.8} />}
        </span>
      )}
    </div>
  );

  // Comment + problem message float to the right so stack geometry never changes.
  const side = (comment || showMessage) && (
    <div className={cn('absolute left-full ml-3 flex w-max max-w-[230px] flex-col items-start gap-1.5', menu ? 'top-1 lg:top-[44px]' : 'top-1')}>
      {comment}
      {showMessage && (
        <div className={cn('rounded-md px-2 py-1 font-sans text-[11.5px] font-medium leading-snug shadow', issue?.severity === 'error' ? 'bg-[#3a1119] text-[#fecdd3]' : 'bg-[#3a2a0c] text-[#fde68a]')}>
          {issueMessage}
        </div>
      )}
    </div>
  );

  // ── C-block: header, slots with arms, footer ──
  if (def.shape === 'c') {
    return (
      <div data-block-root={block.id} {...conn} className={cn('relative flex w-fit flex-col items-start', ghost && 'opacity-35')} style={blockColors(block)}>
        {row('rounded-t-[10px] rounded-br-[10px] min-w-[180px]', parts, true)}
        {def.slots?.map((slot) => (
          <div key={slot.name} className="flex flex-col items-start">
            {slot.label && (
              <div className={cn('relative flex h-[32px] min-w-[180px] items-center rounded-r-[10px] pl-3', surface, text, block.disabled && 'blk-disabled')}>
                {slot.label}
                <ConnectorTab offset={30} />
              </div>
            )}
            <div className="flex">
              <div className={cn('w-[16px] shrink-0 bg-[var(--blk)] shadow-[inset_-2px_0_0_var(--blk-edge)]', block.disabled && 'blk-disabled')} />
              <div
                {...(interactive && { 'data-conn': 'slot', 'data-block-id': block.id, 'data-slot': slot.name })}
                className="relative flex min-h-[36px] min-w-[140px] flex-col py-[5px] pl-[2px]"
              >
                {renderSlot?.(slot)}
              </div>
            </div>
          </div>
        ))}
        <div className={cn('relative h-[18px] w-[150px] rounded-b-[10px] rounded-tr-[10px]', surface, block.disabled && 'blk-disabled')}>
          {hasNext && <ConnectorTab />}
        </div>
        {side}
        {menu}
      </div>
    );
  }

  // ── Hat and statement blocks ──
  return (
    <div data-block-root={block.id} {...conn} className={cn('relative flex w-fit flex-col items-start', ghost && 'opacity-35')} style={blockColors(block)}>
      {def.shape === 'hat' && <div aria-hidden="true" className="h-[12px] w-[72px] rounded-t-[40px] bg-[var(--blk)]" />}
      {row(def.shape === 'hat' ? 'rounded-b-[10px] rounded-tr-[14px]' : 'rounded-[10px]', parts, hasNext)}
      {side}
      {menu}
    </div>
  );
}
