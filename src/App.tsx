'use client';

import { useRef, useState } from 'react';
import { Tabs } from '@base-ui/react/tabs';
import { Toolbar } from '@base-ui/react/toolbar';
import { Tooltip } from '@base-ui/react/tooltip';
import {
  Download,
  Eraser,
  FileCode2,
  Grid2X2,
  Shuffle,
  Sparkles,
  Trash2,
  Type,
  Zap,
} from 'lucide-react';
import { Field, ToggleRow, ToolButton } from './components/Controls';
import { MicrographicSvg } from './components/MicrographicSvg';
import { MicroMark } from './components/MicroMark';
import { initialSettings, loadTemplateItems, marks, palettes, templates } from './data';
import type { CanvasItem, CanvasSymbol, CanvasText, Settings, Template } from './types';
import { clamp, downloadBlob } from './utils';

function App() {
  const [settings, setSettings] = useState<Settings>(initialSettings);
  const [canvasItems, setCanvasItems] = useState<CanvasItem[]>(() => loadTemplateItems(initialSettings.template));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [textDraft, setTextDraft] = useState('MICRO');
  const svgRef = useRef<SVGSVGElement | null>(null);
  const palette = palettes[settings.paletteIndex];

  const update = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings((current) => ({ ...current, [key]: value }));
  };

  const chooseTemplate = (template: Template) => {
    const nextSettings = { ...settings, template };
    setSettings(nextSettings);
    setCanvasItems(loadTemplateItems(template));
    setSelectedId(null);
  };

  const randomize = () => {
    const nextTemplate = templates[Math.floor(Math.random() * templates.length)].id;
    const nextSettings = {
      ...settings,
      seed: Math.floor(Math.random() * 9000) + 1000,
      template: nextTemplate,
      paletteIndex: Math.floor(Math.random() * palettes.length),
    };
    setSettings(nextSettings);
    setCanvasItems(loadTemplateItems(nextTemplate));
    setSelectedId(null);
  };

  const itemBounds = (item: CanvasItem) => {
    if (item.kind === 'symbol') {
      const pad = 10;
      return { x: item.x - item.size / 2 - pad, y: item.y - item.size / 2 - pad, width: item.size + pad * 2, height: item.size + pad * 2 };
    }
    if (item.kind === 'text') {
      const lines = item.text.split('\n');
      const width = Math.max(90, Math.max(...lines.map((line) => line.length)) * item.size * 0.62);
      return { x: item.x - 8, y: item.y - item.size - 10, width: width + 16, height: lines.length * item.size * 1.08 + 22 };
    }
    return { x: item.x - 10, y: item.y - 10, width: item.w + 46, height: item.h + 46 };
  };

  const findOpenPosition = (width: number, height: number) => {
    const existing = canvasItems.map(itemBounds);
    const overlaps = (candidate: { x: number; y: number; width: number; height: number }) =>
      existing.some((item) =>
        candidate.x < item.x + item.width &&
        candidate.x + candidate.width > item.x &&
        candidate.y < item.y + item.height &&
        candidate.y + candidate.height > item.y,
      );

    for (let y = 96; y <= 704 - height; y += 64) {
      for (let x = 96; x <= 1104 - width; x += 64) {
        const candidate = { x, y, width, height };
        if (!overlaps(candidate)) return candidate;
      }
    }

    return { x: 600 - width / 2, y: 400 - height / 2, width, height };
  };

  const addSymbol = (mark: string) => {
    const size = 42;
    const position = findOpenPosition(size + 20, size + 20);
    const item: CanvasSymbol = {
      id: `symbol-${Date.now()}`,
      kind: 'symbol',
      x: position.x + position.width / 2,
      y: position.y + position.height / 2,
      size,
      rotate: 0,
      mark,
      tone: 0.9,
    };
    setCanvasItems((current) => [...current, item]);
    setSelectedId(item.id);
  };

  const addText = () => {
    const text = textDraft.trim();
    if (!text) return;
    const size = 42;
    const width = Math.max(90, text.length * size * 0.62) + 16;
    const height = size + 22;
    const position = findOpenPosition(width, height);
    const item: CanvasText = {
      id: `text-${Date.now()}`,
      kind: 'text',
      x: position.x + 8,
      y: position.y + size + 10,
      rotate: 0,
      size,
      text,
      tone: 0.82,
    };
    setCanvasItems((current) => [...current, item]);
    setSelectedId(item.id);
  };

  const moveItem = (id: string, x: number, y: number) => {
    setCanvasItems((current) =>
      current.map((item) => (item.id === id ? { ...item, x: clamp(x, 52, 1148), y: clamp(y, 48, 752) } : item)),
    );
  };

  const removeSelected = () => {
    if (!selectedId) return;
    setCanvasItems((current) => current.filter((item) => item.id !== selectedId));
    setSelectedId(null);
  };

  const itemLabel = (item: CanvasItem, index: number) => {
    if (item.kind === 'text') return item.text.split('\n')[0] || `Text ${index + 1}`;
    if (item.kind === 'symbol') return `${item.mark} symbol`;
    return `${item.mark} module`;
  };

  const uploadBackground = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      update('backgroundImage', typeof reader.result === 'string' ? reader.result : null);
      update('showBackground', true);
    };
    reader.readAsDataURL(file);
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
            <ToolButton label="Start blank" onClick={() => chooseTemplate('blank')}>
              <Eraser size={17} aria-hidden="true" />
            </ToolButton>
            <ToolButton label="Delete selected" onClick={removeSelected}>
              <Trash2 size={17} aria-hidden="true" />
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
              <Tabs.Tab className="tab" value="elements">
                Elements
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
                      onClick={() => chooseTemplate(template.id)}
                      type="button"
                    >
                      <Grid2X2 size={16} aria-hidden="true" />
                      {template.name}
                    </button>
                  ))}
                  <button
                    className="template-button"
                    data-active={settings.template === 'blank'}
                    onClick={() => chooseTemplate('blank')}
                    type="button"
                  >
                    <Eraser size={16} aria-hidden="true" />
                    Start from scratch
                  </button>
                </div>
              </Field>
              <Field label="Layers">
                <div className="layer-list">
                  {canvasItems.length === 0 ? (
                    <div className="empty-layer">No symbols or text</div>
                  ) : (
                    canvasItems.map((item, index) => (
                      <button
                        className="layer-row"
                        data-active={selectedId === item.id}
                        key={item.id}
                        onClick={() => setSelectedId(item.id)}
                        type="button"
                      >
                        <span>{String(index + 1).padStart(2, '0')}</span>
                        {itemLabel(item, index)}
                      </button>
                    ))
                  )}
                </div>
              </Field>
            </Tabs.Panel>

            <Tabs.Panel value="style" className="tab-panel">
              <Field label="Color">
                <div className="palette-list">
                  {palettes.map((item, index) => (
                    <button
                      className="palette-button"
                      data-active={index === settings.paletteIndex}
                      key={item.name}
                      onClick={() => update('paletteIndex', index)}
                      type="button"
                    >
                      <span className="single-swatch" style={{ background: item.ink }} aria-hidden="true" />
                      {item.name}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Uploaded background">
                <input className="file-input" type="file" accept="image/*" onChange={(event) => uploadBackground(event.target.files?.[0])} />
              </Field>
              <ToggleRow label="Include background" checked={settings.showBackground} onChange={(value) => update('showBackground', value)} />
              <ToggleRow label="Show labels" checked={settings.labels} onChange={(value) => update('labels', value)} />
              <ToggleRow label="Construction grid" checked={settings.grid} onChange={(value) => update('grid', value)} />
              <ToggleRow label="Paper noise" checked={settings.noise} onChange={(value) => update('noise', value)} />
            </Tabs.Panel>

            <Tabs.Panel value="elements" className="tab-panel">
              <Field label="Symbols">
                <div className="symbol-grid">
                  {marks.map((mark) => (
                    <button className="symbol-button" key={mark} onClick={() => addSymbol(mark)} type="button">
                      <svg aria-hidden="true" className="symbol-icon" viewBox="0 0 36 36">
                        <MicroMark color="#f4f0e8" mark={mark} x={18} y={18} />
                      </svg>
                      {mark}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Text">
                <div className="add-row">
                  <input className="text-input" value={textDraft} onChange={(event) => setTextDraft(event.target.value)} />
                  <button className="add-button" onClick={addText} type="button">
                    <Type size={16} aria-hidden="true" />
                    Add
                  </button>
                </div>
              </Field>
            </Tabs.Panel>

          </Tabs.Root>
        </aside>

        <section className="preview-stage" aria-label="Micrographic preview">
          <div className="stage-header">
            <div>
              <span className="eyebrow">
                Template / {settings.template === 'blank' ? 'Scratch canvas' : templates.find((item) => item.id === settings.template)?.name}
              </span>
              <h2>{palette.name}</h2>
            </div>
            <div className="stage-chip">
              <Zap size={14} aria-hidden="true" />
              seed {settings.seed}
            </div>
          </div>
          <div className="artboard-wrap">
            <MicrographicSvg
              ref={svgRef}
              items={canvasItems}
              onMoveItem={moveItem}
              onSelectItem={setSelectedId}
              palette={palette}
              selectedId={selectedId}
              settings={settings}
            />
          </div>
        </section>
      </main>
    </Tooltip.Provider>
  );
}

export default App;
