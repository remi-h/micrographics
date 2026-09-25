import { initialSettings } from './data';
import { STORAGE_KEY, STORAGE_VERSION, loadEditorState, saveEditorState, type PersistedEditorState } from './persistence';
import type { CanvasItem } from './types';

const canvasItems: CanvasItem[] = [
  { id: 'symbol-1', kind: 'symbol', mark: 'ring', rotate: 15, size: 42, x: 100, y: 200 },
  { id: 'text-1', kind: 'text', rotate: 0, size: 42, text: 'MICRO', x: 300, y: 400 },
];

const state: PersistedEditorState = {
  settings: { ...initialSettings, grid: true, paletteIndex: 1 },
  canvasItems,
  canvasZoom: 1.5,
};

function writeRaw(value: string) {
  window.localStorage.setItem(STORAGE_KEY, value);
}

describe('saveEditorState / loadEditorState', () => {
  afterEach(() => {
    window.localStorage.clear();
    jest.restoreAllMocks();
  });

  it('round-trips settings, canvas items and zoom', () => {
    expect(saveEditorState(state)).toBe(true);
    expect(loadEditorState()).toEqual(state);
  });

  it('returns null when nothing has been saved', () => {
    expect(loadEditorState()).toBeNull();
  });

  it('overwrites a previous save rather than merging with it', () => {
    saveEditorState(state);
    saveEditorState({ ...state, canvasItems: [] });

    expect(loadEditorState()?.canvasItems).toEqual([]);
  });

  it('falls back to defaults on corrupt JSON', () => {
    writeRaw('{ not json');

    expect(loadEditorState()).toBeNull();
  });

  it('falls back to defaults when the version is missing or stale', () => {
    writeRaw(JSON.stringify({ settings: state.settings, canvasItems: state.canvasItems }));
    expect(loadEditorState()).toBeNull();

    writeRaw(JSON.stringify({ version: STORAGE_VERSION + 1, settings: state.settings, canvasItems: state.canvasItems }));
    expect(loadEditorState()).toBeNull();
  });

  it('falls back to defaults when the settings do not match the current shape', () => {
    const cases: unknown[] = [
      { ...state.settings, template: '999' },
      { ...state.settings, paletteIndex: 999 },
      { ...state.settings, paletteIndex: 'first' },
      { ...state.settings, grid: 'yes' },
      { ...state.settings, backgroundImage: 42 },
      null,
    ];

    for (const settings of cases) {
      writeRaw(JSON.stringify({ version: STORAGE_VERSION, settings, canvasItems: [] }));
      expect(loadEditorState()).toBeNull();
    }
  });

  it('falls back to defaults when a canvas item does not match the current shape', () => {
    const cases: unknown[] = [
      'not-an-array',
      [{ ...canvasItems[0], kind: 'sticker' }],
      [{ ...canvasItems[0], x: 'left' }],
      [{ ...canvasItems[0], mark: undefined }],
      [{ ...canvasItems[1], text: 12 }],
      [{ ...canvasItems[0], size: Number.NaN }],
    ];

    for (const items of cases) {
      writeRaw(JSON.stringify({ version: STORAGE_VERSION, settings: state.settings, canvasItems: items }));
      expect(loadEditorState()).toBeNull();
    }
  });

  it('restores a save written before a field was removed from the item shape', () => {
    // The shape of a save from before per-item `tone` was removed, written out
    // by hand so this test keeps describing the old save even as the current
    // types move on. The canvas must come back, not be discarded as malformed.
    const legacyItems = [
      { id: 'symbol-1', kind: 'symbol', mark: 'ring', rotate: 15, size: 42, tone: 0.9, x: 100, y: 200 },
      { id: 'text-1', kind: 'text', rotate: 0, size: 42, text: 'MICRO', tone: 0.82, x: 300, y: 400 },
    ];
    writeRaw(
      JSON.stringify({
        version: STORAGE_VERSION,
        settings: state.settings,
        canvasItems: legacyItems,
        canvasZoom: 1.5,
      }),
    );

    const restored = loadEditorState();

    expect(restored).toEqual(state);
    // The dead field is dropped rather than carried forward into the editor.
    for (const item of restored?.canvasItems ?? []) {
      expect(item).not.toHaveProperty('tone');
    }
  });

  it('restores a save whose items carry unknown extra fields', () => {
    writeRaw(
      JSON.stringify({
        version: STORAGE_VERSION,
        settings: state.settings,
        canvasItems: canvasItems.map((item) => ({ ...item, somethingNew: 'ignored' })),
        canvasZoom: 1.5,
      }),
    );

    expect(loadEditorState()).toEqual(state);
  });

  it('clamps an out-of-range zoom instead of discarding the save', () => {
    writeRaw(JSON.stringify({ version: STORAGE_VERSION, settings: state.settings, canvasItems, canvasZoom: 99 }));
    expect(loadEditorState()?.canvasZoom).toBe(2.5);

    writeRaw(JSON.stringify({ version: STORAGE_VERSION, settings: state.settings, canvasItems, canvasZoom: 'big' }));
    expect(loadEditorState()?.canvasZoom).toBe(1);
  });

  // `in` walks the prototype chain, so a plain-object lookup table accepts
  // every Object.prototype key as a valid template id. Such a value survives
  // validation, reaches templateComponents[template]() in loadTemplateItems,
  // and crashes the editor there: the call returns a string, and .map() on it
  // throws. A corrupted or hand-edited save is enough to reach this.
  it.each(['toString', 'constructor', 'valueOf', 'hasOwnProperty', '__proto__'])(
    'rejects the inherited Object key %p as a template id',
    (template) => {
      writeRaw(
        JSON.stringify({
          version: STORAGE_VERSION,
          settings: { ...state.settings, template },
          canvasItems: [],
          canvasZoom: 1,
        }),
      );

      expect(loadEditorState()).toBeNull();
    },
  );

  it('survives a localStorage that throws on write', () => {
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError');
    });

    expect(() => saveEditorState(state)).not.toThrow();
    expect(saveEditorState(state)).toBe(false);
  });

  it('survives a localStorage that throws on read', () => {
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('SecurityError');
    });

    expect(() => loadEditorState()).not.toThrow();
    expect(loadEditorState()).toBeNull();
  });

  // Groups are newer than the saved shape, so the two directions that matter
  // are that a group survives a reload and that a save written before groups
  // existed still loads.
  it('round-trips a group', () => {
    const withGroup: PersistedEditorState = {
      ...state,
      canvasItems: [
        { groupId: 'group-1', id: 'symbol-1', kind: 'symbol', mark: 'ring', rotate: 0, size: 42, x: 100, y: 200 },
        { groupId: 'group-1', id: 'text-1', kind: 'text', rotate: 0, size: 42, text: 'MICRO', x: 300, y: 400 },
      ],
    };

    expect(saveEditorState(withGroup)).toBe(true);
    expect(loadEditorState()).toEqual(withGroup);
  });

  it('restores a save written before groups existed, ungrouped', () => {
    writeRaw(
      JSON.stringify({
        version: STORAGE_VERSION,
        settings: state.settings,
        canvasItems: [{ id: 'symbol-1', kind: 'symbol', mark: 'ring', rotate: 0, size: 42, x: 100, y: 200 }],
        canvasZoom: 1,
      }),
    );

    expect(loadEditorState()?.canvasItems[0].groupId).toBeUndefined();
  });

  it('drops a group id that no second item shares, rather than restoring a group of one', () => {
    writeRaw(
      JSON.stringify({
        version: STORAGE_VERSION,
        settings: state.settings,
        canvasItems: [{ groupId: 'group-1', id: 'symbol-1', kind: 'symbol', mark: 'ring', rotate: 0, size: 42, x: 100, y: 200 }],
        canvasZoom: 1,
      }),
    );

    expect(loadEditorState()?.canvasItems[0].groupId).toBeUndefined();
  });

  it('keeps the rest of an item whose group id is unusable', () => {
    writeRaw(
      JSON.stringify({
        version: STORAGE_VERSION,
        settings: state.settings,
        canvasItems: [
          { groupId: 7, id: 'symbol-1', kind: 'symbol', mark: 'ring', rotate: 0, size: 42, x: 100, y: 200 },
          { groupId: 7, id: 'symbol-2', kind: 'symbol', mark: 'ring', rotate: 0, size: 42, x: 400, y: 200 },
        ],
        canvasZoom: 1,
      }),
    );

    const loaded = loadEditorState();
    expect(loaded?.canvasItems).toHaveLength(2);
    expect(loaded?.canvasItems[0].groupId).toBeUndefined();
  });
  // Animations, like groups, are newer than the saved shape.
  it('round-trips an animation', () => {
    const animated: PersistedEditorState = {
      ...state,
      canvasItems: [{ animation: { delay: 0.4, duration: 1.2, kind: 'pop' }, id: 'symbol-1', kind: 'symbol', mark: 'ring', rotate: 0, size: 42, x: 100, y: 200 }],
    };

    expect(saveEditorState(animated)).toBe(true);
    expect(loadEditorState()).toEqual(animated);
  });

  it('restores a save written before animations existed', () => {
    expect(saveEditorState(state)).toBe(true);
    expect(loadEditorState()?.canvasItems[0].animation).toBeUndefined();
  });

  it('keeps the item when its stored animation is unusable', () => {
    writeRaw(
      JSON.stringify({
        version: STORAGE_VERSION,
        settings: state.settings,
        canvasItems: [{ animation: { kind: 'somersault', duration: 1, delay: 0 }, id: 'symbol-1', kind: 'symbol', mark: 'ring', rotate: 0, size: 42, x: 100, y: 200 }],
        canvasZoom: 1,
      }),
    );

    const loaded = loadEditorState();
    expect(loaded?.canvasItems).toHaveLength(1);
    expect(loaded?.canvasItems[0].animation).toBeUndefined();
  });

  it('clamps a stored timing rather than restoring an entrance that never ends', () => {
    writeRaw(
      JSON.stringify({
        version: STORAGE_VERSION,
        settings: state.settings,
        canvasItems: [{ animation: { kind: 'fade', duration: 4000, delay: -12 }, id: 'symbol-1', kind: 'symbol', mark: 'ring', rotate: 0, size: 42, x: 100, y: 200 }],
        canvasZoom: 1,
      }),
    );

    expect(loadEditorState()?.canvasItems[0].animation).toEqual({ delay: 0, duration: 5, kind: 'fade' });
  });
});
