'use client';

import { useEffect, useRef, useState } from 'react';
import { Tooltip } from '@base-ui/react/tooltip';
import { animationRunTime } from './animations';
import { AssetPanel } from './components/AssetPanel';
import { ControlPanel } from './components/ControlPanel';
import { ExportStatus } from './components/ExportStatus';
import { GroupMenu } from './components/GroupMenu';
import { MicrographicSvg } from './components/MicrographicSvg';
import { StageHeader } from './components/StageHeader';
import { initialSettings, loadTemplateItems, palettes, symbolTabs, templates } from './data';
import { groupActions } from './groups';
import { loadEditorState, saveEditorState, type PersistedEditorState } from './persistence';
import type { CanvasItem, Settings, Template } from './types';
import { useCanvasItems, visualCenter } from './useCanvasItems';
import { useExport } from './useExport';
import { useHistory } from './useHistory';
import { useKeyboardShortcuts } from './useKeyboardShortcuts';
import { clamp } from './utils';

// Long enough that dragging an item writes once the pointer settles rather
// than on every pointer move, short enough to survive a quick reload.
const SAVE_DEBOUNCE_MS = 400;

function App() {
  const [settings, setSettings] = useState<Settings>(initialSettings);
  const [canvasItems, setCanvasItems] = useState<CanvasItem[]>(() => loadTemplateItems(initialSettings.template));
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [canvasZoom, setCanvasZoom] = useState(1);
  const [activeSymbolTab, setActiveSymbolTab] = useState(symbolTabs[0].id);
  const [restored, setRestored] = useState(false);
  // A counter, not a flag: playing twice in a row has to restart the
  // entrances, and the same value twice would not re-run the effect that does.
  const [playToken, setPlayToken] = useState(0);
  const persistRef = useRef<PersistedEditorState>({ canvasItems, canvasZoom, settings });
  const { beginHistoryAction, redo, stateRef, undo } = useHistory({
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
    groupSelected,
    moveItem,
    nudgeSelected,
    pasteClipboard,
    removeSelected,
    reorderLayer,
    rotateItems,
    scaleItems,
    selectItem,
    selectItems,
    setEditingTextDraft,
    setItemAnimation,
    setTextDraft,
    textDraft,
    ungroupSelected,
  } = useCanvasItems({
    beginHistoryAction,
    canvasItems,
    selectedIds,
    setCanvasItems,
    setSelectedIds,
    visibleCanvasRect,
  });
  const palette = palettes[settings.paletteIndex];
  const canvasGroupActions = groupActions(canvasItems, selectedIds);
  const { exportGif, exportingGif, exportPng, exportStatus, exportSvg } = useExport({
    canvasItems,
    palette,
    settings,
  });
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

  useKeyboardShortcuts({
    beginHistoryAction,
    canvasItems,
    copySelected,
    cutSelected,
    duplicateSelected,
    groupSelected,
    nudgeSelected,
    pasteClipboard,
    redo,
    removeSelected,
    resetCanvasZoom,
    rotateItems,
    selectedIds,
    setSelectedIds,
    undo,
    ungroupSelected,
    zoomCanvas,
  });

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

  return (
    <Tooltip.Provider>
      <main className="app-shell">
        <ControlPanel
          canvasItems={canvasItems}
          exportingGif={exportingGif}
          itemLabel={itemLabel}
          selectedIds={selectedIds}
          selectedTemplateName={selectedTemplateName}
          template={settings.template}
          onChooseTemplate={chooseTemplate}
          onExportGif={exportGif}
          onExportPng={exportPng}
          onExportSvg={exportSvg}
          onRandomize={randomize}
          onRedo={redo}
          onReorderLayer={reorderLayer}
          onGroupSelected={groupSelected}
          onRestartTemplate={restartTemplate}
          onSelectItem={selectItem}
          onSelectItems={selectItems}
          onSetItemAnimation={setItemAnimation}
          onUndo={undo}
          onUngroupSelected={ungroupSelected}
        />

        <section className="preview-stage" aria-label="Micrographic preview">
          <StageHeader
            canPlay={animationRunTime(canvasItems) > 0}
            canvasZoom={canvasZoom}
            grid={settings.grid}
            palette={palette}
            paletteIndex={settings.paletteIndex}
            palettes={palettes}
            selectedTemplateName={selectedTemplateName}
            settings={settings}
            onChangeGrid={(value) => update('grid', value)}
            onPlayAnimations={() => setPlayToken((current) => current + 1)}
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
              {/* The same Group / Ungroup menu the Layers list has, on the
                  selection itself. A right-click on an item selects it first
                  (see startDrag), so the menu is always about what is under
                  the pointer. */}
              <GroupMenu
                canGroup={canvasGroupActions.canGroup}
                canUngroup={canvasGroupActions.canUngroup}
                className="artboard-menu"
                onGroup={groupSelected}
                onUngroup={ungroupSelected}
              >
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
                onSelectItems={selectItems}
                onSelectItem={selectItem}
                palette={palette}
                playToken={playToken}
                selectedIds={selectedIds}
                settings={settings}
              />
              </GroupMenu>
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
