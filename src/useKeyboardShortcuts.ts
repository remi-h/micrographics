import { useEffect, useEffectEvent } from 'react';
import type { CanvasItem } from './types';

// The editor's global keyboard shortcuts: one `keydown` listener on `window`,
// covering undo/redo, delete, escape, select-all, the clipboard, duplicate,
// zoom, `[`/`]` rotate and arrow-key nudge.
//
// Like `useHistory` and `useCanvasItems`, this owns no state. It is handed the
// current canvas items and selection plus the actions to run, because the
// actions live in those two hooks and the state still lives in `App`.
//
// Staleness is the whole problem this hook has to solve. `undo` and `redo`
// close over the undo/redo stacks from the render that created them, and every
// other action closes over the canvas items and the selection from its own
// render. A listener registered once with the handlers of the first render
// would therefore go on undoing against an empty stack forever: keyboard undo
// would work once and then quietly stop.
//
// `App` used to solve that by re-binding the listener whenever the state the
// handlers read changed, with an `exhaustive-deps` suppression because the
// handlers themselves — new function objects every render — could not go in
// the dependency array. This uses React 19.2's `useEffectEvent` instead
// (see node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md,
// "React 19.2"). The event is non-reactive: it always sees the latest render's
// props, so the listener binds once on mount, never re-binds, and cannot read
// a stale stack no matter which values change. Nothing is left for the
// dependency array to get wrong, so the suppression is gone with it.
export type UseKeyboardShortcutsOptions = {
  canvasItems: CanvasItem[];
  selectedIds: string[];
  setSelectedIds: (selectedIds: string[]) => void;
  /** Records the pre-mutation state, so the action about to run can be undone. */
  beginHistoryAction: () => void;
  copySelected: () => void;
  cutSelected: () => void;
  duplicateSelected: () => void;
  groupSelected: () => void;
  nudgeSelected: (dx: number, dy: number) => void;
  pasteClipboard: () => void;
  redo: () => void;
  removeSelected: () => void;
  resetCanvasZoom: () => void;
  rotateItems: (updates: Array<{ id: string; rotate: number }>) => void;
  undo: () => void;
  ungroupSelected: () => void;
  zoomCanvas: (delta: number) => void;
};

export function useKeyboardShortcuts({
  beginHistoryAction,
  canvasItems,
  copySelected,
  cutSelected,
  duplicateSelected,
  groupSelected,
  nudgeSelected,
  pasteClipboard,
  redo,
  removeSelected,
  resetCanvasZoom,
  rotateItems,
  selectedIds,
  setSelectedIds,
  undo,
  ungroupSelected,
  zoomCanvas,
}: UseKeyboardShortcutsOptions): void {
  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    const target = event.target as HTMLElement | null;
    const isEditing = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.tagName === 'SELECT';
    if (isEditing) return;

    // Rotating from the keyboard takes its own history snapshot. The pointer
    // path does not: MicrographicSvg calls beginHistoryAction on pointer-down,
    // so one drag is one entry rather than one per frame. Nudging is the same
    // asymmetry, handled inside nudgeSelected.
    const rotateSelected = (delta: number) => {
      beginHistoryAction();
      rotateItems(
        canvasItems
          .filter((item) => selectedIds.includes(item.id))
          .map((item) => ({ id: item.id, rotate: item.rotate + delta })),
      );
    };

    const modifier = event.metaKey || event.ctrlKey;
    if (modifier && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      if (event.shiftKey) redo();
      else undo();
    } else if (modifier && event.key.toLowerCase() === 'y') {
      event.preventDefault();
      redo();
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      removeSelected();
    } else if (event.key === 'Escape') {
      setSelectedIds([]);
    } else if (modifier && event.key.toLowerCase() === 'a') {
      event.preventDefault();
      setSelectedIds(canvasItems.map((item) => item.id));
    } else if (modifier && event.key.toLowerCase() === 'c') {
      event.preventDefault();
      copySelected();
    } else if (modifier && event.key.toLowerCase() === 'x') {
      event.preventDefault();
      cutSelected();
    } else if (modifier && event.key.toLowerCase() === 'v') {
      event.preventDefault();
      pasteClipboard();
    } else if (modifier && event.key.toLowerCase() === 'd') {
      event.preventDefault();
      duplicateSelected();
    } else if (modifier && event.key.toLowerCase() === 'g') {
      // Cmd/Ctrl+G groups, with Shift to take one apart, as every other
      // drawing tool binds it.
      event.preventDefault();
      if (event.shiftKey) ungroupSelected();
      else groupSelected();
    } else if (modifier && (event.key === '=' || event.key === '+')) {
      event.preventDefault();
      zoomCanvas(0.1);
    } else if (modifier && (event.key === '-' || event.key === '_')) {
      event.preventDefault();
      zoomCanvas(-0.1);
    } else if (modifier && event.key === '0') {
      event.preventDefault();
      resetCanvasZoom();
    } else if (event.key === '[') {
      event.preventDefault();
      rotateSelected(event.shiftKey ? -45 : -15);
    } else if (event.key === ']') {
      event.preventDefault();
      rotateSelected(event.shiftKey ? 45 : 15);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      nudgeSelected(event.shiftKey ? -10 : -1, 0);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      nudgeSelected(event.shiftKey ? 10 : 1, 0);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      nudgeSelected(0, event.shiftKey ? -10 : -1);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      nudgeSelected(0, event.shiftKey ? 10 : 1);
    }
  });

  useEffect(() => {
    // Wrapped rather than registered directly: an effect event is only ever
    // called, never handed to anything that outlives the effect.
    const handleKeyDown = (event: KeyboardEvent) => onKeyDown(event);

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
}
