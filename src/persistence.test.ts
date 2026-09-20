import { initialSettings } from './data';
import { STORAGE_KEY, STORAGE_VERSION, loadEditorState, saveEditorState, type PersistedEditorState } from './persistence';
import type { CanvasItem } from './types';

const canvasItems: CanvasItem[] = [
  { id: 'symbol-1', kind: 'symbol', mark: 'ring', rotate: 15, size: 42, tone: 0.9, x: 100, y: 200 },
  { id: 'text-1', kind: 'text', rotate: 0, size: 42, text: 'MICRO', tone: 0.82, x: 300, y: 400 },
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

  it('clamps an out-of-range zoom instead of discarding the save', () => {
    writeRaw(JSON.stringify({ version: STORAGE_VERSION, settings: state.settings, canvasItems, canvasZoom: 99 }));
    expect(loadEditorState()?.canvasZoom).toBe(2.5);

    writeRaw(JSON.stringify({ version: STORAGE_VERSION, settings: state.settings, canvasItems, canvasZoom: 'big' }));
    expect(loadEditorState()?.canvasZoom).toBe(1);
  });

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
});
