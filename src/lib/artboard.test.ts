import { templateComponents } from '../components/templates';
import { inkBounds } from './canvasGeometry';
import {
  ARTBOARD_PRESETS,
  DEFAULT_ARTBOARD,
  artboardForImage,
  artboardPreset,
  clampAnchorX,
  clampAnchorY,
  fitItems,
} from './artboard';
import type { CanvasItem } from '../types';

const PORTRAIT = { width: 800, height: 1200 };

function symbol(id: string, x: number, y: number, size = 42): CanvasItem {
  return { id, kind: 'symbol', mark: 'ring', rotate: 0, size, x, y };
}

describe('artboardForImage', () => {
  it('keeps a portrait image portrait, long side at 1200', () => {
    expect(artboardForImage(3000, 4000)).toEqual({ width: 900, height: 1200 });
  });

  it('keeps a landscape image landscape', () => {
    expect(artboardForImage(1920, 1080)).toEqual({ width: 1200, height: 675 });
  });

  it('does not let a panorama squash the frame past 3:1', () => {
    expect(artboardForImage(10000, 1000)).toEqual({ width: 1200, height: 400 });
    expect(artboardForImage(1000, 10000)).toEqual({ width: 400, height: 1200 });
  });

  it('falls back to the default frame for an image with no size', () => {
    expect(artboardForImage(0, 0)).toEqual(DEFAULT_ARTBOARD);
  });
});

describe('artboardPreset', () => {
  it('names the preset a frame is, and null for any other frame', () => {
    expect(artboardPreset(DEFAULT_ARTBOARD)?.id).toBe('landscape');
    expect(artboardPreset({ width: 900, height: 1200 })).toBeNull();
  });
});

describe('clampAnchor', () => {
  it('keeps anchors inside the margins of the current frame', () => {
    expect(clampAnchorX(5000, PORTRAIT)).toBe(748);
    expect(clampAnchorY(5000, PORTRAIT)).toBe(1152);
    expect(clampAnchorX(-5, PORTRAIT)).toBe(52);
  });
});

describe('fitItems', () => {
  it('leaves items alone when the frame does not change', () => {
    const items = [symbol('a', 100, 100)];
    expect(fitItems(items, DEFAULT_ARTBOARD, DEFAULT_ARTBOARD)).toBe(items);
  });

  it('keeps a drawing that still fits at its size, in the same place relative to the frame', () => {
    const [moved] = fitItems([symbol('a', 600, 400)], DEFAULT_ARTBOARD, PORTRAIT);
    expect(moved).toMatchObject({ size: 42, x: 400, y: 600 });
  });

  it('shrinks a drawing too wide for the new frame until it fits', () => {
    const items = [symbol('a', 100, 400, 100), symbol('b', 1100, 400, 100)];
    const fitted = fitItems(items, DEFAULT_ARTBOARD, PORTRAIT);
    for (const item of fitted) {
      const box = inkBounds(item);
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(PORTRAIT.width);
      expect(item.size).toBeLessThan(100);
    }
  });

  it('does not shrink a drawing a second time on the way back', () => {
    const items = [symbol('a', 100, 400, 100), symbol('b', 1100, 400, 100)];
    const there = fitItems(items, DEFAULT_ARTBOARD, PORTRAIT);
    const back = fitItems(there, PORTRAIT, DEFAULT_ARTBOARD);
    expect(back.map((item) => item.size)).toEqual(there.map((item) => item.size));
  });

  // The same rule overlap.test.ts holds every template to on the default
  // frame, held on every preset: a template chosen on a portrait canvas must
  // land on it.
  for (const preset of ARTBOARD_PRESETS) {
    for (const [id, buildItems] of Object.entries(templateComponents)) {
      it(`fits template ${id} inside ${preset.name}`, () => {
        const fitted = fitItems(buildItems(), DEFAULT_ARTBOARD, preset);
        for (const item of fitted) {
          if (item.kind === 'symbol' && (item.mark === 'semicircle' || item.mark === 'arch')) continue;
          const box = inkBounds(item);
          expect(box.x).toBeGreaterThanOrEqual(-1);
          expect(box.y).toBeGreaterThanOrEqual(-1);
          expect(box.x + box.width).toBeLessThanOrEqual(preset.width + 1);
          expect(box.y + box.height).toBeLessThanOrEqual(preset.height + 1);
        }
      });
    }
  }
});
