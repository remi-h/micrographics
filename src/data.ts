import type { CanvasItem, CanvasModule, CanvasSymbol, CanvasText, Palette, Settings, Template } from './types';

export const palettes: Palette[] = [
  {
    name: 'Carbon signal',
    background: '#1b1b1b',
    paper: '#101111',
    ink: '#f5f2ea',
    muted: '#8f8d86',
    accent: '#f5f2ea',
    second: '#f5f2ea',
  },
  {
    name: 'Bone black',
    background: '#f5f2ea',
    paper: '#f8f4ec',
    ink: '#171717',
    muted: '#171717',
    accent: '#171717',
    second: '#171717',
  },
  {
    name: 'Signal red',
    background: '#161616',
    paper: '#101111',
    ink: '#ff4f3d',
    muted: '#ff4f3d',
    accent: '#ff4f3d',
    second: '#ff4f3d',
  },
  {
    name: 'Electric cyan',
    background: '#121717',
    paper: '#0e1111',
    ink: '#55f0dc',
    muted: '#55f0dc',
    accent: '#55f0dc',
    second: '#55f0dc',
  },
];

export const templates: Array<{ id: Template; name: string }> = [
  { id: '006', name: '006 Coordinates' },
  { id: '007', name: '007 Optical' },
  { id: '008', name: '008 Function' },
  { id: '011', name: '011 Ampers' },
  { id: '012', name: '012 Ten Thousand' },
  { id: '013', name: '013 Form Function' },
];

export const marks = [
  'orbit',
  'sun',
  'chevrons',
  'ce',
  'diamond',
  'anchor',
  'signal',
  'tally',
  'triple',
  'eye',
  'flower',
  'spiral',
  'badge',
  'asterisk',
  'umbrella',
  'layers',
  'info',
  'quarter',
  'head',
  'spark',
  'target',
  'bracket',
  'waves',
  'fingerprint',
  'expand',
  'nodes',
  'arrows',
  'globe',
  'flag',
  'grid',
];

export const initialSettings: Settings = {
  template: '006',
  paletteIndex: 0,
  seed: 628,
  backgroundImage: null,
  labels: false,
  grid: false,
  noise: false,
  showBackground: true,
};

function textItem(id: string, text: string, x: number, y: number, size = 28, rotate = 0): CanvasText {
  return { id, kind: 'text', rotate, size, text, tone: 0.8, x, y };
}

function symbolItem(id: string, mark: string, x: number, y: number, size = 34, rotate = 0): CanvasSymbol {
  return { id, kind: 'symbol', mark, rotate, size, tone: 0.88, x, y };
}

function moduleItem(id: string, mark: string, x: number, y: number, w = 118, h = 26, rotate = 0): CanvasModule {
  return { id, kind: 'module', glyph: '', h, mark, rotate, tone: 0.72, w, x, y };
}

export function loadTemplateItems(template: Template): CanvasItem[] {
  if (template === 'blank') return [];

  const items: CanvasItem[] = {
    '006': [
      moduleItem('006-frame', 'flower', 210, 366, 705, 130),
      symbolItem('006-flower', 'flower', 302, 430, 54),
      textItem('006-coordinates', "51°50'18\"N   12°13'38\"E", 418, 405, 18),
      textItem('006-title', 'STAATLICHES BAUHAUS', 418, 450, 18),
      textItem('006-founded', 'FOUNDED 1919', 418, 492, 16),
      symbolItem('006-mark', 'target', 850, 490, 18),
    ],
    '007': [
      textItem('007-title', 'OPTICAL / 20', 520, 352, 28),
      textItem('007-code', '43R-004585', 615, 390, 13),
      textItem('007-asset', 'ASSET_ID 2026_MG_990X', 615, 424, 19),
      textItem('007-xiv', 'XIV', 510, 475, 36),
      moduleItem('007-pill', 'orbit', 610, 453, 138, 28),
      symbolItem('007-anchor', 'anchor', 805, 365, 38),
      symbolItem('007-waves', 'waves', 818, 472, 44),
    ],
    '008': [
      textItem('008-form', 'FORM', 610, 356, 34, 180),
      textItem('008-function', 'FUNCT-\nION', 426, 420, 34),
      symbolItem('008-info', 'info', 750, 425, 30),
      symbolItem('008-fingerprint', 'fingerprint', 812, 425, 28),
      textItem('008-year', '©2026', 426, 520, 14),
      moduleItem('008-corner-a', 'bracket', 424, 330, 52, 52),
      moduleItem('008-corner-b', 'bracket', 755, 472, 52, 52, 180),
    ],
    '011': [
      symbolItem('011-info', 'info', 285, 365, 34),
      textItem('011-title', 'AMPERS', 330, 402, 58),
      textItem('011-amp', '&', 685, 402, 76),
      symbolItem('011-orbit', 'orbit', 716, 368, 38),
      moduleItem('011-time', 'badge', 300, 470, 132, 30),
      textItem('011-time-text', '11:6:18', 322, 492, 16),
      textItem('011-code', 'ASSET_ID 2026_MG_990X\n_PROCESS/SV01\n©2026', 575, 470, 13),
      symbolItem('011-grid', 'grid', 732, 492, 24),
      symbolItem('011-target', 'target', 782, 492, 24),
    ],
    '012': [
      textItem('012-title', 'Ten Thousand Hours', 360, 398, 42),
      textItem('012-caption', 'INTENTION OVER TIME LEADS\nTO THE HIGHEST FORM OF CRAFT', 424, 452, 15),
      moduleItem('012-top-a', 'tally', 377, 340, 95, 18),
      textItem('012-top-b', 'MMXXIV      #FFAAEE_SPEC', 520, 350, 14),
      symbolItem('012-info', 'info', 500, 520, 22),
      symbolItem('012-ce', 'ce', 575, 520, 25),
      symbolItem('012-arrows', 'arrows', 650, 520, 24),
      symbolItem('012-sun', 'sun', 720, 520, 24),
      moduleItem('012-year', 'badge', 660, 560, 70, 22),
    ],
    '013': [
      symbolItem('013-nodes', 'nodes', 390, 390, 70),
      textItem('013-title', 'FORM  &\nFUNCTION', 535, 390, 26),
      textItem('013-meta-a', '#FFF7E7_LAYOUT\n03 KGCL_ELEMENTS', 390, 465, 12),
      textItem('013-meta-b', 'TYPEFACE\n3.4 LAYOUT', 690, 465, 12),
      symbolItem('013-eye', 'eye', 450, 525, 18),
      symbolItem('013-triple', 'triple', 790, 525, 18),
      moduleItem('013-rule', 'chevrons', 510, 515, 220, 12),
    ],
  }[template];

  return items.map((item) => ({ ...item }));
}
