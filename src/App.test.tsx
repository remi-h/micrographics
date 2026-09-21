import { act, fireEvent, render } from '@testing-library/react';
import App from './App';

// The artboard re-centres on the selection when the zoom changes, and only
// then. Selecting, nudging or editing an item must leave the viewport alone,
// so these two cases pin both halves of that contract.

// The effect schedules its work in an animation frame; run what jsdom queued.
function flushAnimationFrame() {
  act(() => {
    jest.advanceTimersByTime(32);
  });
}

// jsdom has no layout engine, so the effect's measurements have to be faked or
// it bails out on a zero-sized artboard.
function setUpArtboard() {
  const wrap = document.querySelector('.artboard-wrap') as HTMLElement | null;
  const svg = document.querySelector('.artboard-wrap svg') as SVGSVGElement | null;
  if (!wrap || !svg) throw new Error('expected the artboard and its svg to render');

  const rect = (width: number, height: number) =>
    ({ x: 0, y: 0, width, height, left: 0, top: 0, right: width, bottom: height, toJSON: () => ({}) }) as DOMRect;

  wrap.getBoundingClientRect = () => rect(600, 400);
  svg.getBoundingClientRect = () => rect(2400, 1600);
  Object.defineProperty(wrap, 'clientWidth', { configurable: true, value: 600 });
  Object.defineProperty(wrap, 'clientHeight', { configurable: true, value: 400 });

  const scrollTo = jest.fn();
  wrap.scrollTo = scrollTo as unknown as HTMLElement['scrollTo'];

  // Drain the frame the mount already queued, so what follows is only ours.
  flushAnimationFrame();
  scrollTo.mockClear();
  return scrollTo;
}

describe('App scroll-to-selection', () => {
  beforeEach(() => {
    window.localStorage.clear();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('scrolls the artboard when the zoom changes while something is selected', () => {
    const { container } = render(<App />);
    const scrollTo = setUpArtboard();

    fireEvent.click(container.querySelectorAll('.layer-row')[0]);
    flushAnimationFrame();
    // Selecting is not a scroll trigger; only the zoom below should move it.
    expect(scrollTo).not.toHaveBeenCalled();

    fireEvent.click(container.querySelector('[title="Zoom in"]') as HTMLElement);
    flushAnimationFrame();

    expect(scrollTo).toHaveBeenCalledTimes(1);
  });

  it('does not scroll the artboard when only the selection changes', () => {
    const { container } = render(<App />);
    const scrollTo = setUpArtboard();

    const rows = container.querySelectorAll('.layer-row');
    expect(rows.length).toBeGreaterThan(1);

    fireEvent.click(rows[0]);
    flushAnimationFrame();
    fireEvent.click(rows[1]);
    flushAnimationFrame();

    expect(scrollTo).not.toHaveBeenCalled();
  });
});
