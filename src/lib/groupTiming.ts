import { groupAnimation, sameAnimation, staggeredAnimation, type ItemAnimation } from './animations';
import { groupLevel, groupMembers, layerRows, pruneGroups, type LayerRow } from './groups';
import type { CanvasItem, GroupLevel } from '../types';

// When a group's entrance plays, for groups inside groups.
//
// Each group stores its own entrance and stagger on its level (see
// GroupLevel). What plays, though, is still each item's own `animation`: the
// preview, the SVG export and the GIF all read that and nothing else. So the
// group settings are resolved down into the items here, and every operation
// that changes a group's settings or its children's order resolves again.
//
// Timing nests. A group's children -- items and groups directly in it -- take
// their turns in the order the open group lists them, top first, one stagger
// apart. A group's turn starts at its own delay, counted from its slot in its
// parent (from zero for an outermost group), and its children's turns follow
// from there. The entrance itself -- which movement, how long -- comes from
// the nearest group that sets one, so an inner group can play a different
// movement from the group around it. An item in no group that sets one keeps
// whatever entrance it had of its own.

/**
 * `items` with every grouped item's entrance worked out from its groups.
 * Items no group gives an entrance are left as they are. Returns `items`
 * itself when nothing changes.
 */
export function resolveGroupTiming(items: CanvasItem[]): CanvasItem[] {
  const resolved = new Map<string, ItemAnimation>();
  const visit = (row: LayerRow, start: number, inherited: ItemAnimation | undefined) => {
    if (row.kind === 'item') {
      if (inherited) resolved.set(row.id, staggeredAnimation({ ...inherited, delay: start }, 0, 0));
      return;
    }
    const own = row.level.animation;
    const style = own ?? inherited;
    const base = start + (own?.delay ?? 0);
    const stagger = row.level.stagger ?? 0;
    row.children.forEach((child, turn) => visit(child, base + stagger * turn, style));
  };
  layerRows(items).forEach((row) => visit(row, 0, undefined));

  let changed = false;
  const next = items.map((item) => {
    const animation = resolved.get(item.id);
    if (!animation || sameAnimation(item.animation, animation)) return item;
    changed = true;
    return { ...item, animation };
  });
  return changed ? next : items;
}

/**
 * Sets group `groupId`'s entrance and stagger -- `null` takes its entrance
 * away -- and resolves the result into its members. Returns `items` itself
 * when nothing changes.
 *
 * Taking a group's entrance away also takes away the entrance it was giving
 * its members, unless a group around it gives them one: left alone, they
 * would go on playing the entrance of a group that no longer has one.
 */
export function setGroupTiming(
  items: CanvasItem[],
  groupId: string,
  animation: ItemAnimation | null,
  stagger: number,
): CanvasItem[] {
  const current = groupLevel(items, groupId);
  if (!current) return items;
  if (sameAnimation(current.animation, animation) && (current.stagger ?? 0) === stagger) return items;

  const level: GroupLevel = { id: groupId, ...(animation ? { animation } : {}), ...(stagger ? { stagger } : {}) };
  const members = new Set(groupMembers(items, groupId).map((item) => item.id));
  const updated = items.map((item) =>
    members.has(item.id)
      ? { ...item, groups: item.groups!.map((candidate) => (candidate.id === groupId ? level : candidate)) }
      : item,
  );

  const resolved = resolveGroupTiming(updated);
  if (animation || !current.animation) return resolved;
  // Members no group gives an entrance any more had theirs from this one.
  return resolved.map((item) => {
    if (!members.has(item.id) || item.groups!.some((candidate) => candidate.animation)) return item;
    const next = { ...item };
    delete next.animation;
    return next;
  });
}

/**
 * The settings a new group should start with, when the items it is made of
 * already play one staggered entrance between them -- as items grouped before
 * groups had entrances of their own do. `listed` is the new group's members,
 * top of the list first. Only loose items are read: a group among them has an
 * entrance of its own to keep.
 */
export function inheritedTiming(listed: CanvasItem[]): Omit<GroupLevel, 'id'> {
  if (listed.some((item) => item.groups?.length)) return {};
  const shared = groupAnimation(listed);
  return shared ? { animation: shared.animation, ...(shared.stagger ? { stagger: shared.stagger } : {}) } : {};
}

/**
 * Before the groups `groupIds` are taken apart, gives each group directly
 * inside them that has no entrance of its own the one it was playing: the
 * dissolving group's movement, starting at that child's turn. Without this,
 * its members would go on playing that entrance -- it is written into them --
 * while its own row said it had none, and its stagger and order would stop
 * doing anything. Items directly inside keep what they play as their own
 * anyway, so they need nothing.
 *
 * The child takes the dissolving group's place, so its turn is counted from
 * where the dissolving group's own turn began.
 */
export function keepInheritedEntrances(items: CanvasItem[], groupIds: Set<string>): CanvasItem[] {
  const handed = new Map<string, ItemAnimation>();
  const visit = (row: LayerRow) => {
    if (row.kind !== 'group') return;
    const own = row.level.animation;
    if (own && groupIds.has(row.groupId)) {
      const stagger = row.level.stagger ?? 0;
      row.children.forEach((child, turn) => {
        if (child.kind === 'group' && !child.level.animation) {
          handed.set(child.groupId, staggeredAnimation(own, stagger, turn));
        }
      });
    }
    row.children.forEach(visit);
  };
  layerRows(items).forEach(visit);
  if (handed.size === 0) return items;

  return items.map((item) =>
    item.groups?.some((level) => handed.has(level.id))
      ? {
          ...item,
          groups: item.groups.map((level) => (handed.has(level.id) ? { ...level, animation: handed.get(level.id) } : level)),
        }
      : item,
  );
}

/**
 * `pruneGroups`, keeping the timing of whatever the dissolved groups held
 * (see `keepInheritedEntrances`), and resolved afterwards. For after a delete.
 */
export function pruneKeepingTiming(items: CanvasItem[]): CanvasItem[] {
  const levels = (list: CanvasItem[]) => new Set(list.flatMap((item) => item.groups?.map((level) => level.id) ?? []));
  const survivors = levels(pruneGroups(items));
  const dissolved = new Set([...levels(items)].filter((id) => !survivors.has(id)));
  return resolveGroupTiming(pruneGroups(keepInheritedEntrances(items, dissolved)));
}
