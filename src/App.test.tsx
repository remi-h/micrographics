import { act, fireEvent, render } from '@testing-library/react';
import App from './App';
import { initialSettings } from './data';

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

    fireEvent.click(container.querySelectorAll('.layer-select')[0]);
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

    const rows = container.querySelectorAll('.layer-select');
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

// App wires persistence.ts into three effects: restore once on mount, save on
// a debounce, and flush the pending save on pagehide. persistence.test.ts
// covers the module and e2e/persistence.spec.ts covers the user-visible round
// trip, but the wiring between them had no unit test — so a broken gate or a
// dropped listener would only surface in the slow suite, or not at all.
jest.mock('./persistence', () => {
  const actual = jest.requireActual('./persistence');
  return { ...actual, loadEditorState: jest.fn(), saveEditorState: jest.fn(() => true) };
});

// eslint-disable-next-line @typescript-eslint/no-require-imports -- the mock above is only visible through a runtime require
const persistence = require('./persistence') as {
  loadEditorState: jest.Mock;
  saveEditorState: jest.Mock;
};

describe('App persistence wiring', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    persistence.loadEditorState.mockReset().mockReturnValue(null);
    persistence.saveEditorState.mockReset().mockReturnValue(true);
    window.localStorage.clear();
  });

  afterEach(() => {
    // Base UI schedules transition state in animation frames; draining them
    // outside act() logs a React warning even though the assertions are done.
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('restores a saved canvas on mount instead of the default template', () => {
    persistence.loadEditorState.mockReturnValue({
      settings: { ...initialSettings, template: 'blank', grid: true },
      canvasItems: [
        { id: 'text-restored', kind: 'text', rotate: 0, size: 42, text: 'RESTORED', x: 300, y: 400 },
      ],
      canvasZoom: 1,
    });

    const { container } = render(<App />);

    expect(persistence.loadEditorState).toHaveBeenCalledTimes(1);
    const layers = [...container.querySelectorAll('.layer-row')].map((row) => row.textContent ?? '');
    expect(layers).toHaveLength(1);
    expect(layers[0]).toContain('RESTORED');
  });

  it('does not save until the restore has run, then saves on a debounce', () => {
    const { container } = render(<App />);

    // Nothing is written just for mounting: a save here would persist the
    // defaults over a real saved canvas before the restore could read it.
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    persistence.saveEditorState.mockClear();

    const symbol = container.querySelector('.symbol-button');
    if (!symbol) throw new Error('expected a symbol button');
    act(() => {
      fireEvent.click(symbol);
    });

    // Still nothing before the debounce elapses.
    act(() => {
      jest.advanceTimersByTime(399);
    });
    expect(persistence.saveEditorState).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(persistence.saveEditorState).toHaveBeenCalled();
  });

  it('flushes the pending save when the page goes away', () => {
    const { container } = render(<App />);
    act(() => {
      jest.advanceTimersByTime(1000);
    });

    const symbol = container.querySelector('.symbol-button');
    if (!symbol) throw new Error('expected a symbol button');
    act(() => {
      fireEvent.click(symbol);
    });
    persistence.saveEditorState.mockClear();

    // pagehide arrives inside the debounce window: without the flush listener
    // the edit would be lost, because the timer never fires.
    act(() => {
      window.dispatchEvent(new Event('pagehide'));
    });

    expect(persistence.saveEditorState).toHaveBeenCalled();
  });
});
