import { useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { animationRunTime } from './animations';
import type { ExportStatusMessage } from './components/ExportStatus';
import { buildExportMarkup, DEFAULT_EXPORT_SCALE, exportPixelSize, type ExportScale } from './exportMarkup';
import { encodeGif, gifFrameDelay, gifFrameTimes } from './gif';
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
  /**
   * Renders the entrance sequence to an animated .gif. Always at the
   * artboard's own size: a GIF carries every frame as its own picture, so the
   * scales the PNG offers would multiply the file by four or sixteen.
   */
  exportGif: () => Promise<void>;
  /** Whether a GIF is being encoded, so the control can say so and not be pressed twice. */
  exportingGif: boolean;
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
  const [exportingGif, setExportingGif] = useState(false);
  const exportStatusId = useRef(0);
  // The real re-entrancy latch. `exportingGif` beside it is only what the
  // control renders from; a ref is what a second click in the same frame sees.
  const gifInFlight = useRef(false);

  // Both exporters serialize a fresh, unselected render of the canvas rather
  // than the live node, so the editor's own chrome stays out of the file. See
  // buildExportMarkup.
  // The .svg is a document a browser runs, so it carries the entrances. The
  // PNG is one frame, and that frame has to be the finished artwork.
  const exportMarkup = (scale: number, animate = false, freezeAt?: number) =>
    buildExportMarkup({ animate, freezeAt, items: canvasItems, palette, settings, scale });

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

  // Rasterizing a piece of markup into a 2D context, which the PNG export does
  // once and the GIF export does per frame. The context is handed in rather
  // than made here so the GIF can reuse one canvas across every frame instead
  // of allocating a full-size one each time.
  const drawMarkup = async (
    markup: string,
    context: CanvasRenderingContext2D,
    width: number,
    height: number,
    opaqueOn?: string,
  ) => {
    const url = URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml;charset=utf-8' }));
    try {
      const image = new Image();
      image.decoding = 'async';
      image.src = url;

      try {
        await image.decode();
      } catch {
        throw new Error('this browser could not read the generated image');
      }

      // Cleared first: the GIF draws frame after frame into the same context,
      // and an entrance is transparent at its start, so without this every
      // frame would show the one before it underneath.
      context.clearRect(0, 0, width, height);

      // A GIF's transparency is one bit: a pixel is either fully clear or
      // fully opaque, with nothing in between. An entrance is *made of* the
      // in-between -- a dissolve is nothing but partial alpha -- so on a
      // transparent artboard there is no honest way to write one. Thresholding
      // turns every fade into a hard pop, and dropping alpha (which is what a
      // GIF palette does) bakes a 30%-opacity item in at full strength and
      // fills the empty canvas with black.
      //
      // So the frames are laid on the paper colour first. The GIF comes out
      // opaque even when `Include background` is off, and the fades survive.
      // The PNG and the SVG are unaffected: both carry real alpha, so both
      // still honour the toggle.
      if (opaqueOn) {
        context.fillStyle = opaqueOn;
        context.fillRect(0, 0, width, height);
      }

      context.drawImage(image, 0, 0, width, height);
    } finally {
      URL.revokeObjectURL(url);
    }
  };

  const canvasContext = (width: number, height: number) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('this browser gave no 2D canvas to draw into');
    return { canvas, context };
  };

  const exportPng = async (scaleOverride?: ExportScale) => {
    const scale = scaleOverride ?? exportScale;
    if (scaleOverride !== undefined) setExportScale(scaleOverride);
    const { width, height } = exportPixelSize(scale);

    // Every step here can fail for real -- a browser that will not decode the
    // SVG, a refused 2D context, an encode that runs out of memory at 4x -- and
    // each one used to end with no file and no word about it.
    try {
      const { canvas, context } = canvasContext(width, height);
      await drawMarkup(exportMarkup(scale), context, width, height);

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
    }
  };

  const exportGif = async () => {
    // Encoding is slow enough to press twice through, and a second run would
    // race the first for the same filename. The guard is a ref, not the state
    // below it: state read from this closure is the value at the last render,
    // so two clicks inside one frame would both see `false` and both start.
    if (gifInFlight.current) return;
    gifInFlight.current = true;

    const runTime = animationRunTime(canvasItems);
    if (runTime === 0) {
      gifInFlight.current = false;
      announceExport('error', 'Nothing on the canvas is animated, so there is no GIF to make.');
      return;
    }

    const { width, height } = exportPixelSize(1);
    const times = gifFrameTimes(runTime);
    setExportingGif(true);

    try {
      const { context } = canvasContext(width, height);
      const frames: Uint8ClampedArray[] = [];

      for (const at of times) {
        await drawMarkup(exportMarkup(1, false, at), context, width, height, palette.paper);
        frames.push(context.getImageData(0, 0, width, height).data);
      }

      const delay = gifFrameDelay(runTime, frames.length);
      downloadBlob(encodeGif(frames, width, height, delay), 'micrographic.gif');
      announceExport('success', `Saved micrographic.gif (${width} × ${height}, ${frames.length} frames).`);
    } catch (error) {
      announceExport('error', `Could not export the GIF: ${reason(error)}.`);
    } finally {
      gifInFlight.current = false;
      setExportingGif(false);
    }
  };

  return { exportGif, exportingGif, exportPng, exportScale, exportStatus, exportSvg, setExportScale };
}
