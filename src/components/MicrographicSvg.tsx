import { forwardRef, useRef, useState } from 'react';
import { AlignCenterHorizontal, AlignCenterVertical, AlignHorizontalSpaceBetween, AlignVerticalSpaceBetween } from 'lucide-react';
import type { MouseEvent, PointerEvent } from 'react';
import type { CanvasItem, CanvasSymbol, CanvasText, Palette, Settings } from '../types';
import { MicroMark } from './MicroMark';

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
  const resizeRef = useRef<{
    centerX: number;
    centerY: number;
    items: Array<{ id: string; size: number; x: number; y: number }>;
    pointerId: number;
    startDistance: number;
  } | null>(null);

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

  const itemBounds = (item: CanvasItem) => {
    if (item.kind === 'symbol') {
      const half = item.size / 2;
      return { x: item.x - half - 8, y: item.y - half - 8, width: item.size + 16, height: item.size + 16 };
    }

    const lines = item.text.split('\n');
    const width = Math.max(90, Math.max(...lines.map((line) => line.length)) * item.size * 0.62) + 16;
    return { x: item.x - 8, y: item.y - item.size - 10, width, height: lines.length * item.size * 1.08 + 22 };
  };

  const selectedBounds = () => {
    const selectedItems = items.filter((item) => selectedIds.includes(item.id));
    if (selectedItems.length < 2) return null;

    const bounds = selectedItems.map(itemBounds);
    const left = Math.min(...bounds.map((item) => item.x));
    const top = Math.min(...bounds.map((item) => item.y));
    const right = Math.max(...bounds.map((item) => item.x + item.width));

    return {
      toolbarX: Math.min(1000, Math.max(16, (left + right) / 2 - 100)),
      toolbarY: Math.max(16, top - 58),
    };
  };

  const intersects = (
    first: { x: number; y: number; width: number; height: number },
    second: { x: number; y: number; width: number; height: number },
  ) =>
    first.x < second.x + second.width &&
    first.x + first.width > second.x &&
    first.y < second.y + second.height &&
    first.y + first.height > second.y;

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
      const ids = items.filter((item) => intersects(rect, itemBounds(item))).map((item) => item.id);
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
      const point = getSvgPoint(event);
      const distance = Math.hypot(point.x - resizeRef.current.centerX, point.y - resizeRef.current.centerY);
      const ratio = resizeRef.current.startDistance === 0 ? 1 : distance / resizeRef.current.startDistance;
      onScaleItems(
        resizeRef.current.items.map((item) => ({
          id: item.id,
          size: item.size * ratio,
          x: resizeRef.current ? resizeRef.current.centerX + (item.x - resizeRef.current.centerX) * ratio : item.x,
          y: resizeRef.current ? resizeRef.current.centerY + (item.y - resizeRef.current.centerY) * ratio : item.y,
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
    const bounds = selectedItems.map(itemBounds);
    const left = Math.min(...bounds.map((entry) => entry.x));
    const top = Math.min(...bounds.map((entry) => entry.y));
    const right = Math.max(...bounds.map((entry) => entry.x + entry.width));
    const bottom = Math.max(...bounds.map((entry) => entry.y + entry.height));
    const centerX = (left + right) / 2;
    const centerY = (top + bottom) / 2;
    onBeginHistoryAction();
    resizeRef.current = {
      centerX,
      centerY,
      items: selectedItems.map((entry) => ({ id: entry.id, size: entry.size, x: entry.x, y: entry.y })),
      pointerId: event.pointerId,
      startDistance: Math.max(1, Math.hypot(point.x - centerX, point.y - centerY)),
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
  const spacing = 44;

  return (
    <g opacity="0.26">
      {Array.from({ length: Math.floor(width / spacing) + 1 }, (_, index) => (
        <line key={`v-${index}`} x1={index * spacing} x2={index * spacing} y1="0" y2={height} stroke={palette.muted} strokeWidth="0.7" />
      ))}
      {Array.from({ length: Math.floor(height / spacing) + 1 }, (_, index) => (
        <line key={`h-${index}`} x1="0" x2={width} y1={index * spacing} y2={index * spacing} stroke={palette.muted} strokeWidth="0.7" />
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

  return (
    <g className="canvas-item" transform={`translate(${item.x} ${item.y}) rotate(${item.rotate})`} onPointerDown={onPointerDown}>
      {selected && (
        <rect
          x={-half - 8}
          y={-half - 8}
          width={item.size + 16}
          height={item.size + 16}
          fill="none"
          stroke={palette.accent}
          strokeDasharray="5 6"
          strokeWidth="2"
        />
      )}
      <g transform={`scale(${item.size / 36}) translate(-18 -18)`}>
        <MicroMark color={color} mark={item.mark} x={18} y={18} />
      </g>
      {selected && (
        <>
          <RotateHandle color={palette.accent} x={half + 8} y={-half - 8} onPointerDown={onRotatePointerDown} />
          <circle
            className="resize-handle"
            cx={half + 8}
            cy={half + 8}
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
  const lines = item.text.split('\n');
  const width = Math.max(90, Math.max(...lines.map((line) => line.length)) * item.size * 0.62);
  const height = lines.length * item.size * 1.08 + 22;
  const editorWidth = Math.max(width + 16, 180);
  const editorHeight = Math.max(height, 76);

  return (
    <g className="canvas-item" transform={`translate(${item.x} ${item.y}) rotate(${item.rotate})`} onDoubleClick={onDoubleClick} onPointerDown={onPointerDown}>
      {selected && (
        <>
          <rect
            x="-8"
            y={-item.size - 10}
            width={width + 16}
            height={height}
            fill="none"
            stroke={palette.accent}
            strokeDasharray="5 6"
            strokeWidth="2"
          />
          <RotateHandle color={palette.accent} x={width + 8} y={-item.size - 10} onPointerDown={onRotatePointerDown} />
          <circle
            className="resize-handle"
            cx={width + 8}
            cy={-item.size - 10 + height}
            r="6"
            fill={palette.background}
            stroke={palette.accent}
            strokeWidth="2"
            onPointerDown={onResizePointerDown}
          />
        </>
      )}
      {editing ? (
        <foreignObject
          x="-8"
          y={-item.size - 10}
          width={editorWidth}
          height={editorHeight}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <textarea
            autoFocus
            className="canvas-text-editor"
            style={{
              color,
              fontFamily: 'IBM Plex Mono, ui-monospace, monospace',
              fontSize: item.size,
              fontWeight: 800,
              letterSpacing: 2,
              lineHeight: 1.08,
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
      ) : (
        <text
          fill={color}
          fontFamily="IBM Plex Mono, ui-monospace, monospace"
          fontSize={item.size}
          fontWeight="800"
          letterSpacing="2"
        >
          {lines.map((line, index) => (
            <tspan key={`${item.id}-${index}`} x="0" dy={index === 0 ? 0 : item.size * 1.08}>
              {line}
            </tspan>
          ))}
        </text>
      )}
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
