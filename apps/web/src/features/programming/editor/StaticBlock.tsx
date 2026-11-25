import { memo, type ReactNode } from 'react';
import { getBlockDef } from '@robolab/blocks';
import type { ArgDef, BlockFragment, BlockId } from '@robolab/blocks';
import { chainIds } from '@robolab/blocks';
import { DropdownField, NumberField, TextField, VariableField } from './BlockFields';
import { BlockVisual } from './BlockVisual';

/** Read-only argument rendering (palette + drag preview). */
function StaticArg({ fragment, id, name, arg }: { fragment: BlockFragment; id: BlockId; name: string; arg: ArgDef }): ReactNode {
  const block = fragment.blocks[id];
  if (!block) return null;
  const child = block.inputs[name];
  if (child) return <StaticBlock fragment={fragment} id={child} />;
  const value = block.fields[name];
  switch (arg.kind) {
    case 'number':
      return (
        <span className="flex items-center gap-1">
          <NumberField value={value ?? ''} label={arg.label} />
          {arg.unit && <span className="text-[13px] opacity-90">{arg.unit}</span>}
        </span>
      );
    case 'dropdown':
      return <DropdownField value={String(value ?? '')} options={arg.options} label={name} />;
    case 'variable':
      return <VariableField value={String(value ?? '')} variables={[]} />;
    case 'boolean':
      return <span className="hex inline-block h-[24px] w-[46px] bg-black/25" />;
    case 'text':
      return <TextField value={String(value ?? '')} label={arg.label} />;
    case 'dataKey':
    case 'functionName':
      return <DropdownField value={String(value ?? '')} options={[]} label={name} />;
  }
}

/** Renders a block (and its nested blocks / following stack) from a detached fragment. */
export const StaticBlock = memo(function StaticBlock({ fragment, id, stack = false }: { fragment: BlockFragment; id: BlockId; stack?: boolean }) {
  const ids = stack ? chainIds(fragment.blocks, id) : [id];
  return (
    <div className="flex flex-col items-start">
      {ids.map((bid) => {
        const block = fragment.blocks[bid];
        if (!block) return null;
        return (
          <BlockVisual
            key={bid}
            block={block}
            interactive={false}
            renderArg={(name, arg) => <StaticArg fragment={fragment} id={bid} name={name} arg={arg} />}
            renderSlot={(slot) => {
              const head = block.slots[slot.name];
              return head ? <StaticBlock fragment={fragment} id={head} stack /> : null;
            }}
            {...(getBlockDef(block.type).shape !== 'reporter' && !!block.comment && {
              comment: <span className="text-[11px] text-muted">💬 {block.comment}</span>,
            })}
          />
        );
      })}
    </div>
  );
});
