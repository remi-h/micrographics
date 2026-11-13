import { inkBounds } from './canvasGeometry';
import { clamp } from './utils';
import type { Artboard, CanvasItem } from '../types';

// The artboard's size, in canvas units. It used to be a fixed 1200 x 800, so
// an uploaded portrait photo was cropped to a landscape strip: the background
// is drawn with `slice`, which fills the frame and cuts off whatever spills.
// Now the frame itself can change shape, and uploading a background makes it
// match the image.
//
// The templates are still laid out on the original frame, so it stays the
// default and is the frame `fitItems` maps a template from.
export const DEFAULT_ARTBOARD: Artboard = { width: 1200, height: 800 };

// The long side of every artboard. Keeping it fixed means text and symbols
// read at the same size whatever the shape, and the 1x/2x/4x exports stay the
// sizes people already know for the landscape frame.
export const ARTBOARD_LONG_SIDE = 1200;

// How far from square a background may push the frame. A panorama past 3:1
// would leave a strip too thin to place a label on; beyond this the image is
// cropped at the ends instead, as every image used to be.
const MAX_ASPECT = 3;

export const ARTBOARD_PRESETS = [
  { id: 'landscape', name: 'Landscape 3:2', width: 1200, height: 800 },
  { id: 'portrait', name: 'Portrait 2:3', width: 800, height: 1200 },
  { id: 'square', name: 'Square 1:1', width: 1200, height: 1200 },
  { id: 'wide', name: 'Widescreen 16:9', width: 1200, height: 675 },
  { id: 'story', name: 'Story 9:16', width: 675, height: 1200 },
] as const;

export type ArtboardPresetId = (typeof ARTBOARD_PRESETS)[number]['id'];

/** The preset this artboard is, or null for a frame matched to an image. */
export function artboardPreset(artboard: Artboard) {
  return ARTBOARD_PRESETS.find((preset) => preset.width === artboard.width && preset.height === artboard.height) ?? null;
}

export function sameArtboard(a: Artboard, b: Artboard) {
  return a.width === b.width && a.height === b.height;
}

/** The artboard with an image's proportions, its long side at ARTBOARD_LONG_SIDE. */
export function artboardForImage(width: number, height: number): Artboard {
  if (!(width > 0) || !(height > 0)) return DEFAULT_ARTBOARD;
  const ratio = clamp(width / height, 1 / MAX_ASPECT, MAX_ASPECT);
  return ratio >= 1
    ? { width: ARTBOARD_LONG_SIDE, height: Math.round(ARTBOARD_LONG_SIDE / ratio) }
    : { width: Math.round(ARTBOARD_LONG_SIDE * ratio), height: ARTBOARD_LONG_SIDE };
}

// How far an item's anchor may go towards each edge. Dragging, nudging and
// duplicating all keep anchors this far in, so an item cannot be lost off the
// edge. These were written out as 52..1148 and 48..752 against the old frame.
export const ANCHOR_MARGIN = { x: 52, y: 48 } as const;

export function clampAnchorX(x: number, artboard: Artboard) {
  return clamp(x, ANCHOR_MARGIN.x, artboard.width - ANCHOR_MARGIN.x);
}

export function clampAnchorY(y: number, artboard: Artboard) {
  return clamp(y, ANCHOR_MARGIN.y, artboard.height - ANCHOR_MARGIN.y);
}

const round = (value: number) => Math.round(value * 100) / 100;

function inkBox(items: CanvasItem[]) {
  const boxes = items.map(inkBounds);
  return {
    left: Math.min(...boxes.map((box) => box.x)),
    top: Math.min(...boxes.map((box) => box.y)),
    right: Math.max(...boxes.map((box) => box.x + box.width)),
    bottom: Math.max(...boxes.map((box) => box.y + box.height)),
  };
}

// Whether an item already reaches past an edge of its frame. A decorative arch
// is allowed to bleed off the artboard, so these are left out of the fitting:
// making room for their overhang would shrink everything else to fit paint
// nobody can see.
function bleeds(item: CanvasItem, frame: Artboard) {
  const box = inkBounds(item);
  return box.x < -1 || box.y < -1 || box.x + box.width > frame.width + 1 || box.y + box.height > frame.height + 1;
}

/**
 * Moves a drawing laid out on `from` onto `to`.
 *
 * The drawing keeps its place in the frame -- something centred stays
 * centred, something in the top corner stays near it -- and it is only
 * scaled down when it no longer fits, never up. That makes the round trip
 * safe: landscape to portrait shrinks a wide layout to the portrait's width,
 * and portrait back to landscape leaves it at that size rather than shrinking
 * it a second time.
 */
export function fitItems(items: CanvasItem[], from: Artboard, to: Artboard): CanvasItem[] {
  if (items.length === 0 || sameArtboard(from, to)) return items;

  const inside = items.filter((item) => !bleeds(item, from));
  const fitted = inside.length > 0 ? inside : items;
  const box = inkBox(fitted);
  const width = box.right - box.left;
  const height = box.bottom - box.top;
  const fromCenter = { x: (box.left + box.right) / 2, y: (box.top + box.bottom) / 2 };
  const fittedIds = new Set(fitted.map((item) => item.id));

  const place = (scale: number) => {
    // The drawing's middle, as a fraction of the old frame, lands on the same
    // fraction of the new one -- then is pulled in until the scaled box fits.
    const halfWidth = (width * scale) / 2;
    const halfHeight = (height * scale) / 2;
    const toCenter = {
      x: clamp((fromCenter.x / from.width) * to.width, halfWidth, to.width - halfWidth),
      y: clamp((fromCenter.y / from.height) * to.height, halfHeight, to.height - halfHeight),
    };
    const placed = items.map((item) => ({
      ...item,
      size: round(item.size * scale),
      x: round(toCenter.x + (item.x - fromCenter.x) * scale),
      y: round(toCenter.y + (item.y - fromCenter.y) * scale),
    }));
    return { placed, after: inkBox(placed.filter((item) => fittedIds.has(item.id))) };
  };

  // Text does not scale exactly: its letter spacing is a fixed two units at
  // any size, so a shrunk line comes out wider than `scale` says -- by forty
  // units on a full-width template squeezed onto a portrait frame. So the
  // placed drawing is measured, and shrunk again by what it still overshoots,
  // until it fits. Two or three rounds settle it.
  // A drawing that no longer fits shrinks with its frame, so it keeps the
  // margins it was laid out with instead of running edge to edge.
  const fits = width <= to.width && height <= to.height;
  let scale = fits ? 1 : Math.min(to.width / from.width, to.height / from.height);
  let { placed, after } = place(scale);
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const overshoot = Math.max((after.right - after.left) / to.width, (after.bottom - after.top) / to.height);
    if (overshoot <= 1) break;
    scale /= overshoot * 1.001;
    ({ placed, after } = place(scale));
  }

  // Then shift the whole drawing back inside if its centre put it over an
  // edge, so the items stay where they are relative to each other.
  const back = (low: number, high: number, limit: number) => {
    if (low < 0) return -low;
    if (high > limit) return limit - high;
    return 0;
  };
  const shiftX = back(after.left, after.right, to.width);
  const shiftY = back(after.top, after.bottom, to.height);
  if (shiftX === 0 && shiftY === 0) return placed;
  return placed.map((item) => ({ ...item, x: round(item.x + shiftX), y: round(item.y + shiftY) }));
}

/** An image's natural size, read by loading it. Rejects if it will not decode. */
export function measureImage(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => reject(new Error('could not read the image'));
    image.src = src;
  });
}
