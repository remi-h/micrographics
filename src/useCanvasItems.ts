import { useRef, useState, type Dispatch, type SetStateAction } from 'react';
import type { ItemAnimation } from './animations';
import { hitBounds, inkBounds, type Box } from './canvasGeometry';
import { createItemId } from './itemIds';
import type { CanvasItem, CanvasSymbol, CanvasText } from './types';
import { clamp } from './utils';

// Everything that creates, edits, moves or removes a canvas item.
//
// Like `useHistory`, this is a layer over state `App` still owns rather than a
// second home for it. The two hooks are peers: history has to read the canvas
// items to snapshot them, and every canvas mutator has to call
// `beginHistoryAction` before it mutates, so whichever of them owned the state
// would have to be constructed before the other could see it. Keeping
// `canvasItems`/`selectedIds` in `App` and handing both hooks the values and
// the setters breaks that cycle without a ref-indirection dance, and leaves
// the keyboard effect's dependency array naming state that is still in scope
// where it is.
//
// The transient text-entry state (the draft for the next text item, and the
// item being edited in place) is not in a history snapshot and nothing else
// reads it, so the hook does own that outright.
//
// The one thing deliberately left behind is `visibleCanvasRect`: it measures
// the artboard wrapper and the svg, DOM nodes the layout in `App` owns, so it
// is passed in as a function. Placement — which is the part worth testing —
// lives here; the measuring stays with the refs it measures.

export type UseCanvasItemsOptions = {
  canvasItems: CanvasItem[];
  selectedIds: string[];
  setCanvasItems: Dispatch<SetStateAction<CanvasItem[]>>;
  setSelectedIds: Dispatch<SetStateAction<string[]>>;
  /** Records the pre-mutation state, so the action about to run can be undone. */
  beginHistoryAction: () => void;
  /**
   * The part of the artboard the user can currently see, in canvas units, or
   * null when it cannot be measured (no layout yet, or a zero-sized svg).
   * New items are placed inside it when it is known.
   */
  visibleCanvasRect: () => Box | null;
};

/** How small an item may be dragged before it stops shrinking. */
export const MIN_ITEM_SIZE = { symbol: 16, text: 10 } as const;

/**
 * And how large. Sized against the 1200 x 800 artboard rather than picked: a
 * symbol may fill half its width and a text item a third, which is a ceiling a
 * user reaches on purpose rather than one a single drag walks into.
 */
export const MAX_ITEM_SIZE = { symbol: 600, text: 400 } as const;

export type CanvasItems = {
  addSymbol: (mark: string) => void;
  addText: () => void;
  alignSelected: (axis: 'x' | 'y') => void;
  beginTextEdit: (item: CanvasText) => void;
  cancelTextEdit: () => void;
  commitTextEdit: () => void;
  copySelected: () => void;
  cutSelected: () => void;
  distributeSelected: (axis: 'x' | 'y') => void;
  duplicateSelected: () => void;
  editingTextDraft: string;
  editingTextId: string | null;
  findOpenPosition: (width: number, height: number) => Box;
  moveItem: (id: string, x: number, y: number) => void;
  nudgeSelected: (dx: number, dy: number) => void;
  pasteClipboard: () => void;
  removeSelected: () => void;
  rotateItems: (updates: Array<{ id: string; rotate: number }>) => void;
  scaleItems: (updates: Array<{ id: string; size: number; x: number; y: number }>) => void;
  selectItem: (id: string | null, additive?: boolean) => void;
  /**
   * Gives one item an entrance, or takes its entrance away with `null`.
   *
   * `record` is how a continuous gesture stays one undo step. A slider fires a
   * change per step of the drag, and every other continuous gesture in the
   * editor -- drag, rotate, resize -- takes one snapshot as it begins and none
   * after. Pass false for the steps after the first.
   */
  setItemAnimation: (id: string, animation: ItemAnimation | null, record?: boolean) => void;
  setEditingTextDraft: Dispatch<SetStateAction<string>>;
  setTextDraft: Dispatch<SetStateAction<string>>;
  textDraft: string;
};

// The middle of what an item actually draws. Align, distribute and the scroll
// that brings a selection into view all work from this, and all three are
// judged by eye -- so it has to be the middle of the glyphs, not of the box
// the pointer grabs.
//
// It used to measure `hitBounds`, which is that grab box, and the two are not
// the same thing for text:
//
//   - the box is floored at TEXT_MIN_HIT_WIDTH so a short label stays a
//     workable mouse target, and the floor is all added on the right. "CE"
//     centred 19 units right of its own glyphs;
//   - its vertical padding is 10 above and 12 below, so every text item sat a
//     unit high;
//   - and it ignores `rotate` entirely, while the glyphs turn about the text's
//     anchor rather than about their own middle. A side label rotated 90
//     degrees centred 111 units across and 148 down from where it appears.
//
// A symbol's two boxes are identical, so nothing about symbols changes.
//
// Pure geometry, so it lives outside the hook: nothing here reads state, which
// lets effects call it without listing it as a dependency.
export function visualCenter(item: CanvasItem) {
  const bounds = inkBounds(item);
  return {
    x: bounds.x + bounds.width / 2,
    y: bounds.y + bounds.height / 2,
  };
}

// The artboard the selection is kept on, in canvas units.
const ARTBOARD = { width: 1200, height: 800 };

/**
 * Applies a set of per-item moves -- the ones align and distribute compute --
 * and keeps the result on the artboard *as a group*.
 *
 * Both used to clamp each item's own anchor into 52..1148 after moving it.
 * That undid the very relation they had just established for whichever item
 * the clamp touched, and it was the wrong box to clamp besides: a text item's
 * anchor is the left end of its line, not its middle, so an ordinary label
 * sitting near the left margin was pulled right, off the axis it had been
 * aligned to. Measured on a long label, the clamp moved it 136 units.
 *
 * Instead every item moves by exactly its own offset, and if the selection as
 * a whole then pokes past an edge, all of it shifts back by the same amount,
 * so the items stay aligned to each other. A selection too big for the
 * artboard on an axis is left where it lands on that axis: there is no
 * position that fits it, and shifting would only trade one overhang for
 * another.
 */
export function moveKeepingTogether(
  items: CanvasItem[],
  moves: Map<string, { dx: number; dy: number }>,
): Map<string, { x: number; y: number }> {
  const moved = items
    .filter((item) => moves.has(item.id))
    .map((item) => {
      const { dx, dy } = moves.get(item.id)!;
      return { box: inkBounds({ ...item, x: item.x + dx, y: item.y + dy }), dx, dy, item };
    });
  if (moved.length === 0) return new Map();

  const left = Math.min(...moved.map(({ box }) => box.x));
  const right = Math.max(...moved.map(({ box }) => box.x + box.width));
  const top = Math.min(...moved.map(({ box }) => box.y));
  const bottom = Math.max(...moved.map(({ box }) => box.y + box.height));

  const back = (low: number, high: number, limit: number) => {
    if (high - low > limit) return 0;
    if (low < 0) return -low;
    if (high > limit) return limit - high;
    return 0;
  };
  const shiftX = back(left, right, ARTBOARD.width);
  const shiftY = back(top, bottom, ARTBOARD.height);

  return new Map(
    moved.map(({ dx, dy, item }) => [item.id, { x: item.x + dx + shiftX, y: item.y + dy + shiftY }]),
  );
}

// Two entrances are the same entrance when they would play the same way. Used
// to keep a no-op out of the undo stack; an `ItemAnimation` is three flat
// fields, so this is the whole of it.
function sameAnimation(left: ItemAnimation | undefined, right: ItemAnimation | null) {
  if (!left && !right) return true;
  if (!left || !right) return false;
  return left.kind === right.kind && left.duration === right.duration && left.delay === right.delay;
}

// A copy of each item, nudged clear of the original so the user can see that
// there are now two, with ids that cannot collide with anything on the canvas.
function duplicateItems(items: CanvasItem[]) {
  return items.map((item) => ({
    ...item,
    id: createItemId(item.kind),
    x: clamp(item.x + 28, 52, 1148),
    y: clamp(item.y + 28, 48, 752),
  }));
}

export function useCanvasItems({
  canvasItems,
  selectedIds,
  setCanvasItems,
  setSelectedIds,
  beginHistoryAction,
  visibleCanvasRect,
}: UseCanvasItemsOptions): CanvasItems {
  const [textDraft, setTextDraft] = useState('MICRO');
  const [editingTextDraft, setEditingTextDraft] = useState('');
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const clipboardRef = useRef<CanvasItem[]>([]);

  const findOpenPosition = (width: number, height: number) => {
    const existing = canvasItems.map(hitBounds);
    const overlaps = (candidate: { x: number; y: number; width: number; height: number }) =>
      existing.some((item) =>
        candidate.x < item.x + item.width &&
        candidate.x + candidate.width > item.x &&
        candidate.y < item.y + item.height &&
        candidate.y + candidate.height > item.y,
      );

    const visible = visibleCanvasRect();
    if (visible) {
      const minX = clamp(visible.x + 24, 52, 1148 - width);
      const maxX = clamp(visible.x + visible.width - width - 24, minX, 1148 - width);
      const minY = clamp(visible.y + 24, 48, 752 - height);
      const maxY = clamp(visible.y + visible.height - height - 24, minY, 752 - height);
      const centerCandidate = {
        x: clamp(visible.x + visible.width / 2 - width / 2, minX, maxX),
        y: clamp(visible.y + visible.height / 2 - height / 2, minY, maxY),
        width,
        height,
      };

      if (!overlaps(centerCandidate)) return centerCandidate;

      for (let y = minY; y <= maxY; y += 48) {
        for (let x = minX; x <= maxX; x += 48) {
          const candidate = { x, y, width, height };
          if (!overlaps(candidate)) return candidate;
        }
      }

      return centerCandidate;
    }

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
      id: createItemId('symbol'),
      kind: 'symbol',
      x: position.x + position.width / 2,
      y: position.y + position.height / 2,
      size,
      rotate: 0,
      mark,
    };
    setCanvasItems((current) => [...current, item]);
    setSelectedIds([item.id]);
  };

  const addText = () => {
    const text = textDraft.trim();
    if (!text) return;
    beginHistoryAction();
    const size = 42;
    // Placed by the box it will actually hit-test as, so the slot found for it
    // is the room it takes: an item at the origin, measured, then moved so
    // its padded box lands on the free position.
    const probe = hitBounds({ id: '', kind: 'text', rotate: 0, size, text, x: 0, y: 0 });
    const position = findOpenPosition(probe.width, probe.height);
    const item: CanvasText = {
      id: createItemId('text'),
      kind: 'text',
      x: position.x - probe.x,
      y: position.y - probe.y,
      rotate: 0,
      size,
      text,
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
          // The ceilings are what a drag runs into. The old 240 was a fifth of
          // the artboard's width, which a symbol reached after about 160px of
          // pointer travel and then sat there while the user kept dragging.
          size: clamp(update.size, MIN_ITEM_SIZE[item.kind], MAX_ITEM_SIZE[item.kind]),
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

  const setItemAnimation = (id: string, animation: ItemAnimation | null, record = true) => {
    const target = canvasItems.find((item) => item.id === id);
    if (!target) return;
    // Nothing to do at all when the item already has exactly this entrance, or
    // already has none: an undo entry for a no-op reads as a broken undo, and
    // clicking the entrance that is already chosen is an easy way to make one.
    if (sameAnimation(target.animation, animation)) return;

    if (record) beginHistoryAction();
    setCanvasItems((current) =>
      current.map((item) => {
        if (item.id !== id) return item;
        if (!animation) {
          const next = { ...item };
          delete next.animation;
          return next;
        }
        return { ...item, animation };
      }),
    );
  };

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

  const alignSelected = (axis: 'x' | 'y') => {
    const selected = canvasItems.filter((item) => selectedIds.includes(item.id));
    if (selected.length < 2) return;

    beginHistoryAction();
    // The middle of the selection, not the average of its items' middles.
    // Those are the same number for two items and drift apart for three or
    // more: the average is pulled towards wherever the items are densest, so
    // aligning two clustered marks and one far one used to leave all three
    // sitting near the cluster rather than between the outer edges. The
    // bounding box is what "align centres" means in every drawing tool, and
    // it is the one a user can check by eye against the outer two items.
    const spans = selected.map((item) => {
      const box = inkBounds(item);
      return axis === 'x' ? { low: box.x, high: box.x + box.width } : { low: box.y, high: box.y + box.height };
    });
    const target = (Math.min(...spans.map((span) => span.low)) + Math.max(...spans.map((span) => span.high))) / 2;
    const moves = new Map(
      selected.map((item) => {
        const center = visualCenter(item);
        return [item.id, { dx: axis === 'x' ? target - center.x : 0, dy: axis === 'y' ? target - center.y : 0 }];
      }),
    );
    const placed = moveKeepingTogether(selected, moves);
    setCanvasItems((current) => current.map((item) => ({ ...item, ...placed.get(item.id) })));
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

    const moves = new Map(
      selected.map(({ center, item }) => {
        const target = updates.get(item.id)!;
        return [item.id, { dx: axis === 'x' ? target - center.x : 0, dy: axis === 'y' ? target - center.y : 0 }];
      }),
    );
    const placed = moveKeepingTogether(
      selected.map(({ item }) => item),
      moves,
    );
    setCanvasItems((current) => current.map((item) => ({ ...item, ...placed.get(item.id) })));
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

  return {
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
    findOpenPosition,
    moveItem,
    nudgeSelected,
    pasteClipboard,
    removeSelected,
    rotateItems,
    scaleItems,
    selectItem,
    setEditingTextDraft,
    setItemAnimation,
    setTextDraft,
    textDraft,
  };
}
