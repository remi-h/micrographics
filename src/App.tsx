'use client';

import { useEffect, useRef, useState } from 'react';
import { Tooltip } from '@base-ui/react/tooltip';
import { AssetPanel } from './components/AssetPanel';
import { ControlPanel } from './components/ControlPanel';
import { ExportStatus, type ExportStatusMessage } from './components/ExportStatus';
import { MicrographicSvg } from './components/MicrographicSvg';
import { StageHeader } from './components/StageHeader';
import { initialSettings, loadTemplateItems, palettes, symbolTabs, templates } from './data';
import {
  buildExportMarkup,
  DEFAULT_EXPORT_SCALE,
  exportPixelSize,
  type ExportScale,
} from './exportMarkup';
import { loadEditorState, saveEditorState, type PersistedEditorState } from './persistence';
import type { CanvasItem, Settings, Template } from './types';
import { useCanvasItems, visualCenter } from './useCanvasItems';
import { useHistory } from './useHistory';
import { clamp, downloadBlob } from './utils';

// Long enough that dragging an item writes once the pointer settles rather
// than on every pointer move, short enough to survive a quick reload.
const SAVE_DEBOUNCE_MS = 400;

// Every export failure ends up here, so the user is told which step went wrong
// instead of being handed nothing. A thrown Error carries its own sentence; a
// browser can also reject with something that is not an Error at all.
function reason(error: unknown) {
  return error instanceof Error && error.message ? error.message : 'an unknown error';
}

function App() {
  const [settings, setSettings] = useState<Settings>(initialSettings);
  const [canvasItems, setCanvasItems] = useState<CanvasItem[]>(() => loadTemplateItems(initialSettings.template));
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [canvasZoom, setCanvasZoom] = useState(1);
  const [activeSymbolTab, setActiveSymbolTab] = useState(symbolTabs[0].id);
  const [exportScale, setExportScale] = useState<ExportScale>(DEFAULT_EXPORT_SCALE);
  const [exportStatus, setExportStatus] = useState<ExportStatusMessage | null>(null);
  const exportStatusId = useRef(0);
  const [restored, setRestored] = useState(false);
  const persistRef = useRef<PersistedEditorState>({ canvasItems, canvasZoom, settings });
  const { beginHistoryAction, redo, redoStack, stateRef, undo, undoStack } = useHistory({
    canvasItems,
    selectedIds,
    settings,
    setCanvasItems,
    setSelectedIds,
    setSettings,
  });
  const artboardWrapRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  // Measured from the refs above, so it stays with the layout that owns them
  // and is handed to useCanvasItems, which places new items inside it.
  const visibleCanvasRect = () => {
    const wrap = artboardWrapRef.current;
    const svg = svgRef.current;
    if (!wrap || !svg) return null;

    const wrapRect = wrap.getBoundingClientRect();
    const svgRect = svg.getBoundingClientRect();
    if (svgRect.width === 0 || svgRect.height === 0) return null;

    const left = Math.max(wrapRect.left, svgRect.left);
    const top = Math.max(wrapRect.top, svgRect.top);
    const right = Math.min(wrapRect.right, svgRect.right);
    const bottom = Math.min(wrapRect.bottom, svgRect.bottom);
    if (right <= left || bottom <= top) return null;

    return {
      x: clamp(((left - svgRect.left) / svgRect.width) * 1200, 0, 1200),
      y: clamp(((top - svgRect.top) / svgRect.height) * 800, 0, 800),
      width: clamp(((right - left) / svgRect.width) * 1200, 0, 1200),
      height: clamp(((bottom - top) / svgRect.height) * 800, 0, 800),
    };
  };

  const {
    addSymbol,
    addText,
    alignSelected,
    beginTextEdit,
    cancelTextEdit,
    commitTextEdit,
    copySelected,
    cutSelected,
    distributeSelected,
    duplicateSelected,
    editingTextDraft,
    editingTextId,
    moveItem,
    nudgeSelected,
    pasteClipboard,
    removeSelected,
    rotateItems,
    scaleItems,
    selectItem,
    setEditingTextDraft,
    setTextDraft,
    textDraft,
  } = useCanvasItems({
    beginHistoryAction,
    canvasItems,
    selectedIds,
    setCanvasItems,
    setSelectedIds,
    visibleCanvasRect,
  });
  const palette = palettes[settings.paletteIndex];
  const selectedTemplateName =
    settings.template === 'blank' ? 'Start from scratch' : templates.find((item) => item.id === settings.template)?.name;
  const activeSymbolMarks = symbolTabs.find((tab) => tab.id === activeSymbolTab)?.marks ?? symbolTabs[0].marks;

  // Restore after mount, not in a lazy state initializer: this component is
  // server-rendered, and localStorage only exists on the client, so reading it
  // during the first render would desync the two and trip a hydration error.
  // The inline-script trick the Next docs use for flash-free persisted UI can
  // pre-set a DOM attribute, but it cannot rebuild a canvas of SVG items.
  // react-hooks/set-state-in-effect is suppressed rather than obeyed here for
  // that reason: localStorage is an external store that only exists after
  // mount, so the one cascading render this causes is the price of correct
  // hydration. It runs once, on mount, not on every render.
  useEffect(() => {
    const saved = loadEditorState();
    if (saved) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- see above
      setSettings(saved.settings);
      setCanvasItems(saved.canvasItems);
      setCanvasZoom(saved.canvasZoom);
    }
    setRestored(true);
  }, []);

  // Autosave. Only the artwork and its settings are persisted: selection, the
  // undo/redo stacks and the clipboard are session state. Writes are debounced
  // so a drag does not hit localStorage on every pointer move, and the pending
  // write is flushed when the page goes away so a reload cannot outrun it.
  useEffect(() => {
    persistRef.current = { canvasItems, canvasZoom, settings };
    if (!restored) return;

    const timer = window.setTimeout(() => saveEditorState(persistRef.current), SAVE_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [canvasItems, canvasZoom, restored, settings]);

  useEffect(() => {
    if (!restored) return;

    const flush = () => saveEditorState(persistRef.current);
    window.addEventListener('pagehide', flush);
    return () => window.removeEventListener('pagehide', flush);
  }, [restored]);

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

  // Re-centre the artboard on the selection when the zoom changes, and only
  // then. Zoom is the trigger; the selection and the items are what the effect
  // reads to work out where to scroll, not something it should react to —
  // depending on them would drag the viewport around on every click, nudge and
  // drag. They are therefore read from useHistory's stateRef, which that hook
  // keeps current. The ref object itself never changes identity, so listing it
  // alongside `[canvasZoom]` still leaves the zoom as the only real trigger.
  useEffect(() => {
    const animationFrame = window.requestAnimationFrame(() => {
      const wrap = artboardWrapRef.current;
      const svg = svgRef.current;
      const { canvasItems: items, selectedIds: selection } = stateRef.current;
      const selectedItems = items.filter((item) => selection.includes(item.id));
      if (!wrap || !svg || selectedItems.length === 0) return;

      const centers = selectedItems.map(visualCenter);
      const center = {
        x: centers.reduce((sum, point) => sum + point.x, 0) / centers.length,
        y: centers.reduce((sum, point) => sum + point.y, 0) / centers.length,
      };
      const svgRect = svg.getBoundingClientRect();
      if (svgRect.width === 0 || svgRect.height === 0) return;

      const targetX = wrap.scrollLeft + (center.x / 1200) * svgRect.width + svgRect.left - wrap.getBoundingClientRect().left;
      const targetY = wrap.scrollTop + (center.y / 800) * svgRect.height + svgRect.top - wrap.getBoundingClientRect().top;
      wrap.scrollTo({
        left: Math.max(0, targetX - wrap.clientWidth / 2),
        top: Math.max(0, targetY - wrap.clientHeight / 2),
      });
    });

    return () => window.cancelAnimationFrame(animationFrame);
  }, [canvasZoom, stateRef]);

  // Keyboard shortcuts. The handler calls this component's action helpers,
  // which are new function objects on every render, so listing them would
  // re-bind the window listener on every keystroke and every drag frame. The
  // dependency array instead names the state those helpers read, which is what
  // actually has to be fresh inside the listener.
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- see the note above this effect
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

  // Both exporters serialize a fresh, unselected render of the canvas rather
  // than the live node, so the editor's own chrome stays out of the file. See
  // buildExportMarkup.
  const exportMarkup = (scale: number) => buildExportMarkup({ items: canvasItems, palette, settings, scale });

  const announceExport = (tone: ExportStatusMessage['tone'], text: string) => {
    exportStatusId.current += 1;
    setExportStatus({ id: exportStatusId.current, text, tone });
  };

  const exportSvg = () => {
    try {
      // Vector: the artboard's own size, with the scale control left to the
      // PNG. A viewBox is along for the ride, so it still scales anywhere.
      const { width, height } = exportPixelSize(1);
      downloadBlob(new Blob([exportMarkup(1)], { type: 'image/svg+xml;charset=utf-8' }), 'micrographic.svg');
      announceExport('success', `Saved micrographic.svg (${width} × ${height}).`);
    } catch (error) {
      announceExport('error', `Could not export the SVG: ${reason(error)}.`);
    }
  };

  const exportPng = async () => {
    const { width, height } = exportPixelSize(exportScale);
    let url: string | null = null;

    // Every step here can fail for real -- a browser that will not decode the
    // SVG, a refused 2D context, an encode that runs out of memory at 4x -- and
    // each one used to end with no file and no word about it.
    try {
      const blob = new Blob([exportMarkup(exportScale)], { type: 'image/svg+xml;charset=utf-8' });
      url = URL.createObjectURL(blob);
      const image = new Image();
      image.decoding = 'async';
      image.src = url;

      try {
        await image.decode();
      } catch {
        throw new Error('this browser could not read the generated image');
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('this browser gave no 2D canvas to draw into');
      context.drawImage(image, 0, 0, width, height);

      const png = await new Promise<Blob>((resolve, reject) => {
        // toBlob hands back null when it cannot encode -- most plausibly
        // because the canvas is too large, which is exactly what the 4x option
        // makes reachable.
        canvas.toBlob((result) => {
          if (result) resolve(result);
          else reject(new Error(`this browser could not encode a ${width} × ${height} PNG`));
        }, 'image/png');
      });

      downloadBlob(png, 'micrographic.png');
      announceExport('success', `Saved micrographic.png (${width} × ${height}).`);
    } catch (error) {
      announceExport('error', `Could not export the PNG: ${reason(error)}.`);
    } finally {
      if (url) URL.revokeObjectURL(url);
    }
  };

  return (
    <Tooltip.Provider>
      <main className="app-shell">
        <ControlPanel
          canvasItems={canvasItems}
          exportScale={exportScale}
          itemLabel={itemLabel}
          selectedIds={selectedIds}
          selectedTemplateName={selectedTemplateName}
          template={settings.template}
          onChangeExportScale={setExportScale}
          onChooseTemplate={chooseTemplate}
          onExportPng={exportPng}
          onExportSvg={exportSvg}
          onRandomize={randomize}
          onRedo={redo}
          onRestartTemplate={restartTemplate}
          onSelectItem={selectItem}
          onUndo={undo}
        />

        <section className="preview-stage" aria-label="Micrographic preview">
          <StageHeader
            canvasZoom={canvasZoom}
            grid={settings.grid}
            palette={palette}
            paletteIndex={settings.paletteIndex}
            palettes={palettes}
            selectedTemplateName={selectedTemplateName}
            settings={settings}
            onChangeGrid={(value) => update('grid', value)}
            onChangePalette={(index) => update('paletteIndex', index)}
            onResetZoom={resetCanvasZoom}
            onZoomIn={() => zoomCanvas(0.1)}
            onZoomOut={() => zoomCanvas(-0.1)}
          />
          <div
            ref={artboardWrapRef}
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
        <AssetPanel
          activeSymbolMarks={activeSymbolMarks}
          activeSymbolTab={activeSymbolTab}
          showBackground={settings.showBackground}
          textDraft={textDraft}
          onAddSymbol={addSymbol}
          onAddText={addText}
          onChangeShowBackground={(value) => update('showBackground', value)}
          onChangeSymbolTab={setActiveSymbolTab}
          onChangeTextDraft={setTextDraft}
          onUploadBackground={uploadBackground}
        />
        <ExportStatus message={exportStatus} />
      </main>
    </Tooltip.Provider>
  );
}

export default App;
