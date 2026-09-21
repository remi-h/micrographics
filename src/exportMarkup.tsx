import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { MicrographicSvg } from './components/MicrographicSvg';
import type { CanvasItem, Palette, Settings } from './types';

export type ExportInput = {
  items: CanvasItem[];
  palette: Palette;
  settings: Settings;
};

const noop = () => {};

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
export function buildExportMarkup({ items, palette, settings }: ExportInput): string {
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
          selectedIds={[]}
          settings={settings}
        />,
      );
    });

    const svg = host.querySelector('svg');
    if (!svg) return '';

    // XMLSerializer, not markup built by hand: it declares the SVG namespace on
    // the root element, which a standalone .svg file needs and which the PNG
    // export needs before a browser will load the blob as an image.
    return new XMLSerializer().serializeToString(svg);
  } finally {
    root.unmount();
  }
}
