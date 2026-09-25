import { act, render } from '@testing-library/react';
import {
  useInkBox,
  resizeGrip,
  resizeRatio,
  scaleInk,
  selectionBox,
  selectionToolbarPosition,
  LETTER_SPACING,
  MIN_SELECTION_SIZE,
  SELECTION_PAD,
  SELECTION_TOOLBAR_WIDTH,
  type Box,
} from './MicrographicSvg';

// The selection outline is measured from what an item actually renders rather
// than estimated from its size. e2e/selection-outline.spec.ts proves the
// outline contains the ink in a real browser; these cover the unit-level
// branches that a pixel assertion cannot reach — a measurement that fails, one
// that comes back empty, and the padding arithmetic itself.

describe('selectionBox', () => {
  it('pads the ink box evenly on every side', () => {
    const ink: Box = { x: 100, y: 200, width: 50, height: 40 };
    const outline = selectionBox(ink);

    expect(outline).toEqual({
      x: 100 - SELECTION_PAD,
      y: 200 - SELECTION_PAD,
      width: 50 + SELECTION_PAD * 2,
      height: 40 + SELECTION_PAD * 2,
    });
  });

  it('stays centred on the ink when the floor applies', () => {
    // A hairline rule measures zero on one axis. Without the floor the outline
    // would collapse onto the ink and stack both handles in one place.
    const ink: Box = { x: 0, y: 50, width: 80, height: 0 };
    const outline = selectionBox(ink);

    expect(outline.height).toBe(MIN_SELECTION_SIZE);
    expect(outline.y + outline.height / 2).toBe(50);
    // The wide axis is past the floor, so it pads normally.
    expect(outline.width).toBe(80 + SELECTION_PAD * 2);
    expect(outline.x + outline.width / 2).toBe(40);
  });

  it('floors both axes for a point-sized measurement', () => {
    const outline = selectionBox({ x: 10, y: 10, width: 0, height: 0 });

    expect(outline.width).toBe(MIN_SELECTION_SIZE);
    expect(outline.height).toBe(MIN_SELECTION_SIZE);
    expect(outline.x).toBe(10 - MIN_SELECTION_SIZE / 2);
    expect(outline.y).toBe(10 - MIN_SELECTION_SIZE / 2);
  });
});

// Exercises the hook through a real component so the ref attaches to a real
// node, which is what the effect reads.
function Probe({
  active,
  deps,
  bbox,
  measuredAt,
}: {
  active: boolean;
  deps: unknown[];
  bbox?: () => DOMRect;
  measuredAt?: number;
}) {
  const [ref, box] = useInkBox<SVGGElement>(active, deps, measuredAt);
  return (
    <svg>
      <g
        ref={(node) => {
          if (node && bbox) (node as unknown as { getBBox: () => DOMRect }).getBBox = bbox;
          ref.current = node;
        }}
        data-at={box ? String(box.at) : 'null'}
        data-box={box ? `${box.x},${box.y},${box.width},${box.height}` : 'null'}
      />
    </svg>
  );
}

const rect = (x: number, y: number, width: number, height: number) =>
  ({ x, y, width, height, top: y, left: x, right: x + width, bottom: y + height, toJSON: () => ({}) }) as DOMRect;

function measured(container: HTMLElement) {
  return container.querySelector('g')?.getAttribute('data-box');
}

function measuredAt(container: HTMLElement) {
  return container.querySelector('g')?.getAttribute('data-at');
}

describe('useInkBox', () => {
  it('reports the measured box when the node can be measured', () => {
    const { container } = render(<Probe active deps={[]} bbox={() => rect(4, 8, 30, 20)} />);

    expect(measured(container)).toBe('4,8,30,20');
  });

  it('reports nothing while inactive, so an unselected item never measures', () => {
    const bbox = jest.fn(() => rect(4, 8, 30, 20));
    const { container } = render(<Probe active={false} deps={[]} bbox={bbox} />);

    expect(measured(container)).toBe('null');
    expect(bbox).not.toHaveBeenCalled();
  });

  it('treats a zero-sized measurement as no measurement', () => {
    // A node that has not laid out yet measures 0x0. Using that box would draw
    // a floor-sized outline at the origin instead of around the item.
    const { container } = render(<Probe active deps={[]} bbox={() => rect(0, 0, 0, 0)} />);

    expect(measured(container)).toBe('null');
  });

  it('falls back rather than throwing when getBBox throws', () => {
    const { container } = render(
      <Probe
        active
        deps={[]}
        bbox={() => {
          throw new Error('not rendered');
        }}
      />,
    );

    expect(measured(container)).toBe('null');
  });

  it('reports nothing when the environment has no getBBox at all', () => {
    // jsdom does not implement getBBox; the caller must still render.
    const { container } = render(<Probe active deps={[]} />);

    expect(measured(container)).toBe('null');
  });

  it('re-measures when a dependency changes', () => {
    let box = rect(0, 0, 10, 10);
    const { container, rerender } = render(<Probe active deps={[1]} bbox={() => box} />);
    expect(measured(container)).toBe('0,0,10,10');

    box = rect(0, 0, 40, 40);
    act(() => {
      rerender(<Probe active deps={[2]} bbox={() => box} />);
    });

    expect(measured(container)).toBe('0,0,40,40');
  });

  it('records the size a measurement was taken at', () => {
    const { container } = render(<Probe active deps={[]} measuredAt={48} bbox={() => rect(0, -40, 300, 50)} />);

    expect(measuredAt(container)).toBe('48');
  });

  it('does not re-measure when only the size changes', () => {
    // This is what makes a resize drag cheap and the outline honest. Putting
    // the size back in `deps` costs a forced synchronous layout per frame, and
    // lands the new measurement a render *after* the glyph has already grown,
    // so for one frame the outline is drawn around the previous size.
    const bbox = jest.fn(() => rect(0, -40, 300, 50));
    const { container, rerender } = render(<Probe active deps={['LABEL']} measuredAt={48} bbox={bbox} />);
    expect(bbox).toHaveBeenCalledTimes(1);

    act(() => {
      rerender(<Probe active deps={['LABEL']} measuredAt={96} bbox={bbox} />);
    });

    expect(bbox).toHaveBeenCalledTimes(1);
    expect(measuredAt(container)).toBe('48');
  });
});

// The numbers below come from measuring a real <text> in Chromium at the font
// the canvas uses (IBM Plex Mono 800, letter-spacing 2) with the 26-character
// line 'Some reasonably long label'. The box is affine in the font size, not
// proportional to it, which is the whole reason this function exists.
describe('scaleInk', () => {
  const GAPS = 25; // 26 characters, so 25 letter-spacing gaps
  const atFortyEight = { at: 48, x: 0, y: -44.63, width: 802.79, height: 108.87 };

  // Within a SELECTION_PAD of the real box is close enough to draw: the outline
  // is padded by that much anyway, so an error this size only widens or narrows
  // the gap around the glyphs, it never crosses them. The residual comes from
  // the last glyph's side bearing, which the model folds into the scaling part.
  // Proportional scaling misses by 24x that, in both directions.
  const TOLERANCE = SELECTION_PAD;

  it('scales proportionally when there is no letter spacing to hold back', () => {
    const ink = scaleInk({ at: 10, x: 2, y: -8, width: 100, height: 20 }, 30, 0);

    expect(ink).toEqual({ x: 6, y: -24, width: 300, height: 60 });
  });

  it('is a no-op at the size it was measured at', () => {
    expect(scaleInk(atFortyEight, 48, GAPS)).toEqual({
      x: 0,
      y: -44.63,
      width: 802.79,
      height: 108.87,
    });
  });

  it('matches the real box when the text is scaled up', () => {
    // Chromium measures 2868.84 here. Scaling the whole box by 3.75 instead
    // gives 3010.46 -- 142 units of slack hanging off the right of the glyphs.
    expect(Math.abs(scaleInk(atFortyEight, 180, GAPS).width - 2868.84)).toBeLessThan(TOLERANCE);
  });

  it('matches the real box when the text is scaled down', () => {
    // Chromium measures 239.42. Scaling the whole box by 0.25 gives 200.70,
    // which would draw the outline 39 units *inside* the text it contains.
    expect(Math.abs(scaleInk(atFortyEight, 12, GAPS).width - 239.42)).toBeLessThan(TOLERANCE);
  });

  it('holds the letter spacing out of the scaling entirely', () => {
    // A box that is nothing but letter spacing is the same width at any size.
    const spacing = { at: 20, x: 0, y: 0, width: LETTER_SPACING * 4, height: 0 };

    expect(scaleInk(spacing, 200, 4).width).toBe(LETTER_SPACING * 4);
  });

  it('never reports a negative width when the spacing exceeds the measurement', () => {
    // A one-character item measures narrower than the gaps its line would have
    // if it were longer; the subtraction must not run past zero.
    const ink = scaleInk({ at: 10, x: 0, y: 0, width: 4, height: 10 }, 20, 25);

    expect(ink.width).toBeGreaterThanOrEqual(0);
  });

  it('leaves the box alone rather than dividing by a zero reference', () => {
    const ink = scaleInk({ at: 0, x: 1, y: 2, width: 30, height: 40 }, 96, 0);

    expect(ink).toEqual({ x: 1, y: 2, width: 30, height: 40 });
  });
});

// Resizing. The old mapping scaled from the selection's centre, so the box
// grew at twice the pointer's rate and the far corner slid away from the
// cursor; measured in a browser, ten pixels of travel took a size-42 symbol to
// 67 and the size ceiling arrived after eighty. These pin the mapping that
// replaced it: anchored on the opposite corner, and linear in travel.
describe('resizeGrip', () => {
  const bounds = { left: 100, top: 100, right: 200, bottom: 180 };

  it('is exactly neutral at the point the handle was grabbed', () => {
    // Anything else makes the item jump the instant the pointer moves.
    const grab = { x: 200, y: 180 };

    expect(resizeRatio(resizeGrip(bounds, grab), grab)).toBeCloseTo(1);
  });

  it('is neutral even when the grab point is nowhere near the corner', () => {
    // Which is the normal case for a rotated item: the handle is drawn inside
    // the item's rotated group, so it can be grabbed on the far side of the
    // selection from the corner it belongs to.
    const grab = { x: 104, y: 104 };

    expect(resizeRatio(resizeGrip(bounds, grab), grab)).toBeCloseTo(1);
  });

  it('keeps the anchor on the corner opposite the handle', () => {
    const grip = resizeGrip(bounds, { x: 200, y: 180 });

    expect(grip.anchorX).toBe(100);
    expect(grip.anchorY).toBe(100);
  });

  it('takes its axis from the selection, not from where the pointer went down', () => {
    // A rotated item's handle sits at the selection's *top-left* in canvas
    // coordinates. Measuring the axis to the pointer collapsed the span to
    // almost nothing there, and one small drag ran the item to its ceiling.
    const fromCorner = resizeGrip(bounds, { x: 200, y: 180 });
    const fromRotated = resizeGrip(bounds, { x: 100, y: 100 });

    expect(fromRotated.span).toBeCloseTo(fromCorner.span);
    expect(fromRotated.axisX).toBeCloseTo(fromCorner.axisX);
    expect(fromRotated.axisY).toBeCloseTo(fromCorner.axisY);
  });

  it('answers the same push the same way wherever the handle was grabbed', () => {
    // Several items selected means several handles, one per item. Grabbing the
    // near one used to scale many times faster than grabbing the far one.
    const wide = { left: 200, top: 200, right: 1000, bottom: 600 };
    const near = resizeGrip(wide, { x: 260, y: 240 });
    const far = resizeGrip(wide, { x: 1000, y: 600 });

    expect(resizeRatio(near, { x: 280, y: 260 })).toBeCloseTo(resizeRatio(far, { x: 1020, y: 620 }));
  });

  it('survives a selection with no extent at all', () => {
    const grip = resizeGrip({ left: 100, top: 100, right: 100, bottom: 100 }, { x: 100, y: 100 });

    // A zero axis would pin the ratio at its floor for the rest of the drag,
    // collapsing the item with no way back.
    expect(Math.hypot(grip.axisX, grip.axisY)).toBeCloseTo(1);
    expect(resizeRatio(grip, { x: 200, y: 200 })).toBeGreaterThan(1);
  });
});

describe('resizeRatio', () => {
  // A selection 100 units wide and none tall, grabbed on its far corner, so
  // the axis is the x axis and the span is 100.
  const grip = resizeGrip({ left: 0, top: 0, right: 100, bottom: 0 }, { x: 100, y: 0 });

  it('grows in step with the pointer rather than faster than it', () => {
    // Anchored on the opposite corner, travel and growth are one to one. The
    // centre-anchored mapping doubled this, because the box grew both ways.
    expect(resizeRatio(grip, { x: 150, y: 0 })).toBeCloseTo(1.5);
    expect(resizeRatio(grip, { x: 200, y: 0 })).toBeCloseTo(2);
  });

  it('is linear, so the same push means the same growth wherever it starts', () => {
    const first = resizeRatio(grip, { x: 150, y: 0 }) - resizeRatio(grip, { x: 100, y: 0 });
    const later = resizeRatio(grip, { x: 350, y: 0 }) - resizeRatio(grip, { x: 300, y: 0 });

    expect(first).toBeCloseTo(later);
  });

  it('ignores wandering sideways off the axis it was grabbed on', () => {
    // Otherwise a drag that drifts perpendicular would keep inflating the item
    // through sheer distance from the anchor.
    expect(resizeRatio(grip, { x: 150, y: 80 })).toBeCloseTo(1.5);
    expect(resizeRatio(grip, { x: 150, y: -80 })).toBeCloseTo(1.5);
  });

  it('shrinks when the pointer comes back past where it started', () => {
    expect(resizeRatio(grip, { x: 50, y: 0 })).toBeCloseTo(0.5);
  });

  it('will not turn the selection inside out when dragged past the anchor', () => {
    expect(resizeRatio(grip, { x: -400, y: 0 })).toBeGreaterThan(0);
  });
});

// The toolbar that appears over a multi-item selection. It is placed in canvas
// units inside a viewBox that clips, so the arithmetic is the whole of it.
describe('selectionToolbarPosition', () => {
  it('centres the toolbar on the selection', () => {
    const { toolbarX } = selectionToolbarPosition({ left: 400, right: 600, top: 300 });

    expect(toolbarX + SELECTION_TOOLBAR_WIDTH / 2).toBe(500);
  });

  it('sits the toolbar above the selection', () => {
    expect(selectionToolbarPosition({ left: 0, right: 100, top: 300 }).toolbarY).toBe(242);
  });

  it('keeps the whole toolbar on the artboard at the right edge', () => {
    // The previous placement used a half-width of 100 for a toolbar that had
    // grown past 200, so the last button hung off the viewBox and was clipped.
    const { toolbarX } = selectionToolbarPosition({ left: 1140, right: 1190, top: 400 });

    expect(toolbarX + SELECTION_TOOLBAR_WIDTH).toBeLessThanOrEqual(1200);
  });

  it('keeps the whole toolbar on the artboard at the left edge', () => {
    expect(selectionToolbarPosition({ left: 10, right: 40, top: 400 }).toolbarX).toBeGreaterThanOrEqual(0);
  });

  it('keeps the toolbar on the artboard for a selection against the top', () => {
    expect(selectionToolbarPosition({ left: 400, right: 600, top: 0 }).toolbarY).toBeGreaterThanOrEqual(0);
  });
});
