import { useRef, useState, type DragEvent } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { Select } from '@base-ui/react/select';
import { Toolbar } from '@base-ui/react/toolbar';
import { Check, ChevronDown, ChevronRight, Download, FileCode2, Film, Group, RefreshCcw, Shuffle, Sparkles, Trash2, Undo2, Redo2 } from 'lucide-react';
import {
  ANIMATION_KINDS,
  DEFAULT_ANIMATION,
  MAX_DELAY,
  MAX_DURATION,
  MIN_DELAY,
  MIN_DURATION,
  animationLabel,
  animationRunTime,
  MAX_STAGGER,
  type ItemAnimation,
} from '../lib/animations';
import { templates } from '../data';
import { findRow, groupActions, layerRows, rowItemIds, type LayerRow } from '../lib/groups';
import { EXPORT_SCALES, exportPixelSize, type ExportScale } from '../lib/exportMarkup';
import type { CanvasItem, GroupLevel, Template } from '../types';
import { BrandIcon } from './BrandIcon';
import { Field, ToolButton } from './Controls';
import { GroupMenu } from './GroupMenu';

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
  onReorderGroupChild,
  onReorderLayer,
  onRestartTemplate,
  onSelectItem,
  onSelectItems,
  onSetGroupAnimation,
  onSetItemAnimations,
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
  onReorderGroupChild: (groupId: string, childId: string, gap: number) => void;
  onReorderLayer: (rowId: string, gap: number) => void;
  onRestartTemplate: () => void;
  onSelectItem: (id: string, additive: boolean) => void;
  onSelectItems: (ids: string[], additive?: boolean) => void;
  onSetGroupAnimation: (groupId: string, animation: ItemAnimation | null, stagger: number, record?: boolean) => void;
  onSetItemAnimations: (updates: Array<{ id: string; animation: ItemAnimation | null }>, record?: boolean) => void;
  onGroupSelected: () => void;
  onUngroupSelected: () => void;
  onUndo: () => void;
}) {
  const selectedIdSet = new Set(selectedIds);
  const rows = layerRows(canvasItems);
  const { canGroup, canUngroup } = groupActions(canvasItems, selectedIds);
  // Which groups are open to show what is inside them, by group id, at any
  // depth. View state for this panel only: not part of the drawing, not
  // persisted, and not undoable.
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const toggleExpanded = (groupId: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  // What is being dragged in the list -- a whole row, or one child of an open
  // group (an item or a group inside it) among its siblings -- and the gap it
  // would land in if dropped now, counted topmost first as `moveRow` and
  // `moveChild` count it. Null gap while the pointer is somewhere a drop would
  // do nothing.
  const [drag, setDrag] = useState<
    { kind: 'row'; id: string; gap: number | null } | { kind: 'child'; id: string; groupId: string; gap: number | null } | null
  >(null);
  // A child drags among its siblings, as its open group lists them.
  const dragParent = drag?.kind === 'child' ? findRow(rows, drag.groupId) : undefined;
  const dragList = drag?.kind === 'child' ? (dragParent?.kind === 'group' ? dragParent.children : []) : rows;
  const dragFrom = drag ? dragList.findIndex((entry) => entry.id === drag.id) : -1;
  // A drop just above or just below the dragged layer leaves it where it is,
  // so no line is drawn there: a line promises a move.
  const dropGap = drag && drag.gap !== null && drag.gap !== dragFrom && drag.gap !== dragFrom + 1 ? drag.gap : null;
  const rowDropGap = drag?.kind === 'row' ? dropGap : null;
  const dropInList = (event: DragEvent) => {
    if (!drag) return;
    event.preventDefault();
    if (dropGap !== null) {
      if (drag.kind === 'row') onReorderLayer(drag.id, dropGap);
      else onReorderGroupChild(drag.groupId, drag.id, dropGap);
    }
    setDrag(null);
  };
  const groupLabel = (row: Extract<LayerRow, { kind: 'group' }>) => `Group of ${row.children.length}`;

  /**
   * What an open group lists: its children, topmost first -- items, and the
   * groups inside it, each of which can be opened in turn. Everything in here
   * selects the whole outermost group (`selectRow`): a group is never
   * half-selected, anywhere. The disclosure is for seeing what is inside, not
   * for splitting it -- that is Ungroup. Dragging a child moves it among its
   * siblings, in front of or behind them, and never out of its group.
   */
  const renderChildren = (
    group: Extract<LayerRow, { kind: 'group' }>,
    selectRow: (additive: boolean) => void,
    ids: string[],
    // The entrance this group plays, its own or the nearest from around it.
    styled: ItemAnimation | undefined,
  ) => {
    const childDropGap = drag?.kind === 'child' && drag.groupId === group.groupId ? dropGap : null;
    const dropAt = (place: number) =>
      childDropGap === place
        ? 'before'
        : childDropGap === group.children.length && place === group.children.length - 1
          ? 'after'
          : undefined;
    const startDrag = (event: DragEvent, child: LayerRow, label: string) => {
      // Only the child itself drags: a drag begun inside it -- in a group's
      // own children, or its portalled animation dialog -- is not this one.
      if (event.target !== event.currentTarget && !(event.currentTarget as Element).contains(event.target as Node)) return;
      event.stopPropagation();
      event.dataTransfer.effectAllowed = 'move';
      // Firefox starts no drag without data; see the row.
      event.dataTransfer.setData('text/plain', label);
      setDrag({ kind: 'child', id: child.id, groupId: group.groupId, gap: null });
    };
    const select = (event: { shiftKey: boolean; metaKey: boolean; ctrlKey: boolean }) =>
      selectRow(event.shiftKey || event.metaKey || event.ctrlKey);
    const selectOnContext = () => {
      if (!ids.every((id) => selectedIdSet.has(id))) selectRow(false);
    };

    return (
      <div
        className="layer-members"
        onDragOver={(event) => {
          // Only a child of this group lands here; anything else carries on
          // out to the group around this one, or to the entry, which places
          // rows.
          if (drag?.kind !== 'child' || drag.groupId !== group.groupId) return;
          event.preventDefault();
          event.stopPropagation();
          event.dataTransfer.dropEffect = 'move';
          // The gap is how many children's middles are above the pointer, so
          // the 4px between two of them counts as the gap it looks like, not
          // as nowhere. Direct children only: an open group inside counts as
          // one child, however much of it is showing.
          const gap = [...event.currentTarget.children].filter((node) => {
            const box = node.getBoundingClientRect();
            return box.top + box.height / 2 < event.clientY;
          }).length;
          if (gap !== drag.gap) setDrag({ ...drag, gap });
        }}
      >
        {group.children.map((child, place) => {
          const dragging = (drag?.kind === 'child' && drag.id === child.id) || undefined;
          if (child.kind === 'item') {
            const label = itemLabel(child.item, canvasItems.indexOf(child.item));
            return (
              <button
                className="layer-member layer-child"
                data-active={selectedIdSet.has(child.id)}
                data-dragging={dragging}
                data-drop={dropAt(place)}
                draggable
                key={child.id}
                onClick={select}
                onContextMenu={selectOnContext}
                onDragEnd={() => setDrag(null)}
                onDragStart={(event) => startDrag(event, child, label)}
                type="button"
              >
                <span className="layer-name">{label}</span>
              </button>
            );
          }
          const label = groupLabel(child);
          const open = expanded.has(child.groupId);
          return (
            <div className="layer-child" data-drop={dropAt(place)} key={child.id}>
              <div
                className="layer-subgroup"
                data-active={child.items.every((item) => selectedIdSet.has(item.id))}
                data-dragging={dragging}
                draggable
                onDragEnd={() => setDrag(null)}
                onDragStart={(event) => startDrag(event, child, label)}
              >
                <button
                  aria-expanded={open}
                  aria-label={open ? 'Hide the layers in this group' : 'Show the layers in this group'}
                  className="layer-disclosure"
                  onClick={() => toggleExpanded(child.groupId)}
                  type="button"
                >
                  {open ? <ChevronDown size={14} aria-hidden="true" /> : <ChevronRight size={14} aria-hidden="true" />}
                </button>
                <button className="layer-select" onClick={select} onContextMenu={selectOnContext} type="button">
                  <Group size={13} aria-hidden="true" />
                  <span className="layer-name">{label}</span>
                </button>
                <GroupAnimationControl
                  groupId={child.groupId}
                  hasInnerGroups={child.children.some((grandchild) => grandchild.kind === 'group')}
                  inherited={styled}
                  label={label}
                  level={child.level}
                  onSetGroupAnimation={onSetGroupAnimation}
                />
              </div>
              {open && renderChildren(child, selectRow, ids, child.level.animation ?? styled)}
            </div>
          );
        })}
      </div>
    );
  };
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
          {/* Right-click for Group / Ungroup. The menu acts on the selection
              after the right-click has picked its row, so it is always about
              the layer under the pointer. */}
          <GroupMenu
            canGroup={canGroup}
            canUngroup={canUngroup}
            className="layer-list"
            onGroup={onGroupSelected}
            onUngroup={onUngroupSelected}
          >
            {rows.length === 0 ? (
              <div className="empty-layer">No symbols or text</div>
            ) : (
              // The drop is taken here rather than on each row so that
              // letting go in the space between two rows still lands in the
              // gap the line is showing. The rows only work out which gap.
              <div
                className="layer-stack"
                onDragOver={(event) => {
                  if (!drag) return;
                  event.preventDefault();
                  event.dataTransfer.dropEffect = 'move';
                }}
                onDragLeave={(event) => {
                  // Left the list altogether, not just one row for the next:
                  // a drop out there does nothing, so the line has to go
                  // rather than keep promising a move.
                  if (!drag || event.currentTarget.contains(event.relatedTarget as Node | null)) return;
                  setDrag({ ...drag, gap: null });
                }}
                onDrop={dropInList}
              >
                {rows.map((row, index) => {
                  const ids = rowItemIds(row);
                  const label = row.kind === 'group' ? groupLabel(row) : itemLabel(row.item, index);
                  const open = row.kind === 'group' && expanded.has(row.groupId);
                  const selectRow = (additive: boolean) => {
                    // A group row stands for several items, so it goes through
                    // the whole-set selector rather than the single-item one;
                    // both honour the modifier, so a selection spanning two
                    // groups can still be built here.
                    if (row.kind === 'group') onSelectItems(ids, additive);
                    else onSelectItem(row.id, additive);
                  };
                  return (
                    // One entry per row: its number, the row, and -- for an open
                    // group -- the layers inside it. The number sits outside the
                    // row because it numbers the place in the stack, not the
                    // layer: drag a layer and the numbers stay put while the
                    // layers move past them.
                    <div
                      className="layer-entry"
                      data-drop={
                        rowDropGap === index
                          ? 'before'
                          : rowDropGap === rows.length && index === rows.length - 1
                            ? 'after'
                            : undefined
                      }
                      key={row.id}
                      onDragOver={(event) => {
                        if (!drag) return;
                        // A child dragged out of its group's list is over no
                        // place it can go: it only moves among its siblings.
                        // (Over that list, the list takes the event first.)
                        if (drag.kind === 'child') {
                          if (drag.gap !== null) setDrag({ ...drag, gap: null });
                          return;
                        }
                        // Which half of the entry the pointer is in picks the gap
                        // above or below it. The whole entry, so an open group
                        // with its layers listed counts as one thing to drop
                        // around: nothing can be dropped *into* a group.
                        const box = event.currentTarget.getBoundingClientRect();
                        const gap = event.clientY < box.top + box.height / 2 ? index : index + 1;
                        if (gap !== drag.gap) setDrag({ ...drag, gap });
                      }}
                    >
                      <span className="layer-index">{String(rows.length - index).padStart(2, '0')}</span>
                      {/* A row, not a button: it holds two of them. The
                        animation control cannot be nested inside the row's own
                        button, and making the whole row open the dialog would
                        cost the click that selects a layer.
                        The whole row is the drag handle. A drag only starts
                        once the pointer moves with the button held, so a
                        plain click still selects. */}
                      <div
                        className="layer-row"
                        data-active={ids.every((id) => selectedIdSet.has(id))}
                        data-dragging={(drag?.kind === 'row' && drag.id === row.id) || undefined}
                        data-group={row.kind === 'group' || undefined}
                        data-open={open || undefined}
                        draggable
                        onDragEnd={() => setDrag(null)}
                        onDragStart={(event) => {
                          // React bubbles events along the component tree, so
                          // a drag begun in the animation dialog -- portalled
                          // out of the row but still its child in React --
                          // would arrive here too. Only the row itself drags.
                          if (!event.currentTarget.contains(event.target as Node)) return;
                          event.dataTransfer.effectAllowed = 'move';
                          // Firefox starts no drag without data. What the data
                          // says is unused: the drop reads `drag`, not this.
                          event.dataTransfer.setData('text/plain', label);
                          setDrag({ kind: 'row', id: row.id, gap: null });
                        }}
                      >
                        {row.kind === 'group' && (
                          <button
                            aria-expanded={open}
                            aria-label={open ? 'Hide the layers in this group' : 'Show the layers in this group'}
                            className="layer-disclosure"
                            onClick={() => toggleExpanded(row.groupId)}
                            type="button"
                          >
                            {open ? (
                              <ChevronDown size={14} aria-hidden="true" />
                            ) : (
                              <ChevronRight size={14} aria-hidden="true" />
                            )}
                          </button>
                        )}
                        <button
                          className="layer-select"
                          onClick={(event) => selectRow(event.shiftKey || event.metaKey || event.ctrlKey)}
                          onContextMenu={() => {
                            // Right-clicking a layer that is not selected makes
                            // it the selection, as a left click would; one that
                            // is already part of a larger selection keeps it,
                            // so several layers can be selected and grouped.
                            if (!ids.every((id) => selectedIdSet.has(id))) selectRow(false);
                          }}
                          type="button"
                        >
                          {row.kind === 'group' && <Group size={13} aria-hidden="true" />}
                          <span className="layer-name">{label}</span>
                        </button>
                        {/* A group is one thing everywhere else -- it moves,
                          scales and rotates as one -- so it gets one entrance
                          of its own rather than a control per member, plus a
                          stagger: each child starting a set time after the
                          one listed above it. A group inside it has its own,
                          on its own row. */}
                        {row.kind === 'group' ? (
                          <GroupAnimationControl
                            groupId={row.groupId}
                            hasInnerGroups={row.children.some((child) => child.kind === 'group')}
                            inherited={undefined}
                            label={label}
                            level={row.level}
                            onSetGroupAnimation={onSetGroupAnimation}
                          />
                        ) : (
                          <AnimationControl
                            animation={row.item.animation}
                            label={label}
                            onChange={(animation, record) => onSetItemAnimations([{ id: row.id, animation }], record)}
                          />
                        )}
                      </div>
                      {open && row.kind === 'group' && renderChildren(row, selectRow, ids, row.level.animation)}
                    </div>
                  );
                })}
              </div>
            )}
          </GroupMenu>
        </Field>
      </div>
    </aside>
  );
}

/**
 * A group's entrance control: the one for a single layer, plus a stagger. It
 * reads and writes the group's own settings; what that makes each member play
 * is worked out from them (see groupTiming.ts).
 */
function GroupAnimationControl({
  groupId,
  hasInnerGroups,
  inherited,
  label,
  level,
  onSetGroupAnimation,
}: {
  groupId: string;
  /** Whether groups sit inside this one, which a stagger spaces out too. */
  hasInnerGroups: boolean;
  /** The entrance a group around this one gives it, if any. */
  inherited: ItemAnimation | undefined;
  label: string;
  level: GroupLevel;
  onSetGroupAnimation: (groupId: string, animation: ItemAnimation | null, stagger: number, record?: boolean) => void;
}) {
  const stagger = level.stagger ?? 0;
  return (
    <AnimationControl
      animation={level.animation}
      label={label}
      onChange={(animation, record, nextStagger) =>
        // Remove (no entrance, no stagger given) takes the stagger with it. A
        // stagger set with no entrance of the group's own is kept: a group
        // inside another plays the outer group's entrance, staggered its way.
        onSetGroupAnimation(groupId, animation, nextStagger ?? (animation ? stagger : 0), record)
      }
      // With none of its own, the group plays the one from around it, so that
      // is what the sliders start from: nudging the duration then keeps the
      // movement the group was playing rather than switching to the default.
      fallback={inherited}
      stagger={stagger}
      // A stagger spaces out entrances: this group's, one from around it, or
      // those of groups inside it. With none of those, there is nothing for
      // it to space out, and the slider would move to no effect.
      staggerNeedsEntrance={!level.animation && !inherited && !hasInnerGroups}
    />
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
  stagger,
  staggerNeedsEntrance = false,
  fallback,
}: {
  animation: ItemAnimation | undefined;
  label: string;
  /** `stagger` comes back only from a control that was given one. */
  onChange: (animation: ItemAnimation | null, record?: boolean, stagger?: number) => void;
  /**
   * For a group: how far apart its children start. Leave it out for a
   * single layer, which has no stagger.
   */
  stagger?: number;
  /** For a group with no entrance to stagger: the stagger slider is shown disabled, with why. */
  staggerNeedsEntrance?: boolean;
  /** What the sliders start from when there is no entrance yet; the default otherwise. */
  fallback?: ItemAnimation;
}) {
  const [open, setOpen] = useState(false);
  const current = animation ?? (fallback ? { ...fallback, delay: 0 } : DEFAULT_ANIMATION);
  const seconds = stagger ?? 0;
  const [ceiling, setCeiling] = useState({ delay: MAX_DELAY, stagger: MAX_STAGGER });

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
  const slide = (next: ItemAnimation, nextStagger = seconds) => {
    const record = !midGesture.current;
    midGesture.current = true;
    onChange(next, record, nextStagger);
  };
  // The stagger alone does not choose an entrance: a group with none of its
  // own keeps none, and plays whatever a group around it gives.
  const slideStagger = (nextStagger: number) => {
    const record = !midGesture.current;
    midGesture.current = true;
    onChange(animation ?? null, record, nextStagger);
  };

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        // The sliders' ranges are fixed when the dialog opens. A delay or a
        // stagger stored past a slider's usual max stretches it to fit, and a
        // max that followed the value would shrink under the pointer as it is
        // dragged down, leaving the stored value out of reach.
        if (next) setCeiling({ delay: Math.max(MAX_DELAY, current.delay), stagger: Math.max(MAX_STAGGER, seconds) });
        setOpen(next);
      }}
    >
      <Dialog.Trigger
        className="layer-animate"
        data-on={animation ? true : undefined}
        // A group inside another plays that group's entrance: it animates,
        // so the button says so, set apart from an entrance of its own.
        data-inherited={!animation && fallback ? true : undefined}
        aria-label={
          animation
            ? `Edit animation for ${label}`
            : fallback
              ? `Edit animation for ${label}, which plays the group's around it`
              : `Add animation to ${label}`
        }
        title={
          animation
            ? animationLabel(animation.kind)
            : fallback
              ? `${animationLabel(fallback.kind)}, from the group around it`
              : 'Add animation'
        }
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
                onClick={() => onChange({ ...current, kind }, true, seconds)}
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
              // Nested groups add their turns together, so a layer can carry a
              // delay past the slider's range; the max reaches what is stored.
              max={ceiling.delay}
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

          {stagger !== undefined && (
            <label className="animation-field">
              <span>
                Each next layer <strong>+{seconds.toFixed(1)}s</strong>
              </span>
              {staggerNeedsEntrance && <span className="animation-hint">Pick an entrance to stagger the layers.</span>}
              <input
                disabled={staggerNeedsEntrance}
                // A save from before groups nested can carry a wider stagger
                // than the slider offers; a slider cannot show a value past
                // its max, so the max reaches what is stored.
                max={ceiling.stagger}
                min={0}
                onBlur={endGesture}
                onChange={(event) => slideStagger(Number(event.target.value))}
                onKeyUp={endGesture}
                onPointerCancel={endGesture}
                onPointerUp={endGesture}
                step={0.1}
                type="range"
                value={seconds}
              />
            </label>
          )}

          <div className="dialog-footer">
            <button
              className="dialog-close"
              // A group can carry a stagger with no entrance of its own; Remove
              // clears that too.
              disabled={!animation && !seconds}
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
