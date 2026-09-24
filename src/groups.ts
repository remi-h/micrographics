import { createGroupId } from './itemIds';
import type { CanvasItem } from './types';

// Grouping.
//
// A group is not a container: there is no tree, and an item is never moved
// inside anything. Each item simply carries an optional `groupId`, and two
// items are in the same group when they carry the same one. Everything the
// editor already does to a set of items — move, scale, rotate, align, delete,
// export — therefore keeps working untouched, because a group only ever
// changes *which* ids end up selected, never what happens to them afterwards.
//
// That is the whole design, and it is why the rest of this file is pure
// functions over an item array. Nothing here reads or writes React state; the
// hook that does calls into these.
//
// Two invariants the operations below maintain, both of which the layer list
// depends on:
//
//   - A group's members are contiguous in the items array. The array *is* the
//     z-order (later items paint on top), so a group whose members were
//     interleaved with non-members could not be drawn as one row in the layer
//     list without that row lying about what sits above what. `groupItems`
//     gathers the members when the group is formed.
//   - A group has at least two members. A group of one is indistinguishable
//     from an ungrouped item to the user but would still take a "Group of 1"
//     row, so deleting members down to one dissolves the group instead.

/**
 * The ids that must be selected together with `ids`, given the groups in
 * `items`. Ids naming nothing on the canvas are dropped: the result is always
 * a set of real items, in paint order, whether or not a group is involved.
 * Callers count what comes back, so a branch that passed stale ids through
 * could report two items where the canvas holds one.
 */
export function expandToGroups(ids: string[], items: CanvasItem[]): string[] {
  const groupIds = new Set<string>();
  for (const item of items) {
    if (item.groupId && ids.includes(item.id)) groupIds.add(item.groupId);
  }

  const expanded = new Set(ids);
  for (const item of items) {
    if (item.groupId && groupIds.has(item.groupId)) expanded.add(item.id);
  }

  // Item order, not click order: a selection is a set, and returning it in the
  // order it is painted keeps the layer list and the canvas agreeing.
  return items.filter((item) => expanded.has(item.id)).map((item) => item.id);
}

/**
 * Whether `ids` is exactly one whole group and nothing else — the state in
 * which grouping has nothing left to do and ungrouping is the useful action.
 * A selection spanning two groups, or a group plus a loose item, is not this.
 */
export function isOneWholeGroup(items: CanvasItem[], ids: string[]): boolean {
  const selected = items.filter((item) => ids.includes(item.id));
  if (selected.length < 2) return false;

  const groupId = selected[0].groupId;
  if (!groupId || !selected.every((item) => item.groupId === groupId)) return false;

  return items.filter((item) => item.groupId === groupId).length === selected.length;
}

/**
 * Which grouping actions make sense for a selection. The layer list and the
 * canvas each offer these on right-click, and both ask here, so the two menus
 * cannot disagree about what a selection can do.
 *
 * - Group: two or more items that are not already exactly one whole group.
 *   Two groups, or a group plus a loose item, can be grouped -- that merges
 *   them.
 * - Ungroup: any selected item belongs to a group.
 *
 * Usually only one applies, so the menu reads as a toggle. Both apply in the
 * one case where both are real choices: a group selected together with other
 * items, which can either be merged into one group or have its group taken
 * apart.
 */
export function groupActions(items: CanvasItem[], ids: string[]): { canGroup: boolean; canUngroup: boolean } {
  const selected = items.filter((item) => ids.includes(item.id));
  return {
    canGroup: selected.length > 1 && !isOneWholeGroup(items, ids),
    canUngroup: selected.some((item) => item.groupId !== undefined),
  };
}

/**
 * Puts every item in `ids` — and every group any of them belongs to — into one
 * new group, gathered together at the topmost member's position in the z-order.
 * Returns `items` unchanged when there is nothing to group.
 */
export function groupItems(items: CanvasItem[], ids: string[]): CanvasItem[] {
  const members = new Set(expandToGroups(ids, items));
  if (members.size < 2) return items;
  // Re-grouping a group that is already whole would only mint it a new id:
  // nothing on screen changes, but the caller would take a history entry for
  // it, and the user's next undo would appear to do nothing.
  if (isOneWholeGroup(items, [...members])) return items;

  const groupId = createGroupId();
  const grouped = items.filter((item) => members.has(item.id)).map((item) => ({ ...item, groupId }));
  const rest = items.filter((item) => !members.has(item.id));

  // The group lands where its topmost member was, so grouping never sends the
  // selection behind something it was in front of.
  const topIndex = items.reduce((last, item, index) => (members.has(item.id) ? index : last), -1);
  const above = items.slice(0, topIndex + 1).filter((item) => !members.has(item.id)).length;

  return [...rest.slice(0, above), ...grouped, ...rest.slice(above)];
}

/** Dissolves every group any of `ids` belongs to. Item order is untouched. */
export function ungroupItems(items: CanvasItem[], ids: string[]): CanvasItem[] {
  const groupIds = new Set<string>();
  for (const item of items) {
    if (item.groupId && ids.includes(item.id)) groupIds.add(item.groupId);
  }
  if (groupIds.size === 0) return items;

  return items.map((item) => (item.groupId && groupIds.has(item.groupId) ? withoutGroup(item) : item));
}

/**
 * Dissolves any group left with fewer than two members. Call after removing
 * items: deleting all but one member would otherwise leave a lone item wearing
 * a group id, which the layer list would still draw as a group row.
 */
export function pruneGroups(items: CanvasItem[]): CanvasItem[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    if (item.groupId) counts.set(item.groupId, (counts.get(item.groupId) ?? 0) + 1);
  }

  if (![...counts.values()].some((count) => count < 2)) return items;
  return items.map((item) => (item.groupId && (counts.get(item.groupId) ?? 0) < 2 ? withoutGroup(item) : item));
}

/**
 * Gives every group among `items` a fresh id, keeping which items share a group.
 * Copies are made this way so that pasting a group produces a second, separate
 * group rather than silently enlarging the one that was copied.
 */
export function regroupCopies(items: CanvasItem[]): CanvasItem[] {
  const replacements = new Map<string, string>();
  return items.map((item) => {
    if (!item.groupId) return item;
    let replacement = replacements.get(item.groupId);
    if (!replacement) {
      replacement = createGroupId();
      replacements.set(item.groupId, replacement);
    }
    return { ...item, groupId: replacement };
  });
}

/** A row in the Layers list: either one ungrouped item, or a whole group. */
export type LayerRow =
  | { kind: 'item'; id: string; item: CanvasItem }
  | { kind: 'group'; id: string; groupId: string; items: CanvasItem[] };

/**
 * The Layers list, topmost first. A group's members are contiguous (see the
 * note at the top of this file), so collapsing them is a single pass: a run of
 * the same `groupId` becomes one row.
 */
export function layerRows(items: CanvasItem[]): LayerRow[] {
  const rows: LayerRow[] = [];

  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index];
    if (!item.groupId) {
      rows.push({ kind: 'item', id: item.id, item });
      continue;
    }

    const previous = rows[rows.length - 1];
    if (previous?.kind === 'group' && previous.groupId === item.groupId) {
      // Walking top-down, so each next member belongs under the ones already
      // collected; unshift keeps a row's items in painting order.
      previous.items.unshift(item);
      continue;
    }

    // Keyed by the member it starts at rather than by the group id: the
    // contiguity invariant above means one row per group, but a hand-edited
    // save could break it, and two rows sharing a React key is a worse failure
    // than two rows for one group.
    rows.push({ kind: 'group', id: item.id, groupId: item.groupId, items: [item] });
  }

  return rows;
}

/** Every id a layer row stands for. */
export function rowItemIds(row: LayerRow): string[] {
  return row.kind === 'item' ? [row.id] : row.items.map((item) => item.id);
}

// `delete item.groupId` on a copy rather than `groupId: undefined`: the item is
// about to be persisted as JSON, and an explicit undefined is dropped by
// JSON.stringify anyway, so this keeps the saved shape and the in-memory shape
// the same object graph.
function withoutGroup(item: CanvasItem): CanvasItem {
  const next = { ...item };
  delete next.groupId;
  return next;
}
