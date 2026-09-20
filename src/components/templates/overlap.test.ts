import { intersects, itemBounds } from '../../canvasGeometry';
import type { CanvasItem } from '../../types';
import { templateComponents } from './index';

const CANVAS = { x: 0, y: 0, width: 1200, height: 800 };

// Small glyph/text bounding boxes include generous click-target padding, so a
// little incidental overlap between two items' boxes is normal and not a
// visual defect. This threshold catches items whose glyphs actually collide
// on screen without flagging that padding. Calibrated against this repo's
// templates: legitimate close-but-clear layouts land at ratio <= 0.11, while
// a confirmed real collision (two small icons actually touching) lands at
// 0.18, so 0.15 separates the two with margin on both sides.
const OVERLAP_THRESHOLD = 0.15;

// Marks whose bounding box is much larger than their visual ink, so a
// bounding-box overlap with them doesn't mean their glyphs actually collide
// on screen (verified by rendering each template and inspecting it):
// - 'semicircle'/'arch': large decorative background shapes every other item
//   is meant to sit in front of.
// - 'world'/'worldmap': a sparse landmass silhouette inside a much larger
//   square bounding box, mostly empty space.
// - 'barcode'/'badge': both draw a thin shape (16 of 36 local units tall)
//   inside a full square bounding box, well short of its edges.
const SPARSE_MARKS = new Set(['semicircle', 'arch', 'world', 'worldmap', 'barcode', 'badge']);

// itemBounds() is the editor's interactive click/selection target, padded and
// floored at a 90-unit minimum width so short strings stay easy to grab with
// a mouse. That floor makes short all-caps labels like "XIV" or "CE" look far
// wider than their actual glyphs, which would make this test flag adjacent
// icons that don't really touch on screen. For collision purposes we want the
// glyph's real footprint instead.
function inkBounds(item: CanvasItem) {
  if (item.kind === 'symbol') return itemBounds(item);

  const lines = item.text.split('\n');
  const width = Math.max(...lines.map((line) => line.length)) * item.size * 0.62;
  const height = lines.length * item.size * 1.08;
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
  return { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
}

describe('template layouts', () => {
  for (const [id, buildItems] of Object.entries(templateComponents)) {
    it(`template ${id} has no colliding items and no glyph outside the canvas`, () => {
      const items = buildItems();
      const canvasCheckBounds = items.map((item) => ({ item, box: inkBounds(item) }));
      const collisionBounds = canvasCheckBounds;

      for (const { item, box } of canvasCheckBounds) {
        // The 'semicircle'/'arch' decorative background shapes are allowed to
        // bleed past the canvas edge by design (see PlatformArchTemplate /
        // SystemArchTemplate).
        if (item.kind === 'symbol' && (item.mark === 'semicircle' || item.mark === 'arch')) continue;
        expect(box.x).toBeGreaterThanOrEqual(CANVAS.x - 1);
        expect(box.y).toBeGreaterThanOrEqual(CANVAS.y - 1);
        expect(box.x + box.width).toBeLessThanOrEqual(CANVAS.width + 1);
        expect(box.y + box.height).toBeLessThanOrEqual(CANVAS.height + 1);
      }

      for (let i = 0; i < collisionBounds.length; i += 1) {
        for (let j = i + 1; j < collisionBounds.length; j += 1) {
          const a = collisionBounds[i];
          const b = collisionBounds[j];
          const isSparse = (entry: typeof a) => entry.item.kind === 'symbol' && SPARSE_MARKS.has(entry.item.mark);
          if (isSparse(a) || isSparse(b)) continue;
          if (!intersects(a.box, b.box)) continue;

          const overlapX = Math.max(0, Math.min(a.box.x + a.box.width, b.box.x + b.box.width) - Math.max(a.box.x, b.box.x));
          const overlapY = Math.max(0, Math.min(a.box.y + a.box.height, b.box.y + b.box.height) - Math.max(a.box.y, b.box.y));
          const overlapArea = overlapX * overlapY;
          const smallerArea = Math.min(a.box.width * a.box.height, b.box.width * b.box.height);
          const ratio = overlapArea / smallerArea;

          expect(ratio).toBeLessThan(OVERLAP_THRESHOLD);
        }
      }
    });
  }
});
