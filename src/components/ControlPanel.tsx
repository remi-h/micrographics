import { useRef, useState } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { Select } from '@base-ui/react/select';
import { Toolbar } from '@base-ui/react/toolbar';
import { Check, ChevronDown, Download, FileCode2, Film, Group, RefreshCcw, Shuffle, Sparkles, Trash2, Undo2, Redo2, Ungroup } from 'lucide-react';
import {
  ANIMATION_KINDS,
  DEFAULT_ANIMATION,
  MAX_DELAY,
  MAX_DURATION,
  MIN_DELAY,
  MIN_DURATION,
  animationLabel,
  animationRunTime,
  sharedAnimation,
  type ItemAnimation,
} from '../animations';
import { templates } from '../data';
import { isOneWholeGroup, layerRows, rowItemIds } from '../groups';
import { EXPORT_SCALES, exportPixelSize, type ExportScale } from '../exportMarkup';
import type { CanvasItem, Template } from '../types';
import { BrandIcon } from './BrandIcon';
import { Field, ToolButton } from './Controls';

export function ControlPanel({
  canvasItems,
  exportingGif,
  itemLabel,
  selectedIds,
  selectedTemplateName,
  template,
  onChooseTemplate,
  onExportGif,
  onExportPng,
  onExportSvg,
  onRandomize,
  onRedo,
  onRestartTemplate,
  onSelectItem,
  onSelectItems,
  onSetItemAnimation,
  onGroupSelected,
  onUngroupSelected,
  onUndo,
}: {
  canvasItems: CanvasItem[];
  exportingGif: boolean;
  itemLabel: (item: CanvasItem, index: number) => string;
  selectedIds: string[];
  selectedTemplateName: string | undefined;
  template: Template;
  onChooseTemplate: (template: Template) => void;
  onExportGif: () => void;
  onExportPng: (scale: ExportScale) => void;
  onExportSvg: () => void;
  onRandomize: () => void;
  onRedo: () => void;
  onRestartTemplate: () => void;
  onSelectItem: (id: string, additive: boolean) => void;
  onSelectItems: (ids: string[], additive?: boolean) => void;
  onSetItemAnimation: (id: string, animation: ItemAnimation | null, record?: boolean) => void;
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
  const [exportOpen, setExportOpen] = useState(false);
  // Whether anything on the canvas actually animates decides how the dialog
  // talks about the formats: with no entrances there is no animation to lose
  // by picking the PNG, and the GIF has nothing to render.
  const animated = animationRunTime(canvasItems) > 0;

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
        {/* One Export control rather than a button per format: the toolbar has
            to stay a single row at this panel width, and the formats are a
            choice between alternatives, which is what a dialog is for. The PNG
            sizes live in here too, so there is one place to look. */}
        <Dialog.Root open={exportOpen} onOpenChange={setExportOpen}>
          <Dialog.Trigger render={<Toolbar.Button />} className="icon-button" aria-label="Export">
            <Download size={17} aria-hidden="true" />
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Backdrop className="dialog-backdrop" />
            <Dialog.Popup className="dialog-popup export-dialog">
              <Dialog.Title className="dialog-title">Export</Dialog.Title>
              <Dialog.Description className="dialog-description">
                {animated
                  ? 'Choose a format. Only SVG and GIF carry the animation — a PNG is a single frame.'
                  : 'Choose a format. The artboard is 1200 × 800.'}
              </Dialog.Description>

              <div className="export-group">
                <p className="export-group-label">Vector</p>
                <button
                  className="export-option"
                  onClick={() => {
                    setExportOpen(false);
                    onExportSvg();
                  }}
                  type="button"
                >
                  <FileCode2 size={16} aria-hidden="true" />
                  <span className="export-option-name">SVG</span>
                  <span className="export-option-note">{animated ? 'Animated, scales anywhere' : 'Scales anywhere'}</span>
                </button>
              </div>

              <div className="export-group">
                <p className="export-group-label">PNG{animated ? ' — one frame, no animation' : ''}</p>
                {/* Three buttons, not a radio group. None is marked as chosen:
                    a tick reads as a selection, which implies a confirm button
                    this dialog does not have -- every row here exports on the
                    spot. */}
                <div className="size-options">
                  {EXPORT_SCALES.map((scale) => {
                    const { width, height } = exportPixelSize(scale);
                    return (
                      <button
                        className="size-option"
                        key={scale}
                        onClick={() => {
                          setExportOpen(false);
                          void onExportPng(scale);
                        }}
                        type="button"
                      >
                        <span className="size-option-scale">{scale}&times;</span>
                        <span className="size-option-pixels">
                          {width} &times; {height}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="export-group">
                <p className="export-group-label">Animated</p>
                <button
                  className="export-option"
                  disabled={!animated || exportingGif}
                  onClick={() => {
                    // The dialog stays open: encoding takes long enough to
                    // wonder whether the click landed, and closing would take
                    // the only thing saying so with it.
                    void onExportGif();
                  }}
                  type="button"
                >
                  <Film size={16} aria-hidden="true" />
                  <span className="export-option-name">GIF</span>
                  <span className="export-option-note">
                    {exportingGif
                      ? 'Rendering frames…'
                      : animated
                        ? 'Plays the entrances, 1200 × 800, on the background colour'
                        : 'Give a layer an entrance first'}
                  </span>
                </button>
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
                const label = row.kind === 'group' ? `Group of ${row.items.length}` : itemLabel(row.item, index);
                return (
                  // A row, not a button: it holds two of them. The animation
                  // control cannot be nested inside the row's own button, and
                  // making the whole row open the dialog would cost the click
                  // that selects a layer.
                  <div
                    className="layer-row"
                    data-active={ids.every((id) => selectedIdSet.has(id))}
                    data-group={row.kind === 'group' || undefined}
                    key={row.id}
                  >
                    <button
                      className="layer-select"
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
                      {row.kind === 'group' && <Group size={13} aria-hidden="true" />}
                      <span className="layer-name">{label}</span>
                    </button>
                    {/* A group is one thing everywhere else -- it moves,
                        scales and rotates as one -- so it gets one entrance
                        that every member plays, rather than a control per
                        member the list does not have room to show. The first
                        write takes the history snapshot and the rest ride
                        along, so setting a group's entrance is one undo step
                        however many items are in it. */}
                    <AnimationControl
                      animation={row.kind === 'group' ? sharedAnimation(row.items) : row.item.animation}
                      label={label}
                      onChange={(animation, record) =>
                        ids.forEach((id, member) => onSetItemAnimation(id, animation, record && member === 0))
                      }
                    />
                  </div>
                );
              })
            )}
          </div>
        </Field>
      </div>
    </aside>
  );
}

/**
 * The per-layer entrance control from the Layers list: a button that says
 * whether this layer animates, and a dialog to set what it does, how long it
 * takes and how long it waits.
 *
 * The delay is the "order" -- rather than a position in a sequence, because a
 * number of seconds says the same thing while also letting two layers arrive
 * together, and it is the number the animation actually runs on.
 */
function AnimationControl({
  animation,
  label,
  onChange,
}: {
  animation: ItemAnimation | undefined;
  label: string;
  onChange: (animation: ItemAnimation | null, record?: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = animation ?? DEFAULT_ANIMATION;

  // A range input fires a change per step of a drag, and each one that took a
  // history entry would be a separate undo step -- a single drag across the
  // delay slider is a hundred of them, against a history that holds fifty, so
  // it would push every real edit out of the stack. The first change of a
  // gesture records, the rest ride on that snapshot, and the gesture ends when
  // the pointer or the key comes up. That is the same shape as dragging an
  // item on the canvas, which snapshots once at pointer-down.
  const midGesture = useRef(false);
  // Pointer up, key up, blur, or a gesture the browser cancels out from under
  // a touch drag -- any of which mean the next change starts a new undo step.
  const endGesture = () => {
    midGesture.current = false;
  };
  const slide = (next: ItemAnimation) => {
    const record = !midGesture.current;
    midGesture.current = true;
    onChange(next, record);
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger
        className="layer-animate"
        data-on={animation ? true : undefined}
        aria-label={animation ? `Edit animation for ${label}` : `Add animation to ${label}`}
        title={animation ? animationLabel(animation.kind) : 'Add animation'}
      >
        <Sparkles size={14} aria-hidden="true" />
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="dialog-backdrop" />
        <Dialog.Popup className="dialog-popup">
          <Dialog.Title className="dialog-title">Animate {label}</Dialog.Title>
          <Dialog.Description className="dialog-description">
            Plays when you press Play, and in the exported SVG when it is opened in a browser.
          </Dialog.Description>

          <div className="animation-kinds">
            {ANIMATION_KINDS.map((kind) => (
              <button
                className="size-option"
                data-active={animation ? kind === animation.kind : undefined}
                key={kind}
                onClick={() => onChange({ ...current, kind })}
                type="button"
              >
                <span className="size-option-scale">{animationLabel(kind)}</span>
                {animation && kind === animation.kind && <Check size={14} aria-hidden="true" />}
              </button>
            ))}
          </div>

          <label className="animation-field">
            <span>
              Duration <strong>{current.duration.toFixed(1)}s</strong>
            </span>
            <input
              max={MAX_DURATION}
              min={MIN_DURATION}
              onBlur={endGesture}
              onChange={(event) => slide({ ...current, duration: Number(event.target.value) })}
              onKeyUp={endGesture}
              onPointerCancel={endGesture}
              onPointerUp={endGesture}
              step={0.1}
              type="range"
              value={current.duration}
            />
          </label>

          <label className="animation-field">
            <span>
              Starts after <strong>{current.delay.toFixed(1)}s</strong>
            </span>
            <input
              max={MAX_DELAY}
              min={MIN_DELAY}
              onBlur={endGesture}
              onChange={(event) => slide({ ...current, delay: Number(event.target.value) })}
              onKeyUp={endGesture}
              onPointerCancel={endGesture}
              onPointerUp={endGesture}
              step={0.1}
              type="range"
              value={current.delay}
            />
          </label>

          <div className="dialog-footer">
            <button
              className="dialog-close"
              disabled={!animation}
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
              type="button"
            >
              Remove
            </button>
            <Dialog.Close className="dialog-close">Done</Dialog.Close>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
