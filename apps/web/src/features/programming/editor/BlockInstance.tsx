import { memo, useEffect, useRef, useState, type ReactNode } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { ArgDef, BlockId } from '@robolab/blocks';
import { chainIds } from '@robolab/blocks';
import { useRuntimeStore } from '../../simulator/runtime/runtime-store';
import { useDragStore } from '../state/drag-store';
import { useProgramStore } from '../state/program-store';
import { playSnap } from './block-actions';
import { BlockComment } from './BlockComment';
import { BlockContextMenu } from './BlockContextMenu';
import { DropdownField, NumberField, TextField, VariableField } from './BlockFields';
import { useFunctionNames, useMissionDataKeys } from './field-options';
import { BlockVisual } from './BlockVisual';
import { startBlockDrag } from './drag-controller';

/** A vertical stack of workspace blocks (follows `next`). */
export const StackView = memo(function StackView({ headId }: { headId: BlockId }) {
  const ids = useProgramStore(useShallow((s) => chainIds(s.program.blocks, headId)));
  return (
    <div className="flex flex-col items-start">
      {ids.map((id) => (
        <BlockInstance key={id} id={id} />
      ))}
    </div>
  );
});

/** Argument socket that can also receive a value block. */
function ArgSlot({ blockId, name, arg }: { blockId: BlockId; name: string; arg: ArgDef }): ReactNode {
  const child = useProgramStore((s) => s.program.blocks[blockId]?.inputs[name] ?? null);
  const value = useProgramStore((s) => s.program.blocks[blockId]?.fields[name]);
  const variables = useProgramStore((s) => s.program.variables);
  const updateField = useProgramStore((s) => s.updateField);
  const addVariable = useProgramStore((s) => s.addVariable);
  const functions = useFunctionNames(arg.kind === 'functionName');
  const dataKeys = useMissionDataKeys(arg.kind === 'dataKey');

  const socket = (content: ReactNode, check: 'number' | 'boolean') => (
    <span data-conn="input" data-block-id={blockId} data-input={name} data-check={check} className="flex items-center">
      {content}
    </span>
  );

  switch (arg.kind) {
    case 'number':
      return (
        <span className="flex items-center gap-1">
          {socket(
            child ? (
              <BlockInstance id={child} />
            ) : (
              <NumberField
                label={arg.label}
                value={value ?? ''}
                invalid={typeof value !== 'number'}
                onChange={(v) => updateField(blockId, name, v)}
              />
            ),
            'number',
          )}
          {arg.unit && !child && <span className="text-[13px] opacity-90">{arg.unit}</span>}
        </span>
      );
    case 'boolean':
      return socket(
        child ? <BlockInstance id={child} /> : <span title="Drop a yes/no block here" className="hex inline-block h-[26px] w-[50px] bg-black/30" />,
        'boolean',
      );
    case 'dropdown':
      return <DropdownField label={name} value={String(value ?? '')} options={arg.options} onChange={(v) => updateField(blockId, name, v)} />;
    case 'variable':
      return (
        <VariableField
          value={String(value ?? '')}
          variables={variables}
          invalid={!variables.includes(String(value ?? ''))}
          onChange={(v) => updateField(blockId, name, v)}
          onCreate={addVariable}
        />
      );
    case 'text':
      return <TextField label={arg.label} value={String(value ?? '')} onChange={(v) => updateField(blockId, name, v)} />;
    case 'functionName':
      return (
        <DropdownField
          label="Function"
          value={String(value ?? '')}
          options={functions.map((f) => ({ value: f, label: f }))}
          invalid={!functions.includes(String(value ?? ''))}
          onChange={(v) => updateField(blockId, name, v)}
        />
      );
    case 'dataKey':
      return (
        <DropdownField
          label="Mission value"
          value={String(value ?? '')}
          options={dataKeys.map((k) => ({ value: k, label: k }))}
          invalid={!dataKeys.includes(String(value ?? ''))}
          onChange={(v) => updateField(blockId, name, v)}
        />
      );
  }
}

/**
 * One block on the workspace. Subscribes only to its own data, selection,
 * issue and ghost state, so edits elsewhere don't re-render it.
 */
export const BlockInstance = memo(function BlockInstance({ id }: { id: BlockId }) {
  const block = useProgramStore((s) => s.program.blocks[id]);
  const selected = useProgramStore((s) => s.selectedId === id);
  const issue = useProgramStore((s) => s.issues[id]);
  const snapSeq = useProgramStore((s) => (s.snap?.id === id ? s.snap.seq : 0));
  const ghost = useDragStore((s) => !!s.session?.chain.has(id));
  // Execution highlight: only the blocks whose flag flips re-render.
  const running = useRuntimeStore((s) => s.activeBlockId === id);
  const failed = useRuntimeStore((s) => s.errorBlockId === id);
  const [editingComment, setEditingComment] = useState(false);
  const rowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (snapSeq) playSnap(rowRef.current);
  }, [snapSeq]);

  if (!block) return null;

  const hasComment = block.comment !== undefined || editingComment;
  return (
    <BlockVisual
      block={block}
      interactive
      selected={selected}
      issue={issue}
      ghost={ghost}
      running={running}
      failed={failed}
      rowRef={rowRef}
      onPointerDown={(e) => startBlockDrag(e, { kind: 'workspace', id })}
      renderArg={(name, arg) => <ArgSlot blockId={id} name={name} arg={arg} />}
      renderSlot={(slot) => {
        const head = block.slots[slot.name];
        return head ? (
          <StackView headId={head} />
        ) : (
          <div className="flex h-[26px] items-center rounded-md border border-dashed border-white/15 px-2 font-sans text-[11px] text-white/35">drop blocks here</div>
        );
      }}
      {...(hasComment && {
        comment: <BlockComment id={id} text={block.comment ?? ''} editing={editingComment} onDone={() => setEditingComment(false)} />,
      })}
      {...(selected && !ghost && { menu: <BlockContextMenu block={block} onComment={() => setEditingComment(true)} /> })}
    />
  );
});
