import type { CanvasItem, CanvasSymbol, CanvasText } from '../../types';

export function textItem(id: string, text: string, x: number, y: number, size = 28, rotate = 0): CanvasText {
  return { id, kind: 'text', rotate, size, text, tone: 0.8, x, y };
}

export function symbolItem(id: string, mark: string, x: number, y: number, size = 34, rotate = 0): CanvasSymbol {
  return { id, kind: 'symbol', mark, rotate, size, tone: 0.88, x, y };
}

// Print registration marks at the page corners. Used by the templates that
// want to read as a press sheet; deliberately not on every template.
export function registrationMarks(prefix: string, inset = 60): CanvasSymbol[] {
  const positions: Array<[string, number, number]> = [
    ['tl', inset, inset],
    ['tr', 1200 - inset, inset],
    ['bl', inset, 800 - inset],
    ['br', 1200 - inset, 800 - inset],
  ];
  return positions.map(([key, x, y]) => symbolItem(`${prefix}-reg-${key}`, 'target', x, y, 22));
}

// A dashed hairline rule. Built from dash characters rather than the 'line'
// mark because a scaled-up 'line' scales its stroke too, so it can't stay
// hairline-thin at poster width.
export function ruleLine(id: string, x: number, y: number, widthPx: number, size = 13): CanvasText {
  const unit = '-  ';
  const count = Math.max(1, Math.round(widthPx / (unit.length * size * 0.62)));
  return textItem(id, unit.repeat(count).trimEnd(), x, y, size);
}

// A comb of vertical strokes: rulers, scales, bar-chart bars, tick fields.
// One text item, so it stays crisp and can't collide with itself.
export function comb(id: string, x: number, y: number, count: number, size = 20): CanvasText {
  return textItem(id, '|'.repeat(Math.max(1, count)), x, y, size);
}

// An evenly pitched field of marks, for index-plate style density.
export function markGrid(
  prefix: string,
  marks: string[],
  options: { x: number; y: number; columns: number; pitchX: number; pitchY: number; size: number },
): CanvasSymbol[] {
  const { x, y, columns, pitchX, pitchY, size } = options;
  return marks.map((mark, index) =>
    symbolItem(
      `${prefix}-cell-${index}`,
      mark,
      x + (index % columns) * pitchX,
      y + Math.floor(index / columns) * pitchY,
      size,
    ),
  );
}

export type { CanvasItem };
