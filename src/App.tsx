'use client';

import { forwardRef, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Slider } from '@base-ui/react/slider';
import { Switch } from '@base-ui/react/switch';
import { Tabs } from '@base-ui/react/tabs';
import { Toolbar } from '@base-ui/react/toolbar';
import { Tooltip } from '@base-ui/react/tooltip';
import {
  Download,
  FileCode2,
  Grid2X2,
  RefreshCcw,
  Shuffle,
  Sparkles,
  Zap,
} from 'lucide-react';

type Template = 'radial' | 'manifest' | 'dashboard' | 'specimen';
type Palette = {
  name: string;
  background: string;
  ink: string;
  muted: string;
  accent: string;
  second: string;
  paper: string;
};

type Settings = {
  template: Template;
  paletteIndex: number;
  seed: number;
  density: number;
  scale: number;
  detail: number;
  labels: boolean;
  grid: boolean;
  noise: boolean;
};

const palettes: Palette[] = [
  {
    name: 'Carbon signal',
    background: '#f5f4ef',
    paper: '#ffffff',
    ink: '#151515',
    muted: '#7f8179',
    accent: '#e94f37',
    second: '#107c6a',
  },
  {
    name: 'Civic print',
    background: '#f2efe5',
    paper: '#fbfaf4',
    ink: '#23201b',
    muted: '#8d8274',
    accent: '#235789',
    second: '#c44900',
  },
  {
    name: 'Transit lab',
    background: '#eef3f1',
    paper: '#ffffff',
    ink: '#111827',
    muted: '#667085',
    accent: '#ef476f',
    second: '#0b8f8f',
  },
  {
    name: 'Archive red',
    background: '#f8f1ed',
    paper: '#fffdfb',
    ink: '#211c1c',
    muted: '#917a70',
    accent: '#b81e2d',
    second: '#345995',
  },
];

const templates: Array<{ id: Template; name: string }> = [
  { id: 'radial', name: 'Radial cluster' },
  { id: 'manifest', name: 'Manifest strips' },
  { id: 'dashboard', name: 'Instrument panel' },
  { id: 'specimen', name: 'Specimen sheet' },
];

const glyphs = ['A', '07', 'N', 'R2', 'IX', '42', 'M', 'K3', 'T', '18'];
const marks = ['cross', 'circle', 'square', 'tri', 'bar'];

function seeded(seed: number) {
  let value = seed % 2147483647;
  if (value <= 0) value += 2147483646;
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

function pick<T>(items: T[], random: () => number) {
  return items[Math.floor(random() * items.length)];
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function App() {
  const [settings, setSettings] = useState<Settings>({
    template: 'radial',
    paletteIndex: 0,
    seed: 628,
    density: 58,
    scale: 78,
    detail: 64,
    labels: true,
    grid: true,
    noise: true,
  });
  const svgRef = useRef<SVGSVGElement | null>(null);
  const palette = palettes[settings.paletteIndex];

  const elements = useMemo(() => {
    const random = seeded(settings.seed);
    const count = Math.round(18 + settings.density * 0.75);
    return Array.from({ length: count }, (_, index) => ({
      id: index,
      x: 80 + random() * 920,
      y: 75 + random() * 560,
      w: 18 + random() * 86 * (settings.scale / 100),
      h: 8 + random() * 54 * (settings.scale / 100),
      rotate: random() * 32 - 16,
      mark: pick(marks, random),
      glyph: pick(glyphs, random),
      tone: random(),
    }));
  }, [settings.density, settings.scale, settings.seed]);

  const update = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings((current) => ({ ...current, [key]: value }));
  };

  const randomize = () => {
    setSettings((current) => ({
      ...current,
      seed: Math.floor(Math.random() * 9000) + 1000,
      template: templates[Math.floor(Math.random() * templates.length)].id,
      paletteIndex: Math.floor(Math.random() * palettes.length),
    }));
  };

  const exportSvg = () => {
    if (!svgRef.current) return;
    const markup = new XMLSerializer().serializeToString(svgRef.current);
    downloadBlob(new Blob([markup], { type: 'image/svg+xml;charset=utf-8' }), 'micrographic.svg');
  };

  const exportPng = async () => {
    if (!svgRef.current) return;
    const markup = new XMLSerializer().serializeToString(svgRef.current);
    const blob = new Blob([markup], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.decoding = 'async';
    image.src = url;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = 2400;
    canvas.height = 1600;
    const context = canvas.getContext('2d');
    context?.drawImage(image, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);
    canvas.toBlob((png) => {
      if (png) downloadBlob(png, 'micrographic.png');
    }, 'image/png');
  };

  return (
    <Tooltip.Provider>
      <main className="app-shell">
        <aside className="control-panel">
          <div className="brand-row">
            <div className="brand-mark">
              <Sparkles size={18} aria-hidden="true" />
            </div>
            <div>
              <h1>Micrographics Creator</h1>
              <p>Dense graphic systems for posters, decks, and UI texture.</p>
            </div>
          </div>

          <Toolbar.Root className="toolbar" aria-label="Graphic actions">
            <ToolButton label="Randomize" onClick={randomize}>
              <Shuffle size={17} aria-hidden="true" />
            </ToolButton>
            <ToolButton label="Reset seed" onClick={() => update('seed', 628)}>
              <RefreshCcw size={17} aria-hidden="true" />
            </ToolButton>
            <Toolbar.Separator className="toolbar-separator" />
            <ToolButton label="Export SVG" onClick={exportSvg}>
              <FileCode2 size={17} aria-hidden="true" />
            </ToolButton>
            <ToolButton label="Export PNG" onClick={exportPng}>
              <Download size={17} aria-hidden="true" />
            </ToolButton>
          </Toolbar.Root>

          <Tabs.Root defaultValue="layout" className="tabs">
            <Tabs.List className="tab-list">
              <Tabs.Tab className="tab" value="layout">
                Layout
              </Tabs.Tab>
              <Tabs.Tab className="tab" value="style">
                Style
              </Tabs.Tab>
              <Tabs.Tab className="tab" value="output">
                Output
              </Tabs.Tab>
              <Tabs.Indicator className="tab-indicator" />
            </Tabs.List>

            <Tabs.Panel value="layout" className="tab-panel">
              <Field label="Template">
                <div className="template-grid">
                  {templates.map((template) => (
                    <button
                      className="template-button"
                      data-active={settings.template === template.id}
                      key={template.id}
                      onClick={() => update('template', template.id)}
                      type="button"
                    >
                      <Grid2X2 size={16} aria-hidden="true" />
                      {template.name}
                    </button>
                  ))}
                </div>
              </Field>
              <ControlSlider
                label="Density"
                max={100}
                min={12}
                value={settings.density}
                onChange={(value) => update('density', value)}
              />
              <ControlSlider
                label="Scale"
                max={120}
                min={36}
                value={settings.scale}
                onChange={(value) => update('scale', value)}
              />
              <ControlSlider
                label="Detail"
                max={100}
                min={20}
                value={settings.detail}
                onChange={(value) => update('detail', value)}
              />
            </Tabs.Panel>

            <Tabs.Panel value="style" className="tab-panel">
              <Field label="Palette">
                <div className="palette-list">
                  {palettes.map((item, index) => (
                    <button
                      className="palette-button"
                      data-active={index === settings.paletteIndex}
                      key={item.name}
                      onClick={() => update('paletteIndex', index)}
                      type="button"
                    >
                      <span className="swatches" aria-hidden="true">
                        <span style={{ background: item.ink }} />
                        <span style={{ background: item.accent }} />
                        <span style={{ background: item.second }} />
                      </span>
                      {item.name}
                    </button>
                  ))}
                </div>
              </Field>
              <ToggleRow label="Show labels" checked={settings.labels} onChange={(value) => update('labels', value)} />
              <ToggleRow label="Baseline grid" checked={settings.grid} onChange={(value) => update('grid', value)} />
              <ToggleRow label="Paper noise" checked={settings.noise} onChange={(value) => update('noise', value)} />
            </Tabs.Panel>

            <Tabs.Panel value="output" className="tab-panel">
              <Field label="Seed">
                <input
                  className="text-input"
                  type="number"
                  value={settings.seed}
                  onChange={(event) => update('seed', clamp(Number(event.target.value), 1, 99999))}
                />
              </Field>
              <div className="metric-grid">
                <div>
                  <span>{elements.length}</span>
                  modules
                </div>
                <div>
                  <span>3:2</span>
                  artboard
                </div>
                <div>
                  <span>SVG</span>
                  source
                </div>
              </div>
            </Tabs.Panel>
          </Tabs.Root>
        </aside>

        <section className="preview-stage" aria-label="Micrographic preview">
          <div className="stage-header">
            <div>
              <span className="eyebrow">Template / {templates.find((item) => item.id === settings.template)?.name}</span>
              <h2>{palette.name}</h2>
            </div>
            <div className="stage-chip">
              <Zap size={14} aria-hidden="true" />
              seed {settings.seed}
            </div>
          </div>
          <div className="artboard-wrap">
            <MicrographicSvg ref={svgRef} elements={elements} palette={palette} settings={settings} />
          </div>
        </section>
      </main>
    </Tooltip.Provider>
  );
}

function Field({ children, label }: { children: ReactNode; label: string }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function ControlSlider({
  label,
  max,
  min,
  onChange,
  value,
}: {
  label: string;
  max: number;
  min: number;
  onChange: (value: number) => void;
  value: number;
}) {
  return (
    <div className="slider-block">
      <div className="slider-top">
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      <Slider.Root
        className="slider-root"
        max={max}
        min={min}
        step={1}
        value={value}
        onValueChange={(next) => onChange(Array.isArray(next) ? next[0] : next)}
      >
        <Slider.Control className="slider-control">
          <Slider.Track className="slider-track">
            <Slider.Indicator className="slider-indicator" />
            <Slider.Thumb aria-label={label} className="slider-thumb" />
          </Slider.Track>
        </Slider.Control>
      </Slider.Root>
    </div>
  );
}

function ToggleRow({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="toggle-row">
      <span>{label}</span>
      <Switch.Root checked={checked} className="switch" onCheckedChange={onChange}>
        <Switch.Thumb className="switch-thumb" />
      </Switch.Root>
    </label>
  );
}

function ToolButton({
  children,
  label,
  onClick,
}: {
  children: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger render={<Toolbar.Button />} className="icon-button" aria-label={label} onClick={onClick}>
        {children}
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Positioner sideOffset={8}>
          <Tooltip.Popup className="tooltip">
            <Tooltip.Arrow className="tooltip-arrow" />
            {label}
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

const MicrographicSvg = forwardRef<SVGSVGElement, {
  elements: Array<{
    glyph: string;
    h: number;
    id: number;
    mark: string;
    rotate: number;
    tone: number;
    w: number;
    x: number;
    y: number;
  }>;
  palette: Palette;
  settings: Settings;
}>(({ elements, palette, settings }, ref) => {
  return (
    <svg ref={ref} className="artboard" viewBox="0 0 1200 800" role="img">
      <title>Generated micrographic poster</title>
      <defs>
        <filter id="paperNoise">
          <feTurbulence baseFrequency="0.7" numOctaves="2" seed={settings.seed} type="fractalNoise" />
          <feColorMatrix type="saturate" values="0" />
          <feComponentTransfer>
            <feFuncA slope="0.08" type="linear" />
          </feComponentTransfer>
        </filter>
      </defs>
      <rect width="1200" height="800" fill={palette.background} />
      <rect x="52" y="48" width="1096" height="704" rx="0" fill={palette.paper} />
      {settings.noise && <rect x="52" y="48" width="1096" height="704" filter="url(#paperNoise)" opacity="0.45" />}
      {settings.grid && <Grid palette={palette} />}
      <TemplateFrame template={settings.template} palette={palette} />
      {elements.map((item) => (
        <GraphicModule item={item} key={item.id} palette={palette} settings={settings} />
      ))}
      <FooterMarks palette={palette} settings={settings} />
    </svg>
  );
});

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

function TemplateFrame({ palette, template }: { palette: Palette; template: Template }) {
  if (template === 'radial') {
    return (
      <g transform="translate(600 398)">
        {Array.from({ length: 28 }, (_, index) => (
          <line
            key={index}
            x1="0"
            x2={index % 3 === 0 ? 320 : 250}
            y1="0"
            y2="0"
            stroke={index % 5 === 0 ? palette.accent : palette.ink}
            strokeWidth={index % 3 === 0 ? 1.8 : 0.8}
            transform={`rotate(${index * 12.85})`}
            opacity="0.5"
          />
        ))}
        <circle r="112" fill="none" stroke={palette.second} strokeWidth="3" />
        <circle r="178" fill="none" stroke={palette.ink} strokeDasharray="4 8" opacity="0.5" />
      </g>
    );
  }

  if (template === 'manifest') {
    return (
      <g opacity="0.76">
        {Array.from({ length: 10 }, (_, index) => (
          <rect
            key={index}
            x={96 + index * 104}
            y={96 + (index % 3) * 36}
            width="54"
            height="558"
            fill="none"
            stroke={index % 2 ? palette.accent : palette.ink}
            strokeWidth="1.5"
          />
        ))}
      </g>
    );
  }

  if (template === 'dashboard') {
    return (
      <g>
        {Array.from({ length: 7 }, (_, index) => (
          <rect key={index} x={116 + index * 142} y="128" width="104" height="470" fill="none" stroke={palette.muted} strokeWidth="1.4" />
        ))}
        <path d="M116 620 H1084 M116 180 H1084" stroke={palette.ink} strokeWidth="2.2" />
      </g>
    );
  }

  return (
    <g>
      {Array.from({ length: 5 }, (_, row) =>
        Array.from({ length: 7 }, (_, col) => (
          <rect
            key={`${row}-${col}`}
            x={104 + col * 142}
            y={104 + row * 112}
            width="96"
            height="72"
            fill="none"
            stroke={col % 2 ? palette.second : palette.ink}
            strokeWidth="1"
            opacity="0.58"
          />
        )),
      )}
    </g>
  );
}

function GraphicModule({
  item,
  palette,
  settings,
}: {
  item: {
    glyph: string;
    h: number;
    id: number;
    mark: string;
    rotate: number;
    tone: number;
    w: number;
    x: number;
    y: number;
  };
  palette: Palette;
  settings: Settings;
}) {
  const color = item.tone > 0.76 ? palette.accent : item.tone > 0.5 ? palette.second : palette.ink;
  const opacity = 0.62 + item.tone * 0.3;

  return (
    <g transform={`translate(${item.x} ${item.y}) rotate(${item.rotate})`} opacity={opacity}>
      <rect width={item.w} height={item.h} fill="none" stroke={color} strokeWidth={item.tone > 0.8 ? 2 : 1} />
      <line x1="0" x2={item.w * 1.25} y1={item.h + 8} y2={item.h + 8} stroke={palette.ink} strokeWidth="1" />
      {Array.from({ length: Math.max(1, Math.round(settings.detail / 28)) }, (_, index) => (
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
          {item.glyph}-{String(item.id).padStart(2, '0')}
        </text>
      )}
    </g>
  );
}

function MicroMark({ color, mark, x, y }: { color: string; mark: string; x: number; y: number }) {
  if (mark === 'circle') return <circle cx={x} cy={y} r="7" fill="none" stroke={color} strokeWidth="2" />;
  if (mark === 'square') return <rect x={x - 6} y={y - 6} width="12" height="12" fill={color} />;
  if (mark === 'tri') return <path d={`M ${x} ${y - 8} L ${x + 8} ${y + 7} L ${x - 8} ${y + 7} Z`} fill="none" stroke={color} strokeWidth="2" />;
  if (mark === 'bar') return <rect x={x - 3} y={y - 12} width="6" height="24" fill={color} />;
  return (
    <g stroke={color} strokeWidth="2">
      <line x1={x - 8} x2={x + 8} y1={y} y2={y} />
      <line x1={x} x2={x} y1={y - 8} y2={y + 8} />
    </g>
  );
}

function FooterMarks({ palette, settings }: { palette: Palette; settings: Settings }) {
  return (
    <g fontFamily="IBM Plex Mono, ui-monospace, monospace" fill={palette.ink}>
      <text x="72" y="722" fontSize="13" letterSpacing="2">
        MICROGRAPHIC / SYSTEM {settings.seed}
      </text>
      <text x="890" y="722" fontSize="12" letterSpacing="1.4">
        D{settings.density} S{settings.scale} L{settings.detail}
      </text>
      <rect x="72" y="688" width="1056" height="1.5" fill={palette.ink} />
      <rect x="1040" y="704" width="88" height="14" fill={palette.accent} />
      <rect x="1004" y="704" width="28" height="14" fill={palette.second} />
    </g>
  );
}

export default App;
