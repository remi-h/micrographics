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

// The same for text: padding around the drawn box, so a thin line of text is
// not a thin target.
const TEXT_HIT_PAD_X = 8;
const TEXT_HIT_PAD_TOP = 10;
const TEXT_HIT_EXTRA_HEIGHT = 22;

// A short label like "CE" is only a few units wide, which would be a fiddly
// mouse target, so the padded box is floored at this width.
const TEXT_MIN_HIT_WIDTH = 90;

// Canvas text is IBM Plex Mono at weight 800 with letterSpacing="2", and every
// figure below is calibrated against what Chromium paints for it -- getBBox()
// on a real <text>, across lengths from 1 to 45 characters and sizes from 12
// to 96. The model lands within 0.3% of the measured width everywhere.
//
// The old estimate was `characters * size * 0.62`. That is close to the
// font's own advance of 0.6 em, but it left out the letter spacing entirely:
// two units after *every* character, at any font size. On a 45-character care
// label at size 18 that is 90 units, so the model said 502 wide when Chromium
// drew 577. Aligning that label to a symbol centred it 37 units left of where
// it sits, and a template sized by the same estimate ran off the artboard.

/** Letter spacing the canvas applies to all text, in canvas units. Absolute:
 *  the same number of units between two characters at any font size. */
export const LETTER_SPACING = 2;

// IBM Plex Mono's advance: every glyph is 600/1000 of an em wide.
const CHAR_ADVANCE = 0.6;

// The tspan `dy` between lines, as a fraction of the font size.
export const LINE_HEIGHT_RATIO = 1.08;

// The font's ascent, and the height of one line's box, as fractions of the
// size -- what getBBox reports above and around the baseline. These describe
// the font's line box rather than the ink of any particular letter, but for
// Plex Mono the middle of that box lands on the middle of the capitals, which
// is what a label is visually centred by.
const ASCENT = 0.93;
const LINE_BOX = 1.17;

/** How wide a run of `characters` characters draws at `size`. */
export function textAdvance(characters: number, size: number) {
  return Math.max(0, characters) * (size * CHAR_ADVANCE + LETTER_SPACING);
}

/**
 * The box a text item draws, relative to its anchor: x = 0 at the start of
 * the line, y = 0 on the first baseline. This is the model every consumer of
 * a text item's size goes through -- hit-testing, collision, alignment,
 * placing a new item, laying out a template and the outline's fallback when
 * the DOM cannot be measured -- so there is exactly one estimate to be right.
 */
export function textBox(text: string, size: number): Box {
  const lines = text.split('\n');
  const widest = Math.max(0, ...lines.map((line) => line.length));
  return {
    x: 0,
    y: -size * ASCENT,
    width: textAdvance(widest, size),
    height: (lines.length - 1) * size * LINE_HEIGHT_RATIO + size * LINE_BOX,
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

  const box = textBox(item.text, item.size);
  return {
    x: item.x + box.x - TEXT_HIT_PAD_X,
    y: item.y + box.y - TEXT_HIT_PAD_TOP,
    width: Math.max(TEXT_MIN_HIT_WIDTH, box.width) + TEXT_HIT_PAD_X * 2,
    height: box.height + TEXT_HIT_EXTRA_HEIGHT,
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

  const local = textBox(item.text, item.size);
  const box = { x: item.x + local.x, y: item.y + local.y, width: local.width, height: local.height };
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
