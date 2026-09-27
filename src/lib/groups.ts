import { createGroupId } from './itemIds';
import type { CanvasItem, GroupLevel } from '../types';

// Grouping.
//
// A group is not a container: an item is never moved inside anything. Each
// item carries the groups it is in as a path, outermost first, and items are
// in the same group when their paths hold a level with the same id. Groups
// nest because a path can be longer than one: grouping two groups gives both
// of them's members a new outermost level.
//
// Everything the editor already does to a set of items -- move, scale, rotate,
// align, delete, export -- therefore keeps working untouched, because a group
// only ever changes *which* ids end up selected, never what happens to them
// afterwards. Selection works on outermost groups: an item is never selected
// without the rest of the outermost group it is in.
//
// That is why the rest of this file is pure functions over an item array.
// Nothing here reads or writes React state; the hook that does calls in.
//
// Invariants the operations below maintain, and `normalizeGroups` restores on
// anything that arrives from outside (a save):
//
//   - A group's members are contiguous in the items array, at every level. The
//     array *is* the z-order (later items paint on top), so a group
//     interleaved with non-members could not be drawn as one row in the layer
//     list without that row lying about what sits above what.
//   - Paths agree: every member of a group reaches it through the same outer
//     groups. A group is inside exactly one parent, or none.
//   - A group has at least two children -- items directly in it, or groups
//     directly in it. A group of one is indistinguishable from its only child
//     to the user but would still take a row of its own, so it is dissolved.

const path = (item: CanvasItem): GroupLevel[] => item.groups ?? [];

/** The id of the outermost group an item is in, if any. */
export function outermostGroupId(item: CanvasItem): string | undefined {
  return item.groups?.[0]?.id;
}

/** The members of group `groupId`, in paint order. */
export function groupMembers(items: CanvasItem[], groupId: string): CanvasItem[] {
  return items.filter((item) => path(item).some((level) => level.id === groupId));
}

/** A group's own level -- its settings -- as its members carry it. */
export function groupLevel(items: CanvasItem[], groupId: string): GroupLevel | undefined {
  for (const item of items) {
    const level = path(item).find((candidate) => candidate.id === groupId);
    if (level) return level;
  }
  return undefined;
}

/**
 * The ids that must be selected together with `ids`, given the groups in
 * `items`: the whole outermost group of each. Ids naming nothing on the canvas
 * are dropped: the result is always a set of real items, in paint order.
 * Callers count what comes back, so a branch that passed stale ids through
 * could report two items where the canvas holds one.
 */
export function expandToGroups(ids: string[], items: CanvasItem[]): string[] {
  const groupIds = new Set<string>();
  for (const item of items) {
    const outer = outermostGroupId(item);
    if (outer && ids.includes(item.id)) groupIds.add(outer);
  }

  const expanded = new Set(ids);
  for (const item of items) {
    const outer = outermostGroupId(item);
    if (outer && groupIds.has(outer)) expanded.add(item.id);
  }

  // Item order, not click order: a selection is a set, and returning it in the
  // order it is painted keeps the layer list and the canvas agreeing.
  return items.filter((item) => expanded.has(item.id)).map((item) => item.id);
}

/**
 * The selection as the things it is made of: each outermost group in it as
 * one unit, and each loose item as one of its own, in paint order. Align and
 * distribute move these rather than items, so a group keeps its own layout
 * and lines up with the rest as the one thing it is everywhere else.
 */
export function selectionUnits(items: CanvasItem[], ids: string[]): CanvasItem[][] {
  const units = new Map<string, CanvasItem[]>();
  for (const item of items) {
    if (!ids.includes(item.id)) continue;
    const key = outermostGroupId(item) ?? `item:${item.id}`;
    if (!units.has(key)) units.set(key, []);
    units.get(key)!.push(item);
  }
  return [...units.values()];
}

/**
 * Whether `ids` is exactly one whole outermost group and nothing else -- the
 * state in which grouping has nothing left to do and ungrouping is the useful
 * action. Two groups, or a group plus a loose item, is not this.
 */
export function isOneWholeGroup(items: CanvasItem[], ids: string[]): boolean {
  const selected = items.filter((item) => ids.includes(item.id));
  if (selected.length < 2) return false;

  const groupId = outermostGroupId(selected[0]);
  if (!groupId || !selected.every((item) => outermostGroupId(item) === groupId)) return false;

  return items.filter((item) => outermostGroupId(item) === groupId).length === selected.length;
}

/**
 * Which grouping actions make sense for a selection. The layer list and the
 * canvas each offer these on right-click, and both ask here, so the two menus
 * cannot disagree about what a selection can do.
 *
 * - Group: two or more things -- loose items or whole groups -- that are not
 *   already exactly one whole group. Grouping groups nests them.
 * - Ungroup: any selected item belongs to a group.
 */
export function groupActions(items: CanvasItem[], ids: string[]): { canGroup: boolean; canUngroup: boolean } {
  const selected = items.filter((item) => ids.includes(item.id));
  return {
    canGroup: selected.length > 1 && !isOneWholeGroup(items, ids),
    canUngroup: selected.some((item) => path(item).length > 0),
  };
}

/**
 * Puts every item in `ids`, with the rest of each one's outermost group, into
 * one new group. Groups among them keep their own structure and become groups
 * *inside* the new one. The new group is gathered together at its topmost
 * member's position in the z-order. Returns `items` unchanged when there is
 * nothing to group.
 *
 * `level` seeds the new group's settings, for a caller that wants the group
 * to keep an entrance its members already share.
 */
export function groupItems(items: CanvasItem[], ids: string[], level: Omit<GroupLevel, 'id'> = {}): CanvasItem[] {
  const members = new Set(expandToGroups(ids, items));
  if (members.size < 2) return items;
  // Re-grouping a group that is already whole would only wrap it in a group of
  // one: nothing on screen changes, but the caller would take a history entry
  // for it, and the user's next undo would appear to do nothing.
  if (isOneWholeGroup(items, [...members])) return items;

  const outer: GroupLevel = { ...level, id: createGroupId() };
  const grouped = items.filter((item) => members.has(item.id)).map((item) => ({ ...item, groups: [outer, ...path(item)] }));
  const rest = items.filter((item) => !members.has(item.id));

  // The group lands where its topmost member was, so grouping never sends the
  // selection behind something it was in front of.
  const topIndex = items.reduce((last, item, index) => (members.has(item.id) ? index : last), -1);
  const above = items.slice(0, topIndex + 1).filter((item) => !members.has(item.id)).length;

  return [...rest.slice(0, above), ...grouped, ...rest.slice(above)];
}

/**
 * Takes the outermost group off every outermost group any of `ids` is in --
 * one level. A group of groups comes apart into those groups; each of them
 * stays whole until it is ungrouped in turn. Item order is untouched.
 */
export function ungroupItems(items: CanvasItem[], ids: string[]): CanvasItem[] {
  const groupIds = new Set<string>();
  for (const item of items) {
    const outer = outermostGroupId(item);
    if (outer && ids.includes(item.id)) groupIds.add(outer);
  }
  if (groupIds.size === 0) return items;

  return items.map((item) => {
    const outer = outermostGroupId(item);
    return outer && groupIds.has(outer) ? withPath(item, path(item).slice(1)) : item;
  });
}

/**
 * Dissolves any group left with fewer than two children. Call after removing
 * items: deleting all but one member would otherwise leave a lone item wearing
 * a group, which the layer list would still draw as a group row -- and a
 * group whose only child is another group is the same thing one level up.
 */
export function pruneGroups(items: CanvasItem[]): CanvasItem[] {
  let current = items;
  // Dissolving one level can leave its parent with one child in turn, so
  // repeat until nothing changes. Each pass removes a level or stops.
  for (;;) {
    const children = new Map<string, Set<string>>();
    for (const item of current) {
      const levels = path(item);
      levels.forEach((level, depth) => {
        const child = levels[depth + 1]?.id ?? `item:${item.id}`;
        if (!children.has(level.id)) children.set(level.id, new Set());
        children.get(level.id)!.add(child);
      });
    }
    const lonely = new Set([...children].filter(([, set]) => set.size < 2).map(([id]) => id));
    if (lonely.size === 0) return current;
    current = current.map((item) =>
      path(item).some((level) => lonely.has(level.id))
        ? withPath(
            item,
            path(item).filter((level) => !lonely.has(level.id)),
          )
        : item,
    );
  }
}

/**
 * Gives every group among `items` a fresh id, at every level, keeping which
 * items share which group. Copies are made this way so that pasting a group
 * produces a second, separate group rather than silently enlarging the one
 * that was copied. Settings travel with the copy.
 */
export function regroupCopies(items: CanvasItem[]): CanvasItem[] {
  const replacements = new Map<string, string>();
  const fresh = (id: string) => {
    if (!replacements.has(id)) replacements.set(id, createGroupId());
    return replacements.get(id)!;
  };
  return items.map((item) =>
    item.groups ? { ...item, groups: item.groups.map((level) => ({ ...level, id: fresh(level.id) })) } : item,
  );
}

/**
 * Makes groups from anywhere -- a save, a hand-edited one included -- keep
 * the invariants at the top of this file:
 *
 * - Paths agree. The first member met, bottom up, decides the path to each
 *   group; a member reaching it any other way is cut off at the first level
 *   that disagrees, and every copy of a level takes the first one's settings.
 * - Members are contiguous, at every level. Each group is gathered at its
 *   topmost member's place, the way grouping gathers it.
 * - No group has fewer than two children.
 */
export function normalizeGroups(items: CanvasItem[]): CanvasItem[] {
  const parents = new Map<string, string | null>();
  const levels = new Map<string, GroupLevel>();
  const agreed = items.map((item) => {
    const kept: GroupLevel[] = [];
    for (const level of path(item)) {
      const parent = kept[kept.length - 1]?.id ?? null;
      if (parents.has(level.id) && parents.get(level.id) !== parent) break;
      if (kept.some((outer) => outer.id === level.id)) break;
      parents.set(level.id, parent);
      if (!levels.has(level.id)) levels.set(level.id, level);
      kept.push(levels.get(level.id)!);
    }
    return kept.length === path(item).length && kept.every((level, depth) => level === path(item)[depth])
      ? item
      : withPath(item, kept);
  });

  return pruneGroups(gather(agreed, 0));
}

// Gathers each group at `depth` into one run, at its topmost member's place,
// then does the same inside each run one level down.
function gather(items: CanvasItem[], depth: number): CanvasItem[] {
  const top = new Map<string, number>();
  items.forEach((item, index) => {
    const id = path(item)[depth]?.id;
    if (id) top.set(id, index);
  });
  const out: CanvasItem[] = [];
  items.forEach((item, index) => {
    const id = path(item)[depth]?.id;
    if (!id) {
      out.push(item);
      return;
    }
    if (top.get(id) !== index) return;
    out.push(...gather(items.filter((member) => path(member)[depth]?.id === id), depth + 1));
  });
  return out;
}

/**
 * A node of the Layers list: one item, or a whole group with its children --
 * items and groups directly in it, topmost first. `id` is the item's id or the
 * group's; `items` is every item the node stands for, in paint order.
 */
export type LayerRow =
  | { kind: 'item'; id: string; item: CanvasItem; items: CanvasItem[] }
  | { kind: 'group'; id: string; groupId: string; level: GroupLevel; items: CanvasItem[]; children: LayerRow[] };

/**
 * The Layers list, topmost first, as a tree: outermost groups at the top
 * level, each holding its children. A group's members are contiguous (see the
 * note at the top of this file), so each level is a single pass: a run of the
 * same group id becomes one node.
 */
export function layerRows(items: CanvasItem[]): LayerRow[] {
  return nodesAt(items, 0);
}

function nodesAt(items: CanvasItem[], depth: number): LayerRow[] {
  const runs: CanvasItem[][] = [];
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index];
    const id = path(item)[depth]?.id;
    const previous = runs[runs.length - 1];
    if (id && previous && path(previous[0])[depth]?.id === id) {
      // Walking top-down, so each next member belongs under the ones already
      // collected; unshift keeps a run in painting order.
      previous.unshift(item);
    } else {
      runs.push([item]);
    }
  }

  const seen = new Set<string>();
  return runs.map((run) => {
    const level = path(run[0])[depth];
    if (!level) return { kind: 'item', id: run[0].id, item: run[0], items: run };
    // A hand-edited save could split a group into two runs; two nodes sharing
    // a React key is a worse failure than two nodes for one group, so the
    // second takes its topmost member's id. normalizeGroups prevents it.
    const id = seen.has(level.id) ? `${level.id}:${run[run.length - 1].id}` : level.id;
    seen.add(level.id);
    return { kind: 'group', id, groupId: level.id, level, items: run, children: nodesAt(run, depth + 1) };
  });
}

/** Every id a layer row stands for. */
export function rowItemIds(row: LayerRow): string[] {
  return row.items.map((item) => item.id);
}

/**
 * Moves one top-level Layers row -- an item, or a whole group -- to a new
 * place in the list, and returns the items in the paint order that list now
 * describes.
 *
 * `gap` is where the row is dropped, counted in the list as it stands, topmost
 * first: 0 is above the top row, `rows.length` is below the bottom one, and
 * `i` is between rows `i - 1` and `i`. Counting gaps rather than destination
 * indices is what a drop indicator shows, and it keeps "drop just above
 * myself" and "drop just below myself" both meaning "stay put".
 *
 * The move is made on rows and flattened back to items, never on items
 * directly, so a group travels whole and its members stay contiguous: there
 * is no gap *inside* a group to drop a row into (a group's children are
 * reordered among themselves by `moveChild`). Returns `items` itself when
 * nothing moves, so the caller can skip an undo entry for a no-op.
 */
export function moveRow(items: CanvasItem[], rowId: string, gap: number): CanvasItem[] {
  const rows = layerRows(items);
  const reordered = moveToGap(
    rows,
    rows.findIndex((row) => row.id === rowId),
    gap,
  );
  if (!reordered) return items;

  // Rows run topmost first and items bottom first, so flatten in reverse; a
  // row already holds its items in painting order.
  return reordered.reverse().flatMap((row) => row.items);
}

/**
 * Moves one child of group `groupId` -- an item directly in it, or a group
 * directly in it -- to a new place among the group's children, as the open
 * group lists them: topmost first, with `gap` counted the way `moveRow`
 * counts it. The group keeps the places in the paint order it had; only which
 * child is in which of them changes, so nothing outside the group moves, and
 * nothing can be dragged out of its group this way. Ungroup is for that.
 *
 * Returns `items` itself when nothing moves, or when there is no such child.
 */
export function moveChild(items: CanvasItem[], groupId: string, childId: string, gap: number): CanvasItem[] {
  const group = findRow(layerRows(items), groupId);
  if (!group || group.kind !== 'group') return items;

  const reordered = moveToGap(
    group.children,
    group.children.findIndex((child) => child.id === childId),
    gap,
  );
  if (!reordered) return items;

  // The group's members are contiguous, so its places are one run of indices.
  const start = items.indexOf(group.items[0]);
  return [...items.slice(0, start), ...reordered.reverse().flatMap((child) => child.items), ...items.slice(start + group.items.length)];
}

/** The row for group or item `id`, wherever it sits in the tree. */
export function findRow(rows: LayerRow[], id: string): LayerRow | undefined {
  for (const row of rows) {
    if (row.id === id) return row;
    if (row.kind === 'group') {
      const found = findRow(row.children, id);
      if (found) return found;
    }
  }
  return undefined;
}

/**
 * `list` with the entry at `from` moved into `gap` -- counted in the list as
 * it stands, 0 above the first entry and `list.length` below the last -- or
 * null when that leaves it where it was, or `from` is not in the list.
 */
function moveToGap<T>(list: T[], from: number, gap: number): T[] | null {
  if (from < 0) return null;
  const target = Math.max(0, Math.min(list.length, Math.round(gap)));
  // Removing the entry first shifts every gap below it up by one.
  const to = target > from ? target - 1 : target;
  if (to === from) return null;

  const reordered = [...list];
  const [moving] = reordered.splice(from, 1);
  reordered.splice(to, 0, moving);
  return reordered;
}

// `delete item.groups` on a copy rather than `groups: undefined` when the path
// empties: the item is about to be persisted as JSON, and an explicit
// undefined is dropped by JSON.stringify anyway, so this keeps the saved shape
// and the in-memory shape the same object graph.
function withPath(item: CanvasItem, groups: GroupLevel[]): CanvasItem {
  const next: CanvasItem = { ...item, groups };
  if (groups.length === 0) delete next.groups;
  return next;
}
