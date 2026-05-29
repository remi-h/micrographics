'use client';

import { useEffect, useRef, useState } from 'react';
import { Select } from '@base-ui/react/select';
import { Toolbar } from '@base-ui/react/toolbar';
import { Tooltip } from '@base-ui/react/tooltip';
import {
  Download,
  FileCode2,
  Check,
  ChevronDown,
  RefreshCcw,
  Shuffle,
  Sparkles,
  Trash2,
  Type,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { Field, ToggleRow, ToolButton } from './components/Controls';
import { MicrographicSvg } from './components/MicrographicSvg';
import { MicroMark } from './components/MicroMark';
import { initialSettings, loadTemplateItems, palettes, symbolTabs, templates } from './data';
import type { CanvasItem, CanvasSymbol, CanvasText, Settings, Template } from './types';
import { clamp, downloadBlob } from './utils';

type HistorySnapshot = {
  canvasItems: CanvasItem[];
  selectedIds: string[];
  settings: Settings;
};

const symbolLabelOverrides: Record<string, string> = {
  chatgpt: 'ChatGPT',
  'claude-code': 'Claude Code',
  codex: 'Codex',
  'creative-commons': 'Creative Commons',
  deepseek: 'DeepSeek',
  android: 'Android',
  ce: 'CE',
  figma: 'Figma',
  github: 'GitHub',
  'github-copilot': 'GitHub Copilot',
  ios: 'iOS',
  kiro: 'Kiro',
  macos: 'macOS',
  mc: 'MC',
  mistral: 'Mistral AI',
  nextjs: 'Next.js',
  openai: 'OpenAI',
  opentui: 'OpenTUI',
  react: 'React',
};

function formatSymbolLabel(mark: string) {
  return (
    symbolLabelOverrides[mark] ??
    mark
      .split('-')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ')
  );
}

function App() {
  const [settings, setSettings] = useState<Settings>(initialSettings);
  const [canvasItems, setCanvasItems] = useState<CanvasItem[]>(() => loadTemplateItems(initialSettings.template));
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [undoStack, setUndoStack] = useState<HistorySnapshot[]>([]);
  const [redoStack, setRedoStack] = useState<HistorySnapshot[]>([]);
  const [textDraft, setTextDraft] = useState('MICRO');
  const [editingTextDraft, setEditingTextDraft] = useState('');
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [canvasZoom, setCanvasZoom] = useState(1);
  const [activeSymbolTab, setActiveSymbolTab] = useState(symbolTabs[0].id);
  const clipboardRef = useRef<CanvasItem[]>([]);
  const stateRef = useRef<HistorySnapshot>({ canvasItems, selectedIds, settings });
  const svgRef = useRef<SVGSVGElement | null>(null);
  const palette = palettes[settings.paletteIndex];
  const selectedIdSet = new Set(selectedIds);
  const selectedTemplateName =
    settings.template === 'blank' ? 'Start from scratch' : templates.find((item) => item.id === settings.template)?.name;
  const activeSymbolMarks = symbolTabs.find((tab) => tab.id === activeSymbolTab)?.marks ?? symbolTabs[0].marks;

  useEffect(() => {
    stateRef.current = { canvasItems, selectedIds, settings };
  }, [canvasItems, selectedIds, settings]);

  const currentSnapshot = (): HistorySnapshot => ({
    canvasItems: stateRef.current.canvasItems.map((item) => ({ ...item })),
    selectedIds: [...stateRef.current.selectedIds],
    settings: { ...stateRef.current.settings },
  });

  const beginHistoryAction = () => {
    const snapshot = currentSnapshot();
    setUndoStack((current) => [...current.slice(-49), snapshot]);
    setRedoStack([]);
  };

  const restoreSnapshot = (snapshot: HistorySnapshot) => {
    setSettings(snapshot.settings);
    setCanvasItems(snapshot.canvasItems);
    setSelectedIds(snapshot.selectedIds);
  };

  const undo = () => {
    if (undoStack.length === 0) return;
    const previous = undoStack[undoStack.length - 1];
    setUndoStack((current) => current.slice(0, -1));
    setRedoStack((current) => [...current.slice(-49), currentSnapshot()]);
    restoreSnapshot(previous);
  };

  const redo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setRedoStack((current) => current.slice(0, -1));
    setUndoStack((current) => [...current.slice(-49), currentSnapshot()]);
    restoreSnapshot(next);
  };

  const update = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    beginHistoryAction();
    setSettings((current) => ({ ...current, [key]: value }));
  };

  const zoomCanvas = (delta: number) => {
    setCanvasZoom((current) => clamp(Math.round((current + delta) * 100) / 100, 0.5, 2.5));
  };

  const resetCanvasZoom = () => {
    setCanvasZoom(1);
  };

  const chooseTemplate = (template: Template) => {
    beginHistoryAction();
    const nextSettings = { ...settings, template };
    setSettings(nextSettings);
    setCanvasItems(loadTemplateItems(template));
    setSelectedIds([]);
  };

  const randomize = () => {
    beginHistoryAction();
    const nextTemplate = templates[Math.floor(Math.random() * templates.length)].id;
    const nextSettings = {
      ...settings,
      template: nextTemplate,
      paletteIndex: Math.floor(Math.random() * palettes.length),
    };
    setSettings(nextSettings);
    setCanvasItems(loadTemplateItems(nextTemplate));
    setSelectedIds([]);
  };

  const restartTemplate = () => {
    beginHistoryAction();
    setCanvasItems(loadTemplateItems(settings.template));
    setSelectedIds([]);
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
    return { x: 0, y: 0, width: 0, height: 0 };
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
    beginHistoryAction();
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
    setSelectedIds([item.id]);
  };

  const addText = () => {
    const text = textDraft.trim();
    if (!text) return;
    beginHistoryAction();
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
    setSelectedIds([item.id]);
  };

  const beginTextEdit = (item: CanvasText) => {
    setEditingTextId(item.id);
    setEditingTextDraft(item.text);
    setSelectedIds([item.id]);
  };

  const cancelTextEdit = () => {
    setEditingTextId(null);
    setEditingTextDraft('');
  };

  const commitTextEdit = () => {
    if (!editingTextId) return;
    const nextText = editingTextDraft.trim();
    const currentItem = canvasItems.find((item): item is CanvasText => item.id === editingTextId && item.kind === 'text');

    if (!currentItem || !nextText || currentItem.text === nextText) {
      cancelTextEdit();
      return;
    }

    beginHistoryAction();
    setCanvasItems((current) => current.map((item) => (item.id === editingTextId && item.kind === 'text' ? { ...item, text: nextText } : item)));
    cancelTextEdit();
  };

  const moveItem = (id: string, x: number, y: number) => {
    setCanvasItems((current) => {
      const active = current.find((item) => item.id === id);
      if (!active) return current;
      const idsToMove = selectedIds.includes(id) ? selectedIds : [id];
      const dx = clamp(x, 52, 1148) - active.x;
      const dy = clamp(y, 48, 752) - active.y;

      return current.map((item) =>
        idsToMove.includes(item.id) ? { ...item, x: clamp(item.x + dx, 52, 1148), y: clamp(item.y + dy, 48, 752) } : item,
      );
    });
  };

  const scaleItems = (updates: Array<{ id: string; size: number; x: number; y: number }>) => {
    setCanvasItems((current) =>
      current.map((item) => {
        const update = updates.find((entry) => entry.id === item.id);
        if (!update) return item;

        return {
          ...item,
          size: clamp(update.size, item.kind === 'text' ? 10 : 16, item.kind === 'text' ? 180 : 240),
          x: clamp(update.x, 52, 1148),
          y: clamp(update.y, 48, 752),
        };
      }),
    );
  };

  const rotateItems = (updates: Array<{ id: string; rotate: number }>) => {
    setCanvasItems((current) =>
      current.map((item) => {
        const update = updates.find((entry) => entry.id === item.id);
        return update ? { ...item, rotate: (update.rotate + 360) % 360 } : item;
      }),
    );
  };

  const removeSelected = () => {
    if (selectedIds.length === 0) return;
    beginHistoryAction();
    setCanvasItems((current) => current.filter((item) => !selectedIds.includes(item.id)));
    setSelectedIds([]);
  };

  const selectItem = (id: string | null, additive = false) => {
    if (!id) {
      setSelectedIds([]);
      return;
    }

    setSelectedIds((current) => {
      if (!additive) return [id];
      return current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
    });
  };

  const duplicateItems = (items: CanvasItem[]) =>
    items.map((item, index) => ({
      ...item,
      id: `${item.kind}-${Date.now()}-${index}`,
      x: clamp(item.x + 28, 52, 1148),
      y: clamp(item.y + 28, 48, 752),
    }));

  const copySelected = () => {
    clipboardRef.current = canvasItems.filter((item) => selectedIds.includes(item.id));
  };

  const pasteClipboard = () => {
    if (clipboardRef.current.length === 0) return;
    beginHistoryAction();
    const pasted = duplicateItems(clipboardRef.current);
    clipboardRef.current = pasted;
    setCanvasItems((current) => [...current, ...pasted]);
    setSelectedIds(pasted.map((item) => item.id));
  };

  const duplicateSelected = () => {
    const selected = canvasItems.filter((item) => selectedIds.includes(item.id));
    if (selected.length === 0) return;
    beginHistoryAction();
    const duplicated = duplicateItems(selected);
    setCanvasItems((current) => [...current, ...duplicated]);
    setSelectedIds(duplicated.map((item) => item.id));
  };

  const cutSelected = () => {
    copySelected();
    removeSelected();
  };

  const visualCenter = (item: CanvasItem) => {
    const bounds = itemBounds(item);
    return {
      x: bounds.x + bounds.width / 2,
      y: bounds.y + bounds.height / 2,
    };
  };

  const alignSelected = (axis: 'x' | 'y') => {
    const selected = canvasItems.filter((item) => selectedIds.includes(item.id));
    if (selected.length < 2) return;

    beginHistoryAction();
    const target = selected.reduce((sum, item) => sum + visualCenter(item)[axis], 0) / selected.length;
    setCanvasItems((current) =>
      current.map((item) => {
        if (!selectedIds.includes(item.id)) return item;
        const center = visualCenter(item);
        const dx = axis === 'x' ? target - center.x : 0;
        const dy = axis === 'y' ? target - center.y : 0;
        return { ...item, x: clamp(item.x + dx, 52, 1148), y: clamp(item.y + dy, 48, 752) };
      }),
    );
  };

  const distributeSelected = (axis: 'x' | 'y') => {
    const selected = canvasItems
      .filter((item) => selectedIds.includes(item.id))
      .map((item) => ({ item, center: visualCenter(item) }))
      .sort((a, b) => a.center[axis] - b.center[axis]);

    if (selected.length < 3) return;

    beginHistoryAction();
    const first = selected[0].center[axis];
    const last = selected[selected.length - 1].center[axis];
    const step = (last - first) / (selected.length - 1);
    const updates = new Map(selected.map((entry, index) => [entry.item.id, first + step * index]));

    setCanvasItems((current) =>
      current.map((item) => {
        const target = updates.get(item.id);
        if (target === undefined) return item;
        const center = visualCenter(item);
        const dx = axis === 'x' ? target - center.x : 0;
        const dy = axis === 'y' ? target - center.y : 0;
        return { ...item, x: clamp(item.x + dx, 52, 1148), y: clamp(item.y + dy, 48, 752) };
      }),
    );
  };

  const nudgeSelected = (dx: number, dy: number) => {
    if (selectedIds.length === 0) return;
    beginHistoryAction();
    setCanvasItems((current) =>
      current.map((item) =>
        selectedIds.includes(item.id) ? { ...item, x: clamp(item.x + dx, 52, 1148), y: clamp(item.y + dy, 48, 752) } : item,
      ),
    );
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isEditing = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.tagName === 'SELECT';
      if (isEditing) return;

      const modifier = event.metaKey || event.ctrlKey;
      if (modifier && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
      } else if (modifier && event.key.toLowerCase() === 'y') {
        event.preventDefault();
        redo();
      } else if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        removeSelected();
      } else if (event.key === 'Escape') {
        setSelectedIds([]);
      } else if (modifier && event.key.toLowerCase() === 'a') {
        event.preventDefault();
        setSelectedIds(canvasItems.map((item) => item.id));
      } else if (modifier && event.key.toLowerCase() === 'c') {
        event.preventDefault();
        copySelected();
      } else if (modifier && event.key.toLowerCase() === 'x') {
        event.preventDefault();
        cutSelected();
      } else if (modifier && event.key.toLowerCase() === 'v') {
        event.preventDefault();
        pasteClipboard();
      } else if (modifier && event.key.toLowerCase() === 'd') {
        event.preventDefault();
        duplicateSelected();
      } else if (modifier && (event.key === '=' || event.key === '+')) {
        event.preventDefault();
        zoomCanvas(0.1);
      } else if (modifier && (event.key === '-' || event.key === '_')) {
        event.preventDefault();
        zoomCanvas(-0.1);
      } else if (modifier && event.key === '0') {
        event.preventDefault();
        resetCanvasZoom();
      } else if (event.key === '[') {
        event.preventDefault();
        beginHistoryAction();
        rotateItems(
          canvasItems
            .filter((item) => selectedIds.includes(item.id))
            .map((item) => ({ id: item.id, rotate: item.rotate + (event.shiftKey ? -45 : -15) })),
        );
      } else if (event.key === ']') {
        event.preventDefault();
        beginHistoryAction();
        rotateItems(
          canvasItems
            .filter((item) => selectedIds.includes(item.id))
            .map((item) => ({ id: item.id, rotate: item.rotate + (event.shiftKey ? 45 : 15) })),
        );
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        nudgeSelected(event.shiftKey ? -10 : -1, 0);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        nudgeSelected(event.shiftKey ? 10 : 1, 0);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        nudgeSelected(0, event.shiftKey ? -10 : -1);
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        nudgeSelected(0, event.shiftKey ? 10 : 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canvasItems, redoStack, selectedIds, settings.template, undoStack]);

  const itemLabel = (item: CanvasItem, index: number) => {
    if (item.kind === 'text') return item.text.split('\n')[0] || `Text ${index + 1}`;
    return `${item.mark} symbol`;
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
            <ToolButton label="Restart template" onClick={restartTemplate}>
              <RefreshCcw size={17} aria-hidden="true" />
            </ToolButton>
            <ToolButton label="Start from scratch" onClick={() => chooseTemplate('blank')}>
              <Trash2 size={17} aria-hidden="true" />
            </ToolButton>
            <Toolbar.Separator className="toolbar-separator" />
            <ToolButton label="Undo" onClick={undo}>
              <Undo2 size={17} aria-hidden="true" />
            </ToolButton>
            <ToolButton label="Redo" onClick={redo}>
              <Redo2 size={17} aria-hidden="true" />
            </ToolButton>
            <Toolbar.Separator className="toolbar-separator" />
            <ToolButton label="Export SVG" onClick={exportSvg}>
              <FileCode2 size={17} aria-hidden="true" />
            </ToolButton>
            <ToolButton label="Export PNG" onClick={exportPng}>
              <Download size={17} aria-hidden="true" />
            </ToolButton>
          </Toolbar.Root>

          <div className="panel-scroll">
            <Field label="Template">
              <Select.Root value={settings.template} onValueChange={(value) => chooseTemplate(value as Template)}>
                <Select.Trigger className="select-trigger">
                  <span>{selectedTemplateName}</span>
                  <Select.Icon className="select-icon">
                    <ChevronDown size={16} aria-hidden="true" />
                  </Select.Icon>
                </Select.Trigger>
                <Select.Portal>
                  <Select.Positioner sideOffset={8}>
                    <Select.Popup className="select-popup">
                      {templates.map((template) => (
                        <Select.Item className="select-item" key={template.id} value={template.id}>
                          <Select.ItemText>{template.name}</Select.ItemText>
                          <Select.ItemIndicator className="select-item-indicator">
                            <Check size={14} aria-hidden="true" />
                          </Select.ItemIndicator>
                        </Select.Item>
                      ))}
                      <Select.Item className="select-item" value="blank">
                        <Select.ItemText>Start from scratch</Select.ItemText>
                        <Select.ItemIndicator className="select-item-indicator">
                          <Check size={14} aria-hidden="true" />
                        </Select.ItemIndicator>
                      </Select.Item>
                    </Select.Popup>
                  </Select.Positioner>
                </Select.Portal>
              </Select.Root>
            </Field>
            <Field label="Layers">
              <div className="layer-list">
                {canvasItems.length === 0 ? (
                  <div className="empty-layer">No symbols or text</div>
                ) : (
                  [...canvasItems].reverse().map((item, index) => (
                    <button
                      className="layer-row"
                      data-active={selectedIdSet.has(item.id)}
                      key={item.id}
                      onClick={(event) => selectItem(item.id, event.shiftKey || event.metaKey || event.ctrlKey)}
                      type="button"
                    >
                      <span>{String(canvasItems.length - index).padStart(2, '0')}</span>
                      {itemLabel(item, index)}
                    </button>
                  ))
                )}
              </div>
            </Field>
          </div>
        </aside>

        <section className="preview-stage" aria-label="Micrographic preview">
          <div className="stage-header">
            <div>
              <span className="eyebrow">
                Template / {settings.template === 'blank' ? 'Scratch canvas' : selectedTemplateName}
              </span>
              <h2>{palette.name}</h2>
            </div>
            <div className="stage-actions">
              <div className="stage-palette-list" aria-label="Color palette">
                {palettes.map((item, index) => (
                  <button
                    aria-label={item.name}
                    className="stage-palette-button"
                    data-active={index === settings.paletteIndex}
                    key={item.name}
                    onClick={() => update('paletteIndex', index)}
                    title={item.name}
                    type="button"
                  >
                    <span className="single-swatch" style={{ background: item.ink }} aria-hidden="true" />
                  </button>
                ))}
              </div>
              <label className="stage-toggle">
                <span>Grid</span>
                <input checked={settings.grid} onChange={(event) => update('grid', event.target.checked)} type="checkbox" />
              </label>
              <button className="icon-button" onClick={() => zoomCanvas(-0.1)} title="Zoom out" type="button">
                <ZoomOut size={17} aria-hidden="true" />
              </button>
              <button className="zoom-value" onClick={resetCanvasZoom} title="Reset zoom" type="button">
                {Math.round(canvasZoom * 100)}%
              </button>
              <button className="icon-button" onClick={() => zoomCanvas(0.1)} title="Zoom in" type="button">
                <ZoomIn size={17} aria-hidden="true" />
              </button>
            </div>
          </div>
          <div
            className="artboard-wrap"
            onWheel={(event) => {
              if (!event.ctrlKey && !event.metaKey) return;
              event.preventDefault();
              zoomCanvas(event.deltaY > 0 ? -0.1 : 0.1);
            }}
          >
            <div className="artboard-zoom" style={{ width: `min(${canvasZoom * 100}%, ${1180 * canvasZoom}px)` }}>
              <MicrographicSvg
                ref={svgRef}
                editingTextId={editingTextId}
                editingTextValue={editingTextDraft}
                items={canvasItems}
                onAlignSelected={alignSelected}
                onBeginHistoryAction={beginHistoryAction}
                onBeginTextEdit={beginTextEdit}
                onCancelTextEdit={cancelTextEdit}
                onChangeEditingText={setEditingTextDraft}
                onCommitTextEdit={commitTextEdit}
                onDistributeSelected={distributeSelected}
                onMoveItem={moveItem}
                onRotateItems={rotateItems}
                onScaleItems={scaleItems}
                onSelectItems={setSelectedIds}
                onSelectItem={selectItem}
                palette={palette}
                selectedIds={selectedIds}
                settings={settings}
              />
            </div>
          </div>
        </section>
        <aside className="asset-panel">
          <div className="asset-panel-inner">
            <Field label="Uploaded background">
              <input className="file-input" type="file" accept="image/*" onChange={(event) => uploadBackground(event.target.files?.[0])} />
            </Field>
            <ToggleRow label="Include background" checked={settings.showBackground} onChange={(value) => update('showBackground', value)} />
            <Field label="Symbols">
              <div className="symbol-tabs" role="tablist" aria-label="Symbol groups">
                {symbolTabs.map((tab) => (
                  <button
                    aria-selected={tab.id === activeSymbolTab}
                    className="symbol-tab"
                    data-active={tab.id === activeSymbolTab}
                    key={tab.id}
                    onClick={() => setActiveSymbolTab(tab.id)}
                    role="tab"
                    type="button"
                  >
                    {tab.name}
                  </button>
                ))}
              </div>
              <div className="symbol-grid">
                {activeSymbolMarks.map((mark) => {
                  const label = formatSymbolLabel(mark);
                  return (
                    <Tooltip.Root key={mark}>
                      <Tooltip.Trigger
                        render={<button type="button" />}
                        aria-label={label}
                        className="symbol-button"
                        onClick={() => addSymbol(mark)}
                      >
                        <svg aria-hidden="true" className="symbol-icon" viewBox="0 0 36 36">
                          <MicroMark color="#f4f0e8" mark={mark} x={18} y={18} />
                        </svg>
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
                })}
              </div>
            </Field>
            <Field label="Text">
              <div className="add-row">
                <input
                  className="text-input"
                  value={textDraft}
                  onChange={(event) => setTextDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      addText();
                    }
                  }}
                />
                <button className="add-button" onClick={addText} type="button">
                  <Type size={16} aria-hidden="true" />
                  Add
                </button>
              </div>
            </Field>
          </div>
        </aside>
      </main>
    </Tooltip.Provider>
  );
}

export default App;
