import type { CanvasSymbol, CanvasText } from '../../types';

export function textItem(id: string, text: string, x: number, y: number, size = 28, rotate = 0): CanvasText {
  return { id, kind: 'text', rotate, size, text, tone: 0.8, x, y };
}

export function symbolItem(id: string, mark: string, x: number, y: number, size = 34, rotate = 0): CanvasSymbol {
  return { id, kind: 'symbol', mark, rotate, size, tone: 0.88, x, y };
}

// Shared document grid every template builds on: print-style registration
// marks at the page corners, and dashed hairline rules that separate the
// header/body/footer zones. Keeping this in one place means every template
// reads as the same "system" instead of a one-off layout.
const CANVAS_MARGIN = 60;
const CANVAS_WIDTH = 1200;
const CANVAS_HEIGHT = 800;

export function registrationMarks(prefix: string): CanvasSymbol[] {
  const size = 22;
  const positions: Array<[string, number, number]> = [
    ['tl', CANVAS_MARGIN, CANVAS_MARGIN],
    ['tr', CANVAS_WIDTH - CANVAS_MARGIN, CANVAS_MARGIN],
    ['bl', CANVAS_MARGIN, CANVAS_HEIGHT - CANVAS_MARGIN],
    ['br', CANVAS_WIDTH - CANVAS_MARGIN, CANVAS_HEIGHT - CANVAS_MARGIN],
  ];
  return positions.map(([key, x, y]) => symbolItem(`${prefix}-reg-${key}`, 'target', x, y, size));
}

export function ruleLine(id: string, x: number, y: number, widthPx: number, size = 13): CanvasText {
  const unit = '-  ';
  const unitWidth = unit.length * size * 0.62;
  const count = Math.max(1, Math.round(widthPx / unitWidth));
  return textItem(id, unit.repeat(count).trimEnd(), x, y, size);
}
