import type { ItemAnimation } from './animations';
import { inheritedTiming, keepInheritedEntrances, pruneKeepingTiming, resolveGroupTiming, setGroupTiming } from './groupTiming';
import { ungroupItems } from './groups';
import type { CanvasItem, CanvasSymbol, GroupLevel } from '../types';

// Group timing is the one place a group's own settings become what each item
// plays, so it is worth pinning down exactly: the preview, the SVG export and
// the GIF all read only the items. The browser half -- that a nested group
// really plays in this order -- is in e2e/groups.spec.ts.

const pop = (delay = 0, duration = 0.6): ItemAnimation => ({ delay, duration, kind: 'pop' });
const slide = (delay = 0, duration = 0.6): ItemAnimation => ({ delay, duration, kind: 'slide-left' });

/** A symbol inside the levels given, outermost first. */
function symbol(id: string, groups: GroupLevel[] = [], animation?: ItemAnimation): CanvasSymbol {
  return {
    ...(groups.length ? { groups } : {}),
    ...(animation ? { animation } : {}),
    id,
    kind: 'symbol',
    mark: 'ring',
    rotate: 0,
    size: 42,
    x: 0,
    y: 0,
  };
}

const played = (items: CanvasItem[]) => Object.fromEntries(items.map((item) => [item.id, item.animation]));

describe('resolveGroupTiming', () => {
  it('gives every member the group entrance, one stagger apart, top of the list first', () => {
    const group: GroupLevel = { id: 'g', animation: pop(0.5), stagger: 0.2 };
    // Paint order bottom first, so c is listed first and starts first.
    const items = [symbol('a', [group]), symbol('b', [group]), symbol('c', [group])];

    expect(played(resolveGroupTiming(items))).toEqual({ a: pop(0.9), b: pop(0.7), c: pop(0.5) });
  });

  it('nests timing: an inner group takes one turn in its parent, then staggers its own children from there', () => {
    // The example from the issue: outer pops, 0.5s apart; inner slides, 0.2s apart.
    const outer: GroupLevel = { id: 'outer', animation: pop(), stagger: 0.5 };
    const inner: GroupLevel = { id: 'inner', animation: slide(), stagger: 0.2 };
    // Listed top first: inner (B over A), then C.
    const items = [symbol('C', [outer]), symbol('A', [outer, inner]), symbol('B', [outer, inner])];

    expect(played(resolveGroupTiming(items))).toEqual({ A: slide(0.2), B: slide(0), C: pop(0.5) });
  });

  it('counts an inner group’s own delay from its turn in its parent', () => {
    const outer: GroupLevel = { id: 'outer', animation: pop(1), stagger: 0.5 };
    const inner: GroupLevel = { id: 'inner', animation: pop(0.3) };
    // Listed: x (turn 0, starts 1s), then inner (turn 1, starts 1.5s + its own 0.3s).
    const items = [symbol('a', [outer, inner]), symbol('b', [outer, inner]), symbol('x', [outer])];

    expect(played(resolveGroupTiming(items))).toEqual({ a: pop(1.8), b: pop(1.8), x: pop(1) });
  });

  it('lets an inner group with no entrance of its own play its parent’s, staggered its own way', () => {
    const outer: GroupLevel = { id: 'outer', animation: pop() };
    const inner: GroupLevel = { id: 'inner', stagger: 0.25 };
    const items = [symbol('a', [outer, inner]), symbol('b', [outer, inner]), symbol('x', [outer])];

    expect(played(resolveGroupTiming(items))).toEqual({ a: pop(0.25), b: pop(0), x: pop(0) });
  });

  it('leaves items no group gives an entrance to as they were', () => {
    const items = [symbol('a', [{ id: 'g' }], slide(3)), symbol('b', [{ id: 'g' }]), symbol('loose', [], pop(1))];

    expect(resolveGroupTiming(items)).toBe(items);
  });

  it('returns the same array when nothing changes', () => {
    const group: GroupLevel = { id: 'g', animation: pop() };
    const items = resolveGroupTiming([symbol('a', [group]), symbol('b', [group])]);

    expect(resolveGroupTiming(items)).toBe(items);
  });

  it('keeps delays the number the sliders set, not a floating-point sum', () => {
    const group: GroupLevel = { id: 'g', animation: pop(), stagger: 0.1 };
    const items = [symbol('a', [group]), symbol('b', [group]), symbol('c', [group]), symbol('d', [group])];

    expect(resolveGroupTiming(items)[0].animation?.delay).toBe(0.3);
  });
});

describe('setGroupTiming', () => {
  it('stores the settings on every member and resolves them', () => {
    const items = [symbol('a', [{ id: 'g' }]), symbol('b', [{ id: 'g' }])];
    const set = setGroupTiming(items, 'g', pop(), 0.4);

    expect(set.map((item) => item.groups?.[0])).toEqual([
      { id: 'g', animation: pop(), stagger: 0.4 },
      { id: 'g', animation: pop(), stagger: 0.4 },
    ]);
    expect(played(set)).toEqual({ a: pop(0.4), b: pop(0) });
  });

  it('sets an inner group without touching its parent’s settings', () => {
    const outer: GroupLevel = { id: 'outer', animation: pop(), stagger: 1 };
    const items = [symbol('a', [outer, { id: 'inner' }]), symbol('b', [outer, { id: 'inner' }]), symbol('x', [outer])];
    const set = setGroupTiming(items, 'inner', slide(), 0);

    expect(set[0].groups?.[0]).toEqual(outer);
    expect(played(set)).toEqual({ a: slide(1), b: slide(1), x: pop(0) });
  });

  it('takes the members’ entrances away with the group’s', () => {
    const group: GroupLevel = { id: 'g', animation: pop(), stagger: 0.2 };
    const items = resolveGroupTiming([symbol('a', [group]), symbol('b', [group])]);
    const cleared = setGroupTiming(items, 'g', null, 0);

    expect(cleared.every((item) => !('animation' in item))).toBe(true);
    expect(cleared[0].groups?.[0]).toEqual({ id: 'g' });
  });

  it('hands members back to the group around when an inner group’s entrance goes', () => {
    const outer: GroupLevel = { id: 'outer', animation: pop() };
    const inner: GroupLevel = { id: 'inner', animation: slide() };
    const items = resolveGroupTiming([symbol('a', [outer, inner]), symbol('b', [outer, inner]), symbol('x', [outer])]);

    expect(played(setGroupTiming(items, 'inner', null, 0))).toEqual({ a: pop(), b: pop(), x: pop() });
  });

  it('leaves members’ own entrances alone when only a stagger is set on a group with none', () => {
    const items = [symbol('a', [{ id: 'g' }], slide(2)), symbol('b', [{ id: 'g' }], pop(1))];
    const set = setGroupTiming(items, 'g', null, 0.5);

    expect(played(set)).toEqual({ a: slide(2), b: pop(1) });
    expect(set[0].groups?.[0]).toEqual({ id: 'g', stagger: 0.5 });
  });

  it('returns the same array for no change, or a group that is not there', () => {
    const group: GroupLevel = { id: 'g', animation: pop(), stagger: 0.2 };
    const items = [symbol('a', [group]), symbol('b', [group])];

    expect(setGroupTiming(items, 'g', pop(), 0.2)).toBe(items);
    expect(setGroupTiming(items, 'missing', pop(), 0)).toBe(items);
  });
});

describe('inheritedTiming', () => {
  it('takes over a staggered entrance loose items already play', () => {
    const listed = [symbol('a', [], pop(0.5)), symbol('b', [], pop(0.8))];

    expect(inheritedTiming(listed)).toEqual({ animation: pop(0.5), stagger: 0.3 });
  });

  it('takes nothing from items that do not share one', () => {
    expect(inheritedTiming([symbol('a', [], pop()), symbol('b', [], slide())])).toEqual({});
    expect(inheritedTiming([symbol('a', [], pop()), symbol('b')])).toEqual({});
  });

  it('takes nothing when a group is among them: it has an entrance of its own to keep', () => {
    expect(inheritedTiming([symbol('a', [{ id: 'g' }], pop()), symbol('b', [], pop())])).toEqual({});
  });
});

describe('keepInheritedEntrances', () => {
  // Outer slides in 2s late, children 1s apart. Listed top first: x, then the
  // inner group I, which has no entrance of its own.
  const outer: GroupLevel = { id: 'O', animation: slide(2), stagger: 1 };
  const inner: GroupLevel = { id: 'I', stagger: 0.5 };
  const items = resolveGroupTiming([symbol('a', [outer, inner]), symbol('b', [outer, inner]), symbol('x', [outer])]);

  it('hands the dissolving group\'s entrance to a group inside it that has none, at that child\'s turn', () => {
    const kept = keepInheritedEntrances(items, new Set(['O']));

    expect(kept[0].groups?.[1]).toEqual({ id: 'I', stagger: 0.5, animation: slide(3) });
    expect(kept[1].groups?.[1]).toEqual(kept[0].groups?.[1]);
  });

  it('keeps an ungrouped inner group playing exactly what it played, with its row saying so', () => {
    const before = played(items);
    const after = resolveGroupTiming(ungroupItems(keepInheritedEntrances(items, new Set(['O'])), ['x']));

    expect(played(after)).toEqual(before);
    expect(after[0].groups).toEqual([{ id: 'I', stagger: 0.5, animation: slide(3) }]);
  });

  it('leaves a group inside that has an entrance of its own alone', () => {
    const ownInner: GroupLevel = { id: 'I', animation: pop(0.4) };
    const own = [symbol('a', [outer, ownInner]), symbol('b', [outer, ownInner]), symbol('x', [outer])];

    expect(keepInheritedEntrances(own, new Set(['O']))).toBe(own);
  });

  it('does nothing for a dissolving group with no entrance of its own', () => {
    const plain = [symbol('a', [{ id: 'O' }, inner]), symbol('b', [{ id: 'O' }, inner]), symbol('x', [{ id: 'O' }])];

    expect(keepInheritedEntrances(plain, new Set(['O']))).toBe(plain);
  });
});

describe('pruneKeepingTiming', () => {
  it('keeps the timing of a group inside one a delete dissolves', () => {
    // Deleting x leaves O holding only I: O dissolves, and I takes its place.
    const outer: GroupLevel = { id: 'O', animation: slide(2), stagger: 1 };
    const inner: GroupLevel = { id: 'I', stagger: 0.5 };
    const items = resolveGroupTiming([symbol('a', [outer, inner]), symbol('b', [outer, inner]), symbol('x', [outer])]);
    const remaining = items.filter((item) => item.id !== 'x');

    const pruned = pruneKeepingTiming(remaining);

    expect(pruned.map((item) => item.groups?.map((level) => level.id))).toEqual([['I'], ['I']]);
    // I was the first child, so its turn began where O's did: 2s in.
    expect(played(pruned)).toEqual({ a: slide(2.5), b: slide(2) });
  });
});
