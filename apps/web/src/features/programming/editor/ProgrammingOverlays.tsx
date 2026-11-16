import { DragPreview } from './DragPreview';
import { DropIndicator } from './DropIndicator';
import { useEditorShortcuts } from './use-editor-shortcuts';

/** App-level pieces of the editor: drag preview, drop indicator, keyboard shortcuts. */
export function ProgrammingOverlays() {
  useEditorShortcuts();
  return (
    <>
      <DropIndicator />
      <DragPreview />
    </>
  );
}
