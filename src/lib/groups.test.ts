import {
  groupActions,
  expandToGroups,
  groupItems,
  isOneWholeGroup,
  layerRows,
  moveChild,
  moveRow,
  normalizeGroups,
  pruneGroups,
  regroupCopies,
  rowItemIds,
  selectionUnits,
  ungroupItems,
} from './groups';
import type { CanvasItem, CanvasSymbol } from '../types';

// Grouping is pure array work over each item's path of groups (see
// groups.ts), so the whole of it is testable without a canvas. What the
// browser has to prove instead -- that clicking one member selects the rest,
// and that a copied group moves on its own -- is in e2e/groups.spec.ts.

/** A symbol in the groups named, outermost first. */
function symbol(id: string, ...groupIds: string[]): CanvasSymbol {
  return {
    ...(groupIds.length ? { groups: groupIds.map((groupId) => ({ id: groupId })) } : {}),
    id,
    kind: 'symbol',
    mark: 'ring',
    rotate: 0,
    size: 42,
    x: 100,
    y: 200,
  };
}

const ids = (items: CanvasItem[]) => items.map((item) => item.id);
/** The outermost group an item is in. */
const groupOf = (items: CanvasItem[], id: string) => items.find((item) => item.id === id)?.groups?.[0]?.id;
/** Every group an item is in, outermost first. */
const pathOf = (items: CanvasItem[], id: string) => items.find((item) => item.id === id)?.groups?.map((level) => level.id) ?? [];

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

  it('nests an existing group inside the new one, keeping it whole', () => {
    const items = [symbol('a', 'g1'), symbol('b', 'g1'), symbol('c')];
    const grouped = groupItems(items, ['a', 'c']);

    const outer = groupOf(grouped, 'a');
    expect(outer).not.toBe('g1');
    expect(pathOf(grouped, 'a')).toEqual([outer, 'g1']);
    expect(pathOf(grouped, 'b')).toEqual([outer, 'g1']);
    expect(pathOf(grouped, 'c')).toEqual([outer]);
  });

  it('nests two groups side by side in a new one', () => {
    const items = [symbol('a', 'g1'), symbol('b', 'g1'), symbol('c', 'g2'), symbol('d', 'g2')];
    const grouped = groupItems(items, ['a', 'c']);

    const outer = groupOf(grouped, 'a');
    expect(pathOf(grouped, 'b')).toEqual([outer, 'g1']);
    expect(pathOf(grouped, 'd')).toEqual([outer, 'g2']);
  });

  it('starts the new group with the settings it is given', () => {
    const pop = { delay: 0, duration: 1, kind: 'pop' as const };
    const grouped = groupItems([symbol('a'), symbol('b')], ['a', 'b'], { animation: pop, stagger: 0.2 });

    expect(grouped[0].groups?.[0]).toMatchObject({ animation: pop, stagger: 0.2 });
    expect(grouped[1].groups?.[0]).toEqual(grouped[0].groups?.[0]);
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

    expect(ungrouped.every((item) => item.groups === undefined)).toBe(true);
  });

  it('takes one level off a group of groups, leaving the groups inside whole', () => {
    const items = [symbol('a', 'outer', 'g1'), symbol('b', 'outer', 'g1'), symbol('c', 'outer')];
    const ungrouped = ungroupItems(items, ['c']);

    expect(pathOf(ungrouped, 'a')).toEqual(['g1']);
    expect(pathOf(ungrouped, 'b')).toEqual(['g1']);
    expect(pathOf(ungrouped, 'c')).toEqual([]);
  });

  it('leaves other groups alone', () => {
    const items = [symbol('a', 'g1'), symbol('b', 'g1'), symbol('c', 'g2'), symbol('d', 'g2')];
    const ungrouped = ungroupItems(items, ['a']);

    expect(groupOf(ungrouped, 'b')).toBeUndefined();
    expect(groupOf(ungrouped, 'c')).toBe('g2');
  });

  it('drops the key entirely rather than leaving an undefined behind', () => {
    const [item] = ungroupItems([symbol('a', 'g1'), symbol('b', 'g1')], ['a']);

    expect(Object.hasOwnProperty.call(item, 'groups')).toBe(false);
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

  it('dissolves a group whose only child is another group', () => {
    // Two members, but one child: the outer group adds nothing but a row.
    const pruned = pruneGroups([symbol('a', 'outer', 'g1'), symbol('b', 'outer', 'g1')]);

    expect(pathOf(pruned, 'a')).toEqual(['g1']);
    expect(pathOf(pruned, 'b')).toEqual(['g1']);
  });

  it('keeps going when dissolving an inner group leaves its parent short', () => {
    // g1 is down to one member; once it goes, outer holds only a.
    const pruned = pruneGroups([symbol('a', 'outer', 'g1'), symbol('b')]);

    expect(pathOf(pruned, 'a')).toEqual([]);
  });

  it('counts an inner group as one child of its parent', () => {
    const items = [symbol('a', 'outer', 'g1'), symbol('b', 'outer', 'g1'), symbol('c', 'outer')];

    expect(pruneGroups(items)).toBe(items);
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

  it('re-mints every level of a nested group, keeping the shape', () => {
    const copies = regroupCopies([symbol('a', 'outer', 'g1'), symbol('b', 'outer', 'g1'), symbol('c', 'outer')]);

    const [outer, inner] = pathOf(copies, 'a');
    expect([outer, inner]).not.toContain('outer');
    expect([outer, inner]).not.toContain('g1');
    expect(pathOf(copies, 'b')).toEqual([outer, inner]);
    expect(pathOf(copies, 'c')).toEqual([outer]);
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

  it('nests a group inside a group as a child of its row, topmost first', () => {
    const rows = layerRows([symbol('a', 'outer', 'g1'), symbol('b', 'outer', 'g1'), symbol('c', 'outer'), symbol('d')]);

    expect(rows.map((row) => row.id)).toEqual(['d', 'outer']);
    const outer = rows[1];
    if (outer.kind !== 'group') throw new Error('expected a group row');
    expect(outer.children.map((child) => child.id)).toEqual(['c', 'g1']);
    expect(rowItemIds(outer)).toEqual(['a', 'b', 'c']);
    const inner = outer.children[1];
    expect(inner.kind === 'group' && inner.children.map((child) => child.id)).toEqual(['b', 'a']);
  });
});

describe('groupActions', () => {
  const loose = (id: string): CanvasItem => ({ id, kind: 'symbol', mark: 'ring', rotate: 0, size: 42, x: 0, y: 0 });
  const member = (id: string, groupId: string): CanvasItem => ({ ...loose(id), groups: [{ id: groupId }] });
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

  it('treats a group of groups as one whole group', () => {
    const nested = [symbol('a', 'outer', 'g1'), symbol('b', 'outer', 'g1'), symbol('c', 'outer')];

    expect(groupActions(nested, ['a', 'b', 'c'])).toEqual({ canGroup: false, canUngroup: true });
  });
});

describe('moveRow', () => {
  // Paint order, bottom first: a, then the group [g1, g2], then b on top. So
  // the Layers list reads, topmost first: b, group, a. A group row takes the
  // group's id, group-1.
  const items = [symbol('a'), symbol('g1', 'group-1'), symbol('g2', 'group-1'), symbol('b')];
  const rowOrder = (moved: CanvasItem[]) => layerRows(moved).map((row) => row.id);

  it('moves an item to the top of the list, which is the top of the paint order', () => {
    const moved = moveRow(items, 'a', 0);

    expect(rowOrder(moved)).toEqual(['a', 'b', 'group-1']);
    expect(ids(moved)).toEqual(['g1', 'g2', 'b', 'a']);
  });

  it('moves an item to the bottom of the list', () => {
    const moved = moveRow(items, 'b', 3);

    expect(rowOrder(moved)).toEqual(['group-1', 'a', 'b']);
    expect(ids(moved)).toEqual(['b', 'a', 'g1', 'g2']);
  });

  it('counts the gap in the list as it stands, before the row is lifted out', () => {
    // Gap 2 sits between the group and a. Dragging b down into it lands b
    // directly above a, not one further down.
    expect(rowOrder(moveRow(items, 'b', 2))).toEqual(['group-1', 'b', 'a']);
  });

  it('moves a group whole, with its members still together and in order', () => {
    const moved = moveRow(items, 'group-1', 0);

    expect(ids(moved)).toEqual(['a', 'b', 'g1', 'g2']);
    expect(layerRows(moved).filter((row) => row.kind === 'group')).toHaveLength(1);
  });

  it('keeps a group together when another row is dropped around it', () => {
    const moved = moveRow(items, 'a', 1);

    expect(ids(moved)).toEqual(['g1', 'g2', 'a', 'b']);
  });

  it('returns the same array for a drop just above or just below the row itself', () => {
    // The group is row 1, so gaps 1 and 2 both leave it where it is.
    expect(moveRow(items, 'group-1', 1)).toBe(items);
    expect(moveRow(items, 'group-1', 2)).toBe(items);
  });

  it('returns the same array for a row that is not in the list', () => {
    // g1 is a member, not a row: the group is moved by its row, as a whole.
    expect(moveRow(items, 'g1', 0)).toBe(items);
    expect(moveRow(items, 'missing', 0)).toBe(items);
  });

  it('clamps a gap past either end of the list', () => {
    expect(rowOrder(moveRow(items, 'a', -4))).toEqual(['a', 'b', 'group-1']);
    expect(rowOrder(moveRow(items, 'b', 99))).toEqual(['group-1', 'a', 'b']);
  });
});

describe('moveChild', () => {
  // Paint order, bottom first: a, then the group [g1, g2, g3], then b. An
  // open group lists its children top first: g3, g2, g1.
  const items = [symbol('a'), symbol('g1', 'group-1'), symbol('g2', 'group-1'), symbol('g3', 'group-1'), symbol('b')];
  const listed = (moved: CanvasItem[], groupId = 'group-1') => {
    const group = layerRows(moved).find((row) => row.id === groupId);
    return group?.kind === 'group' ? group.children.map((child) => child.id) : [];
  };

  it('moves a member to the top of its group, and so in front of the others', () => {
    const moved = moveChild(items, 'group-1', 'g1', 0);

    expect(listed(moved)).toEqual(['g1', 'g3', 'g2']);
    expect(ids(moved)).toEqual(['a', 'g2', 'g3', 'g1', 'b']);
  });

  it('moves a member to the bottom of its group', () => {
    expect(listed(moveChild(items, 'group-1', 'g3', 3))).toEqual(['g2', 'g1', 'g3']);
  });

  it('counts the gap among the children as they stand', () => {
    // Gap 2 sits between g2 and g1: g3 lands directly above g1.
    expect(listed(moveChild(items, 'group-1', 'g3', 2))).toEqual(['g2', 'g3', 'g1']);
  });

  it('leaves everything outside the group where it was', () => {
    const moved = moveChild(items, 'group-1', 'g1', 0);

    expect(moved[0].id).toBe('a');
    expect(moved[4].id).toBe('b');
    expect(moved.filter((item) => groupOf(moved, item.id) === 'group-1')).toHaveLength(3);
  });

  it('returns the same array for a drop that leaves the child where it was', () => {
    expect(moveChild(items, 'group-1', 'g2', 1)).toBe(items);
    expect(moveChild(items, 'group-1', 'g2', 2)).toBe(items);
  });

  it('returns the same array for a child not in that group, or a group that is not there', () => {
    expect(moveChild(items, 'group-1', 'a', 0)).toBe(items);
    expect(moveChild(items, 'group-1', 'missing', 0)).toBe(items);
    expect(moveChild(items, 'missing', 'g1', 0)).toBe(items);
  });

  it('moves a group inside a group as one child, whole', () => {
    // outer lists, top first: inner (b over a), then c.
    const nested = [symbol('c', 'outer'), symbol('a', 'outer', 'inner'), symbol('b', 'outer', 'inner'), symbol('d')];
    const moved = moveChild(nested, 'outer', 'inner', 2);

    expect(listed(moved, 'outer')).toEqual(['c', 'inner']);
    expect(ids(moved)).toEqual(['a', 'b', 'c', 'd']);
    expect(pathOf(moved, 'a')).toEqual(['outer', 'inner']);
  });

  it('reorders inside an inner group without touching its siblings', () => {
    const nested = [symbol('c', 'outer'), symbol('a', 'outer', 'inner'), symbol('b', 'outer', 'inner')];
    const moved = moveChild(nested, 'inner', 'a', 0);

    expect(ids(moved)).toEqual(['c', 'b', 'a']);
  });
});

describe('normalizeGroups', () => {
  it('gathers a group a save left split apart, at its topmost member', () => {
    const items = [symbol('g1', 'group-1'), symbol('a'), symbol('g2', 'group-1')];

    expect(ids(normalizeGroups(items))).toEqual(['a', 'g1', 'g2']);
  });

  it('gathers at every level', () => {
    const items = [symbol('x', 'outer', 'inner'), symbol('y', 'outer'), symbol('z', 'outer', 'inner')];

    expect(ids(normalizeGroups(items))).toEqual(['y', 'x', 'z']);
  });

  it('cuts off a member that reaches a group by a different path', () => {
    // inner sits in outer for a and b; c claims it sits at the top level.
    const items = [symbol('a', 'outer', 'inner'), symbol('b', 'outer', 'inner'), symbol('x', 'outer'), symbol('c', 'inner')];
    const normalized = normalizeGroups(items);

    expect(pathOf(normalized, 'a')).toEqual(['outer', 'inner']);
    expect(pathOf(normalized, 'c')).toEqual([]);
  });

  it('makes every copy of a level carry the first one\'s settings', () => {
    const pop = { delay: 0, duration: 1, kind: 'pop' as const };
    const a = { ...symbol('a'), groups: [{ id: 'g1', animation: pop }] };
    const b = { ...symbol('b'), groups: [{ id: 'g1', stagger: 3 }] };
    const normalized = normalizeGroups([a, b]);

    expect(normalized[1].groups?.[0]).toEqual({ id: 'g1', animation: pop });
  });

  it('dissolves a group left with one child', () => {
    expect(pathOf(normalizeGroups([symbol('a', 'g1'), symbol('b')]), 'a')).toEqual([]);
  });
});

describe('selectionUnits', () => {
  it('makes each outermost group one unit and each loose item one of its own, in paint order', () => {
    const items = [symbol('a', 'outer', 'inner'), symbol('b', 'outer'), symbol('c'), symbol('d', 'g2'), symbol('e', 'g2')];

    expect(selectionUnits(items, ['a', 'b', 'c', 'd', 'e']).map(ids)).toEqual([['a', 'b'], ['c'], ['d', 'e']]);
  });

  it('leaves out what is not selected', () => {
    expect(selectionUnits([symbol('a'), symbol('b')], ['b']).map(ids)).toEqual([['b']]);
  });
});
