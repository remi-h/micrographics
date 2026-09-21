import { act, renderHook } from '@testing-library/react';
import { useState } from 'react';
import { initialSettings } from './data';
import type { CanvasItem, Settings } from './types';
import { useHistory, type HistorySnapshot } from './useHistory';

// The hook is a layer over state somebody else owns, so the tests stand up the
// smallest possible owner: three pieces of state and the setters that write
// them back, exactly the shape App passes in.
function useHistoryHarness(initial: HistorySnapshot) {
  const [canvasItems, setCanvasItems] = useState<CanvasItem[]>(initial.canvasItems);
  const [selectedIds, setSelectedIds] = useState<string[]>(initial.selectedIds);
  const [settings, setSettings] = useState<Settings>(initial.settings);
  const history = useHistory({ canvasItems, selectedIds, settings, setCanvasItems, setSelectedIds, setSettings });

  return { canvasItems, selectedIds, settings, setCanvasItems, setSelectedIds, setSettings, ...history };
}

function symbol(id: string, x = 100): CanvasItem {
  return { id, kind: 'symbol', mark: 'ring', rotate: 0, size: 42, x, y: 200 };
}

function setUp(initial?: Partial<HistorySnapshot>) {
  const snapshot: HistorySnapshot = {
    canvasItems: [symbol('symbol-1')],
    selectedIds: [],
    settings: initialSettings,
    ...initial,
  };

  return renderHook(() => useHistoryHarness(snapshot));
}

describe('useHistory', () => {
  it('restores the canvas, the selection and the settings an action began with', () => {
    const { result } = setUp();

    act(() => {
      result.current.beginHistoryAction();
      result.current.setCanvasItems([symbol('symbol-1'), symbol('symbol-2', 300)]);
      result.current.setSelectedIds(['symbol-2']);
      result.current.setSettings({ ...initialSettings, grid: true, paletteIndex: 3 });
    });

    expect(result.current.canvasItems).toHaveLength(2);
    expect(result.current.undoStack).toHaveLength(1);

    act(() => result.current.undo());

    expect(result.current.canvasItems).toEqual([symbol('symbol-1')]);
    expect(result.current.selectedIds).toEqual([]);
    expect(result.current.settings).toEqual(initialSettings);
    expect(result.current.undoStack).toHaveLength(0);
    expect(result.current.redoStack).toHaveLength(1);
  });

  it('re-applies the undone state on redo', () => {
    const { result } = setUp();

    act(() => {
      result.current.beginHistoryAction();
      result.current.setCanvasItems([symbol('symbol-1'), symbol('symbol-2', 300)]);
      result.current.setSelectedIds(['symbol-2']);
    });
    act(() => result.current.undo());
    act(() => result.current.redo());

    expect(result.current.canvasItems).toEqual([symbol('symbol-1'), symbol('symbol-2', 300)]);
    expect(result.current.selectedIds).toEqual(['symbol-2']);
    expect(result.current.redoStack).toHaveLength(0);
    expect(result.current.undoStack).toHaveLength(1);
  });

  it('drops the redo stack when a new action begins', () => {
    const { result } = setUp();

    act(() => {
      result.current.beginHistoryAction();
      result.current.setCanvasItems([symbol('symbol-1'), symbol('symbol-2', 300)]);
    });
    act(() => result.current.undo());
    expect(result.current.redoStack).toHaveLength(1);

    act(() => {
      result.current.beginHistoryAction();
      result.current.setCanvasItems([symbol('symbol-3', 500)]);
    });

    expect(result.current.redoStack).toHaveLength(0);
    expect(result.current.undoStack).toHaveLength(1);
  });

  it('keeps at most fifty entries, discarding the oldest', () => {
    const { result } = setUp({ canvasItems: [symbol('symbol-1', 0)] });

    // Sixty edits, each in its own commit so the hook sees the state the last
    // one left behind. The first ten snapshots should fall off the bottom.
    for (let step = 1; step <= 60; step += 1) {
      act(() => {
        result.current.beginHistoryAction();
        result.current.setCanvasItems([symbol('symbol-1', step)]);
      });
    }

    expect(result.current.undoStack).toHaveLength(50);
    // The oldest entry kept is the eleventh push, taken after ten edits.
    expect(result.current.undoStack[0].canvasItems).toEqual([symbol('symbol-1', 10)]);
    // ...and the newest is the sixtieth, taken after fifty-nine.
    expect(result.current.undoStack[49].canvasItems).toEqual([symbol('symbol-1', 59)]);

    act(() => result.current.undo());

    expect(result.current.canvasItems).toEqual([symbol('symbol-1', 59)]);
  });

  it('does nothing when there is nothing to undo or redo', () => {
    const { result } = setUp();

    act(() => result.current.undo());
    act(() => result.current.redo());

    expect(result.current.canvasItems).toEqual([symbol('symbol-1')]);
    expect(result.current.undoStack).toHaveLength(0);
    expect(result.current.redoStack).toHaveLength(0);
  });

  it('copies canvas items into a snapshot, so a later mutation cannot rewrite it', () => {
    const original = symbol('symbol-1', 100);
    const { result } = setUp({ canvasItems: [original] });

    act(() => result.current.beginHistoryAction());

    // An edit that mutates the item in place instead of replacing it: if the
    // snapshot held the same object, undo would restore the mutated one.
    act(() => {
      original.x = 999;
      result.current.setCanvasItems([symbol('symbol-2', 400)]);
    });
    act(() => result.current.undo());

    expect(result.current.canvasItems).toEqual([symbol('symbol-1', 100)]);
  });
});
