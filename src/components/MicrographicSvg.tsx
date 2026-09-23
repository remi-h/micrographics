import { forwardRef, useEffect, useEffectEvent, useRef, useState } from 'react';
import { AlignCenterHorizontal, AlignCenterVertical, AlignHorizontalSpaceBetween, AlignVerticalSpaceBetween } from 'lucide-react';
import type { MouseEvent, PointerEvent } from 'react';
import { hitBounds, intersects } from '../canvasGeometry';
import type { CanvasItem, CanvasSymbol, CanvasText, Palette, Settings } from '../types';
import { MicroMark } from './MicroMark';

export type Box = { x: number; y: number; width: number; height: number };

// Breathing room between the glyph and its selection outline, in canvas units.
export const SELECTION_PAD = 6;

// A one-dimensional glyph (a rule, a hairline) measures zero on one axis, and a
// zero-height outline would collapse onto the ink and put both handles in the
// same place. Floor the outline so it stays grabbable.
export const MIN_SELECTION_SIZE = 20;

// Dragging the handle past the anchor would otherwise invert the ratio and
// flip the selection through itself. The items have their own size floor; this
// only has to keep the arithmetic the right way up.
export const MIN_RESIZE_RATIO = 0.02;

// A selection with no extent at all has no diagonal to scale along. Floor the
// span so the division stays sane; the axis has its own fallback below.
export const MIN_RESIZE_SPAN = 1;

/**
 * Where a resize drag started: the corner that stays put, the far corner the
 * pointer drags, the axis between them, and where the pointer first went down.
 */
export type ResizeGrip = {
  anchorX: number;
  anchorY: number;
  axisX: number;
  axisY: number;
  span: number;
  cornerX: number;
  cornerY: number;
  grabX: number;
  grabY: number;
};

/**
 * The grip a drag starts from, taken from the selection's own bounds: the
 * top-left corner stays put and the bottom-right one is what the pointer
 * drags, along the diagonal between them.
 *
 * The grab point is recorded but deliberately not used to build the axis. The
 * resize handle is drawn *inside* each item's rotated group, so on a rotated
 * item the pointer is nowhere near the corner it appears to sit on; and with
 * several items selected there is one handle per item, so the pointer is at
 * whichever one was grabbed rather than at the selection's corner. Deriving
 * the axis from the pointer made the drag wildly over-sensitive in the first
 * case and dependent on which handle you grabbed in the second. Bounds have
 * neither problem, and `resizeRatio` applies the pointer as a displacement so
 * the ratio is still exactly 1 where the drag began.
 */
export function resizeGrip(
  bounds: { left: number; top: number; right: number; bottom: number },
  grab: { x: number; y: number },
): ResizeGrip {
  const reachX = bounds.right - bounds.left;
  const reachY = bounds.bottom - bounds.top;
  const diagonal = Math.hypot(reachX, reachY);
  // A zero diagonal would divide out to a zero vector rather than a unit one,
  // which pins the ratio at its floor for the rest of the drag. Fall back to
  // the diagonal every handle sits on.
  const unit = diagonal === 0 ? { x: Math.SQRT1_2, y: Math.SQRT1_2 } : { x: reachX / diagonal, y: reachY / diagonal };
  return {
    anchorX: bounds.left,
    anchorY: bounds.top,
    axisX: unit.x,
    axisY: unit.y,
    cornerX: bounds.right,
    cornerY: bounds.bottom,
    grabX: grab.x,
    grabY: grab.y,
    span: Math.max(MIN_RESIZE_SPAN, diagonal),
  };
}

/**
 * How much bigger the selection should be, given where the pointer is now.
 *
 * The pointer is projected onto the grip's axis rather than measured straight
 * to it, so wandering sideways off the diagonal does not change the size. The
 * result is linear in how far the pointer has travelled along that axis: move
 * twice as far, get twice the growth.
 *
 * Scaling used to run from the selection's *centre*, which made the box grow
 * in both directions at once -- twice the pointer's own rate -- while the far
 * corner slid away from the cursor. On a small item the centre is barely
 * twenty pixels from the handle, so ten pixels of travel was most of its size
 * again, and the size ceiling arrived within one flick of the wrist.
 */
export function resizeRatio(grip: ResizeGrip, point: { x: number; y: number }): number {
  // How far the pointer has come, applied to the selection's far corner. The
  // pointer's absolute position is not the corner -- see `resizeGrip` -- but
  // how far it has moved is the same wherever it started.
  const cornerX = grip.cornerX + (point.x - grip.grabX);
  const cornerY = grip.cornerY + (point.y - grip.grabY);
  const along = (cornerX - grip.anchorX) * grip.axisX + (cornerY - grip.anchorY) * grip.axisY;
  return Math.max(MIN_RESIZE_RATIO, along / grip.span);
}

// Letter spacing on the canvas text, in canvas units. Absolute: it is the same
// number of units between two characters at any font size, which is why
// `scaleInk` below has to take it out before scaling a measurement.
export const LETTER_SPACING = 2;

// A measurement, and the font size it was taken at, so it can answer for other
// sizes. `at` is 1 for a measurement that does not depend on a font size.
export type Measured = Box & { at: number };

// The selection outline is drawn from what the item actually renders, not from
// an estimate of it. Estimates were wrong in both directions: symbol glyphs
// don't fill their nominal 36-unit design box, and the text width formula
// (chars * size * 0.62) ignores the letterSpacing="2" that <text> below
// applies, so long strings overflowed their own outline to the right.
//
// `deps` are the things that change the *shape* being measured -- a symbol's
// mark, a text item's characters. An item's `size` is deliberately not one of
// them. Re-measuring on every frame of a resize drag was both slow (each
// getBBox is a forced synchronous layout: ~2.5ms per update for a text item,
// against 0.2ms for a symbol) and wrong to look at, because the measurement
// only lands on the render *after* the one that resized the glyph. For one
// frame the outline still wore the previous size, and a text item's letters
// visibly escaped their own border while it was being dragged bigger. Callers
// scale the measurement instead; `scaleInk` and the symbol call site below.
export function useInkBox<T extends SVGGraphicsElement>(active: boolean, deps: unknown[], measuredAt = 1) {
  const ref = useRef<T | null>(null);
  const [box, setBox] = useState<Measured | null>(null);

  // The measurement reads `measuredAt` but must not re-run when it changes --
  // that is the per-frame re-measure this hook exists to avoid. An effect event
  // is exactly that: the latest value, without a dependency on it.
  const measure = useEffectEvent(() => {
    const node = ref.current;
    // getBBox is unimplemented in jsdom and throws on an unrendered node.
    if (!active || !node || typeof node.getBBox !== 'function') {
      setBox(null);
      return;
    }

    try {
      const measured = node.getBBox();
      if (measured.width === 0 && measured.height === 0) {
        setBox(null);
        return;
      }
      setBox({ at: measuredAt, height: measured.height, width: measured.width, x: measured.x, y: measured.y });
    } catch {
      setBox(null);
    }
  });

  // The box does not exist until the node is in the DOM, so storing it is a
  // genuine render-measure-render: react-hooks/set-state-in-effect is
  // suppressed rather than obeyed. The extra render it schedules is bounded --
  // the effect re-runs when the shape changes, not on every frame of a drag.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- see above
    measure();
    // The dependency list spreads `deps`, a parameter, so its contents are not
    // statically known and exhaustive-deps cannot verify them. Callers pass the
    // values the measurement depends on; see the two call sites below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, ...deps]);

  return [ref, box] as const;
}

// Answer for a font size other than the one a text box was measured at, without
// measuring again. Everything about the glyphs scales with the font size, so
// the box does too -- except the letter spacing, which is a fixed number of
// units per gap whatever the size. Take it out, scale, put it back: measured at
// 48 and asked for everything from 12 to 180, that stays within four units of
// the real box -- inside the SELECTION_PAD the outline adds anyway. A plain
// proportional scale does not: from 48 up to 180 it is 141 units too wide, and
// from 48 down to 12 it is 39 units too *narrow*, which draws the outline
// inside the text it is meant to contain.
//
// `gaps` is how many letter-spacing gaps the widest line has, so one less than
// its character count.
export function scaleInk(ink: Measured, size: number, gaps: number): Box {
  const ratio = ink.at === 0 ? 1 : size / ink.at;
  const spacing = LETTER_SPACING * Math.max(0, gaps);
  return {
    x: ink.x * ratio,
    y: ink.y * ratio,
    width: Math.max(0, ink.width - spacing) * ratio + spacing,
    height: ink.height * ratio,
  };
}

// Grow a measured ink box into the outline that gets drawn around it.
export function selectionBox(ink: Box): Box {
  const width = Math.max(ink.width + SELECTION_PAD * 2, MIN_SELECTION_SIZE);
  const height = Math.max(ink.height + SELECTION_PAD * 2, MIN_SELECTION_SIZE);
  return {
    x: ink.x + ink.width / 2 - width / 2,
    y: ink.y + ink.height / 2 - height / 2,
    width,
    height,
  };
}

export const MicrographicSvg = forwardRef<SVGSVGElement, {
  items: CanvasItem[];
  editingTextId: string | null;
  editingTextValue: string;
  onBeginHistoryAction: () => void;
  onBeginTextEdit: (item: CanvasText) => void;
  onCancelTextEdit: () => void;
  onChangeEditingText: (value: string) => void;
  onCommitTextEdit: () => void;
  onAlignSelected: (axis: 'x' | 'y') => void;
  onDistributeSelected: (axis: 'x' | 'y') => void;
  onMoveItem: (id: string, x: number, y: number) => void;
  onRotateItems: (updates: Array<{ id: string; rotate: number }>) => void;
  onScaleItems: (updates: Array<{ id: string; size: number; x: number; y: number }>) => void;
  onSelectItems: (ids: string[]) => void;
  onSelectItem: (id: string | null, additive?: boolean) => void;
  palette: Palette;
  selectedIds: string[];
  settings: Settings;
}>(
  (
    {
      editingTextId,
      editingTextValue,
      items,
      onBeginHistoryAction,
      onBeginTextEdit,
      onCancelTextEdit,
      onChangeEditingText,
      onCommitTextEdit,
      onAlignSelected,
      onDistributeSelected,
      onMoveItem,
      onRotateItems,
      onScaleItems,
      onSelectItem,
      onSelectItems,
      palette,
      selectedIds,
      settings,
    },
    ref,
  ) => {
  const localRef = useRef<SVGSVGElement | null>(null);
  const dragRef = useRef<{ id: string; offsetX: number; offsetY: number; pointerId: number } | null>(null);
  const marqueeRef = useRef<{ additive: boolean; pointerId: number; startX: number; startY: number } | null>(null);
  const [marqueeRect, setMarqueeRect] = useState<{ height: number; width: number; x: number; y: number } | null>(null);
  const rotateRef = useRef<{
    pointerId: number;
    startAngle: number;
    rotations: Array<{ id: string; rotate: number }>;
    x: number;
    y: number;
  } | null>(null);
  const resizeRef = useRef<
    (ResizeGrip & { items: Array<{ id: string; size: number; x: number; y: number }>; pointerId: number }) | null
  >(null);

  const setRefs = (node: SVGSVGElement | null) => {
    localRef.current = node;
    if (typeof ref === 'function') {
      ref(node);
    } else if (ref) {
      ref.current = node;
    }
  };

  const getSvgPoint = (event: PointerEvent<SVGElement>) => {
    const svg = localRef.current;
    if (!svg) return { x: 0, y: 0 };
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const matrix = svg.getScreenCTM();
    if (!matrix) return { x: 0, y: 0 };
    return point.matrixTransform(matrix.inverse());
  };

  const selectForPointerAction = (event: PointerEvent<SVGElement>, item: CanvasItem) => {
    const additive = event.shiftKey || event.metaKey || event.ctrlKey;
    if (!additive && selectedIds.length > 1 && selectedIds.includes(item.id)) return;
    onSelectItem(item.id, additive);
  };

  const startDrag = (event: PointerEvent<SVGGElement>, item: CanvasItem) => {
    event.stopPropagation();
    const point = getSvgPoint(event);
    onBeginHistoryAction();
    dragRef.current = {
      id: item.id,
      offsetX: item.x - point.x,
      offsetY: item.y - point.y,
      pointerId: event.pointerId,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    selectForPointerAction(event, item);
  };

  const selectedBounds = () => {
    const selectedItems = items.filter((item) => selectedIds.includes(item.id));
    if (selectedItems.length < 2) return null;

    const bounds = selectedItems.map(hitBounds);
    const left = Math.min(...bounds.map((item) => item.x));
    const top = Math.min(...bounds.map((item) => item.y));
    const right = Math.max(...bounds.map((item) => item.x + item.width));

    return {
      toolbarX: Math.min(1000, Math.max(16, (left + right) / 2 - 100)),
      toolbarY: Math.max(16, top - 58),
    };
  };

  const getMarqueeRect = (event: PointerEvent<SVGElement>) => {
    if (!marqueeRef.current) return null;
    const point = getSvgPoint(event);
    const x = Math.min(marqueeRef.current.startX, point.x);
    const y = Math.min(marqueeRef.current.startY, point.y);
    return {
      height: Math.abs(point.y - marqueeRef.current.startY),
      width: Math.abs(point.x - marqueeRef.current.startX),
      x,
      y,
    };
  };

  const startMarquee = (event: PointerEvent<SVGElement>) => {
    const point = getSvgPoint(event);
    marqueeRef.current = {
      additive: event.shiftKey || event.metaKey || event.ctrlKey,
      pointerId: event.pointerId,
      startX: point.x,
      startY: point.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setMarqueeRect({ height: 0, width: 0, x: point.x, y: point.y });
    if (!marqueeRef.current.additive) onSelectItems([]);
  };

  const moveDrag = (event: PointerEvent<SVGSVGElement>) => {
    if (marqueeRef.current) {
      const rect = getMarqueeRect(event);
      if (!rect) return;
      setMarqueeRect(rect);
      const ids = items.filter((item) => intersects(rect, hitBounds(item))).map((item) => item.id);
      onSelectItems(marqueeRef.current.additive ? Array.from(new Set([...selectedIds, ...ids])) : ids);
      return;
    }

    if (rotateRef.current) {
      const point = getSvgPoint(event);
      const angle = Math.atan2(point.y - rotateRef.current.y, point.x - rotateRef.current.x) * (180 / Math.PI);
      const delta = angle - rotateRef.current.startAngle;
      onRotateItems(rotateRef.current.rotations.map((item) => ({ id: item.id, rotate: item.rotate + delta })));
      return;
    }

    if (resizeRef.current) {
      const resize = resizeRef.current;
      const point = getSvgPoint(event);
      const ratio = resizeRatio(resize, point);

      onScaleItems(
        resize.items.map((item) => ({
          id: item.id,
          size: item.size * ratio,
          x: resize.anchorX + (item.x - resize.anchorX) * ratio,
          y: resize.anchorY + (item.y - resize.anchorY) * ratio,
        })),
      );
      return;
    }

    if (!dragRef.current) return;
    const point = getSvgPoint(event);
    onMoveItem(dragRef.current.id, point.x + dragRef.current.offsetX, point.y + dragRef.current.offsetY);
  };

  const stopDrag = (event: PointerEvent<SVGSVGElement>) => {
    if (marqueeRef.current?.pointerId === event.pointerId) {
      marqueeRef.current = null;
      setMarqueeRect(null);
    }
    if (rotateRef.current?.pointerId === event.pointerId) {
      rotateRef.current = null;
    }
    if (resizeRef.current?.pointerId === event.pointerId) {
      resizeRef.current = null;
    }
    if (dragRef.current?.pointerId === event.pointerId) {
      dragRef.current = null;
    }
  };

  const startRotate = (event: PointerEvent<SVGElement>, item: CanvasItem) => {
    event.stopPropagation();
    const point = getSvgPoint(event);
    const ids = selectedIds.includes(item.id) ? selectedIds : [item.id];
    onBeginHistoryAction();
    rotateRef.current = {
      pointerId: event.pointerId,
      startAngle: Math.atan2(point.y - item.y, point.x - item.x) * (180 / Math.PI),
      rotations: items.filter((entry) => ids.includes(entry.id)).map((entry) => ({ id: entry.id, rotate: entry.rotate })),
      x: item.x,
      y: item.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    selectForPointerAction(event, item);
  };

  const startItemResize = (event: PointerEvent<SVGElement>, item: CanvasItem) => {
    event.stopPropagation();
    const point = getSvgPoint(event);
    const ids = selectedIds.includes(item.id) ? selectedIds : [item.id];
    const selectedItems = items.filter((entry) => ids.includes(entry.id));
    const bounds = selectedItems.map(hitBounds);
    // The top-left corner of the selection stays put and the bottom-right one
    // follows the pointer -- the same anchoring every drawing tool uses.
    // Scaling about the centre instead made the box grow in both directions at
    // once, so it moved twice as fast as the pointer and the far corner ran
    // away from the cursor; on a small item that was most of its size for ten
    // pixels of travel, and the size clamp arrived almost immediately.
    const grip = resizeGrip(
      {
        left: Math.min(...bounds.map((entry) => entry.x)),
        top: Math.min(...bounds.map((entry) => entry.y)),
        right: Math.max(...bounds.map((entry) => entry.x + entry.width)),
        bottom: Math.max(...bounds.map((entry) => entry.y + entry.height)),
      },
      point,
    );

    onBeginHistoryAction();
    resizeRef.current = {
      ...grip,
      items: selectedItems.map((entry) => ({ id: entry.id, size: entry.size, x: entry.x, y: entry.y })),
      pointerId: event.pointerId,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    selectForPointerAction(event, item);
  };

    const selectionToolbar = selectedBounds();

    return (
      <svg
        ref={setRefs}
        className="artboard"
        viewBox="0 0 1200 800"
        role="img"
        onPointerMove={moveDrag}
        onPointerUp={stopDrag}
        onPointerCancel={stopDrag}
      >
        <title>Generated micrographic poster</title>
        <rect width="1200" height="800" fill="transparent" onPointerDown={startMarquee} />
        {settings.showBackground && (
          <>
            <rect width="1200" height="800" fill={palette.paper} onPointerDown={startMarquee} />
            {settings.backgroundImage && (
              <image
                href={settings.backgroundImage}
                x="0"
                y="0"
                width="1200"
                height="800"
                preserveAspectRatio="xMidYMid slice"
                onPointerDown={startMarquee}
              />
            )}
          </>
        )}
        {settings.grid && <Grid palette={palette} />}
        {items.map((item) =>
          item.kind === 'symbol' ? (
            <GraphicSymbol
              item={item}
              key={item.id}
              onPointerDown={(event) => startDrag(event, item)}
              onRotatePointerDown={(event) => startRotate(event, item)}
              onResizePointerDown={(event) => startItemResize(event, item)}
              palette={palette}
              selected={selectedIds.includes(item.id)}
            />
          ) : (
            <GraphicText
              editing={editingTextId === item.id}
              editingValue={editingTextValue}
              item={item}
              key={item.id}
              onCancelEdit={onCancelTextEdit}
              onChangeEdit={onChangeEditingText}
              onCommitEdit={onCommitTextEdit}
              onDoubleClick={(event) => {
                event.stopPropagation();
                onSelectItem(item.id);
                onBeginTextEdit(item);
              }}
              onPointerDown={(event) => startDrag(event, item)}
              onRotatePointerDown={(event) => startRotate(event, item)}
              onResizePointerDown={(event) => startItemResize(event, item)}
              palette={palette}
              selected={selectedIds.includes(item.id)}
            />
          ),
        )}
        {selectionToolbar && (
          <foreignObject
            x={selectionToolbar.toolbarX}
            y={selectionToolbar.toolbarY}
            width="200"
            height="44"
            onPointerDown={(event) => event.stopPropagation()}
          >
            <div className="canvas-selection-actions" aria-label="Selection alignment tools">
              <button className="icon-button" onClick={() => onAlignSelected('x')} title="Align vertical centers" type="button">
                <AlignCenterVertical size={17} aria-hidden="true" />
              </button>
              <button className="icon-button" onClick={() => onAlignSelected('y')} title="Align horizontal centers" type="button">
                <AlignCenterHorizontal size={17} aria-hidden="true" />
              </button>
              <button className="icon-button" onClick={() => onDistributeSelected('x')} title="Even space horizontally" type="button">
                <AlignHorizontalSpaceBetween size={17} aria-hidden="true" />
              </button>
              <button className="icon-button" onClick={() => onDistributeSelected('y')} title="Even space vertically" type="button">
                <AlignVerticalSpaceBetween size={17} aria-hidden="true" />
              </button>
            </div>
          </foreignObject>
        )}
        {marqueeRect && <rect className="marquee-rect" {...marqueeRect} />}
      </svg>
    );
  },
);

MicrographicSvg.displayName = 'MicrographicSvg';

function Grid({ palette }: { palette: Palette }) {
  const width = 1200;
  const height = 800;
  const spacing = 40;
  const xLines = Array.from({ length: Math.floor(width / spacing) + 1 }, (_, index) => index * spacing);
  const yLines = Array.from({ length: Math.floor(height / spacing) + 1 }, (_, index) => index * spacing);
  if (xLines[xLines.length - 1] !== width) xLines.push(width);
  if (yLines[yLines.length - 1] !== height) yLines.push(height);

  return (
    <g opacity="0.26">
      {xLines.map((x, index) => (
        <line key={`v-${index}`} x1={x} x2={x} y1="0" y2={height} stroke={palette.muted} strokeWidth="0.7" />
      ))}
      {yLines.map((y, index) => (
        <line key={`h-${index}`} x1="0" x2={width} y1={y} y2={y} stroke={palette.muted} strokeWidth="0.7" />
      ))}
    </g>
  );
}

function GraphicSymbol({
  item,
  onPointerDown,
  onRotatePointerDown,
  onResizePointerDown,
  palette,
  selected,
}: {
  item: CanvasSymbol;
  onPointerDown: (event: PointerEvent<SVGGElement>) => void;
  onRotatePointerDown: (event: PointerEvent<SVGElement>) => void;
  onResizePointerDown: (event: PointerEvent<SVGElement>) => void;
  palette: Palette;
  selected: boolean;
}) {
  const color = palette.ink;
  const half = item.size / 2;
  const scale = item.size / 36;
  const [glyphRef, glyphBox] = useInkBox<SVGGElement>(selected, [item.mark]);

  // glyphBox is measured inside the glyph group, so it is in the mark's own
  // 36-unit space and excludes the group's own transform. That makes it the
  // same numbers at every size, which is why `item.size` is not a dependency
  // above: mapping it through that same transform — scale(size/36)
  // translate(-18 -18) — reaches item space at whatever size the item is now.
  const ink: Box = glyphBox
    ? {
        x: (glyphBox.x - 18) * scale,
        y: (glyphBox.y - 18) * scale,
        width: glyphBox.width * scale,
        height: glyphBox.height * scale,
      }
    : { x: -half, y: -half, width: item.size, height: item.size };
  const outline = selectionBox(ink);

  return (
    <g className="canvas-item" transform={`translate(${item.x} ${item.y}) rotate(${item.rotate})`} onPointerDown={onPointerDown}>
      <rect
        x={-half - 8}
        y={-half - 8}
        width={item.size + 16}
        height={item.size + 16}
        fill="transparent"
        pointerEvents="all"
      />
      {selected && (
        <rect
          x={outline.x}
          y={outline.y}
          width={outline.width}
          height={outline.height}
          fill="none"
          stroke={palette.accent}
          strokeDasharray="5 6"
          strokeWidth="2"
        />
      )}
      <g ref={glyphRef} transform={`scale(${scale}) translate(-18 -18)`}>
        <MicroMark color={color} mark={item.mark} x={18} y={18} />
      </g>
      {selected && (
        <>
          <RotateHandle
            color={palette.accent}
            x={outline.x + outline.width}
            y={outline.y}
            onPointerDown={onRotatePointerDown}
          />
          <circle
            className="resize-handle"
            cx={outline.x + outline.width}
            cy={outline.y + outline.height}
            r="6"
            fill={palette.background}
            stroke={palette.accent}
            strokeWidth="2"
            onPointerDown={onResizePointerDown}
          />
        </>
      )}
    </g>
  );
}

function GraphicText({
  editing,
  editingValue,
  item,
  onCancelEdit,
  onChangeEdit,
  onCommitEdit,
  onDoubleClick,
  onPointerDown,
  onRotatePointerDown,
  onResizePointerDown,
  palette,
  selected,
}: {
  editing: boolean;
  editingValue: string;
  item: CanvasText;
  onCancelEdit: () => void;
  onChangeEdit: (value: string) => void;
  onCommitEdit: () => void;
  onDoubleClick: (event: MouseEvent<SVGGElement>) => void;
  onPointerDown: (event: PointerEvent<SVGGElement>) => void;
  onRotatePointerDown: (event: PointerEvent<SVGElement>) => void;
  onResizePointerDown: (event: PointerEvent<SVGElement>) => void;
  palette: Palette;
  selected: boolean;
}) {
  const color = palette.ink;

  // Editing shows the draft, not the committed text, so the item on the canvas
  // is what the user is typing. The <text> below renders this in both states —
  // an item mid-edit and the same item deselected draw from the same element
  // with the same metrics, so they cannot look different.
  const displayText = editing ? editingValue : item.text;
  const lines = displayText.split('\n');
  const widestLine = Math.max(...lines.map((line) => line.length));
  const estimatedWidth = widestLine * item.size * 0.62;
  const estimatedHeight = lines.length * item.size * 1.08;
  const [textRef, textBox] = useInkBox<SVGTextElement>(selected || editing, [displayText], item.size);

  // <text> sits at the item group's origin with no transform of its own, so a
  // measured box is already in item space. Measuring while editing too is what
  // lets the outline grow as lines are added; the estimate is the fallback for
  // where measuring is unavailable, such as jsdom.
  //
  // The measurement is taken at whatever size the item was when it was selected
  // and scaled from there, so dragging the resize handle re-measures nothing
  // and the outline is never a frame behind the letters. Reselecting the item
  // takes a fresh measurement at the size it ended up.
  const ink: Box = textBox
    ? scaleInk(textBox, item.size, widestLine - 1)
    : { x: 0, y: -item.size, width: estimatedWidth, height: estimatedHeight };
  const outline = selectionBox(ink);

  return (
    <g className="canvas-item" transform={`translate(${item.x} ${item.y}) rotate(${item.rotate})`} onDoubleClick={onDoubleClick} onPointerDown={onPointerDown}>
      <rect
        x={outline.x}
        y={outline.y}
        width={outline.width}
        height={outline.height}
        fill="transparent"
        pointerEvents="all"
      />
      {selected && (
        <>
          <rect
            x={outline.x}
            y={outline.y}
            width={outline.width}
            height={outline.height}
            fill="none"
            stroke={palette.accent}
            strokeDasharray="5 6"
            strokeWidth="2"
          />
          <RotateHandle
            color={palette.accent}
            x={outline.x + outline.width}
            y={outline.y}
            onPointerDown={onRotatePointerDown}
          />
          <circle
            className="resize-handle"
            cx={outline.x + outline.width}
            cy={outline.y + outline.height}
            r="6"
            fill={palette.background}
            stroke={palette.accent}
            strokeWidth="2"
            onPointerDown={onResizePointerDown}
          />
        </>
      )}
      {editing && (
        // An input layer, not a second rendering of the text. The <text> below
        // stays visible and draws the draft, so what is on the canvas while
        // editing is the same element, in the same font at the same size, that
        // draws once the edit is committed. The textarea only carries the
        // caret, the selection and the keystrokes: its own glyphs are
        // transparent, and it does not wrap, because <text> does not either —
        // a wrapping textarea was why a long line filled the width while being
        // edited and then rendered as one long line afterwards.
        <foreignObject
          x={outline.x}
          y={outline.y}
          width={outline.width}
          height={outline.height}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <textarea
            autoFocus
            className="canvas-text-editor"
            wrap="off"
            style={{
              caretColor: color,
              fontFamily: 'IBM Plex Mono, ui-monospace, monospace',
              fontSize: item.size,
              fontWeight: 800,
              letterSpacing: LETTER_SPACING,
              lineHeight: 1.08,
              paddingTop: SELECTION_PAD,
              paddingLeft: SELECTION_PAD,
            }}
            value={editingValue}
            onBlur={onCommitEdit}
            onChange={(event) => onChangeEdit(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault();
                onCancelEdit();
              } else if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                onCommitEdit();
              }
            }}
          />
        </foreignObject>
      )}
      <text
        ref={textRef}
        fill={color}
        // While editing this paints over the textarea, and SVG's default
        // visiblePainted hit-testing would let the glyph ink swallow a click
        // meant for the caret: the event would reach the group's drag handler
        // and blur the editor, so clicking a character to move the caret
        // committed the edit and started dragging the item instead.
        pointerEvents={editing ? 'none' : undefined}
        fontFamily="IBM Plex Mono, ui-monospace, monospace"
        fontSize={item.size}
        fontWeight="800"
        letterSpacing={LETTER_SPACING}
        xmlSpace="preserve"
      >
        {lines.map((line, index) => (
          <tspan key={`${item.id}-${index}`} x="0" dy={index === 0 ? 0 : item.size * 1.08}>
            {line}
          </tspan>
        ))}
      </text>
    </g>
  );
}

function RotateHandle({
  color,
  onPointerDown,
  x,
  y,
}: {
  color: string;
  onPointerDown: (event: PointerEvent<SVGElement>) => void;
  x: number;
  y: number;
}) {
  return (
    <g className="rotate-handle" transform={`translate(${x} ${y})`} onPointerDown={onPointerDown}>
      <circle r="10" fill="transparent" />
      <path d="M 2 -4 A 5 5 0 1 0 4 2" fill="none" stroke={color} strokeLinecap="round" strokeWidth="1.7" />
      <path d="M 3 -7 L 3 -2 L 7 -4.5 Z" fill={color} />
    </g>
  );
}
