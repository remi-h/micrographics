import { act, renderHook } from '@testing-library/react';
import { initialSettings, palettes } from './data';
import * as exportMarkup from './exportMarkup';
import type { ExportScale } from './exportMarkup';
import type { CanvasItem } from './types';
import { useExport } from './useExport';

// The PNG path has four ways to fail — a serializer that throws, a decode the
// browser rejects, a refused 2D context and an encode that gives up — and each
// one is supposed to name itself in the status line. Only the refused context
// was ever exercised, from Playwright; the rest were unreachable from a test
// while they lived inside App, because nothing could make a real Chromium
// refuse to decode or run a 4800 x 3200 canvas out of memory on demand.
//
// Against the hook they are all one stub away, so all four are pinned here,
// along with the success confirmations and — on both paths — the object URL
// being revoked. A leak there shows up in nothing a user or a test can see.

// The real thing, wrapped so a single test can make it throw. Everything else
// gets the actual serializer, so the markup the exporters hand to the blob is
// the markup exportMarkup.test.ts describes.
jest.mock('./exportMarkup', () => {
  const actual = jest.requireActual('./exportMarkup');
  return { ...actual, buildExportMarkup: jest.fn(actual.buildExportMarkup) };
});

const buildExportMarkup = exportMarkup.buildExportMarkup as jest.MockedFunction<typeof exportMarkup.buildExportMarkup>;

const canvasItems: CanvasItem[] = [
  { id: 'symbol-1', kind: 'symbol', mark: 'orbit', rotate: 15, size: 42, x: 100, y: 200 },
  { id: 'text-1', kind: 'text', rotate: 0, size: 42, text: 'MICRO', x: 300, y: 400 },
];

// jsdom implements none of the browser machinery a PNG export runs on:
// HTMLCanvasElement.getContext and toBlob are stubs that throw "not
// implemented", Image has no decode, and there is no URL.createObjectURL. Each
// one is replaced on its prototype (or on URL) and restored in afterEach, so a
// test that wants a failure only has to change the one step it is about.
type Stubs = {
  createdUrls: string[];
  revokedUrls: string[];
  downloads: Array<{ download: string; href: string }>;
  decode: jest.Mock<Promise<void>, []>;
  clearRect: jest.Mock;
  drawImage: jest.Mock;
  getContext: jest.Mock;
  toBlob: jest.Mock;
  canvases: HTMLCanvasElement[];
};

let stubs: Stubs;
const originals: Array<() => void> = [];

function replace<T extends object, K extends keyof T>(host: T, key: K, value: T[K]) {
  const had = Object.prototype.hasOwnProperty.call(host, key);
  const descriptor = Object.getOwnPropertyDescriptor(host, key);
  Object.defineProperty(host, key, { configurable: true, writable: true, value });
  originals.push(() => {
    if (had && descriptor) Object.defineProperty(host, key, descriptor);
    else delete host[key];
  });
}

beforeEach(() => {
  const createdUrls: string[] = [];
  const revokedUrls: string[] = [];
  const downloads: Array<{ download: string; href: string }> = [];
  const canvases: HTMLCanvasElement[] = [];
  const drawImage = jest.fn();
  const clearRect = jest.fn();
  const decode = jest.fn<Promise<void>, []>(() => Promise.resolve());
  const getContext = jest.fn(function getContext(this: HTMLCanvasElement) {
    canvases.push(this);
    return {
      clearRect,
      drawImage,
      // The GIF export reads each frame back out; a fixed one-pixel buffer is
      // enough, since what is asserted is the encoding, not the pixels.
      getImageData: () => ({ data: new Uint8ClampedArray(4) }),
    } as unknown as CanvasRenderingContext2D;
  });
  const toBlob = jest.fn((callback: BlobCallback) => callback(new Blob(['png'], { type: 'image/png' })));

  replace(URL, 'createObjectURL', ((blob: Blob) => {
    const url = `blob:mock-${createdUrls.length + 1}:${blob.type}`;
    createdUrls.push(url);
    return url;
  }) as typeof URL.createObjectURL);
  replace(URL, 'revokeObjectURL', ((url: string) => {
    revokedUrls.push(url);
  }) as typeof URL.revokeObjectURL);
  replace(HTMLImageElement.prototype, 'decode', decode as HTMLImageElement['decode']);
  replace(HTMLCanvasElement.prototype, 'getContext', getContext as unknown as HTMLCanvasElement['getContext']);
  replace(HTMLCanvasElement.prototype, 'toBlob', toBlob as unknown as HTMLCanvasElement['toBlob']);
  // downloadBlob triggers the save by clicking a detached <a>; jsdom would try
  // to navigate to it. Record what it was asked to write instead.
  replace(HTMLAnchorElement.prototype, 'click', function click(this: HTMLAnchorElement) {
    downloads.push({ download: this.download, href: this.href });
  } as HTMLAnchorElement['click']);

  stubs = { canvases, clearRect, createdUrls, decode, downloads, drawImage, getContext, revokedUrls, toBlob };
});

afterEach(() => {
  while (originals.length > 0) originals.pop()?.();
  buildExportMarkup.mockClear();
});

function setUp() {
  return renderHook(() => useExport({ canvasItems, palette: palettes[0], settings: initialSettings }));
}

async function exportPng(result: { current: ReturnType<typeof useExport> }, scale?: ExportScale) {
  await act(async () => {
    await result.current.exportPng(scale);
  });
}

describe('useExport SVG', () => {
  it('writes a standalone svg at the artboard size and says so', () => {
    const { result } = setUp();

    act(() => result.current.exportSvg());

    expect(stubs.downloads).toEqual([
      { download: 'micrographic.svg', href: 'blob:mock-1:image/svg+xml;charset=utf-8' },
    ]);
    expect(result.current.exportStatus).toEqual({
      id: 1,
      text: 'Saved micrographic.svg (1200 × 800).',
      tone: 'success',
    });
    // The scale control belongs to the PNG: the vector file is always 1x.
    expect(buildExportMarkup).toHaveBeenCalledWith(expect.objectContaining({ scale: 1 }));
  });

  it('names the step that failed when the markup cannot be serialized', () => {
    buildExportMarkup.mockImplementationOnce(() => {
      throw new Error('the SVG could not be serialized');
    });
    const { result } = setUp();

    act(() => result.current.exportSvg());

    expect(result.current.exportStatus).toEqual({
      id: 1,
      text: 'Could not export the SVG: the SVG could not be serialized.',
      tone: 'error',
    });
    expect(stubs.downloads).toEqual([]);
  });

  it('still says something when the failure is not an Error', () => {
    buildExportMarkup.mockImplementationOnce(() => {
      throw 'a bare string';
    });
    const { result } = setUp();

    act(() => result.current.exportSvg());

    expect(result.current.exportStatus?.text).toBe('Could not export the SVG: an unknown error.');
  });

  it('revokes the object URL it downloaded through', () => {
    const { result } = setUp();

    act(() => result.current.exportSvg());

    expect(stubs.revokedUrls).toEqual(stubs.createdUrls);
  });
});

describe('useExport PNG', () => {
  it('rasterizes at the default scale and confirms the file and its pixel size', async () => {
    const { result } = setUp();

    await exportPng(result);

    expect(buildExportMarkup).toHaveBeenCalledWith(expect.objectContaining({ items: canvasItems, scale: 2 }));
    expect(stubs.canvases[0].width).toBe(2400);
    expect(stubs.canvases[0].height).toBe(1600);
    expect(stubs.drawImage).toHaveBeenCalledWith(expect.any(HTMLImageElement), 0, 0, 2400, 1600);
    expect(stubs.downloads).toEqual([{ download: 'micrographic.png', href: 'blob:mock-2:image/png' }]);
    expect(result.current.exportStatus).toEqual({
      id: 1,
      text: 'Saved micrographic.png (2400 × 1600).',
      tone: 'success',
    });
  });

  it('rasterizes at the chosen scale, and quotes that size', async () => {
    const { result } = setUp();

    act(() => result.current.setExportScale(4));
    await exportPng(result);

    expect(buildExportMarkup).toHaveBeenCalledWith(expect.objectContaining({ scale: 4 }));
    expect(stubs.canvases[0].width).toBe(4800);
    expect(stubs.canvases[0].height).toBe(3200);
    expect(result.current.exportStatus?.text).toBe('Saved micrographic.png (4800 × 3200).');
  });

  // The size picker sets the scale and exports in one click. Reading the scale
  // off state would rasterize at the previous one, because state is not updated
  // until the next render, so the scale is passed in instead.
  it('rasterizes at a scale passed in, not the one still in state', async () => {
    const { result } = setUp();
    expect(result.current.exportScale).toBe(2);

    await exportPng(result, 4);

    expect(buildExportMarkup).toHaveBeenCalledWith(expect.objectContaining({ scale: 4 }));
    expect(stubs.canvases[0].width).toBe(4800);
    expect(result.current.exportStatus?.text).toBe('Saved micrographic.png (4800 × 3200).');
  });

  it('remembers a scale passed in as the new default', async () => {
    const { result } = setUp();

    await exportPng(result, 1);
    expect(result.current.exportScale).toBe(1);

    // A later export with no scale uses what the picker last chose.
    await exportPng(result);
    expect(stubs.canvases[1].width).toBe(1200);
  });

  // 1 of 4: the serializer itself throws, before there is anything to decode.
  it('names a markup failure', async () => {
    buildExportMarkup.mockImplementationOnce(() => {
      throw new Error('the SVG could not be serialized');
    });
    const { result } = setUp();

    await exportPng(result);

    expect(result.current.exportStatus).toEqual({
      id: 1,
      text: 'Could not export the PNG: the SVG could not be serialized.',
      tone: 'error',
    });
    expect(stubs.downloads).toEqual([]);
  });

  // 2 of 4: the browser refuses to decode the SVG it was just handed. The
  // rejection is deliberately not quoted: DOMException's own text is not a
  // sentence anyone can act on.
  it('names a decode failure rather than passing the browser error through', async () => {
    stubs.decode.mockRejectedValueOnce(new DOMException('The source image cannot be decoded', 'EncodingError'));
    const { result } = setUp();

    await exportPng(result);

    expect(result.current.exportStatus).toEqual({
      id: 1,
      text: 'Could not export the PNG: this browser could not read the generated image.',
      tone: 'error',
    });
    expect(stubs.drawImage).not.toHaveBeenCalled();
    expect(stubs.downloads).toEqual([]);
  });

  // 3 of 4: no 2D context. This used to be `context?.drawImage(...)`, which
  // drew nothing, encoded a blank canvas and called it a success.
  it('names a refused 2D context instead of writing an empty file', async () => {
    stubs.getContext.mockReturnValueOnce(null);
    const { result } = setUp();

    await exportPng(result);

    expect(result.current.exportStatus).toEqual({
      id: 1,
      text: 'Could not export the PNG: this browser gave no 2D canvas to draw into.',
      tone: 'error',
    });
    expect(stubs.toBlob).not.toHaveBeenCalled();
    expect(stubs.downloads).toEqual([]);
  });

  // 4 of 4: toBlob yields null, which a real browser does when it cannot
  // encode a canvas that big — what the 4x option makes reachable.
  it('names an encode failure, with the size that could not be encoded', async () => {
    stubs.toBlob.mockImplementationOnce((callback: BlobCallback) => callback(null));
    const { result } = setUp();

    act(() => result.current.setExportScale(4));
    await exportPng(result);

    expect(result.current.exportStatus).toEqual({
      id: 1,
      text: 'Could not export the PNG: this browser could not encode a 4800 × 3200 PNG.',
      tone: 'error',
    });
    expect(stubs.downloads).toEqual([]);
  });

  it('revokes the source object URL when the export succeeds', async () => {
    const { result } = setUp();

    await exportPng(result);

    // Two URLs: the SVG the image decodes from, and the PNG downloadBlob
    // saves through. Both have to go — downloadBlob revokes its own as it
    // returns, and the source one goes in the finally after it, so compare
    // them as sets rather than in order.
    expect(stubs.createdUrls).toHaveLength(2);
    expect([...stubs.revokedUrls].sort()).toEqual([...stubs.createdUrls].sort());
  });

  // A refused context is now found before any markup is serialized, so there
  // is no source URL to revoke -- the leak this guards against cannot happen
  // on that path at all. The two failures that come after the URL is minted
  // still have to clean it up, and are covered below.
  it('mints no object URL at all when the 2D context is refused', async () => {
    stubs.getContext.mockReturnValueOnce(null);
    const { result } = setUp();

    await exportPng(result);

    expect(result.current.exportStatus?.tone).toBe('error');
    expect(stubs.createdUrls).toEqual([]);
    expect(stubs.revokedUrls).toEqual([]);
  });

  it.each([
    ['a decode failure', () => stubs.decode.mockRejectedValueOnce(new Error('nope'))],
    ['an encode failure', () => stubs.toBlob.mockImplementationOnce((callback: BlobCallback) => callback(null))],
  ])('revokes the source object URL after %s', async (_label, arrange) => {
    arrange();
    const { result } = setUp();

    await exportPng(result);

    expect(result.current.exportStatus?.tone).toBe('error');
    expect(stubs.createdUrls).toEqual(['blob:mock-1:image/svg+xml;charset=utf-8']);
    expect(stubs.revokedUrls).toEqual(stubs.createdUrls);
  });
});

describe('useExport status messages', () => {
  // ExportStatus keys its paragraph on the id so the node is re-inserted:
  // without a new id, a screen reader treats identical text as no update and
  // stays silent on the second export.
  it('gives every result a new id, even when the text repeats', async () => {
    const { result } = setUp();

    act(() => result.current.exportSvg());
    expect(result.current.exportStatus?.id).toBe(1);

    act(() => result.current.exportSvg());
    expect(result.current.exportStatus).toEqual({
      id: 2,
      text: 'Saved micrographic.svg (1200 × 800).',
      tone: 'success',
    });

    await exportPng(result);
    expect(result.current.exportStatus?.id).toBe(3);
  });

  it('says nothing until something has been exported', () => {
    const { result } = setUp();

    expect(result.current.exportStatus).toBeNull();
    expect(result.current.exportScale).toBe(2);
  });
});

// The GIF is the one export with no engine behind it: the browser runs the
// .svg's CSS and rasterizes the PNG, but every GIF frame has to be rendered
// with the animation's state already worked out and applied. These pin the
// parts of that a browser test cannot see -- which moments are rendered, that
// each one is a fresh picture, and that the failure paths still say so.
describe('useExport GIF', () => {
  const animated: CanvasItem[] = [
    { ...canvasItems[0], animation: { delay: 0, duration: 1, kind: 'slide-left' } },
    { ...canvasItems[1], animation: { delay: 1, duration: 1, kind: 'fade' } },
  ];

  function setUpGif(items: CanvasItem[] = animated) {
    return renderHook(() => useExport({ canvasItems: items, palette: palettes[0], settings: initialSettings }));
  }

  async function exportGif(result: { current: ReturnType<typeof useExport> }) {
    await act(async () => {
      await result.current.exportGif();
    });
  }

  it('renders a frame per sampled moment, each at its own time', async () => {
    const { result } = setUpGif();

    await exportGif(result);

    const frozen = buildExportMarkup.mock.calls
      .map(([input]) => input.freezeAt)
      .filter((at): at is number => at !== undefined);

    expect(frozen.length).toBeGreaterThan(1);
    // Strictly increasing: a repeated moment would be a duplicated picture,
    // and a decreasing one would play the entrance backwards.
    expect([...frozen].sort((a, b) => a - b)).toEqual(frozen);
    expect(new Set(frozen).size).toBe(frozen.length);
    // The sequence runs two seconds, so the plan must reach past the last
    // item's landing rather than stopping at the first one's.
    expect(Math.max(...frozen)).toBeGreaterThan(2);
  });

  it('clears the canvas between frames', async () => {
    // Entrances are transparent at their start, so without a clear each frame
    // would be composited onto the one before it and the GIF would smear.
    const { result } = setUpGif();

    await exportGif(result);

    expect(stubs.clearRect.mock.calls.length).toBeGreaterThanOrEqual(buildExportMarkup.mock.calls.length);
  });

  it('writes the file at the artboard size and says how many frames it took', async () => {
    const { result } = setUpGif();

    await exportGif(result);

    expect(stubs.downloads).toEqual([expect.objectContaining({ download: 'micrographic.gif' })]);
    expect(result.current.exportStatus?.tone).toBe('success');
    expect(result.current.exportStatus?.text).toMatch(/^Saved micrographic\.gif \(1200 × 800, \d+ frames\)\.$/);
  });

  it('says there is nothing to animate rather than writing a still GIF', async () => {
    const { result } = setUpGif(canvasItems);

    await exportGif(result);

    expect(stubs.downloads).toEqual([]);
    expect(result.current.exportStatus).toEqual({
      id: 1,
      text: 'Nothing on the canvas is animated, so there is no GIF to make.',
      tone: 'error',
    });
  });

  it('names the step that failed instead of ending with no file', async () => {
    buildExportMarkup.mockImplementationOnce(() => {
      throw new Error('the SVG could not be serialized');
    });
    const { result } = setUpGif();

    await exportGif(result);

    expect(stubs.downloads).toEqual([]);
    expect(result.current.exportStatus).toEqual({
      id: 1,
      text: 'Could not export the GIF: the SVG could not be serialized.',
      tone: 'error',
    });
  });

  it('ignores a second press while the first is still encoding', async () => {
    // Two clicks inside one frame both read the same rendered `exportingGif`,
    // so a state-based guard lets both through -- and they race for the same
    // filename. The latch is a ref for that reason.
    const { result } = setUpGif();

    await act(async () => {
      await Promise.all([result.current.exportGif(), result.current.exportGif()]);
    });

    expect(stubs.downloads).toHaveLength(1);
  });

  it('can be run again once the first one has finished', async () => {
    // The latch has to clear, or the control is dead after one export.
    const { result } = setUpGif();

    await exportGif(result);
    await exportGif(result);

    expect(stubs.downloads).toHaveLength(2);
  });

  it('clears the latch when there is nothing to animate', async () => {
    // This path returns before any work starts; leaving the latch set would
    // make the very next GIF export silently do nothing.
    const { result } = setUpGif(canvasItems);

    await exportGif(result);

    expect(result.current.exportStatus?.tone).toBe('error');
    await act(async () => {
      await result.current.exportGif();
    });
    expect(result.current.exportStatus?.id).toBe(2);
  });

  it('reports that it is working, and settles when it is done', async () => {
    const { result } = setUpGif();
    expect(result.current.exportingGif).toBe(false);

    await exportGif(result);

    expect(result.current.exportingGif).toBe(false);
  });

  it('leaves no object URL behind', async () => {
    const { result } = setUpGif();

    await exportGif(result);

    expect([...stubs.revokedUrls].sort()).toEqual([...stubs.createdUrls].sort());
  });
});
