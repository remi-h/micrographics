import { Select } from '@base-ui/react/select';
import { Toolbar } from '@base-ui/react/toolbar';
import { Check, ChevronDown, Download, FileCode2, RefreshCcw, Shuffle, Sparkles, Trash2, Undo2, Redo2 } from 'lucide-react';
import { templates } from '../data';
import type { CanvasItem, Template } from '../types';
import { Field, ToolButton } from './Controls';

export function ControlPanel({
  canvasItems,
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
  onUndo,
}: {
  canvasItems: CanvasItem[];
  itemLabel: (item: CanvasItem, index: number) => string;
  selectedIds: string[];
  selectedTemplateName: string | undefined;
  template: Template;
  onChooseTemplate: (template: Template) => void;
  onExportPng: () => void;
  onExportSvg: () => void;
  onRandomize: () => void;
  onRedo: () => void;
  onRestartTemplate: () => void;
  onSelectItem: (id: string, additive: boolean) => void;
  onUndo: () => void;
}) {
  const selectedIdSet = new Set(selectedIds);

  return (
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
        <ToolButton label="Export PNG" onClick={onExportPng}>
          <Download size={17} aria-hidden="true" />
        </ToolButton>
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
          <div className="layer-list">
            {canvasItems.length === 0 ? (
              <div className="empty-layer">No symbols or text</div>
            ) : (
              [...canvasItems].reverse().map((item, index) => (
                <button
                  className="layer-row"
                  data-active={selectedIdSet.has(item.id)}
                  key={item.id}
                  onClick={(event) => onSelectItem(item.id, event.shiftKey || event.metaKey || event.ctrlKey)}
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
  );
}
