import { applyPalette, GIFEncoder, quantize } from 'gifenc';

// Turning the entrance sequence into an animated GIF.
//
// The .svg export hands the animation to the browser as CSS and lets it run.
// A GIF has no engine: it is a stack of finished pictures with a delay between
// them, so the sequence has to be sampled -- each frame rendered with the
// animation's state already applied (see `freezeAt` in exportMarkup) and
// rasterized on its own.
//
// This module owns the two decisions that follow from that: when to sample,
// and how to encode. Both are pure apart from `encodeGif` itself, so the frame
// plan is testable without a browser.

/** Frames a second. Enough for a smooth slide without a file nobody can post. */
export const GIF_FPS = 25;

/**
 * How long the finished artwork is held on screen before the GIF loops, in
 * seconds. Without it the sequence restarts the instant the last item lands
 * and the poster is never actually seen -- which is the frame the whole
 * animation is an entrance *to*.
 */
export const GIF_HOLD = 1.2;

/**
 * A ceiling on frames, so a ten-second delay on one item cannot ask the
 * browser for six hundred rasterizations and a file to match. Past it the
 * sequence is sampled more coarsely rather than truncated: a whole animation
 * at a lower frame rate is a better answer than the first half of one.
 */
export const GIF_MAX_FRAMES = 150;

/**
 * The moments to render, in seconds. Always at least one -- the finished
 * artwork -- so a canvas with nothing animated still produces a valid file
 * rather than an empty one.
 */
export function gifFrameTimes(runTime: number, fps = GIF_FPS, hold = GIF_HOLD): number[] {
  const total = Math.max(0, runTime) + Math.max(0, hold);
  if (total <= 0) return [0];

  const wanted = Math.ceil(total * fps);
  const count = Math.min(GIF_MAX_FRAMES, Math.max(1, wanted));
  const step = total / count;

  return Array.from({ length: count }, (_, index) => index * step);
}

/** Milliseconds each frame is held, so the file plays over the time it covers. */
export function gifFrameDelay(runTime: number, frames: number, hold = GIF_HOLD): number {
  const total = Math.max(0, runTime) + Math.max(0, hold);
  if (frames <= 0 || total <= 0) return 100;
  // GIF delays are stored in hundredths of a second, so anything finer is lost
  // in the file anyway. Round to that grid here rather than let the encoder do
  // it, so the delay this reports is the delay the file actually plays at.
  return Math.max(20, Math.round((total * 1000) / frames / 10) * 10);
}

/**
 * Encodes already-rasterized frames into a GIF blob.
 *
 * One palette per frame rather than one for the whole file. A shared palette
 * would be cheaper, but an entrance fades and slides items over the
 * background, so the mid-animation frames contain colours -- blends of the
 * palette's two -- that the poster frame does not, and quantizing those to a
 * palette built from the poster alone bands the fade badly.
 */
export function encodeGif(frames: Uint8ClampedArray[], width: number, height: number, delayMs: number): Blob {
  const encoder = GIFEncoder();

  for (const frame of frames) {
    const data = new Uint8Array(frame.buffer, frame.byteOffset, frame.byteLength);
    const palette = quantize(data, 256);
    encoder.writeFrame(applyPalette(data, palette), width, height, { delay: delayMs, palette });
  }

  encoder.finish();
  return new Blob([encoder.bytesView() as unknown as BlobPart], { type: 'image/gif' });
}
