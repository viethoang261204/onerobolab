/*
 * Puzzle-style connectors. Every stackable block shows a small socket in its
 * top edge and a tab under its bottom edge; when stacked, the upper block's
 * tab (painted above) sits in the lower block's socket.
 */

/** Tab below a block (drawn in the block's own colour). */
export function ConnectorTab({ offset = 14 }: { offset?: number }) {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute -bottom-[6px] z-10 h-[7px] w-[22px] rounded-b-[6px] bg-[var(--blk)] shadow-[0_2px_0_var(--blk-edge)]"
      style={{ left: offset }}
    />
  );
}

/** Socket notch in the top edge (visible only when nothing is connected above). */
export function ConnectorSocket({ offset = 14 }: { offset?: number }) {
  return <span aria-hidden="true" className="pointer-events-none absolute top-0 h-[6px] w-[22px] rounded-b-[6px] bg-black/30" style={{ left: offset }} />;
}
