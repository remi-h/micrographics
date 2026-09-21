import { useEffect, useRef, useState, type RefObject } from 'react';
import type { CanvasItem, Settings } from './types';

// Undo/redo for the editor.
//
// One history entry is the whole editable document — the canvas items, the
// selection and the settings — because the actions that push an entry change
// several of them at once (choosing a template replaces the items and the
// settings and clears the selection), so restoring any one of them alone would
// leave the others describing a different drawing.
//
// The hook does not own that state: `App` does, and the plan is for the canvas
// state to move to its own hook next. So this takes the current values plus
// the setters that write them back, which keeps history a layer over whoever
// holds the state rather than a second home for it.

export type HistorySnapshot = {
  canvasItems: CanvasItem[];
  selectedIds: string[];
  settings: Settings;
};

export type UseHistoryOptions = HistorySnapshot & {
  setCanvasItems: (canvasItems: CanvasItem[]) => void;
  setSelectedIds: (selectedIds: string[]) => void;
  setSettings: (settings: Settings) => void;
};

export type History = {
  /** Records the state as of this moment, so the action about to run can be undone. */
  beginHistoryAction: () => void;
  undo: () => void;
  redo: () => void;
  /**
   * The stacks, for reading only: what is on them decides whether undo and
   * redo do anything. `undo` and `redo` close over the stacks of the render
   * that created them, so anything holding on to one of them past that render
   * — a listener bound once, say — has to call the latest render's copy and
   * not the one it captured. `useKeyboardShortcuts` does that with an effect
   * event.
   */
  undoStack: HistorySnapshot[];
  redoStack: HistorySnapshot[];
  /**
   * The values the last render was given, kept current so a snapshot taken at
   * call time is the state the user is acting on rather than the state a
   * handler happened to close over when it was created.
   */
  stateRef: RefObject<HistorySnapshot>;
};

// Deep enough for any session's worth of edits while still bounded: fifty
// snapshots of a full canvas is a few hundred kilobytes at most.
const HISTORY_LIMIT = 50;

function pushCapped(stack: HistorySnapshot[], snapshot: HistorySnapshot) {
  return [...stack.slice(-(HISTORY_LIMIT - 1)), snapshot];
}

export function useHistory({
  canvasItems,
  selectedIds,
  settings,
  setCanvasItems,
  setSelectedIds,
  setSettings,
}: UseHistoryOptions): History {
  const [undoStack, setUndoStack] = useState<HistorySnapshot[]>([]);
  const [redoStack, setRedoStack] = useState<HistorySnapshot[]>([]);
  const stateRef = useRef<HistorySnapshot>({ canvasItems, selectedIds, settings });

  useEffect(() => {
    stateRef.current = { canvasItems, selectedIds, settings };
  }, [canvasItems, selectedIds, settings]);

  // Copied one level deep: the arrays are rebuilt and every item is cloned, so
  // an edit that mutates an item in place cannot reach back into a snapshot
  // already on a stack and rewrite what undo will restore.
  const currentSnapshot = (): HistorySnapshot => ({
    canvasItems: stateRef.current.canvasItems.map((item) => ({ ...item })),
    selectedIds: [...stateRef.current.selectedIds],
    settings: { ...stateRef.current.settings },
  });

  const beginHistoryAction = () => {
    const snapshot = currentSnapshot();
    setUndoStack((current) => pushCapped(current, snapshot));
    setRedoStack([]);
  };

  const restoreSnapshot = (snapshot: HistorySnapshot) => {
    setSettings(snapshot.settings);
    setCanvasItems(snapshot.canvasItems);
    setSelectedIds(snapshot.selectedIds);
  };

  const undo = () => {
    if (undoStack.length === 0) return;
    const previous = undoStack[undoStack.length - 1];
    setUndoStack((current) => current.slice(0, -1));
    setRedoStack((current) => pushCapped(current, currentSnapshot()));
    restoreSnapshot(previous);
  };

  const redo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setRedoStack((current) => current.slice(0, -1));
    setUndoStack((current) => pushCapped(current, currentSnapshot()));
    restoreSnapshot(next);
  };

  return { beginHistoryAction, redo, redoStack, stateRef, undo, undoStack };
}
