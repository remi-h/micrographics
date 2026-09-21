import { inkBounds, intersects } from '../../canvasGeometry';
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
