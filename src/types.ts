import type { ItemAnimation } from './animations';

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

export type CanvasText = {
  id: string;
  /**
   * Set when this item is part of a group. Items sharing a groupId are
   * selected, moved and deleted together. Optional because most items are not
   * grouped, and because a save written before groups existed has no such
   * field. See groups.ts.
   */
  groupId?: string;
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
  /** Set when this item is part of a group; see CanvasText above and groups.ts. */
  groupId?: string;
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
