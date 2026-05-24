import { forwardRef, useRef } from 'react';
import type { PointerEvent } from 'react';
import type { CanvasItem, CanvasModule, CanvasSymbol, CanvasText, Palette, Settings } from '../types';
import { MicroMark } from './MicroMark';

export const MicrographicSvg = forwardRef<SVGSVGElement, {
  items: CanvasItem[];
  onMoveItem: (id: string, x: number, y: number) => void;
  onSelectItem: (id: string | null) => void;
  palette: Palette;
  selectedId: string | null;
  settings: Settings;
}>(({ items, onMoveItem, onSelectItem, palette, selectedId, settings }, ref) => {
  const localRef = useRef<SVGSVGElement | null>(null);
  const dragRef = useRef<{ id: string; offsetX: number; offsetY: number; pointerId: number } | null>(null);

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

  const startDrag = (event: PointerEvent<SVGGElement>, item: CanvasItem) => {
    event.stopPropagation();
    const point = getSvgPoint(event);
    dragRef.current = {
      id: item.id,
      offsetX: item.x - point.x,
      offsetY: item.y - point.y,
      pointerId: event.pointerId,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    onSelectItem(item.id);
  };

  const moveDrag = (event: PointerEvent<SVGSVGElement>) => {
    if (!dragRef.current) return;
    const point = getSvgPoint(event);
    onMoveItem(dragRef.current.id, point.x + dragRef.current.offsetX, point.y + dragRef.current.offsetY);
  };

  const stopDrag = (event: PointerEvent<SVGSVGElement>) => {
    if (dragRef.current?.pointerId === event.pointerId) {
      dragRef.current = null;
    }
  };

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
      <defs>
        <clipPath id="artboardPaper">
          <rect x="52" y="48" width="1096" height="704" rx="0" />
        </clipPath>
        <filter id="paperNoise">
          <feTurbulence baseFrequency="0.7" numOctaves="2" seed={settings.seed} type="fractalNoise" />
          <feColorMatrix type="saturate" values="0" />
          <feComponentTransfer>
            <feFuncA slope="0.08" type="linear" />
          </feComponentTransfer>
        </filter>
      </defs>
      <rect width="1200" height="800" fill="transparent" onPointerDown={() => onSelectItem(null)} />
      {settings.showBackground && (
        <>
          <rect width="1200" height="800" fill={palette.background} onPointerDown={() => onSelectItem(null)} />
          <rect x="52" y="48" width="1096" height="704" rx="0" fill={palette.paper} onPointerDown={() => onSelectItem(null)} />
          {settings.backgroundImage && (
            <image
              href={settings.backgroundImage}
              x="52"
              y="48"
              width="1096"
              height="704"
              preserveAspectRatio="xMidYMid slice"
              clipPath="url(#artboardPaper)"
              onPointerDown={() => onSelectItem(null)}
            />
          )}
          {settings.noise && <rect x="52" y="48" width="1096" height="704" filter="url(#paperNoise)" opacity="0.45" />}
        </>
      )}
      {settings.grid && <Grid palette={palette} />}
      {items.map((item) =>
        item.kind === 'module' ? (
          <GraphicModule
            item={item}
            key={item.id}
            onPointerDown={(event) => startDrag(event, item)}
            palette={palette}
            selected={selectedId === item.id}
            settings={settings}
          />
        ) : item.kind === 'symbol' ? (
          <GraphicSymbol
            item={item}
            key={item.id}
            onPointerDown={(event) => startDrag(event, item)}
            palette={palette}
            selected={selectedId === item.id}
          />
        ) : (
          <GraphicText
            item={item}
            key={item.id}
            onPointerDown={(event) => startDrag(event, item)}
            palette={palette}
            selected={selectedId === item.id}
          />
        ),
      )}
    </svg>
  );
});

MicrographicSvg.displayName = 'MicrographicSvg';

function Grid({ palette }: { palette: Palette }) {
  return (
    <g opacity="0.26">
      {Array.from({ length: 24 }, (_, index) => (
        <line key={`v-${index}`} x1={72 + index * 44} x2={72 + index * 44} y1="68" y2="732" stroke={palette.muted} strokeWidth="0.7" />
      ))}
      {Array.from({ length: 15 }, (_, index) => (
        <line key={`h-${index}`} x1="72" x2="1128" y1={80 + index * 44} y2={80 + index * 44} stroke={palette.muted} strokeWidth="0.7" />
      ))}
    </g>
  );
}

function GraphicModule({
  item,
  onPointerDown,
  palette,
  selected,
  settings,
}: {
  item: CanvasModule;
  onPointerDown: (event: PointerEvent<SVGGElement>) => void;
  palette: Palette;
  selected: boolean;
  settings: Settings;
}) {
  const color = palette.ink;

  return (
    <g
      className="canvas-item"
      transform={`translate(${item.x} ${item.y}) rotate(${item.rotate})`}
      onPointerDown={onPointerDown}
    >
      {selected && (
        <rect
          x="-10"
          y="-10"
          width={item.w + 46}
          height={item.h + 46}
          fill="none"
          stroke={palette.accent}
          strokeDasharray="5 6"
          strokeWidth="2"
        />
      )}
      <rect width={item.w} height={item.h} fill="none" stroke={color} strokeWidth={item.tone > 0.8 ? 2 : 1} />
      <line x1="0" x2={item.w * 1.25} y1={item.h + 8} y2={item.h + 8} stroke={palette.ink} strokeWidth="1" />
      {Array.from({ length: 3 }, (_, index) => (
        <line
          key={index}
          x1={6 + index * 13}
          x2={6 + index * 13}
          y1="3"
          y2={item.h - 3}
          stroke={color}
          strokeWidth="0.8"
          opacity="0.7"
        />
      ))}
      <MicroMark mark={item.mark} color={color} x={item.w + 13} y={item.h * 0.45} />
      {settings.labels && (
        <text x="0" y={item.h + 24} fill={palette.ink} fontFamily="IBM Plex Mono, ui-monospace, monospace" fontSize="10" letterSpacing="1.2">
          {item.glyph}
        </text>
      )}
    </g>
  );
}

function GraphicSymbol({
  item,
  onPointerDown,
  palette,
  selected,
}: {
  item: CanvasSymbol;
  onPointerDown: (event: PointerEvent<SVGGElement>) => void;
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
    </g>
  );
}

function GraphicText({
  item,
  onPointerDown,
  palette,
  selected,
}: {
  item: CanvasText;
  onPointerDown: (event: PointerEvent<SVGGElement>) => void;
  palette: Palette;
  selected: boolean;
}) {
  const color = palette.ink;
  const lines = item.text.split('\n');
  const width = Math.max(90, Math.max(...lines.map((line) => line.length)) * item.size * 0.62);

  return (
    <g className="canvas-item" transform={`translate(${item.x} ${item.y}) rotate(${item.rotate})`} onPointerDown={onPointerDown}>
      {selected && (
        <rect
          x="-8"
          y={-item.size - 10}
          width={width + 16}
          height={item.size + 22}
          fill="none"
          stroke={palette.accent}
          strokeDasharray="5 6"
          strokeWidth="2"
        />
      )}
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
    </g>
  );
}
