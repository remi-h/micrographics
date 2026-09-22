import { animationStyleSheet } from './animations';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { MicrographicSvg } from './components/MicrographicSvg';
import type { CanvasItem, Palette, Settings } from './types';

// The artboard's own coordinate system, and the units the viewBox is written
// in. Everything exported is a multiple of it.
export const ARTBOARD_WIDTH = 1200;
export const ARTBOARD_HEIGHT = 800;

// The PNG sizes offered in the toolbar: screen-scale, the 2400x1600 the export
// used to hardcode, and a print-scale file.
export const EXPORT_SCALES = [1, 2, 4] as const;

export type ExportScale = (typeof EXPORT_SCALES)[number];

// What the export produced before the scale was selectable, kept as the default
// so nobody's habitual export changes size under them.
export const DEFAULT_EXPORT_SCALE: ExportScale = 2;

// Pixel size of an export at a given scale. Pure, so the PNG canvas, the labels
// on the size control and the status message all quote the same numbers.
export function exportPixelSize(scale: number) {
  return { width: ARTBOARD_WIDTH * scale, height: ARTBOARD_HEIGHT * scale };
}

export type ExportInput = {
  items: CanvasItem[];
  palette: Palette;
  settings: Settings;
  /**
   * Whether to write the items' entrance animations into the file as CSS.
   * True for the .svg, which is a document a browser will run; false for the
   * PNG, which is one frame and must be the finished artwork rather than the
   * first frame of an entrance.
   */
  animate?: boolean;
  // Multiplier on the artboard size for the width/height written onto the SVG
  // root. The downloaded .svg stays at 1x; the PNG path raises it.
  scale?: number;
};

const noop = () => {};

// A fresh id for each exported file, so its stylesheet can be scoped to it.
let exportCount = 0;
function exportScopeId() {
  exportCount += 1;
  return `mg-${Math.random().toString(36).slice(2, 8)}-${exportCount}`;
}

// Exports used to be serialized straight off the live canvas node, so whatever
// the editor was drawing at the time went into the file: the dashed selection
// outline, the rotate and resize handles, the marquee, the multi-select
// alignment toolbar (a <foreignObject> of HTML buttons, which no browser
// rasterizes into a PNG) and a <textarea> in place of the text being edited.
// Having something selected is the normal state right after placing an item,
// so ordinary exports were corrupt.
//
// The fix renders the same component again, off-screen, with nothing selected
// and nothing being edited, and serializes that. The alternative -- cloning the
// live node and deleting the chrome out of it -- has to be taught about every
// affordance, so the next handle someone adds would silently reappear in
// exports. Here there is no chrome to strip: a future handle only renders for a
// selected item, and this render has none. Re-rendering also gets the committed
// <text> of an item being edited for free.
//
// Each item still carries its transparent hit-target rect. It paints nothing,
// so the exported artwork is unaffected, and dropping it would mean a second
// render mode -- exactly the kind of special case this approach avoids.
export function buildExportMarkup({ animate = false, items, palette, settings, scale = 1 }: ExportInput): string {
  // Detached from the document: it is never laid out and never painted, so the
  // canvas the user is looking at is untouched.
  const host = document.createElement('div');
  const root = createRoot(host);

  try {
    // createRoot renders asynchronously; flushSync makes the markup available
    // in this tick so the export stays a plain synchronous function.
    flushSync(() => {
      root.render(
        <MicrographicSvg
          editingTextId={null}
          editingTextValue=""
          items={items}
          onAlignSelected={noop}
          onBeginHistoryAction={noop}
          onBeginTextEdit={noop}
          onCancelTextEdit={noop}
          onChangeEditingText={noop}
          onCommitTextEdit={noop}
          onDistributeSelected={noop}
          onMoveItem={noop}
          onRotateItems={noop}
          onScaleItems={noop}
          onSelectItem={noop}
          onSelectItems={noop}
          palette={palette}
          playToken={0}
          selectedIds={[]}
          settings={settings}
        />,
      );
    });

    const svg = host.querySelector('svg');
    if (!svg) return '';

    // The live canvas is sized by its container, so its root carries a viewBox
    // and nothing else. A viewBox on its own leaves the SVG with no intrinsic
    // size: Chromium guesses one when the file is loaded through an <img>, but
    // Firefox refuses to rasterize it at all, which is why PNG export was dead
    // there. Write the size the export is meant to be.
    //
    // Fixing the dimensions does not pin the downloaded .svg to one size. width
    // and height are only the default box; with the viewBox still in place, the
    // drawing is fitted to whatever box a consumer gives it (CSS, an <img
    // width>, a page layout), so an embedded file scales exactly as it did
    // before -- it now simply also has a sensible size when nobody says.
    const { width, height } = exportPixelSize(scale);
    svg.setAttribute('width', String(width));
    svg.setAttribute('height', String(height));

    // The animations ride along as a stylesheet inside the file rather than as
    // SMIL, which is deprecated, and rather than being baked into the elements,
    // which would leave a viewer that does not run CSS showing the *first*
    // frame: items stacked transparently off the left edge instead of the
    // poster. Every entrance animates from an offset back to the item's own
    // attributes, so without CSS the file is simply the finished artwork.
    //
    // The rules are scoped to this file's own root id. An exported SVG is often
    // inlined into a page, where its styles are document-global -- two of them
    // in one page would otherwise both define `.mg-anim-0` and the second would
    // win for both. This is the same exposure the `mg-` prefix on the keyframes
    // names guards against, which those already handle by being identical
    // wherever they collide; the per-item timings are not.
    const stylesheet = animate ? animationStyleSheet(items, exportScopeId()) : null;
    if (stylesheet) {
      const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
      style.setAttribute('type', 'text/css');
      style.textContent = stylesheet.css;
      svg.setAttribute('id', stylesheet.scope);
      // After <title>, which is the element's accessible name and is expected
      // to come first.
      const title = svg.querySelector('title');
      svg.insertBefore(style, title ? title.nextSibling : svg.firstChild);
    }

    // XMLSerializer, not markup built by hand: it declares the SVG namespace on
    // the root element, which a standalone .svg file needs and which the PNG
    // export needs before a browser will load the blob as an image.
    return new XMLSerializer().serializeToString(svg);
  } finally {
    root.unmount();
  }
}
