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
