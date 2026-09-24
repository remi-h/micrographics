import { textAdvance, textBox } from '../../canvasGeometry';
import type { CanvasItem, CanvasSymbol, CanvasText } from '../../types';

export function textItem(id: string, text: string, x: number, y: number, size = 28, rotate = 0): CanvasText {
  return { id, kind: 'text', rotate, size, text, x, y };
}

/**
 * A line of text whose middle sits on `centreX`, rather than one whose start
 * sits on `x`. For a centred layout, compute the start from the text model
 * instead of by hand: the care label's column was hand-placed with an estimate
 * that left out the canvas's letter spacing, and its wash label painted 43
 * units right of the column its own symbols stand on.
 */
export function centredText(id: string, text: string, centreX: number, y: number, size = 28): CanvasText {
  return textItem(id, text, centreX - textBox(text, size).width / 2, y, size);
}

export function symbolItem(id: string, mark: string, x: number, y: number, size = 34, rotate = 0): CanvasSymbol {
  return { id, kind: 'symbol', mark, rotate, size, x, y };
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
//
// As many dashes as *fit* in `widthPx`, never more. This used to divide by an
// estimate that left out the canvas's letter spacing and then round to the
// nearest count, so it asked for more dashes than the width could hold and a
// full-width rule ran straight off the right edge of the artboard.
export function ruleLine(id: string, x: number, y: number, widthPx: number, size = 13): CanvasText {
  const unit = '-  ';
  // `count` units, trimmed of the trailing spaces, is 3 * count - 2 glyphs.
  const perGlyph = textAdvance(1, size);
  const count = Math.max(1, Math.floor((widthPx / perGlyph + 2) / unit.length));
  return textItem(id, unit.repeat(count).trimEnd(), x, y, size);
}

/** A dashed rule of at most `widthPx`, centred on `centreX`. */
export function centredRuleLine(id: string, centreX: number, y: number, widthPx: number, size = 13): CanvasText {
  const rule = ruleLine(id, 0, y, widthPx, size);
  return { ...rule, x: centreX - textBox(rule.text, size).width / 2 };
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
