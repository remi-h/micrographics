import { useState } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { Select } from '@base-ui/react/select';
import { Toolbar } from '@base-ui/react/toolbar';
import { Check, ChevronDown, Download, FileCode2, Group, RefreshCcw, Shuffle, Trash2, Undo2, Redo2, Ungroup } from 'lucide-react';
import { templates } from '../data';
import { isOneWholeGroup, layerRows, rowItemIds } from '../groups';
import { EXPORT_SCALES, exportPixelSize, type ExportScale } from '../exportMarkup';
import type { CanvasItem, Template } from '../types';
import { BrandIcon } from './BrandIcon';
import { Field, ToolButton } from './Controls';

export function ControlPanel({
  canvasItems,
  exportScale,
  itemLabel,
  selectedIds,
  selectedTemplateName,
  template,
  onChooseTemplate,
  onExportPng,
  onExportSvg,
  onRandomize,
  onRedo,
  onRestartTemplate,
  onSelectItem,
  onSelectItems,
  onGroupSelected,
  onUngroupSelected,
  onUndo,
}: {
  canvasItems: CanvasItem[];
  exportScale: ExportScale;
  itemLabel: (item: CanvasItem, index: number) => string;
  selectedIds: string[];
  selectedTemplateName: string | undefined;
  template: Template;
  onChooseTemplate: (template: Template) => void;
  onExportPng: (scale?: ExportScale) => void;
  onExportSvg: () => void;
  onRandomize: () => void;
  onRedo: () => void;
  onRestartTemplate: () => void;
  onSelectItem: (id: string, additive: boolean) => void;
  onSelectItems: (ids: string[], additive?: boolean) => void;
  onGroupSelected: () => void;
  onUngroupSelected: () => void;
  onUndo: () => void;
}) {
  const selectedIdSet = new Set(selectedIds);
  const rows = layerRows(canvasItems);
  // A group can be dissolved as soon as one of its members is selected; two
  // items are needed before there is anything to group, and a selection that
  // is already one whole group has nothing left to gather.
  const canGroup = selectedIds.length > 1 && !isOneWholeGroup(canvasItems, selectedIds);
  const canUngroup = canvasItems.some((item) => item.groupId && selectedIdSet.has(item.id));
  const [sizeOpen, setSizeOpen] = useState(false);

  return (
    <aside className="control-panel">
      <div className="brand-row">
        <div className="brand-mark">
          <BrandIcon />
        </div>
        <div>
          <h1>Micrographics Creator</h1>
          <p>Dense graphic systems for posters, decks, and UI texture.</p>
        </div>
      </div>

      <Toolbar.Root className="toolbar" aria-label="Graphic actions">
        <ToolButton label="Randomize" onClick={onRandomize}>
          <Shuffle size={17} aria-hidden="true" />
        </ToolButton>
        <ToolButton label="Restart template" onClick={onRestartTemplate}>
          <RefreshCcw size={17} aria-hidden="true" />
        </ToolButton>
        <ToolButton label="Start from scratch" onClick={() => onChooseTemplate('blank')}>
          <Trash2 size={17} aria-hidden="true" />
        </ToolButton>
        <Toolbar.Separator className="toolbar-separator" />
        <ToolButton label="Undo" onClick={onUndo}>
          <Undo2 size={17} aria-hidden="true" />
        </ToolButton>
        <ToolButton label="Redo" onClick={onRedo}>
          <Redo2 size={17} aria-hidden="true" />
        </ToolButton>
        <Toolbar.Separator className="toolbar-separator" />
        <ToolButton label="Export SVG" onClick={onExportSvg}>
          <FileCode2 size={17} aria-hidden="true" />
        </ToolButton>
        {/* The size is asked for in a dialog rather than shown as a second
            control, so the toolbar stays one row at this panel width. Choosing
            a size exports at it immediately -- picking a size and then hunting
            for a second button to press would be a worse trade than the wrap
            it replaces. */}
        <Dialog.Root open={sizeOpen} onOpenChange={setSizeOpen}>
          <Dialog.Trigger
            render={<Toolbar.Button />}
            className="icon-button"
            aria-label="Export PNG"
          >
            <Download size={17} aria-hidden="true" />
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Backdrop className="dialog-backdrop" />
            <Dialog.Popup className="dialog-popup">
              <Dialog.Title className="dialog-title">Export PNG</Dialog.Title>
              <Dialog.Description className="dialog-description">
                Pick a size. The artboard is 1200 × 800.
              </Dialog.Description>
              <div className="size-options">
                {EXPORT_SCALES.map((scale) => {
                  const { width, height } = exportPixelSize(scale);
                  return (
                    <button
                      className="size-option"
                      data-active={scale === exportScale}
                      key={scale}
                      onClick={() => {
                        setSizeOpen(false);
                        // The scale goes to the exporter directly: setting it
                        // as state here and exporting in the same click would
                        // rasterize at the previously chosen size.
                        void onExportPng(scale);
                      }}
                      type="button"
                    >
                      <span className="size-option-scale">{scale}&times;</span>
                      <span className="size-option-pixels">
                        {width} &times; {height}
                      </span>
                      {scale === exportScale && <Check size={14} aria-hidden="true" />}
                    </button>
                  );
                })}
              </div>
              <Dialog.Close className="dialog-close">Cancel</Dialog.Close>
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
      </Toolbar.Root>

      <div className="panel-scroll">
        <Field label="Template">
          <Select.Root value={template} onValueChange={(value) => onChooseTemplate(value as Template)}>
            <Select.Trigger className="select-trigger">
              <span>{selectedTemplateName}</span>
              <Select.Icon className="select-icon">
                <ChevronDown size={16} aria-hidden="true" />
              </Select.Icon>
            </Select.Trigger>
            <Select.Portal>
              <Select.Positioner sideOffset={8}>
                <Select.Popup className="select-popup">
                  {templates.map((item) => (
                    <Select.Item className="select-item" key={item.id} value={item.id}>
                      <Select.ItemText>{item.name}</Select.ItemText>
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
          {/* Grouping lives here as well as on the canvas: the layer list is
              where a group reads as one thing, so it is where undoing that is
              expected to be. */}
          <div className="layer-actions">
            <button className="layer-action" disabled={!canGroup} onClick={onGroupSelected} type="button">
              <Group size={14} aria-hidden="true" />
              Group
            </button>
            <button className="layer-action" disabled={!canUngroup} onClick={onUngroupSelected} type="button">
              <Ungroup size={14} aria-hidden="true" />
              Ungroup
            </button>
          </div>
          <div className="layer-list">
            {rows.length === 0 ? (
              <div className="empty-layer">No symbols or text</div>
            ) : (
              rows.map((row, index) => {
                const ids = rowItemIds(row);
                return (
                  <button
                    className="layer-row"
                    data-active={ids.every((id) => selectedIdSet.has(id))}
                    data-group={row.kind === 'group' || undefined}
                    key={row.id}
                    onClick={(event) => {
                      const additive = event.shiftKey || event.metaKey || event.ctrlKey;
                      // A group row stands for several items, so it goes
                      // through the whole-set selector rather than the
                      // single-item one; both honour the modifier, so a
                      // selection spanning two groups can still be built here.
                      if (row.kind === 'group') onSelectItems(ids, additive);
                      else onSelectItem(row.id, additive);
                    }}
                    type="button"
                  >
                    <span>{String(rows.length - index).padStart(2, '0')}</span>
                    {row.kind === 'group' ? (
                      <>
                        <Group size={13} aria-hidden="true" />
                        {`Group of ${row.items.length}`}
                      </>
                    ) : (
                      itemLabel(row.item, index)
                    )}
                  </button>
                );
              })
            )}
          </div>
        </Field>
      </div>
    </aside>
  );
}
