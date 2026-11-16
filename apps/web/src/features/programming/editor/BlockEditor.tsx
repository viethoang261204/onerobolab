import { BlockWorkspace } from './BlockWorkspace';

/**
 * The block programming workspace (Blocks tab). Program state lives in
 * `program-store`; the drag overlays and shortcuts are mounted once by
 * `ProgrammingOverlays` so toolbox drags work from anywhere.
 */
export function BlockEditor() {
  return (
    <div data-editor-area className="flex min-h-0 flex-1 flex-col">
      <BlockWorkspace />
    </div>
  );
}
