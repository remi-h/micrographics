import type { CanvasItem } from './types';

export type Box = { x: number; y: number; width: number; height: number };

// Every canvas item has two boxes, and they are not the same box:
//
//   hitBounds() — what the pointer can grab. It mirrors the transparent
//     <rect> that MicrographicSvg renders behind each item, so anything that
//     answers "did the user hit this?" (clicks, drags, the marquee, the
//     multi-select bounds and the toolbar placed from them) must use it.
//
//   inkBounds() — what the item actually draws. No click padding, no minimum
//     width, so anything that answers "do these two collide?" or "where does
//     this sit on the page?" (collision checks, layout) uses it.
//
// Both are axis-aligned and expressed in canvas units.

// Breathing room around a symbol glyph so a small mark stays grabbable. This
// is not a free parameter: MicrographicSvg draws the symbol's hit rect at
// (-size/2 - 8, size + 16), so changing it here silently desyncs hit-testing
// from the rect the user is actually clicking.
const SYMBOL_HIT_PAD = 8;

// The same for text: the hit rect is drawn at x = -8, y = -size - 10 with 16
// units of extra width and 22 of extra height.
const TEXT_HIT_PAD_X = 8;
const TEXT_HIT_PAD_TOP = 10;
const TEXT_HIT_EXTRA_HEIGHT = 22;

// A short label like "CE" is only a few units wide, which would be a fiddly
// mouse target, so the padded box is floored at this width.
const TEXT_MIN_HIT_WIDTH = 90;

// Character advance and line spacing as fractions of the font size. Estimates:
// they ignore the letterSpacing="2" that <text> applies, which is why the
// selection outline measures the real glyphs with getBBox() instead. Good
// enough for hit-testing and collision checks, which run without a DOM.
const CHAR_WIDTH_RATIO = 0.62;
const LINE_HEIGHT_RATIO = 1.08;

function textMetrics(lines: string[], size: number) {
  return {
    width: Math.max(...lines.map((line) => line.length)) * size * CHAR_WIDTH_RATIO,
    height: lines.length * size * LINE_HEIGHT_RATIO,
  };
}

// The item's interaction box: click and drag target, marquee intersection,
// selection bounds. Padded, and floored at a minimum width for text.
export function hitBounds(item: CanvasItem): Box {
  if (item.kind === 'symbol') {
    const half = item.size / 2;
    return {
      x: item.x - half - SYMBOL_HIT_PAD,
      y: item.y - half - SYMBOL_HIT_PAD,
      width: item.size + SYMBOL_HIT_PAD * 2,
      height: item.size + SYMBOL_HIT_PAD * 2,
    };
  }

  const lines = item.text.split('\n');
  const { width, height } = textMetrics(lines, item.size);
  return {
    x: item.x - TEXT_HIT_PAD_X,
    y: item.y - item.size - TEXT_HIT_PAD_TOP,
    width: Math.max(TEXT_MIN_HIT_WIDTH, width) + TEXT_HIT_PAD_X * 2,
    height: height + TEXT_HIT_EXTRA_HEIGHT,
  };
}

// The item's drawn footprint: no click padding and no minimum width, so two
// boxes overlapping here means the glyphs themselves are on top of each other.
//
// For a symbol this is currently the same box as hitBounds(): a mark is drawn
// from a 36-unit design box scaled to `size`, and the 8-unit pad stands in for
// strokes and glyphs that run past that nominal box. The template overlap test
// is calibrated against this box, so narrowing it is a deliberate change with
// its own re-calibration, not a cleanup.
export function inkBounds(item: CanvasItem): Box {
  if (item.kind === 'symbol') return hitBounds(item);

  const lines = item.text.split('\n');
  const { width, height } = textMetrics(lines, item.size);
  const box = { x: item.x, y: item.y - item.size, width, height };
  if (!item.rotate) return box;

  // Text renders inside a group rotated about (item.x, item.y), so the
  // unrotated box above is wrong for side labels. Rotate its corners about
  // the anchor and take the axis-aligned box around them.
  const radians = (item.rotate * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const corners = [
    [box.x, box.y],
    [box.x + box.width, box.y],
    [box.x, box.y + box.height],
    [box.x + box.width, box.y + box.height],
  ].map(([cx, cy]) => {
    const dx = cx - item.x;
    const dy = cy - item.y;
    return [item.x + dx * cos - dy * sin, item.y + dx * sin + dy * cos];
  });
  const xs = corners.map(([cx]) => cx);
  const ys = corners.map(([, cy]) => cy);
  return {
    x: Math.min(...xs),
    y: Math.min(...ys),
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
  };
}

export function intersects(first: Box, second: Box) {
  return (
    first.x < second.x + second.width &&
    first.x + first.width > second.x &&
    first.y < second.y + second.height &&
    first.y + first.height > second.y
  );
}
