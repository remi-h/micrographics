import type { ItemAnimation } from '../lib/animations';

export type Template = '001' | '002' | '003' | '004' | '005' | '006' | '007' | '008' | 'blank';

export type Palette = {
  name: string;
  background: string;
  ink: string;
  muted: string;
  accent: string;
  paper: string;
};

export type Settings = {
  template: Template;
  paletteIndex: number;
  backgroundImage: string | null;
  grid: boolean;
  showBackground: boolean;
};

/**
 * One group an item belongs to. A group is not a container: it is the items
 * that carry a level with its id, and every member carries a copy of the
 * level. The copies are kept identical by the operations that change them
 * (see groups.ts and groupTiming.ts).
 */
export type GroupLevel = {
  id: string;
  /**
   * The entrance this group gives its members, if it sets one. An inner
   * group's own entrance wins over an outer group's for the inner group's
   * members; `delay` is counted from the moment the group's turn comes.
   */
  animation?: ItemAnimation;
  /** Seconds between one child of this group starting and the next. */
  stagger?: number;
};

export type CanvasText = {
  id: string;
  /**
   * The groups this item is in, outermost first, when it is in any. Groups
   * nest: items sharing a level's id are in that group, and each level is
   * inside the one before it. Selected, moved and deleted together by their
   * outermost group. Optional because most items are not grouped, and because
   * a save written before groups existed has no such field. See groups.ts.
   */
  groups?: GroupLevel[];
  /**
   * The entrance this item plays, if it has one. Optional because most items
   * have none, and because a save written before animations existed has no
   * such field. See animations.ts.
   */
  animation?: ItemAnimation;
  kind: 'text';
  rotate: number;
  size: number;
  text: string;
  x: number;
  y: number;
};

export type CanvasSymbol = {
  id: string;
  /** The groups this item is in, outermost first; see CanvasText above and groups.ts. */
  groups?: GroupLevel[];
  /** The entrance this item plays, if it has one; see CanvasText above. */
  animation?: ItemAnimation;
  kind: 'symbol';
  mark: string;
  rotate: number;
  size: number;
  x: number;
  y: number;
};

export type CanvasItem = CanvasSymbol | CanvasText;
