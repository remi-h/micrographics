import { hitBounds, inkBounds, intersects } from './canvasGeometry';
import type { CanvasSymbol, CanvasText } from './types';

function symbol(overrides: Partial<CanvasSymbol> = {}): CanvasSymbol {
  return { id: 's1', kind: 'symbol', mark: 'star', rotate: 0, size: 42, tone: 0.9, x: 100, y: 100, ...overrides };
}

function text(overrides: Partial<CanvasText> = {}): CanvasText {
  return { id: 't1', kind: 'text', rotate: 0, size: 50, text: 'MICRO', tone: 0.82, x: 200, y: 300, ...overrides };
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
    // 13 chars * 50 * 0.62 = 403, well past the 90-unit floor, + 16 of padding.
    const box = hitBounds(text({ text: 'MICROGRAPHICS', size: 50, x: 200, y: 300 }));
    expectBox(box, [192, 240, 419, 76]);
  });

  it('floors a short label at 90 units of width so it stays grabbable', () => {
    // "CE" is only 24.8 units of ink; the box is the 90-unit floor + padding.
    expectBox(hitBounds(text({ text: 'CE', size: 20, x: 0, y: 0 })), [-8, -30, 106, 43.6]);
  });

  it('grows with each line of a multi-line string', () => {
    const box = hitBounds(text({ text: 'AB\nCDE', size: 30, x: 10, y: 60 }));
    expectBox(box, [2, 20, 106, 86.8]);
  });

  it('ignores rotation, matching the un-rotated hit rect inside the rotated group', () => {
    // The hit <rect> is a child of the group that rotate() is applied to, so
    // it turns with the item; this box is the item-space rect before that
    // turn, which is what the marquee compares against today.
    expectBox(hitBounds(text({ text: 'CE', size: 20, x: 0, y: 0, rotate: 90 })), [-8, -30, 106, 43.6]);
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
    // 2 chars * 20 * 0.62 = 24.8 wide, 1 line * 20 * 1.08 = 21.6 tall, anchored
    // at the item's baseline origin rather than 8 units to its left.
    expectBox(inkBounds(text({ text: 'CE', size: 20, x: 0, y: 0 })), [0, -20, 24.8, 21.6]);
  });

  it('measures multi-line text from its longest line and its line count', () => {
    expectBox(inkBounds(text({ text: 'AB\nCDE', size: 30, x: 10, y: 60 })), [10, 30, 55.8, 64.8]);
  });

  it('rotates a side label about the item anchor', () => {
    // Text renders inside a group rotated about (x, y). At 90 degrees the
    // upright box (w x h) anchored at (x, y - size) lands as an (h x w) box
    // starting at (x + size - h, y).
    const item = text({ text: 'AB\nCDE', size: 30, x: 10, y: 60, rotate: 90 });
    const upright = inkBounds({ ...item, rotate: 0 });
    expectBox(inkBounds(item), [10 + 30 - upright.height, 60, upright.height, upright.width]);
  });

  it('keeps a half-turn the same size as the upright box', () => {
    const item = text({ text: 'MICRO', size: 40, x: 500, y: 400, rotate: 180 });
    const upright = inkBounds({ ...item, rotate: 0 });
    const turned = inkBounds(item);
    expect(turned.width).toBeCloseTo(upright.width, 6);
    expect(turned.height).toBeCloseTo(upright.height, 6);
    // 180 degrees about (x, y) flips the box through the anchor: the corner
    // that sat at (x, y - size) ends up at (x, y + size).
    expect(turned.x).toBeCloseTo(item.x - upright.width, 6);
    expect(turned.y).toBeCloseTo(item.y + item.size - upright.height, 6);
  });

  it('leaves an unrotated item in place', () => {
    const item = text({ rotate: 0 });
    expectBox(inkBounds(item), [item.x, item.y - item.size, 5 * 50 * 0.62, 50 * 1.08]);
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
