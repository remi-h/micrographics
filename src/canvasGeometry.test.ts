import { hitBounds, inkBounds, intersects, textAdvance, textBox } from './canvasGeometry';
import type { CanvasSymbol, CanvasText } from './types';

function symbol(overrides: Partial<CanvasSymbol> = {}): CanvasSymbol {
  return { id: 's1', kind: 'symbol', mark: 'star', rotate: 0, size: 42, x: 100, y: 100, ...overrides };
}

function text(overrides: Partial<CanvasText> = {}): CanvasText {
  return { id: 't1', kind: 'text', rotate: 0, size: 50, text: 'MICRO', x: 200, y: 300, ...overrides };
}

function expectBox(actual: { x: number; y: number; width: number; height: number }, expected: number[]) {
  const [x, y, width, height] = expected;
  expect(actual.x).toBeCloseTo(x, 6);
  expect(actual.y).toBeCloseTo(y, 6);
  expect(actual.width).toBeCloseTo(width, 6);
  expect(actual.height).toBeCloseTo(height, 6);
}

describe('hitBounds', () => {
  it('pads a symbol by 8 units on every side, centred on the item', () => {
    // Must match the transparent hit <rect> MicrographicSvg draws at
    // (-size/2 - 8, size + 16); if the two drift apart, the marquee starts
    // selecting items the pointer cannot click.
    expectBox(hitBounds(symbol({ size: 42, x: 100, y: 100 })), [71, 71, 58, 58]);
    expectBox(hitBounds(symbol({ size: 10, x: 0, y: 0 })), [-13, -13, 26, 26]);
  });

  it('measures a single line of text from its longest line and pads it', () => {
    // 13 chars * (50 * 0.6 + 2) = 416, well past the 90-unit floor, + 16 of
    // padding. Top is the font's ascent (0.93 em) above the baseline, less 10.
    const box = hitBounds(text({ text: 'MICROGRAPHICS', size: 50, x: 200, y: 300 }));
    expectBox(box, [192, 243.5, 432, 80.5]);
  });

  it('floors a short label at 90 units of width so it stays grabbable', () => {
    // "CE" is only 28 units of ink; the box is the 90-unit floor + padding.
    expectBox(hitBounds(text({ text: 'CE', size: 20, x: 0, y: 0 })), [-8, -28.6, 106, 45.4]);
  });

  it('grows with each line of a multi-line string', () => {
    const box = hitBounds(text({ text: 'AB\nCDE', size: 30, x: 10, y: 60 }));
    expectBox(box, [2, 22.1, 106, 89.5]);
  });

  it('ignores rotation, matching the un-rotated hit rect inside the rotated group', () => {
    // The hit <rect> is a child of the group that rotate() is applied to, so
    // it turns with the item; this box is the item-space rect before that
    // turn, which is what the marquee compares against today.
    expectBox(hitBounds(text({ text: 'CE', size: 20, x: 0, y: 0, rotate: 90 })), [-8, -28.6, 106, 45.4]);
    expectBox(hitBounds(symbol({ size: 42, x: 100, y: 100, rotate: 45 })), [71, 71, 58, 58]);
  });
});

describe('inkBounds', () => {
  it('uses the padded box for a symbol', () => {
    // Symbol ink and symbol hit box coincide: the 8-unit pad stands in for
    // strokes that run past the mark's nominal design box. The template
    // overlap test is calibrated against this.
    expect(inkBounds(symbol())).toEqual(hitBounds(symbol()));
  });

  it('measures text tight: no padding and no minimum width', () => {
    // 2 chars * (20 * 0.6 + 2) = 28 wide; one line box is 1.17 em tall and
    // starts 0.93 em above the baseline, at the item's x rather than 8 left.
    expectBox(inkBounds(text({ text: 'CE', size: 20, x: 0, y: 0 })), [0, -18.6, 28, 23.4]);
  });

  it('measures multi-line text from its longest line and its line count', () => {
    // Each line after the first adds the tspan's 1.08 em step.
    expectBox(inkBounds(text({ text: 'AB\nCDE', size: 30, x: 10, y: 60 })), [10, 32.1, 60, 67.5]);
  });

  it('rotates a side label about the item anchor', () => {
    // Text renders inside a group rotated about (x, y). At 90 degrees the
    // upright box (w x h), whose top sits `ascent` above the anchor, lands as
    // an (h x w) box starting at (x + ascent - h, y).
    const item = text({ text: 'AB\nCDE', size: 30, x: 10, y: 60, rotate: 90 });
    const upright = inkBounds({ ...item, rotate: 0 });
    const ascent = item.y - upright.y;
    expectBox(inkBounds(item), [10 + ascent - upright.height, 60, upright.height, upright.width]);
  });

  it('keeps a half-turn the same size as the upright box', () => {
    const item = text({ text: 'MICRO', size: 40, x: 500, y: 400, rotate: 180 });
    const upright = inkBounds({ ...item, rotate: 0 });
    const turned = inkBounds(item);
    expect(turned.width).toBeCloseTo(upright.width, 6);
    expect(turned.height).toBeCloseTo(upright.height, 6);
    // 180 degrees about (x, y) flips the box through the anchor: the corner
    // that sat `ascent` above it ends up the same distance below.
    const ascent = item.y - upright.y;
    expect(turned.x).toBeCloseTo(item.x - upright.width, 6);
    expect(turned.y).toBeCloseTo(item.y + ascent - upright.height, 6);
  });

  it('leaves an unrotated item in place', () => {
    const item = text({ rotate: 0 });
    expectBox(inkBounds(item), [item.x, item.y - 50 * 0.93, 5 * (50 * 0.6 + 2), 50 * 1.17]);
  });
});

describe('intersects', () => {
  const base = { x: 0, y: 0, width: 10, height: 10 };

  it('is true for boxes that overlap', () => {
    expect(intersects(base, { x: 5, y: 5, width: 10, height: 10 })).toBe(true);
  });

  it('is true when one box contains the other, in either order', () => {
    const inner = { x: 2, y: 2, width: 3, height: 3 };
    expect(intersects(base, inner)).toBe(true);
    expect(intersects(inner, base)).toBe(true);
  });

  it('is false for boxes that only touch along an edge', () => {
    expect(intersects(base, { x: 10, y: 0, width: 10, height: 10 })).toBe(false);
    expect(intersects(base, { x: 0, y: 10, width: 10, height: 10 })).toBe(false);
  });

  it('is false when the boxes are apart on either axis alone', () => {
    expect(intersects(base, { x: 20, y: 0, width: 10, height: 10 })).toBe(false);
    expect(intersects(base, { x: 0, y: -20, width: 10, height: 10 })).toBe(false);
  });

  it('still reports a degenerate box that sits strictly inside another', () => {
    // A zero-width marquee (a plain click, before the pointer moves) is inside
    // the item it lands on, so this stays true; only the edges are exclusive.
    expect(intersects(base, { x: 5, y: 5, width: 0, height: 5 })).toBe(true);
    expect(intersects(base, { x: 0, y: 5, width: 0, height: 5 })).toBe(false);
  });
});

// The text model is only worth anything if it matches what gets painted. These
// are getBBox() readings from Chromium for real <text> elements with the
// canvas's own attributes -- IBM Plex Mono 800, letter-spacing 2 -- taken with
// the font loaded. Align, hit-testing, collision checks, placement and
// template layout all run on the model, so this is the test that keeps every
// one of them honest.
describe('textBox against what Chromium paints', () => {
  const measured: Array<{ text: string; size: number; y: number; width: number; height: number }> = [
    { text: 'CE', size: 42, y: -39.67, width: 54.55, height: 49.59 },
    { text: 'MICRO', size: 42, y: -39.67, width: 136.33, height: 49.59 },
    { text: 'MACHINE WASH COLD / DO NOT BLEACH / WARM IRON', size: 18, y: -17.36, width: 577.01, height: 22.31 },
    { text: 'MACHINE WASH COLD / DO NOT BLEACH / WARM IRON', size: 42, y: -39.67, width: 1226.73, height: 49.59 },
    { text: 'Some reasonably long label', size: 48, y: -44.63, width: 802.79, height: 57.03 },
    { text: 'A', size: 12, y: -9.92, width: 9.22, height: 12.4 },
    { text: 'A', size: 96, y: -89.26, width: 59.78, height: 111.57 },
    { text: '- - - - - - - - - - - - - - - - - - - -', size: 24, y: -22.31, width: 640.19, height: 27.27 },
    { text: 'TWO\nLINES', size: 40, y: -37.19, width: 130.36, height: 90.31 },
  ];

  it.each(measured)('matches the painted width of "$text" at $size to within 0.5%', ({ text, size, width }) => {
    // The old `chars * size * 0.62` missed the long care label by 75 units --
    // the letter spacing it never counted -- and centred it 37 units wrong.
    expect(Math.abs(textBox(text, size).width - width) / width).toBeLessThan(0.005);
  });

  it.each(measured)('puts the middle of "$text" at $size where Chromium does', ({ text, size, y, height }) => {
    // The middle is what alignment lines up. Within a unit and a half, or 2%
    // of the size for large type -- small sizes are snapped to whole pixels
    // by the rasterizer, which no model reproduces.
    const box = textBox(text, size);
    const tolerance = Math.max(1.5, size * 0.02);
    expect(Math.abs(box.y + box.height / 2 - (y + height / 2))).toBeLessThan(tolerance);
  });

  it('counts the letter spacing after every character, not only between them', () => {
    // Chromium adds it after the last glyph too, which is why "A" alone is
    // 0.6 em + 2 rather than 0.6 em.
    expect(textAdvance(1, 12)).toBeCloseTo(9.2, 6);
    expect(textAdvance(0, 12)).toBe(0);
  });
});
