import { act, renderHook } from '@testing-library/react';
import { useState } from 'react';
import { hitBounds, intersects, type Box } from './canvasGeometry';
import type { CanvasItem, CanvasSymbol, CanvasText } from './types';
import { MAX_ITEM_SIZE, MIN_ITEM_SIZE, useCanvasItems } from './useCanvasItems';

// Like useHistory, the hook is a layer over state App owns, so the tests stand
// up the smallest possible owner: the two pieces of state and their setters,
// exactly the shape App passes in. `beginHistoryAction` is a spy, and the
// visible artboard rectangle is a stub, since the real one measures DOM nodes
// that only the layout has.
function useCanvasHarness(initial: { canvasItems: CanvasItem[]; selectedIds: string[] }, options: { beginHistoryAction: () => void; visible: Box | null }) {
  const [canvasItems, setCanvasItems] = useState<CanvasItem[]>(initial.canvasItems);
  const [selectedIds, setSelectedIds] = useState<string[]>(initial.selectedIds);
  const canvas = useCanvasItems({
    beginHistoryAction: options.beginHistoryAction,
    canvasItems,
    selectedIds,
    setCanvasItems,
    setSelectedIds,
    visibleCanvasRect: () => options.visible,
  });

  return { canvasItems, selectedIds, setCanvasItems, setSelectedIds, ...canvas };
}

function symbol(id: string, x = 100, y = 200, size = 42): CanvasSymbol {
  return { id, kind: 'symbol', mark: 'ring', rotate: 0, size, x, y };
}

function text(id: string, x = 100, y = 200, size = 42): CanvasText {
  return { id, kind: 'text', rotate: 0, size, text: 'MICRO', x, y };
}

function setUp(initial: { canvasItems?: CanvasItem[]; selectedIds?: string[] } = {}, visible: Box | null = null) {
  const beginHistoryAction = jest.fn();
  const start = { canvasItems: initial.canvasItems ?? [symbol('symbol-1')], selectedIds: initial.selectedIds ?? [] };
  const view = renderHook(() => useCanvasHarness(start, { beginHistoryAction, visible }));

  return { ...view, beginHistoryAction };
}

function itemById(items: CanvasItem[], id: string) {
  const found = items.find((item) => item.id === id);
  if (!found) throw new Error(`expected an item with id ${id}`);
  return found;
}

describe('useCanvasItems moving', () => {
  it('clamps a move to the canvas bounds', () => {
    const { result } = setUp();

    act(() => result.current.moveItem('symbol-1', 5000, -500));

    expect(itemById(result.current.canvasItems, 'symbol-1')).toMatchObject({ x: 1148, y: 48 });
  });

  it('moves the whole selection when one of its items is dragged', () => {
    const { result } = setUp({
      canvasItems: [symbol('symbol-1', 100), symbol('symbol-2', 300), symbol('symbol-3', 700)],
      selectedIds: ['symbol-1', 'symbol-2'],
    });

    act(() => result.current.moveItem('symbol-1', 150, 260));

    expect(itemById(result.current.canvasItems, 'symbol-1')).toMatchObject({ x: 150, y: 260 });
    expect(itemById(result.current.canvasItems, 'symbol-2')).toMatchObject({ x: 350, y: 260 });
    // Not selected, so the drag leaves it alone.
    expect(itemById(result.current.canvasItems, 'symbol-3')).toMatchObject({ x: 700, y: 200 });
  });

  it('nudges by the step it is given, including the larger shift step', () => {
    const { result } = setUp({ canvasItems: [symbol('symbol-1', 500, 400)], selectedIds: ['symbol-1'] });

    act(() => result.current.nudgeSelected(-1, 0));
    expect(itemById(result.current.canvasItems, 'symbol-1')).toMatchObject({ x: 499, y: 400 });

    act(() => result.current.nudgeSelected(0, -10));
    expect(itemById(result.current.canvasItems, 'symbol-1')).toMatchObject({ x: 499, y: 390 });
  });

  it('does not begin a history action when nothing is selected to nudge', () => {
    const { result, beginHistoryAction } = setUp({ selectedIds: [] });

    act(() => result.current.nudgeSelected(0, -1));

    expect(beginHistoryAction).not.toHaveBeenCalled();
    expect(result.current.canvasItems).toEqual([symbol('symbol-1')]);
  });
});

describe('useCanvasItems scaling and rotating', () => {
  it('holds a scale inside the per-kind minimum and maximum', () => {
    const { result } = setUp({ canvasItems: [symbol('symbol-1'), text('text-1', 400)] });

    act(() =>
      result.current.scaleItems([
        { id: 'symbol-1', size: 4000, x: 100, y: 200 },
        { id: 'text-1', size: 4000, x: 400, y: 200 },
      ]),
    );

    expect(itemById(result.current.canvasItems, 'symbol-1').size).toBe(MAX_ITEM_SIZE.symbol);
    expect(itemById(result.current.canvasItems, 'text-1').size).toBe(MAX_ITEM_SIZE.text);

    act(() =>
      result.current.scaleItems([
        { id: 'symbol-1', size: 1, x: 100, y: 200 },
        { id: 'text-1', size: 1, x: 400, y: 200 },
      ]),
    );

    expect(itemById(result.current.canvasItems, 'symbol-1').size).toBe(MIN_ITEM_SIZE.symbol);
    expect(itemById(result.current.canvasItems, 'text-1').size).toBe(MIN_ITEM_SIZE.text);
  });

  it('clamps the position a scale moves an item to', () => {
    const { result } = setUp();

    act(() => result.current.scaleItems([{ id: 'symbol-1', size: 60, x: -400, y: 5000 }]));

    expect(itemById(result.current.canvasItems, 'symbol-1')).toMatchObject({ size: 60, x: 52, y: 752 });
  });

  it('wraps a rotation into 0-359 degrees', () => {
    const { result } = setUp();

    act(() => result.current.rotateItems([{ id: 'symbol-1', rotate: -45 }]));

    expect(itemById(result.current.canvasItems, 'symbol-1').rotate).toBe(315);
  });
});

describe('useCanvasItems align and distribute', () => {
  it('centres a selection on its average centre', () => {
    const { result, beginHistoryAction } = setUp({
      canvasItems: [symbol('symbol-1', 100, 200), symbol('symbol-2', 100, 400)],
      selectedIds: ['symbol-1', 'symbol-2'],
    });

    act(() => result.current.alignSelected('y'));

    expect(itemById(result.current.canvasItems, 'symbol-1').y).toBe(300);
    expect(itemById(result.current.canvasItems, 'symbol-2').y).toBe(300);
    expect(beginHistoryAction).toHaveBeenCalledTimes(1);
  });

  it('leaves a selection of fewer than two items alone', () => {
    const { result, beginHistoryAction } = setUp({ selectedIds: ['symbol-1'] });

    act(() => result.current.alignSelected('x'));

    expect(result.current.canvasItems).toEqual([symbol('symbol-1')]);
    expect(beginHistoryAction).not.toHaveBeenCalled();
  });

  it('spreads three or more items evenly between the outermost two', () => {
    const { result } = setUp({
      canvasItems: [symbol('symbol-1', 100), symbol('symbol-2', 150), symbol('symbol-3', 500)],
      selectedIds: ['symbol-1', 'symbol-2', 'symbol-3'],
    });

    act(() => result.current.distributeSelected('x'));

    expect(itemById(result.current.canvasItems, 'symbol-1').x).toBe(100);
    expect(itemById(result.current.canvasItems, 'symbol-2').x).toBe(300);
    expect(itemById(result.current.canvasItems, 'symbol-3').x).toBe(500);
  });

  it('leaves a selection of fewer than three items alone', () => {
    const { result, beginHistoryAction } = setUp({
      canvasItems: [symbol('symbol-1', 100), symbol('symbol-2', 150)],
      selectedIds: ['symbol-1', 'symbol-2'],
    });

    act(() => result.current.distributeSelected('x'));

    expect(itemById(result.current.canvasItems, 'symbol-1').x).toBe(100);
    expect(itemById(result.current.canvasItems, 'symbol-2').x).toBe(150);
    expect(beginHistoryAction).not.toHaveBeenCalled();
  });
});

describe('useCanvasItems clipboard', () => {
  it('pastes copies that are new items, not the ones that were copied', () => {
    const { result, beginHistoryAction } = setUp({ selectedIds: ['symbol-1'] });

    act(() => result.current.copySelected());
    // Copying on its own is not an edit, so it records no history entry.
    expect(beginHistoryAction).not.toHaveBeenCalled();

    act(() => result.current.pasteClipboard());

    expect(result.current.canvasItems).toHaveLength(2);
    const [original, pasted] = result.current.canvasItems;
    expect(pasted.id).not.toBe(original.id);
    expect(pasted).toMatchObject({ kind: 'symbol', x: 128, y: 228 });
    expect(result.current.selectedIds).toEqual([pasted.id]);
    expect(beginHistoryAction).toHaveBeenCalledTimes(1);

    // A second paste is a second pair of items, again with ids of their own.
    act(() => result.current.pasteClipboard());
    const ids = result.current.canvasItems.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives duplicates ids of their own', () => {
    const { result } = setUp({ selectedIds: ['symbol-1'] });

    act(() => result.current.duplicateSelected());

    const ids = result.current.canvasItems.map((item) => item.id);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
  });

  it('cuts by copying and then removing the selection', () => {
    const { result } = setUp({ canvasItems: [symbol('symbol-1'), symbol('symbol-2', 400)], selectedIds: ['symbol-1'] });

    act(() => result.current.cutSelected());

    expect(result.current.canvasItems.map((item) => item.id)).toEqual(['symbol-2']);
    expect(result.current.selectedIds).toEqual([]);

    act(() => result.current.pasteClipboard());

    expect(result.current.canvasItems).toHaveLength(2);
  });

  it('pastes nothing when the clipboard is empty', () => {
    const { result, beginHistoryAction } = setUp();

    act(() => result.current.pasteClipboard());

    expect(result.current.canvasItems).toHaveLength(1);
    expect(beginHistoryAction).not.toHaveBeenCalled();
  });
});

describe('useCanvasItems selection', () => {
  it('replaces the selection, or toggles an item into it when additive', () => {
    const { result } = setUp({ canvasItems: [symbol('symbol-1'), symbol('symbol-2', 400)] });

    act(() => result.current.selectItem('symbol-1'));
    expect(result.current.selectedIds).toEqual(['symbol-1']);

    act(() => result.current.selectItem('symbol-2', true));
    expect(result.current.selectedIds).toEqual(['symbol-1', 'symbol-2']);

    act(() => result.current.selectItem('symbol-1', true));
    expect(result.current.selectedIds).toEqual(['symbol-2']);

    act(() => result.current.selectItem(null));
    expect(result.current.selectedIds).toEqual([]);
  });

  it('removes the selected items and clears the selection', () => {
    const { result } = setUp({ canvasItems: [symbol('symbol-1'), symbol('symbol-2', 400)], selectedIds: ['symbol-1'] });

    act(() => result.current.removeSelected());

    expect(result.current.canvasItems.map((item) => item.id)).toEqual(['symbol-2']);
    expect(result.current.selectedIds).toEqual([]);
  });
});

describe('useCanvasItems placement', () => {
  it('finds a spot that does not overlap what is already on the canvas', () => {
    // A symbol sitting over the first slot of the fallback placement grid.
    const blocker = symbol('symbol-1', 120, 120);
    const { result } = setUp({ canvasItems: [blocker] });

    const position = result.current.findOpenPosition(60, 60);

    expect(intersects(position, hitBounds(blocker))).toBe(false);
  });

  it('places an item in the middle of the visible artboard when it is free', () => {
    const { result } = setUp({ canvasItems: [] }, { x: 0, y: 0, width: 1200, height: 800 });

    const position = result.current.findOpenPosition(60, 60);

    expect(position).toMatchObject({ x: 570, y: 370, width: 60, height: 60 });
  });

  it('steps away from the centre of the visible artboard when it is taken', () => {
    const blocker = symbol('symbol-1', 600, 400, 200);
    const { result } = setUp({ canvasItems: [blocker] }, { x: 0, y: 0, width: 1200, height: 800 });

    const position = result.current.findOpenPosition(60, 60);

    expect(intersects(position, hitBounds(blocker))).toBe(false);
  });

  it('adds a symbol at an open spot and selects it', () => {
    const { result, beginHistoryAction } = setUp({ canvasItems: [] });

    act(() => result.current.addSymbol('ring'));

    expect(result.current.canvasItems).toHaveLength(1);
    const added = result.current.canvasItems[0];
    expect(added).toMatchObject({ kind: 'symbol', mark: 'ring', rotate: 0, size: 42 });
    expect(result.current.selectedIds).toEqual([added.id]);
    expect(beginHistoryAction).toHaveBeenCalledTimes(1);
  });

  it('adds the trimmed draft as text, and adds nothing when it is blank', () => {
    const { result, beginHistoryAction } = setUp({ canvasItems: [] });

    act(() => result.current.setTextDraft('  PLATE  '));
    act(() => result.current.addText());

    expect(result.current.canvasItems).toHaveLength(1);
    expect(result.current.canvasItems[0]).toMatchObject({ kind: 'text', text: 'PLATE' });

    act(() => result.current.setTextDraft('   '));
    act(() => result.current.addText());

    expect(result.current.canvasItems).toHaveLength(1);
    expect(beginHistoryAction).toHaveBeenCalledTimes(1);
  });
});

describe('useCanvasItems text editing', () => {
  it('commits an edited label to the item being edited', () => {
    const item = text('text-1');
    const { result, beginHistoryAction } = setUp({ canvasItems: [item] });

    act(() => result.current.beginTextEdit(item));

    expect(result.current.editingTextId).toBe('text-1');
    expect(result.current.editingTextDraft).toBe('MICRO');
    expect(result.current.selectedIds).toEqual(['text-1']);

    act(() => result.current.setEditingTextDraft('  PLATE  '));
    act(() => result.current.commitTextEdit());

    expect(itemById(result.current.canvasItems, 'text-1')).toMatchObject({ kind: 'text', text: 'PLATE' });
    expect(result.current.editingTextId).toBeNull();
    expect(beginHistoryAction).toHaveBeenCalledTimes(1);
  });

  it('records no history entry when the label is unchanged or emptied', () => {
    const item = text('text-1');
    const { result, beginHistoryAction } = setUp({ canvasItems: [item] });

    act(() => result.current.beginTextEdit(item));
    act(() => result.current.commitTextEdit());

    expect(itemById(result.current.canvasItems, 'text-1')).toMatchObject({ text: 'MICRO' });
    expect(beginHistoryAction).not.toHaveBeenCalled();

    act(() => result.current.beginTextEdit(item));
    act(() => result.current.setEditingTextDraft('   '));
    act(() => result.current.commitTextEdit());

    expect(itemById(result.current.canvasItems, 'text-1')).toMatchObject({ text: 'MICRO' });
    expect(result.current.editingTextId).toBeNull();
    expect(beginHistoryAction).not.toHaveBeenCalled();
  });

  it('drops the draft when an edit is cancelled', () => {
    const item = text('text-1');
    const { result } = setUp({ canvasItems: [item] });

    act(() => result.current.beginTextEdit(item));
    act(() => result.current.setEditingTextDraft('PLATE'));
    act(() => result.current.cancelTextEdit());

    expect(result.current.editingTextId).toBeNull();
    expect(result.current.editingTextDraft).toBe('');
    expect(itemById(result.current.canvasItems, 'text-1')).toMatchObject({ text: 'MICRO' });
  });
});

// Grouping. The arithmetic is covered in groups.test.ts; what matters here is
// how the hook uses it -- which ids end up selected, when a history entry is
// taken, and that a copy of a group is a group of its own.
describe('useCanvasItems grouping', () => {
  const grouped = () => {
    const view = setUp({
      canvasItems: [symbol('symbol-1'), symbol('symbol-2', 300), symbol('symbol-3', 500)],
      selectedIds: ['symbol-1', 'symbol-2'],
    });
    act(() => view.result.current.groupSelected());
    return view;
  };

  it('groups the selection and takes one history entry for it', () => {
    const { result, beginHistoryAction } = grouped();

    const groupId = itemById(result.current.canvasItems, 'symbol-1').groupId;
    expect(groupId).toBeDefined();
    expect(itemById(result.current.canvasItems, 'symbol-2').groupId).toBe(groupId);
    expect(itemById(result.current.canvasItems, 'symbol-3').groupId).toBeUndefined();
    expect(beginHistoryAction).toHaveBeenCalledTimes(1);
  });

  it('refuses to group one item, and takes no history entry for the refusal', () => {
    const { result, beginHistoryAction } = setUp({
      canvasItems: [symbol('symbol-1'), symbol('symbol-2', 300)],
      selectedIds: ['symbol-1'],
    });

    act(() => result.current.groupSelected());

    expect(itemById(result.current.canvasItems, 'symbol-1').groupId).toBeUndefined();
    expect(beginHistoryAction).not.toHaveBeenCalled();
  });

  it('selects the whole group when one member is clicked', () => {
    const { result } = grouped();

    act(() => result.current.selectItem('symbol-2'));

    expect(result.current.selectedIds).toEqual(['symbol-1', 'symbol-2']);
  });

  it('adds a whole group to an existing selection on a shift-click', () => {
    const { result } = grouped();
    act(() => result.current.selectItem('symbol-3'));

    act(() => result.current.selectItem('symbol-1', true));

    expect([...result.current.selectedIds].sort()).toEqual(['symbol-1', 'symbol-2', 'symbol-3']);
  });

  it('takes a whole group back out again on a second shift-click', () => {
    const { result } = grouped();
    act(() => result.current.selectItem('symbol-3'));
    act(() => result.current.selectItem('symbol-1', true));

    act(() => result.current.selectItem('symbol-2', true));

    expect(result.current.selectedIds).toEqual(['symbol-3']);
  });

  it('completes a partial selection through selectItems, so a marquee cannot halve a group', () => {
    const { result } = grouped();

    act(() => result.current.selectItems(['symbol-1']));

    expect(result.current.selectedIds).toEqual(['symbol-1', 'symbol-2']);
  });

  it('ungroups every group in the selection', () => {
    const { result } = grouped();

    act(() => result.current.ungroupSelected());

    expect(result.current.canvasItems.every((item) => item.groupId === undefined)).toBe(true);
  });

  it('takes no history entry for ungrouping a selection that is not grouped', () => {
    const { result, beginHistoryAction } = setUp({
      canvasItems: [symbol('symbol-1'), symbol('symbol-2', 300)],
      selectedIds: ['symbol-1', 'symbol-2'],
    });

    act(() => result.current.ungroupSelected());

    expect(beginHistoryAction).not.toHaveBeenCalled();
  });

  it('duplicates a group into a second group rather than a bigger one', () => {
    // Sharing the id would mean dragging "the copy" drags the original too.
    const { result } = grouped();

    act(() => result.current.duplicateSelected());

    const copies = result.current.canvasItems.filter((item) => !['symbol-1', 'symbol-2', 'symbol-3'].includes(item.id));
    expect(copies).toHaveLength(2);
    expect(copies[0].groupId).toBe(copies[1].groupId);
    expect(copies[0].groupId).not.toBe(itemById(result.current.canvasItems, 'symbol-1').groupId);
  });

  it('pastes a group as its own group', () => {
    const { result } = grouped();

    act(() => result.current.copySelected());
    act(() => result.current.pasteClipboard());

    const pasted = result.current.canvasItems.filter((item) => !['symbol-1', 'symbol-2', 'symbol-3'].includes(item.id));
    expect(pasted).toHaveLength(2);
    expect(pasted[0].groupId).toBe(pasted[1].groupId);
    expect(pasted[0].groupId).not.toBe(itemById(result.current.canvasItems, 'symbol-1').groupId);
  });

  it('keeps the group selected while one of its text items is edited', () => {
    // Editing reads `editingTextId`, never the selection, so there is nothing
    // to gain by narrowing it -- and the narrowing outlives the edit, leaving
    // the next nudge or delete acting on one member of a locked group.
    const view = setUp({
      canvasItems: [symbol('symbol-1'), text('text-1', 300)],
      selectedIds: ['symbol-1', 'text-1'],
    });
    act(() => view.result.current.groupSelected());

    const item = itemById(view.result.current.canvasItems, 'text-1');
    if (item.kind !== 'text') throw new Error('expected a text item');
    act(() => view.result.current.beginTextEdit(item));

    expect(view.result.current.editingTextId).toBe('text-1');
    expect([...view.result.current.selectedIds].sort()).toEqual(['symbol-1', 'text-1']);
  });

  it('leaves an ungrouped text item selected on its own when it is edited', () => {
    const view = setUp({
      canvasItems: [symbol('symbol-1'), text('text-1', 300)],
      selectedIds: ['symbol-1'],
    });

    const item = itemById(view.result.current.canvasItems, 'text-1');
    if (item.kind !== 'text') throw new Error('expected a text item');
    act(() => view.result.current.beginTextEdit(item));

    expect(view.result.current.selectedIds).toEqual(['text-1']);
  });

  it('takes no history entry for grouping a selection that is already one group', () => {
    // It would only re-mint the group id: nothing changes on screen, but the
    // user's next undo would appear to do nothing.
    const view = grouped();
    const groupId = itemById(view.result.current.canvasItems, 'symbol-1').groupId;
    view.beginHistoryAction.mockClear();

    act(() => view.result.current.groupSelected());

    expect(view.beginHistoryAction).not.toHaveBeenCalled();
    expect(itemById(view.result.current.canvasItems, 'symbol-1').groupId).toBe(groupId);
  });

  it('still groups a selection that spans a group and a loose item', () => {
    const view = grouped();
    act(() => view.result.current.selectItems(['symbol-1', 'symbol-3']));

    act(() => view.result.current.groupSelected());

    const groupId = itemById(view.result.current.canvasItems, 'symbol-3').groupId;
    expect(groupId).toBeDefined();
    expect(itemById(view.result.current.canvasItems, 'symbol-1').groupId).toBe(groupId);
    expect(itemById(view.result.current.canvasItems, 'symbol-2').groupId).toBe(groupId);
  });

  it('adds a group to the selection from a layer row held with a modifier', () => {
    const view = grouped();
    act(() => view.result.current.selectItem('symbol-3'));

    act(() => view.result.current.selectItems(['symbol-1', 'symbol-2'], true));

    expect([...view.result.current.selectedIds].sort()).toEqual(['symbol-1', 'symbol-2', 'symbol-3']);
  });

  it('takes a group back out again on a second modifier-click of its layer row', () => {
    // The mirror of the branch above, and of what a shift-click on a single
    // item does: everything already in comes back out together.
    const view = grouped();
    act(() => view.result.current.selectItem('symbol-3'));
    act(() => view.result.current.selectItems(['symbol-1', 'symbol-2'], true));

    act(() => view.result.current.selectItems(['symbol-1', 'symbol-2'], true));

    expect(view.result.current.selectedIds).toEqual(['symbol-3']);
  });

  it('dissolves a group that a delete strips down to one member', () => {
    const { result } = grouped();

    act(() => result.current.selectItem('symbol-1'));
    // The click above selected the group, so narrow it back to one member the
    // way the layer list would not, then delete just that one.
    act(() => result.current.setSelectedIds(['symbol-1']));
    act(() => result.current.removeSelected());

    expect(itemById(result.current.canvasItems, 'symbol-2').groupId).toBeUndefined();
  });
});
