export type ShortcutAction = 'runStop' | 'resetRobot' | 'focusRobot' | 'closeOverlay';

export interface KeyInput {
  readonly key: string;
  readonly ctrlKey?: boolean;
  readonly metaKey?: boolean;
  readonly altKey?: boolean;
  /** Focus is in a text field / select. */
  readonly typing?: boolean;
  /** Pointer is over the block workspace (Space pans there). */
  readonly overWorkspace?: boolean;
}

/**
 * App-level shortcuts (editor shortcuts — undo/redo/copy/delete — live in the
 * block editor). Never fires while typing.
 *   Space → Run / Stop · R → reset robot · F → focus robot · Esc → close overlay
 */
export function shortcutFor(e: KeyInput): ShortcutAction | null {
  if (e.typing || e.ctrlKey || e.metaKey || e.altKey) return null;
  switch (e.key) {
    case ' ':
    case 'Spacebar':
      return e.overWorkspace ? null : 'runStop';
    case 'r':
    case 'R':
      return 'resetRobot';
    case 'f':
    case 'F':
      return 'focusRobot';
    case 'Escape':
      return 'closeOverlay';
    default:
      return null;
  }
}
