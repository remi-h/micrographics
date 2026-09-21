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

// Ids are internal, but a collision is not: every operation finds its item by
// id, so two items sharing one makes the editor act on the wrong item. This
// exercises the consequence rather than the string — with the old
// `${kind}-${Date.now()}` ids, both symbols below take the same id and the
// delete lands on the wrong one.
describe('App item ids', () => {
  beforeEach(() => {
    window.localStorage.clear();
    // Modern fake timers freeze Date.now, so both adds land in one millisecond.
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('deletes only the selected one of two symbols added in the same millisecond', () => {
    const { container } = render(<App />);
    // The row's leading number is its position in the stack, which shifts as
    // items come and go; the rest of the label names the item.
    const labels = () =>
      Array.from(container.querySelectorAll('.layer-row')).map((row) => (row.textContent ?? '').replace(/^\d+/, ''));
    const occurrences = (label: string) => labels().filter((entry) => entry === label).length;
    const before = labels().length;

    const symbolButtons = container.querySelectorAll('.symbol-button');
    expect(symbolButtons.length).toBeGreaterThan(1);

    act(() => {
      fireEvent.click(symbolButtons[0]);
      fireEvent.click(symbolButtons[1]);
    });

    expect(labels().length).toBe(before + 2);
    // The layer list is newest first, so [0] is the second symbol — the one
    // adding left selected — and [1] is the first.
    const [selectedLabel, keptLabel] = labels();
    const selectedBefore = occurrences(selectedLabel);
    const keptBefore = occurrences(keptLabel);

    act(() => {
      fireEvent.keyDown(window, { key: 'Delete' });
    });

    expect(labels().length).toBe(before + 1);
    expect(occurrences(selectedLabel)).toBe(selectedBefore - 1);
    expect(occurrences(keptLabel)).toBe(keptBefore);
  });
});
