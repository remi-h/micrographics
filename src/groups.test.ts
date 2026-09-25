import {
  groupActions,
  expandToGroups,
  groupItems,
  isOneWholeGroup,
  layerRows,
  moveMember,
  moveRow,
  pruneGroups,
  regroupCopies,
  rowItemIds,
  ungroupItems,
} from './groups';
import type { CanvasItem, CanvasSymbol } from './types';

// Grouping is pure array work over `groupId` (see groups.ts), so the whole of
// it is testable without a canvas. What the browser has to prove instead --
// that clicking one member selects the rest, and that a copied group moves on
// its own -- is in e2e/groups.spec.ts.

function symbol(id: string, groupId?: string): CanvasSymbol {
  return { ...(groupId ? { groupId } : {}), id, kind: 'symbol', mark: 'ring', rotate: 0, size: 42, x: 100, y: 200 };
}

const ids = (items: CanvasItem[]) => items.map((item) => item.id);
const groupOf = (items: CanvasItem[], id: string) => items.find((item) => item.id === id)?.groupId;

describe('expandToGroups', () => {
  it('returns the ids unchanged when nothing is grouped', () => {
    const items = [symbol('a'), symbol('b'), symbol('c')];

    expect(expandToGroups(['a', 'c'], items)).toEqual(['a', 'c']);
  });

  it('pulls in the rest of a group when one member is named', () => {
    const items = [symbol('a', 'g1'), symbol('b', 'g1'), symbol('c')];

    expect(expandToGroups(['a'], items)).toEqual(['a', 'b']);
  });

  it('expands every group the ids touch, not just the first', () => {
    const items = [symbol('a', 'g1'), symbol('b', 'g1'), symbol('c', 'g2'), symbol('d', 'g2')];

    expect(expandToGroups(['a', 'c'], items)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('reports the selection in paint order rather than the order it was asked for', () => {
    const items = [symbol('a', 'g1'), symbol('b'), symbol('c', 'g1')];

    expect(expandToGroups(['c'], items)).toEqual(['a', 'c']);
  });

  it('does not repeat an id that was named twice', () => {
    const items = [symbol('a'), symbol('b')];

    expect(expandToGroups(['a', 'a', 'b'], items)).toEqual(['a', 'b']);
  });

  it('drops an id no item on the canvas holds, grouped or not', () => {
    // Callers count what comes back. A stale id counted as a second item is
    // enough for groupItems to stamp a group onto a lone survivor.
    expect(expandToGroups(['a', 'ghost'], [symbol('a')])).toEqual(['a']);
    expect(expandToGroups(['a', 'ghost'], [symbol('a', 'g1'), symbol('b', 'g1')])).toEqual(['a', 'b']);
  });
});

describe('isOneWholeGroup', () => {
  it('is true for exactly one group and nothing else', () => {
    expect(isOneWholeGroup([symbol('a', 'g1'), symbol('b', 'g1')], ['a', 'b'])).toBe(true);
  });

  it('is false for part of a group', () => {
    expect(isOneWholeGroup([symbol('a', 'g1'), symbol('b', 'g1')], ['a'])).toBe(false);
  });

  it('is false for a group plus a loose item', () => {
    const items = [symbol('a', 'g1'), symbol('b', 'g1'), symbol('c')];

    expect(isOneWholeGroup(items, ['a', 'b', 'c'])).toBe(false);
  });

  it('is false for two whole groups', () => {
    const items = [symbol('a', 'g1'), symbol('b', 'g1'), symbol('c', 'g2'), symbol('d', 'g2')];

    expect(isOneWholeGroup(items, ['a', 'b', 'c', 'd'])).toBe(false);
  });

  it('is false for loose items, however many', () => {
    expect(isOneWholeGroup([symbol('a'), symbol('b')], ['a', 'b'])).toBe(false);
    expect(isOneWholeGroup([symbol('a')], ['a'])).toBe(false);
  });
});

describe('groupItems', () => {
  it('gives every member one shared, new group id', () => {
    const grouped = groupItems([symbol('a'), symbol('b'), symbol('c')], ['a', 'c']);

    expect(groupOf(grouped, 'a')).toBeDefined();
    expect(groupOf(grouped, 'a')).toBe(groupOf(grouped, 'c'));
    expect(groupOf(grouped, 'b')).toBeUndefined();
  });

  it('gathers the members together at the topmost one, so the layer row is honest', () => {
    // b and d are grouped across c. The array is the z-order, so leaving c
    // between them would draw one layer row over a range it does not own.
    const grouped = groupItems([symbol('a'), symbol('b'), symbol('c'), symbol('d'), symbol('e')], ['b', 'd']);

    expect(ids(grouped)).toEqual(['a', 'c', 'b', 'd', 'e']);
  });

  it('leaves the order alone when the members are already together', () => {
    const grouped = groupItems([symbol('a'), symbol('b'), symbol('c')], ['b', 'c']);

    expect(ids(grouped)).toEqual(['a', 'b', 'c']);
  });

  it('merges existing groups into the new one rather than nesting them', () => {
    const items = [symbol('a', 'g1'), symbol('b', 'g1'), symbol('c')];
    const grouped = groupItems(items, ['a', 'c']);

    const shared = groupOf(grouped, 'a');
    expect(shared).not.toBe('g1');
    expect(groupOf(grouped, 'b')).toBe(shared);
    expect(groupOf(grouped, 'c')).toBe(shared);
  });

  it('does nothing with fewer than two items, and says so by identity', () => {
    const items = [symbol('a'), symbol('b')];

    expect(groupItems(items, ['a'])).toBe(items);
    expect(groupItems(items, [])).toBe(items);
  });

  it('does nothing to a group that is already whole', () => {
    // Re-minting the id changes nothing on screen but costs a history entry,
    // so the user's next undo would look broken.
    const items = [symbol('a', 'g1'), symbol('b', 'g1')];

    expect(groupItems(items, ['a', 'b'])).toBe(items);
    expect(groupItems(items, ['a'])).toBe(items);
  });

  it('still groups a whole group together with a loose item', () => {
    const items = [symbol('a', 'g1'), symbol('b', 'g1'), symbol('c')];
    const grouped = groupItems(items, ['a', 'c']);

    expect(grouped).not.toBe(items);
    expect(groupOf(grouped, 'c')).toBe(groupOf(grouped, 'a'));
  });

  it('will not stamp a group onto a lone item named alongside a stale id', () => {
    const items = [symbol('a')];

    expect(groupItems(items, ['a', 'ghost'])).toBe(items);
  });
});

describe('ungroupItems', () => {
  it('dissolves the group a named item belongs to', () => {
    const ungrouped = ungroupItems([symbol('a', 'g1'), symbol('b', 'g1')], ['a']);

    expect(ungrouped.every((item) => item.groupId === undefined)).toBe(true);
  });

  it('leaves other groups alone', () => {
    const items = [symbol('a', 'g1'), symbol('b', 'g1'), symbol('c', 'g2'), symbol('d', 'g2')];
    const ungrouped = ungroupItems(items, ['a']);

    expect(groupOf(ungrouped, 'b')).toBeUndefined();
    expect(groupOf(ungrouped, 'c')).toBe('g2');
  });

  it('drops the key entirely rather than leaving an undefined behind', () => {
    const [item] = ungroupItems([symbol('a', 'g1'), symbol('b', 'g1')], ['a']);

    expect(Object.hasOwnProperty.call(item, 'groupId')).toBe(false);
  });

  it('does nothing when nothing named is grouped', () => {
    const items = [symbol('a'), symbol('b')];

    expect(ungroupItems(items, ['a', 'b'])).toBe(items);
  });
});

describe('pruneGroups', () => {
  it('dissolves a group left with a single member', () => {
    const pruned = pruneGroups([symbol('a', 'g1'), symbol('b')]);

    expect(groupOf(pruned, 'a')).toBeUndefined();
  });

  it('keeps a group that still has two', () => {
    const items = [symbol('a', 'g1'), symbol('b', 'g1')];

    expect(pruneGroups(items)).toBe(items);
  });

  it('prunes only the group that is short', () => {
    const pruned = pruneGroups([symbol('a', 'g1'), symbol('b', 'g1'), symbol('c', 'g2')]);

    expect(groupOf(pruned, 'a')).toBe('g1');
    expect(groupOf(pruned, 'c')).toBeUndefined();
  });
});

describe('regroupCopies', () => {
  it('keeps copied members together but apart from what they were copied from', () => {
    const copies = regroupCopies([symbol('a', 'g1'), symbol('b', 'g1')]);

    expect(groupOf(copies, 'a')).toBe(groupOf(copies, 'b'));
    expect(groupOf(copies, 'a')).not.toBe('g1');
  });

  it('keeps two copied groups separate', () => {
    const copies = regroupCopies([symbol('a', 'g1'), symbol('b', 'g1'), symbol('c', 'g2')]);

    expect(groupOf(copies, 'a')).not.toBe(groupOf(copies, 'c'));
  });

  it('leaves ungrouped items alone', () => {
    const copies = regroupCopies([symbol('a'), symbol('b', 'g1'), symbol('c', 'g1')]);

    expect(groupOf(copies, 'a')).toBeUndefined();
  });
});

describe('layerRows', () => {
  it('lists the topmost item first', () => {
    const rows = layerRows([symbol('a'), symbol('b')]);

    expect(rows.map((row) => row.id)).toEqual(['b', 'a']);
  });

  it('collapses a group into one row', () => {
    const rows = layerRows([symbol('a'), symbol('b', 'g1'), symbol('c', 'g1')]);

    expect(rows).toHaveLength(2);
    expect(rows[0].kind).toBe('group');
    expect(rowItemIds(rows[0])).toEqual(['b', 'c']);
    expect(rows[1].kind).toBe('item');
  });

  it('keeps a group row a group row even where two groups touch', () => {
    const rows = layerRows([symbol('a', 'g1'), symbol('b', 'g1'), symbol('c', 'g2'), symbol('d', 'g2')]);

    expect(rows).toHaveLength(2);
    expect(rowItemIds(rows[0])).toEqual(['c', 'd']);
    expect(rowItemIds(rows[1])).toEqual(['a', 'b']);
  });

  it('gives every row its own key even if a save arrives with a group split apart', () => {
    // Not reachable through the editor -- groupItems gathers members -- but a
    // hand-edited save can carry it, and two React rows sharing a key breaks
    // the list rather than just drawing it oddly.
    const rows = layerRows([symbol('a', 'g1'), symbol('b'), symbol('c', 'g1')]);

    expect(new Set(rows.map((row) => row.id)).size).toBe(rows.length);
  });

  it('has no rows for an empty canvas', () => {
    expect(layerRows([])).toEqual([]);
  });
});

describe('groupActions', () => {
  const loose = (id: string): CanvasItem => ({ id, kind: 'symbol', mark: 'ring', rotate: 0, size: 42, x: 0, y: 0 });
  const member = (id: string, groupId: string): CanvasItem => ({ ...loose(id), groupId });
  const items = [loose('a'), loose('b'), member('c', 'g1'), member('d', 'g1'), member('e', 'g2'), member('f', 'g2')];

  it('offers nothing for a single loose item', () => {
    expect(groupActions(items, ['a'])).toEqual({ canGroup: false, canUngroup: false });
  });

  it('offers Group for several loose items', () => {
    expect(groupActions(items, ['a', 'b'])).toEqual({ canGroup: true, canUngroup: false });
  });

  it('offers only Ungroup for exactly one whole group, so the menu reads as a toggle', () => {
    expect(groupActions(items, ['c', 'd'])).toEqual({ canGroup: false, canUngroup: true });
  });

  it('offers both for a group selected with something else -- merging and splitting are both real', () => {
    expect(groupActions(items, ['c', 'd', 'a'])).toEqual({ canGroup: true, canUngroup: true });
    expect(groupActions(items, ['c', 'd', 'e', 'f'])).toEqual({ canGroup: true, canUngroup: true });
  });

  it('offers nothing for an empty selection', () => {
    expect(groupActions(items, [])).toEqual({ canGroup: false, canUngroup: false });
  });
});

describe('moveRow', () => {
  // Paint order, bottom first: a, then the group [g1, g2], then b on top. So
  // the Layers list reads, topmost first: b, group, a. A group row takes the
  // id of its topmost member, g2.
  const items = [symbol('a'), symbol('g1', 'group-1'), symbol('g2', 'group-1'), symbol('b')];
  const rowOrder = (moved: CanvasItem[]) => layerRows(moved).map((row) => row.id);

  it('moves an item to the top of the list, which is the top of the paint order', () => {
    const moved = moveRow(items, 'a', 0);

    expect(rowOrder(moved)).toEqual(['a', 'b', 'g2']);
    expect(ids(moved)).toEqual(['g1', 'g2', 'b', 'a']);
  });

  it('moves an item to the bottom of the list', () => {
    const moved = moveRow(items, 'b', 3);

    expect(rowOrder(moved)).toEqual(['g2', 'a', 'b']);
    expect(ids(moved)).toEqual(['b', 'a', 'g1', 'g2']);
  });

  it('counts the gap in the list as it stands, before the row is lifted out', () => {
    // Gap 2 sits between the group and a. Dragging b down into it lands b
    // directly above a, not one further down.
    expect(rowOrder(moveRow(items, 'b', 2))).toEqual(['g2', 'b', 'a']);
  });

  it('moves a group whole, with its members still together and in order', () => {
    const moved = moveRow(items, 'g2', 0);

    expect(ids(moved)).toEqual(['a', 'b', 'g1', 'g2']);
    expect(layerRows(moved).filter((row) => row.kind === 'group')).toHaveLength(1);
  });

  it('keeps a group together when another row is dropped around it', () => {
    const moved = moveRow(items, 'a', 1);

    expect(ids(moved)).toEqual(['g1', 'g2', 'a', 'b']);
  });

  it('returns the same array for a drop just above or just below the row itself', () => {
    // The group is row 1, so gaps 1 and 2 both leave it where it is.
    expect(moveRow(items, 'g2', 1)).toBe(items);
    expect(moveRow(items, 'g2', 2)).toBe(items);
  });

  it('returns the same array for a row that is not in the list', () => {
    // g1 is a member, not a row: the group is moved by its row, as a whole.
    expect(moveRow(items, 'g1', 0)).toBe(items);
    expect(moveRow(items, 'missing', 0)).toBe(items);
  });

  it('clamps a gap past either end of the list', () => {
    expect(rowOrder(moveRow(items, 'a', -4))).toEqual(['a', 'b', 'g2']);
    expect(rowOrder(moveRow(items, 'b', 99))).toEqual(['g2', 'a', 'b']);
  });
});

describe('moveMember', () => {
  // Paint order, bottom first: a, then the group [g1, g2, g3], then b. An
  // open group lists its members top first: g3, g2, g1.
  const items = [symbol('a'), symbol('g1', 'group-1'), symbol('g2', 'group-1'), symbol('g3', 'group-1'), symbol('b')];
  const listed = (moved: CanvasItem[]) => {
    const group = layerRows(moved).find((row) => row.kind === 'group');
    return group?.kind === 'group' ? [...group.items].reverse().map((item) => item.id) : [];
  };

  it('moves a member to the top of its group, and so in front of the others', () => {
    const moved = moveMember(items, 'g1', 0);

    expect(listed(moved)).toEqual(['g1', 'g3', 'g2']);
    expect(ids(moved)).toEqual(['a', 'g2', 'g3', 'g1', 'b']);
  });

  it('moves a member to the bottom of its group', () => {
    expect(listed(moveMember(items, 'g3', 3))).toEqual(['g2', 'g1', 'g3']);
  });

  it('counts the gap among the members as they stand', () => {
    // Gap 2 sits between g2 and g1: g3 lands directly above g1.
    expect(listed(moveMember(items, 'g3', 2))).toEqual(['g2', 'g3', 'g1']);
  });

  it('leaves everything outside the group where it was', () => {
    const moved = moveMember(items, 'g1', 0);

    expect(moved[0].id).toBe('a');
    expect(moved[4].id).toBe('b');
    expect(moved.filter((item) => item.groupId === 'group-1')).toHaveLength(3);
  });

  it('returns the same array for a drop that leaves the member where it was', () => {
    expect(moveMember(items, 'g2', 1)).toBe(items);
    expect(moveMember(items, 'g2', 2)).toBe(items);
  });

  it('returns the same array for an ungrouped item, or one not on the canvas', () => {
    expect(moveMember(items, 'a', 0)).toBe(items);
    expect(moveMember(items, 'missing', 0)).toBe(items);
  });

  it('reorders a group whose members a hand-edited save left apart, in the places they hold', () => {
    const scattered = [symbol('g1', 'group-1'), symbol('a'), symbol('g2', 'group-1')];

    expect(ids(moveMember(scattered, 'g1', 0))).toEqual(['g2', 'a', 'g1']);
  });
});
