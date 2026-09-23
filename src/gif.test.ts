import { GIF_FPS, GIF_HOLD, GIF_MAX_FRAMES, gifFrameDelay, gifFrameTimes } from './gif';

// The frame plan is the part of the GIF export that can be wrong quietly: a
// file still comes out, it just plays at the wrong speed, stops before the
// artwork lands, or asks the browser for hundreds of rasterizations.

describe('gifFrameTimes', () => {
  it('covers the animation and the hold after it', () => {
    const times = gifFrameTimes(2);

    expect(times[0]).toBe(0);
    // The last frame starts one frame short of the end, since it is held for a
    // frame's worth of time itself.
    expect(times[times.length - 1]).toBeCloseTo(2 + GIF_HOLD - (2 + GIF_HOLD) / times.length, 5);
  });

  it('samples at the frame rate it is given', () => {
    expect(gifFrameTimes(2, 10, 0)).toHaveLength(20);
    expect(gifFrameTimes(2, 25, 0)).toHaveLength(50);
  });

  it('spaces the frames evenly', () => {
    const times = gifFrameTimes(2, 10, 0);
    const gaps = times.slice(1).map((time, index) => time - times[index]);

    expect(Math.max(...gaps) - Math.min(...gaps)).toBeLessThan(1e-9);
  });

  it('holds the finished artwork after the last item lands', () => {
    // Otherwise the loop restarts the instant the animation ends and the
    // poster -- the thing the entrance is an entrance *to* -- is never seen.
    const times = gifFrameTimes(1, GIF_FPS, 1);

    expect(times.filter((time) => time >= 1).length).toBeGreaterThan(GIF_FPS / 2);
  });

  it('samples a very long sequence more coarsely rather than cutting it short', () => {
    // Ten seconds of delay at the full frame rate would be 280 rasterizations
    // and a file to match. The whole animation at a lower rate beats the first
    // half of one at the full rate.
    const times = gifFrameTimes(10);

    expect(times).toHaveLength(GIF_MAX_FRAMES);
    expect(times[times.length - 1]).toBeGreaterThan(10);
  });

  it('still produces a frame when nothing animates', () => {
    // A zero-length plan would encode a GIF with no pictures in it.
    expect(gifFrameTimes(0, GIF_FPS, 0)).toEqual([0]);
  });
});

describe('gifFrameDelay', () => {
  it('plays the file over the time it covers', () => {
    const runTime = 2;
    const frames = gifFrameTimes(runTime).length;

    expect(gifFrameDelay(runTime, frames) * frames).toBeCloseTo((runTime + GIF_HOLD) * 1000, -2);
  });

  it('rounds to the hundredths of a second a GIF can actually store', () => {
    expect(gifFrameDelay(2, 30) % 10).toBe(0);
  });

  it('never asks for a delay so short that viewers override it', () => {
    // Browsers and most viewers clamp anything under 20ms to 100ms, which would
    // play the animation five times slower than it was rendered.
    expect(gifFrameDelay(0.1, 500)).toBeGreaterThanOrEqual(20);
  });

  it('answers with something usable when there is nothing to divide', () => {
    expect(gifFrameDelay(0, 0, 0)).toBeGreaterThan(0);
  });
});
