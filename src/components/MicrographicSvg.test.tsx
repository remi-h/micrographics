import { act, render } from '@testing-library/react';
import { useInkBox, selectionBox, MIN_SELECTION_SIZE, SELECTION_PAD, type Box } from './MicrographicSvg';

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
function Probe({ active, deps, bbox }: { active: boolean; deps: unknown[]; bbox?: () => DOMRect }) {
  const [ref, box] = useInkBox<SVGGElement>(active, deps);
  return (
    <svg>
      <g
        ref={(node) => {
          if (node && bbox) (node as unknown as { getBBox: () => DOMRect }).getBBox = bbox;
          ref.current = node;
        }}
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
});
