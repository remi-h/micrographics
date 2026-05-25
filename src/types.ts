export type Template = '006' | '007' | '008' | '011' | '012' | '013' | 'blank';

export type Palette = {
  name: string;
  background: string;
  ink: string;
  muted: string;
  accent: string;
  second: string;
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
  kind: 'text';
  rotate: number;
  size: number;
  text: string;
  tone: number;
  x: number;
  y: number;
};

export type CanvasSymbol = {
  id: string;
  kind: 'symbol';
  mark: string;
  rotate: number;
  size: number;
  tone: number;
  x: number;
  y: number;
};

export type CanvasItem = CanvasSymbol | CanvasText;
