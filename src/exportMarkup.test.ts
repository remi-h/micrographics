import { initialSettings, palettes } from './data';
import {
  ARTBOARD_HEIGHT,
  ARTBOARD_WIDTH,
  buildExportMarkup,
  DEFAULT_EXPORT_SCALE,
  EXPORT_SCALES,
  exportPixelSize,
} from './exportMarkup';
import type { CanvasItem } from './types';

const palette = palettes[0];

const canvasItems: CanvasItem[] = [
  { id: 'symbol-1', kind: 'symbol', mark: 'orbit', rotate: 15, size: 42, x: 100, y: 200 },
  { id: 'text-1', kind: 'text', rotate: 0, size: 42, text: 'MICRO', x: 300, y: 400 },
];

const settings = { ...initialSettings, grid: true, showBackground: true };

// Everything the editor draws only to support editing. None of it belongs in a
// downloaded file, and the alignment toolbar's <foreignObject> does not even
// rasterize into a PNG.
const EDITOR_CHROME = ['stroke-dasharray', 'foreignObject', 'resize-handle', 'rotate-handle', 'marquee-rect'];

describe('buildExportMarkup', () => {
  it('serializes a standalone SVG with the namespace declared', () => {
    const markup = buildExportMarkup({ items: canvasItems, palette, settings });

    expect(markup).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(markup.startsWith('<svg')).toBe(true);
    expect(markup).toContain('viewBox="0 0 1200 800"');
  });

  // A viewBox with no width/height leaves the file without an intrinsic size.
  // Chromium guesses one when it loads the blob through an <img>; Firefox
  // refuses to rasterize it, which is what broke PNG export there.
  it('gives the root an explicit size at the artboard scale by default', () => {
    const markup = buildExportMarkup({ items: canvasItems, palette, settings });

    expect(markup).toContain('width="1200"');
    expect(markup).toContain('height="800"');
  });

  it.each(EXPORT_SCALES)('sizes the root for a %sx export and keeps the viewBox', (scale) => {
    const markup = buildExportMarkup({ items: canvasItems, palette, settings, scale });
    const { width, height } = exportPixelSize(scale);

    expect(markup).toContain(`width="${width}"`);
    expect(markup).toContain(`height="${height}"`);
    // The viewBox is what keeps the drawing resolution-independent: a consumer
    // that overrides width/height still gets the whole artboard, scaled.
    expect(markup).toContain('viewBox="0 0 1200 800"');
  });

  it('includes the artwork: background, grid and items', () => {
    const markup = buildExportMarkup({ items: canvasItems, palette, settings });

    expect(markup).toContain(palette.paper);
    // The grid is the only group drawn at this opacity, and palettes reuse one
    // colour across ink/muted/accent, so its stroke colour would not identify it.
    expect(markup).toContain('opacity="0.26"');
    expect(markup).toContain('<line');
    expect(markup).toContain('MICRO');
    expect(markup).toContain('<circle');
    expect(markup).toContain('translate(100 200) rotate(15)');
  });

  it('leaves out the background and grid when they are switched off', () => {
    const markup = buildExportMarkup({
      items: canvasItems,
      palette,
      settings: { ...settings, grid: false, showBackground: false },
    });

    expect(markup).not.toContain(palette.paper);
    expect(markup).not.toContain('opacity="0.26"');
    expect(markup).not.toContain('<line');
    expect(markup).toContain('MICRO');
  });

  it('never carries the editor chrome, whatever is selected on screen', () => {
    const markup = buildExportMarkup({ items: canvasItems, palette, settings });

    for (const chrome of EDITOR_CHROME) {
      expect(markup).not.toContain(chrome);
    }
  });

  it('still keeps the editor chrome out at every export scale', () => {
    for (const scale of EXPORT_SCALES) {
      const markup = buildExportMarkup({ items: canvasItems, palette, settings, scale });

      for (const chrome of EDITOR_CHROME) {
        expect(`${scale}x: ${markup}`).not.toContain(chrome);
      }
      expect(markup).not.toContain('textarea');
    }
  });

  it('exports the committed text of an item, not an editing textarea', () => {
    const markup = buildExportMarkup({ items: canvasItems, palette, settings });

    expect(markup).toContain('<text');
    expect(markup).not.toContain('textarea');
    expect(markup).not.toContain('canvas-text-editor');
  });

  it('exports an empty canvas without throwing', () => {
    const markup = buildExportMarkup({ items: [], palette, settings });

    expect(markup).toContain('<svg');
  });

  it('does not attach anything to the document it renders through', () => {
    const before = document.body.innerHTML;
    buildExportMarkup({ items: canvasItems, palette, settings });

    expect(document.body.innerHTML).toBe(before);
    expect(document.querySelector('svg.artboard')).toBeNull();
  });
  // Animations ride along in the .svg, which a browser runs, but never in the
  // PNG, which is a single frame and has to be the finished artwork rather
  // than the first frame of an entrance.
  it('writes the entrances into the SVG when asked to', () => {
    const animated: CanvasItem[] = [{ ...canvasItems[0], animation: { delay: 0.2, duration: 0.6, kind: 'slide-left' } }];
    const markup = buildExportMarkup({ animate: true, items: animated, palette, settings });

    expect(markup).toContain('@keyframes mg-slide-left');
    expect(markup).toContain('mg-anim-0');
  });

  it('leaves the entrances out when it is not asked to, which is the PNG path', () => {
    const animated: CanvasItem[] = [{ ...canvasItems[0], animation: { delay: 0.2, duration: 0.6, kind: 'slide-left' } }];
    const markup = buildExportMarkup({ items: animated, palette, settings });

    expect(markup).not.toContain('@keyframes');
    expect(markup).not.toContain('animation:');
  });

  it('adds no stylesheet to an SVG whose items are not animated', () => {
    const markup = buildExportMarkup({ animate: true, items: canvasItems, palette, settings });

    expect(markup).not.toContain('<style');
  });

  it('puts the stylesheet after the title, which is the element’s accessible name', () => {
    const animated: CanvasItem[] = [{ ...canvasItems[0], animation: { delay: 0, duration: 0.6, kind: 'fade' } }];
    const markup = buildExportMarkup({ animate: true, items: animated, palette, settings });

    expect(markup.indexOf('<title')).toBeLessThan(markup.indexOf('<style'));
    expect(markup).toContain('type="text/css"');
  });

  it('gives each exported file its own scope, so two of them can share a page', () => {
    // Styles inside an inlined SVG are document-global, so two files both
    // claiming `.mg-anim-0` would leave the second one's timings driving both.
    const animated: CanvasItem[] = [{ ...canvasItems[0], animation: { delay: 0, duration: 0.6, kind: 'fade' } }];
    const scopeOf = (markup: string) => /<svg[^>]*\sid="([^"]+)"/.exec(markup)?.[1];

    const first = buildExportMarkup({ animate: true, items: animated, palette, settings });
    const second = buildExportMarkup({ animate: true, items: animated, palette, settings });

    expect(scopeOf(first)).toBeDefined();
    expect(scopeOf(first)).not.toBe(scopeOf(second));
    expect(first).toContain(`#${scopeOf(first)} .mg-anim-0`);
  });

  it('keeps the animated item at its own position, so a viewer without CSS shows the artwork', () => {
    // The animation is a departure from the element's own attributes and
    // resolves back to them, so the attributes are the finished poster.
    const animated: CanvasItem[] = [{ ...canvasItems[0], animation: { delay: 0, duration: 0.6, kind: 'slide-left' } }];
    const markup = buildExportMarkup({ animate: true, items: animated, palette, settings });

    expect(markup).toContain('translate(100 200)');
  });
});

describe('exportPixelSize', () => {
  it('multiplies the artboard, so 1x is the artboard itself', () => {
    expect(exportPixelSize(1)).toEqual({ width: ARTBOARD_WIDTH, height: ARTBOARD_HEIGHT });
  });

  it('scales both axes together', () => {
    expect(exportPixelSize(2)).toEqual({ width: 2400, height: 1600 });
    expect(exportPixelSize(4)).toEqual({ width: 4800, height: 3200 });
  });

  it('offers screen, retina and print scales, defaulting to what PNG export always produced', () => {
    expect(EXPORT_SCALES).toEqual([1, 2, 4]);
    expect(DEFAULT_EXPORT_SCALE).toBe(2);
    expect(exportPixelSize(DEFAULT_EXPORT_SCALE)).toEqual({ width: 2400, height: 1600 });
  });

});
