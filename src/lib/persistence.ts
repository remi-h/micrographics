import { ANIMATION_KINDS, MAX_DURATION, MIN_DELAY, MIN_DURATION, type ItemAnimation } from './animations';
import { palettes } from '../data';
import { normalizeGroups } from './groups';
import { inheritedTiming, resolveGroupTiming } from './groupTiming';
import type { CanvasItem, GroupLevel, Settings, Template } from '../types';

export const STORAGE_KEY = 'micrographics.editor';

// Bump when the persisted shape changes in a way older saves cannot satisfy.
// A save carrying any other version is discarded in favour of the defaults.
export const STORAGE_VERSION = 1;

export type PersistedEditorState = {
  settings: Settings;
  canvasItems: CanvasItem[];
  // canvasZoom is a view preference rather than part of the artwork, but it is
  // persisted deliberately: coming back to a design you left zoomed in on is
  // less surprising than being snapped back to 100%. It is cheap to store and
  // harmless to drop, so an invalid value falls back to 1 instead of throwing
  // the whole save away.
  canvasZoom: number;
};

// Keyed by Template so adding a template to the union is a type error here
// until it is listed — the validator can never silently fall behind the type.
const TEMPLATE_IDS: Record<Template, true> = {
  '001': true,
  '002': true,
  '003': true,
  '004': true,
  '005': true,
  '006': true,
  '007': true,
  '008': true,
  blank: true,
};

// Object.keys returns own enumerable keys only, so nothing inherited from
// Object.prototype can reach this set. Derived from the record above so the
// exhaustiveness guarantee there still holds.
const TEMPLATE_ID_SET = new Set<string>(Object.keys(TEMPLATE_IDS));

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2.5;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function parseSettings(value: unknown): Settings | null {
  if (!isRecord(value)) return null;

  const { template, paletteIndex, backgroundImage, grid, showBackground } = value;
  // A Set of own keys, not `template in TEMPLATE_IDS`: `in` walks the
  // prototype chain, so 'toString', 'constructor' and every other
  // Object.prototype key passed validation. Such a value reaches
  // templateComponents[template]() in loadTemplateItems, which then returns a
  // string instead of an array and throws on the .map() after it — a corrupted
  // or hand-edited save was enough to crash the editor on load.
  if (typeof template !== 'string' || !TEMPLATE_ID_SET.has(template)) return null;
  if (!isFiniteNumber(paletteIndex) || !Number.isInteger(paletteIndex)) return null;
  if (paletteIndex < 0 || paletteIndex >= palettes.length) return null;
  if (backgroundImage !== null && typeof backgroundImage !== 'string') return null;
  if (typeof grid !== 'boolean' || typeof showBackground !== 'boolean') return null;

  return {
    template: template as Template,
    paletteIndex,
    backgroundImage,
    grid,
    showBackground,
  };
}

// Only the fields the current shape defines are read, and the item is rebuilt
// from them: a save written by an older version carrying fields that no longer
// exist (such as the removed per-item `tone`) still restores, minus those
// fields, rather than being thrown away with the rest of the canvas.
// Keyed off the kinds animations.ts defines, so adding one cannot leave the
// validator behind. Out-of-range timings are clamped rather than rejected: a
// duration of 400 seconds is a bad save, not a reason to lose the artwork.
const ANIMATION_KIND_SET = new Set<string>(ANIMATION_KINDS);

// How late a saved delay or how wide a saved stagger may be. Deliberately not
// the sliders' limits: nested groups add their turns together, and loose items
// grouped with their own timing carry whatever spacing they had, so a real
// canvas can hold a delay past MAX_DELAY or a stagger past MAX_STAGGER, and
// clamping those to the sliders would re-time the work on every reload. This
// only catches a save that is simply broken.
const MAX_SAVED_SECONDS = 60;

function parseAnimation(value: unknown): ItemAnimation | null {
  if (!isRecord(value)) return null;

  const { kind, duration, delay } = value;
  if (typeof kind !== 'string' || !ANIMATION_KIND_SET.has(kind)) return null;
  if (!isFiniteNumber(duration) || !isFiniteNumber(delay)) return null;

  return {
    delay: Math.min(Math.max(delay, MIN_DELAY), MAX_SAVED_SECONDS),
    duration: Math.min(Math.max(duration, MIN_DURATION), MAX_DURATION),
    kind: kind as ItemAnimation['kind'],
  };
}

// A group level: an id, and the group's own entrance and stagger if it set
// them. A save from before groups nested has a single `groupId` instead,
// which is one level with no settings of its own; `adoptLegacyTiming` below
// gives it back the entrance its members played.
function parseGroups(value: unknown, legacyGroupId: unknown): GroupLevel[] {
  if (!Array.isArray(value)) {
    return typeof legacyGroupId === 'string' && legacyGroupId.length > 0 ? [{ id: legacyGroupId }] : [];
  }
  const levels: GroupLevel[] = [];
  for (const entry of value) {
    if (!isRecord(entry) || typeof entry.id !== 'string' || entry.id.length === 0) break;
    const animation = parseAnimation(entry.animation);
    const stagger = isFiniteNumber(entry.stagger) ? Math.min(Math.max(entry.stagger, 0), MAX_SAVED_SECONDS) : 0;
    levels.push({ id: entry.id, ...(animation ? { animation } : {}), ...(stagger ? { stagger } : {}) });
  }
  return levels;
}

// Before groups stored an entrance of their own, a group's entrance was the
// one its members all played, staggered down the list. A group read back from
// such a save takes that over as its own, so its row shows it and it keeps
// playing the same way.
function adoptLegacyTiming(items: CanvasItem[], legacy: Set<string>): CanvasItem[] {
  if (legacy.size === 0) return items;

  const timing = new Map(
    [...legacy].map((id) => {
      const listed = items.filter((item) => item.groups?.[0]?.id === id).reverse();
      return [id, inheritedTiming(listed.map((item) => ({ ...item, groups: undefined })))];
    }),
  );
  return items.map((item) =>
    item.groups?.[0] && legacy.has(item.groups[0].id)
      ? { ...item, groups: [{ id: item.groups[0].id, ...timing.get(item.groups[0].id) }] }
      : item,
  );
}

function parseCanvasItem(value: unknown): CanvasItem | null {
  if (!isRecord(value)) return null;

  const { id, kind, rotate, size, x, y } = value;
  if (typeof id !== 'string' || id.length === 0) return null;
  if (!isFiniteNumber(rotate) || !isFiniteNumber(size)) return null;
  if (!isFiniteNumber(x) || !isFiniteNumber(y)) return null;

  // Grouping is newer than the saved shape, so a save from before it exists
  // simply has no groups and restores ungrouped. An unusable value is dropped
  // rather than failing the item: a lost grouping costs the user a re-group,
  // where a rejected item costs them the whole canvas.
  const parsedGroups = parseGroups(value.groups, value.groupId);
  const groups = parsedGroups.length > 0 ? { groups: parsedGroups } : null;

  // Animations are newer than the saved shape too, and are dropped on the same
  // terms and for the same reason: a lost entrance costs the user one dialog.
  const parsedAnimation = parseAnimation(value.animation);
  const animation = parsedAnimation ? { animation: parsedAnimation } : null;

  if (kind === 'symbol') {
    if (typeof value.mark !== 'string' || value.mark.length === 0) return null;
    return { ...groups, ...animation, id, kind, mark: value.mark, rotate, size, x, y };
  }

  if (kind === 'text') {
    if (typeof value.text !== 'string') return null;
    return { ...groups, ...animation, id, kind, rotate, size, text: value.text, x, y };
  }

  return null;
}

function parseCanvasItems(value: unknown): CanvasItem[] | null {
  if (!Array.isArray(value)) return null;

  const items: CanvasItem[] = [];
  // Groups saved as a bare `groupId`, from before groups nested.
  const legacy = new Set<string>();
  for (const entry of value) {
    const item = parseCanvasItem(entry);
    if (!item) return null;
    items.push(item);
    if (isRecord(entry) && !Array.isArray(entry.groups) && item.groups) legacy.add(item.groups[0].id);
  }

  // Groups come back from storage, which is the one place items arrive without
  // having gone through the operations that keep groups whole: two children
  // or more, members together, and every member agreeing where the group sits.
  // A save naming a group only one surviving item belongs to would otherwise
  // draw a "Group of 1" row nothing can be done with. Timing is then worked
  // out again from the groups, since each item's stored entrance is only a
  // copy of what its groups give it.
  return resolveGroupTiming(normalizeGroups(adoptLegacyTiming(items, legacy)));
}

function parseZoom(value: unknown): number {
  if (!isFiniteNumber(value)) return 1;
  return Math.min(Math.max(value, MIN_ZOOM), MAX_ZOOM);
}

/**
 * Reads the saved editor state. Returns `null` — meaning "use the defaults" —
 * when nothing is stored, when storage is unavailable or throws (private mode,
 * blocked site data), or when what comes back is corrupt or from another
 * version. Never throws.
 */
export function loadEditorState(): PersistedEditorState | null {
  let raw: string | null = null;

  try {
    if (typeof window === 'undefined') return null;
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }

  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!isRecord(parsed)) return null;
  if (parsed.version !== STORAGE_VERSION) return null;

  const settings = parseSettings(parsed.settings);
  const canvasItems = parseCanvasItems(parsed.canvasItems);
  if (!settings || !canvasItems) return null;

  return { settings, canvasItems, canvasZoom: parseZoom(parsed.canvasZoom) };
}

/**
 * Writes the editor state. Storage can fail for reasons the editor cannot fix
 * — quota exceeded from a large background image data URL, private mode,
 * blocked site data — so every failure is swallowed and the session simply
 * carries on in memory only. Returns whether the write landed.
 */
export function saveEditorState(state: PersistedEditorState): boolean {
  try {
    if (typeof window === 'undefined') return false;
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: STORAGE_VERSION,
        settings: state.settings,
        canvasItems: state.canvasItems,
        canvasZoom: state.canvasZoom,
      }),
    );
    return true;
  } catch {
    return false;
  }
}
