import { act, fireEvent, renderHook } from '@testing-library/react';
import { useState } from 'react';
import { initialSettings } from './data';
import type { CanvasItem, CanvasSymbol, Settings } from './types';
import { useCanvasItems } from './useCanvasItems';
import { useHistory } from './useHistory';
import { useKeyboardShortcuts, type UseKeyboardShortcutsOptions } from './useKeyboardShortcuts';

// Two harnesses, because the hook has two things worth pinning.
//
// `setUp` hands it spies, so each key press can be checked against the exact
// action it is supposed to run, with the arguments it is supposed to pass.
//
// `setUpLive` wires it to the real `useHistory` and `useCanvasItems` over state
// a component owns, exactly as `App` does, because the failure this hook exists
// to prevent is invisible to spies: `undo` closes over the undo stack of the
// render that made it, so a listener that keeps the first render's copy undoes
// once and then silently does nothing.

function symbol(id: string, x = 100, rotate = 0): CanvasSymbol {
  return { id, kind: 'symbol', mark: 'ring', rotate, size: 42, x, y: 200 };
}

function spyActions() {
  return {
    beginHistoryAction: jest.fn(),
    copySelected: jest.fn(),
    cutSelected: jest.fn(),
    duplicateSelected: jest.fn(),
    groupSelected: jest.fn(),
    nudgeSelected: jest.fn(),
    pasteClipboard: jest.fn(),
    redo: jest.fn(),
    removeSelected: jest.fn(),
    resetCanvasZoom: jest.fn(),
    rotateItems: jest.fn(),
    setSelectedIds: jest.fn(),
    undo: jest.fn(),
    ungroupSelected: jest.fn(),
    zoomCanvas: jest.fn(),
  } satisfies Omit<UseKeyboardShortcutsOptions, 'canvasItems' | 'selectedIds'>;
}

function setUp(initial: { canvasItems?: CanvasItem[]; selectedIds?: string[] } = {}) {
  const actions = spyActions();
  const canvasItems = initial.canvasItems ?? [symbol('symbol-1'), symbol('symbol-2', 300)];
  const selectedIds = initial.selectedIds ?? ['symbol-1'];
  const view = renderHook(() => useKeyboardShortcuts({ canvasItems, selectedIds, ...actions }));

  return { ...view, actions };
}

// Returns false when the handler called preventDefault, which is what
// dispatchEvent reports for a cancelled event.
function press(key: string, init: KeyboardEventInit = {}, target: Window | Element = window) {
  return fireEvent.keyDown(target, { key, ...init });
}

// An element of the given tag, in the document so its keydown reaches window.
function fieldOfType(tagName: string) {
  const field = document.createElement(tagName);
  document.body.append(field);
  return field;
}

function useLiveHarness(initial: { canvasItems: CanvasItem[]; selectedIds: string[] }) {
  const [canvasItems, setCanvasItems] = useState<CanvasItem[]>(initial.canvasItems);
  const [selectedIds, setSelectedIds] = useState<string[]>(initial.selectedIds);
  const [settings, setSettings] = useState<Settings>(initialSettings);
  const [canvasZoom, setCanvasZoom] = useState(1);
  const history = useHistory({ canvasItems, selectedIds, settings, setCanvasItems, setSelectedIds, setSettings });
  const canvas = useCanvasItems({
    beginHistoryAction: history.beginHistoryAction,
    canvasItems,
    selectedIds,
    setCanvasItems,
    setSelectedIds,
    visibleCanvasRect: () => null,
  });

  useKeyboardShortcuts({
    beginHistoryAction: history.beginHistoryAction,
    canvasItems,
    copySelected: canvas.copySelected,
    cutSelected: canvas.cutSelected,
    duplicateSelected: canvas.duplicateSelected,
    groupSelected: canvas.groupSelected,
    nudgeSelected: canvas.nudgeSelected,
    pasteClipboard: canvas.pasteClipboard,
    redo: history.redo,
    removeSelected: canvas.removeSelected,
    resetCanvasZoom: () => setCanvasZoom(1),
    rotateItems: canvas.rotateItems,
    selectedIds,
    setSelectedIds,
    undo: history.undo,
    ungroupSelected: canvas.ungroupSelected,
    zoomCanvas: (delta: number) => setCanvasZoom((current) => current + delta),
  });

  return { canvasItems, canvasZoom, selectedIds, setCanvasItems, setSelectedIds, setSettings, settings, ...history };
}

function setUpLive(initial: { canvasItems?: CanvasItem[]; selectedIds?: string[] } = {}) {
  return renderHook(() =>
    useLiveHarness({
      canvasItems: initial.canvasItems ?? [symbol('symbol-1')],
      selectedIds: initial.selectedIds ?? [],
    }),
  );
}

function itemById(items: CanvasItem[], id: string) {
  const found = items.find((item) => item.id === id);
  if (!found) throw new Error(`expected an item with id ${id}`);
  return found;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('useKeyboardShortcuts typing guard', () => {
  it.each(['input', 'textarea', 'select'])('ignores keys typed into a %s', (tagName) => {
    const { actions } = setUp();
    const field = fieldOfType(tagName);

    press('Delete', {}, field);
    press('z', { ctrlKey: true }, field);
    press('ArrowLeft', {}, field);
    press('a', { ctrlKey: true }, field);

    expect(actions.removeSelected).not.toHaveBeenCalled();
    expect(actions.undo).not.toHaveBeenCalled();
    expect(actions.nudgeSelected).not.toHaveBeenCalled();
    expect(actions.setSelectedIds).not.toHaveBeenCalled();
  });

  it('still handles a key pressed with a non-field element focused', () => {
    const { actions } = setUp();

    press('Delete', {}, fieldOfType('button'));

    expect(actions.removeSelected).toHaveBeenCalledTimes(1);
  });
});

describe('useKeyboardShortcuts modifier shortcuts', () => {
  it.each([
    ['ctrl', { ctrlKey: true }],
    ['meta', { metaKey: true }],
  ])('accepts %s as the modifier', (_name, modifier) => {
    const { actions } = setUp();

    press('z', modifier);
    press('z', { ...modifier, shiftKey: true });
    press('y', modifier);
    press('c', modifier);
    press('x', modifier);
    press('v', modifier);
    press('d', modifier);
    press('0', modifier);

    expect(actions.undo).toHaveBeenCalledTimes(1);
    expect(actions.redo).toHaveBeenCalledTimes(2);
    expect(actions.copySelected).toHaveBeenCalledTimes(1);
    expect(actions.cutSelected).toHaveBeenCalledTimes(1);
    expect(actions.pasteClipboard).toHaveBeenCalledTimes(1);
    expect(actions.duplicateSelected).toHaveBeenCalledTimes(1);
    expect(actions.resetCanvasZoom).toHaveBeenCalledTimes(1);
  });

  it('matches shortcut keys whatever their case', () => {
    const { actions } = setUp();

    press('Z', { ctrlKey: true });
    press('C', { ctrlKey: true });

    expect(actions.undo).toHaveBeenCalledTimes(1);
    expect(actions.copySelected).toHaveBeenCalledTimes(1);
  });

  it('selects every item on the canvas', () => {
    const { actions } = setUp();

    press('a', { ctrlKey: true });

    expect(actions.setSelectedIds).toHaveBeenCalledWith(['symbol-1', 'symbol-2']);
  });

  it('zooms in on either key that shares the plus, and out on either that shares the minus', () => {
    const { actions } = setUp();

    press('=', { ctrlKey: true });
    press('+', { ctrlKey: true });
    press('-', { ctrlKey: true });
    press('_', { ctrlKey: true });

    expect(actions.zoomCanvas.mock.calls).toEqual([[0.1], [0.1], [-0.1], [-0.1]]);
  });

  it('leaves an unmodified letter alone, so typing on the canvas is not a shortcut', () => {
    const { actions } = setUp();

    expect(press('z')).toBe(true);
    expect(press('a')).toBe(true);
    expect(press('k', { ctrlKey: true })).toBe(true);

    expect(actions.undo).not.toHaveBeenCalled();
    expect(actions.setSelectedIds).not.toHaveBeenCalled();
  });
});

describe('useKeyboardShortcuts selection shortcuts', () => {
  it.each(['Delete', 'Backspace'])('removes the selection on %s', (key) => {
    const { actions } = setUp();

    press(key);

    expect(actions.removeSelected).toHaveBeenCalledTimes(1);
  });

  it('clears the selection on Escape without cancelling the event', () => {
    const { actions } = setUp();

    // Escape is the one handled key the editor does not claim: it must stay
    // available to whatever else is listening for it.
    expect(press('Escape')).toBe(true);
    expect(actions.setSelectedIds).toHaveBeenCalledWith([]);
  });

  it('cancels the browser default for the keys it claims', () => {
    setUp();

    expect(press('Delete')).toBe(false);
    expect(press('a', { ctrlKey: true })).toBe(false);
    expect(press('ArrowLeft')).toBe(false);
    expect(press(']')).toBe(false);
  });
});

describe('useKeyboardShortcuts rotate', () => {
  it('rotates the selection by 15 degrees, or 45 with shift', () => {
    const { actions } = setUp({
      canvasItems: [symbol('symbol-1', 100, 30), symbol('symbol-2', 300, 0)],
      selectedIds: ['symbol-1'],
    });

    press(']');
    press(']', { shiftKey: true });
    press('[');
    press('[', { shiftKey: true });

    // Only the selected item is rotated, and always from its own current angle.
    expect(actions.rotateItems.mock.calls).toEqual([
      [[{ id: 'symbol-1', rotate: 45 }]],
      [[{ id: 'symbol-1', rotate: 75 }]],
      [[{ id: 'symbol-1', rotate: 15 }]],
      [[{ id: 'symbol-1', rotate: -15 }]],
    ]);
  });

  it('takes a history snapshot before rotating, because the pointer path cannot have taken one', () => {
    const { actions } = setUp();

    press(']');

    expect(actions.beginHistoryAction).toHaveBeenCalledTimes(1);
    expect(actions.beginHistoryAction.mock.invocationCallOrder[0]).toBeLessThan(
      actions.rotateItems.mock.invocationCallOrder[0],
    );
  });
});

describe('useKeyboardShortcuts nudge', () => {
  it('nudges by one unit, or ten with shift', () => {
    const { actions } = setUp();

    press('ArrowLeft');
    press('ArrowRight');
    press('ArrowUp');
    press('ArrowDown');
    press('ArrowLeft', { shiftKey: true });
    press('ArrowRight', { shiftKey: true });
    press('ArrowUp', { shiftKey: true });
    press('ArrowDown', { shiftKey: true });

    expect(actions.nudgeSelected.mock.calls).toEqual([
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
      [-10, 0],
      [10, 0],
      [0, -10],
      [0, 10],
    ]);
  });

  it('leaves the history snapshot to nudgeSelected', () => {
    const { actions } = setUp();

    press('ArrowLeft');

    // The asymmetry is deliberate: nudgeSelected snapshots for itself, while
    // rotateItems does not because the pointer handlers snapshot on
    // pointer-down. The keyboard must not add a second entry here.
    expect(actions.beginHistoryAction).not.toHaveBeenCalled();
  });
});

describe('useKeyboardShortcuts listener lifetime', () => {
  it('stops handling keys once the component is gone', () => {
    const { actions, unmount } = setUp();

    press('Delete');
    unmount();
    press('Delete');
    press('z', { ctrlKey: true });

    expect(actions.removeSelected).toHaveBeenCalledTimes(1);
    expect(actions.undo).not.toHaveBeenCalled();
  });

  it('binds the window listener exactly once, however often the state it reads changes', () => {
    const addEventListener = jest.spyOn(window, 'addEventListener');
    const removeEventListener = jest.spyOn(window, 'removeEventListener');
    const keydownCalls = (spy: jest.SpyInstance) => spy.mock.calls.filter(([type]) => type === 'keydown').length;

    try {
      const { result, unmount } = setUpLive();

      act(() => result.current.setCanvasItems([symbol('symbol-1'), symbol('symbol-2', 300)]));
      act(() => result.current.setSelectedIds(['symbol-2']));
      act(() => result.current.beginHistoryAction());

      expect(keydownCalls(addEventListener)).toBe(1);
      expect(keydownCalls(removeEventListener)).toBe(0);

      unmount();
      expect(keydownCalls(removeEventListener)).toBe(1);
    } finally {
      addEventListener.mockRestore();
      removeEventListener.mockRestore();
    }
  });
});

describe('useKeyboardShortcuts against live history and canvas state', () => {
  it('keeps undoing from the keyboard after the first press', () => {
    const { result } = setUpLive();

    act(() => {
      result.current.beginHistoryAction();
      result.current.setCanvasItems([symbol('symbol-1'), symbol('symbol-2', 300)]);
    });
    expect(result.current.canvasItems).toHaveLength(2);

    press('z', { ctrlKey: true });
    expect(result.current.canvasItems).toEqual([symbol('symbol-1')]);

    act(() => {
      result.current.beginHistoryAction();
      result.current.setCanvasItems([symbol('symbol-1'), symbol('symbol-3', 500)]);
    });
    expect(result.current.canvasItems).toHaveLength(2);

    // The press that matters. `undo` closes over the undo stack of the render
    // that created it, so a listener still holding the one from before the
    // first undo restores nothing here and keyboard undo dies silently.
    press('z', { ctrlKey: true });
    expect(result.current.canvasItems).toEqual([symbol('symbol-1')]);
    expect(result.current.undoStack).toHaveLength(0);
    // One, not two: the second beginHistoryAction dropped what the first undo
    // had put on the redo stack.
    expect(result.current.redoStack).toHaveLength(1);
  });

  it('undoes an action that changed neither the canvas nor the selection', () => {
    const { result } = setUpLive();

    act(() => {
      result.current.beginHistoryAction();
      result.current.setSettings({ ...initialSettings, grid: true });
    });
    expect(result.current.settings.grid).toBe(true);

    // Nothing the shortcuts themselves read has changed here — only the undo
    // stack has — so a listener that re-binds on the canvas and the selection
    // alone is holding an empty stack and this press does nothing.
    press('z', { ctrlKey: true });
    expect(result.current.settings).toEqual(initialSettings);
  });

  it('redoes from the keyboard after an undo', () => {
    const { result } = setUpLive();

    act(() => {
      result.current.beginHistoryAction();
      result.current.setCanvasItems([symbol('symbol-1'), symbol('symbol-2', 300)]);
    });
    press('z', { ctrlKey: true });
    press('z', { ctrlKey: true, shiftKey: true });

    expect(result.current.canvasItems).toEqual([symbol('symbol-1'), symbol('symbol-2', 300)]);
  });

  it('acts on state that changed in the render immediately before the key press', () => {
    const { result } = setUpLive({ canvasItems: [symbol('symbol-1'), symbol('symbol-2', 300)] });

    // Selection first: the nudge that follows has to see it, not the empty
    // selection the listener was bound with.
    act(() => result.current.setSelectedIds(['symbol-2']));
    press('ArrowRight');

    expect(itemById(result.current.canvasItems, 'symbol-2').x).toBe(301);
    expect(itemById(result.current.canvasItems, 'symbol-1').x).toBe(100);

    // And an item added after binding is still selectable with select-all.
    act(() => result.current.setCanvasItems((current) => [...current, symbol('symbol-3', 500)]));
    press('a', { ctrlKey: true });

    expect(result.current.selectedIds).toEqual(['symbol-1', 'symbol-2', 'symbol-3']);
  });

  it('deletes the live selection and restores it with undo', () => {
    const { result } = setUpLive({ canvasItems: [symbol('symbol-1'), symbol('symbol-2', 300)] });

    act(() => result.current.setSelectedIds(['symbol-1']));
    press('Delete');
    expect(result.current.canvasItems).toEqual([symbol('symbol-2', 300)]);

    press('z', { ctrlKey: true });
    expect(result.current.canvasItems).toEqual([symbol('symbol-1'), symbol('symbol-2', 300)]);
  });

  it('zooms through the handlers it is given', () => {
    const { result } = setUpLive();

    press('=', { ctrlKey: true });
    expect(result.current.canvasZoom).toBeCloseTo(1.1);

    press('-', { ctrlKey: true });
    expect(result.current.canvasZoom).toBeCloseTo(1);

    press('=', { ctrlKey: true });
    press('0', { ctrlKey: true });
    expect(result.current.canvasZoom).toBe(1);
  });
});
