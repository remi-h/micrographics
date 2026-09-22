import { useRef, useState, type Dispatch, type SetStateAction } from 'react';
import type { ExportStatusMessage } from './components/ExportStatus';
import { buildExportMarkup, DEFAULT_EXPORT_SCALE, exportPixelSize, type ExportScale } from './exportMarkup';
import type { CanvasItem, Palette, Settings } from './types';
import { downloadBlob } from './utils';

// Saving the artwork: the SVG download, the PNG rasterization, the size the
// PNG is taken at, and the one line the user is told about how it went.
//
// Like `useHistory`, `useCanvasItems` and `useKeyboardShortcuts` this owns no
// state `App` needs: it is handed the document to export — the canvas items,
// the palette and the settings — because those still live in `App` and the
// canvas, history and keyboard hooks all read them too. Exporting only reads
// them, so nothing is passed back the other way and there is no setter here.
//
// What it does own is the state nothing else has any use for: the chosen PNG
// scale, and the status message. Both are session state, and the scale is
// deliberately not persisted — `persistence.ts` saves the artwork and its
// settings, and the size of the last PNG somebody took is not part of the
// drawing. That is the same line `useCanvasItems` draws around its text draft.
//
// `downloadBlob` is imported rather than injected. It is a pure utility over
// `URL` and an `<a>`, not something `App` holds, so passing it in would only
// add a parameter every caller has to fill in with the same import. A test
// that needs to see what was written stubs `URL.createObjectURL` and the
// anchor's click, which is also the only way to observe the object URL being
// revoked — the leak this path has to avoid.
//
// The status message is returned as data for `App` to render, not as an
// element. `App` owns the shell and decides where the live region sits in it;
// returning `<ExportStatus>` from here would move that placement decision into
// a module that knows nothing about the layout, and would leave the text
// reachable only by rendering the hook's output. As a plain
// `ExportStatusMessage | null` it is asserted directly, which is what the
// failure-branch tests below do.

export type UseExportOptions = {
  canvasItems: CanvasItem[];
  palette: Palette;
  settings: Settings;
};

export type Export = {
  /** Downloads the artboard as a standalone .svg, at the artboard's own size. */
  exportSvg: () => void;
  /**
   * Rasterizes the artboard to a .png. Pass a scale to export at that size and
   * make it the new default; the size picker does, because setting state and
   * exporting in one call would otherwise rasterize at the previous scale --
   * state is not updated until the next render.
   */
  exportPng: (scale?: ExportScale) => Promise<void>;
  /** The multiplier the PNG export rasterizes at. Session state; never persisted. */
  exportScale: ExportScale;
  setExportScale: Dispatch<SetStateAction<ExportScale>>;
  /** The result of the last export, for `App` to hand to `<ExportStatus>`. */
  exportStatus: ExportStatusMessage | null;
};

// Every export failure ends up here, so the user is told which step went wrong
// instead of being handed nothing. A thrown Error carries its own sentence; a
// browser can also reject with something that is not an Error at all.
function reason(error: unknown) {
  return error instanceof Error && error.message ? error.message : 'an unknown error';
}

export function useExport({ canvasItems, palette, settings }: UseExportOptions): Export {
  const [exportScale, setExportScale] = useState<ExportScale>(DEFAULT_EXPORT_SCALE);
  const [exportStatus, setExportStatus] = useState<ExportStatusMessage | null>(null);
  const exportStatusId = useRef(0);

  // Both exporters serialize a fresh, unselected render of the canvas rather
  // than the live node, so the editor's own chrome stays out of the file. See
  // buildExportMarkup.
  // The .svg is a document a browser runs, so it carries the entrances. The
  // PNG is one frame, and that frame has to be the finished artwork.
  const exportMarkup = (scale: number, animate = false) =>
    buildExportMarkup({ animate, items: canvasItems, palette, settings, scale });

  const announceExport = (tone: ExportStatusMessage['tone'], text: string) => {
    exportStatusId.current += 1;
    setExportStatus({ id: exportStatusId.current, text, tone });
  };

  const exportSvg = () => {
    try {
      // Vector: the artboard's own size, with the scale control left to the
      // PNG. A viewBox is along for the ride, so it still scales anywhere.
      const { width, height } = exportPixelSize(1);
      downloadBlob(new Blob([exportMarkup(1, true)], { type: 'image/svg+xml;charset=utf-8' }), 'micrographic.svg');
      announceExport('success', `Saved micrographic.svg (${width} × ${height}).`);
    } catch (error) {
      announceExport('error', `Could not export the SVG: ${reason(error)}.`);
    }
  };

  const exportPng = async (scaleOverride?: ExportScale) => {
    const scale = scaleOverride ?? exportScale;
    if (scaleOverride !== undefined) setExportScale(scaleOverride);
    const { width, height } = exportPixelSize(scale);
    let url: string | null = null;

    // Every step here can fail for real -- a browser that will not decode the
    // SVG, a refused 2D context, an encode that runs out of memory at 4x -- and
    // each one used to end with no file and no word about it.
    try {
      const blob = new Blob([exportMarkup(scale)], { type: 'image/svg+xml;charset=utf-8' });
      url = URL.createObjectURL(blob);
      const image = new Image();
      image.decoding = 'async';
      image.src = url;

      try {
        await image.decode();
      } catch {
        throw new Error('this browser could not read the generated image');
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('this browser gave no 2D canvas to draw into');
      context.drawImage(image, 0, 0, width, height);

      const png = await new Promise<Blob>((resolve, reject) => {
        // toBlob hands back null when it cannot encode -- most plausibly
        // because the canvas is too large, which is exactly what the 4x option
        // makes reachable.
        canvas.toBlob((result) => {
          if (result) resolve(result);
          else reject(new Error(`this browser could not encode a ${width} × ${height} PNG`));
        }, 'image/png');
      });

      downloadBlob(png, 'micrographic.png');
      announceExport('success', `Saved micrographic.png (${width} × ${height}).`);
    } catch (error) {
      announceExport('error', `Could not export the PNG: ${reason(error)}.`);
    } finally {
      if (url) URL.revokeObjectURL(url);
    }
  };

  return { exportPng, exportScale, exportStatus, exportSvg, setExportScale };
}
