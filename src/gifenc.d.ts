// gifenc ships no types. This declares only the surface `src/gif.ts` uses,
// matching node_modules/gifenc/src: `quantize` builds a palette from RGBA
// bytes, `applyPalette` maps those bytes onto it, and the encoder writes the
// indexed frames out. A palette entry is [r, g, b] or [r, g, b, a].
declare module 'gifenc' {
  export type GifPalette = number[][];

  export function quantize(rgba: Uint8Array | Uint8ClampedArray, maxColors: number): GifPalette;

  export function applyPalette(
    rgba: Uint8Array | Uint8ClampedArray,
    palette: GifPalette,
    format?: 'rgb565' | 'rgb444' | 'rgba4444',
  ): Uint8Array;

  export type GifFrameOptions = {
    delay?: number;
    palette?: GifPalette | null;
    repeat?: number;
    transparent?: boolean;
    transparentIndex?: number;
  };

  export type GifEncoder = {
    writeFrame: (index: Uint8Array, width: number, height: number, options?: GifFrameOptions) => void;
    finish: () => void;
    bytesView: () => Uint8Array;
  };

  export function GIFEncoder(options?: { auto?: boolean; initialCapacity?: number }): GifEncoder;
}
