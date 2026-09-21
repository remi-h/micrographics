import { palettes } from './data';
import type { CanvasItem, Settings, Template } from './types';

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
function parseCanvasItem(value: unknown): CanvasItem | null {
  if (!isRecord(value)) return null;

  const { id, kind, rotate, size, x, y } = value;
  if (typeof id !== 'string' || id.length === 0) return null;
  if (!isFiniteNumber(rotate) || !isFiniteNumber(size)) return null;
  if (!isFiniteNumber(x) || !isFiniteNumber(y)) return null;

  if (kind === 'symbol') {
    if (typeof value.mark !== 'string' || value.mark.length === 0) return null;
    return { id, kind, mark: value.mark, rotate, size, x, y };
  }

  if (kind === 'text') {
    if (typeof value.text !== 'string') return null;
    return { id, kind, rotate, size, text: value.text, x, y };
  }

  return null;
}

function parseCanvasItems(value: unknown): CanvasItem[] | null {
  if (!Array.isArray(value)) return null;

  const items: CanvasItem[] = [];
  for (const entry of value) {
    const item = parseCanvasItem(entry);
    if (!item) return null;
    items.push(item);
  }

  return items;
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
