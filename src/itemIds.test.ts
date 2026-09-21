import { initialSettings, loadTemplateItems, templates } from './data';
import { createItemId } from './itemIds';
import { loadEditorState, saveEditorState } from './persistence';
import type { CanvasItem } from './types';

// Re-evaluates the id module the way a page reload does: a fresh module
// instance, so the sequence counter starts over and a new session token is
// drawn. Everything the previous instance minted is now "an id from an earlier
// session" — exactly what a restored save carries.
async function reloadItemIds() {
  jest.resetModules();
  const fresh = await import('./itemIds');
  return fresh.createItemId;
}

function mint(create: (kind: CanvasItem['kind']) => string, count: number) {
  const ids: string[] = [];
  for (let index = 0; index < count; index += 1) {
    ids.push(create(index % 2 === 0 ? 'symbol' : 'text'));
  }
  return ids;
}

describe('createItemId', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.resetModules();
  });

  it('mints distinct ids for items created within the same millisecond', () => {
    // The original bug in one line: ids were `${kind}-${Date.now()}`, so a
    // frozen clock handed every item the same id.
    jest.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);

    const ids = mint(createItemId, 1000);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it('mints ids persistence accepts: non-empty strings', () => {
    const id = createItemId('symbol');

    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
    expect(id.startsWith('symbol-')).toBe(true);
  });

  it('never mints an id that a template item already holds', () => {
    const templateIds = new Set(templates.flatMap((template) => loadTemplateItems(template.id).map((item) => item.id)));
    expect(templateIds.size).toBeGreaterThan(0);

    for (const id of mint(createItemId, 500)) {
      expect(templateIds.has(id)).toBe(false);
    }
  });

  it('never mints an id an item from a previous session holds, across a reload', async () => {
    // A reload the same millisecond as the last item of the previous session:
    // the counter restarting is only safe because the session token is not.
    jest.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
    const before = new Set(mint(createItemId, 200));

    const createAfterReload = await reloadItemIds();

    for (const id of mint(createAfterReload, 200)) {
      expect(before.has(id)).toBe(false);
    }
  });

  it('does not collide with items restored from localStorage after a reload', async () => {
    const restoredItem = (id: string): CanvasItem => ({
      id,
      kind: 'symbol',
      mark: 'ring',
      rotate: 0,
      size: 42,
      x: 100,
      y: 100,
    });
    jest.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
    const saved = mint(createItemId, 50).map(restoredItem);
    expect(saveEditorState({ settings: initialSettings, canvasItems: saved, canvasZoom: 1 })).toBe(true);

    const createAfterReload = await reloadItemIds();
    const restored = loadEditorState();
    // The ids survived the round trip unchanged; the validator kept them.
    expect(restored?.canvasItems.map((item) => item.id)).toEqual(saved.map((item) => item.id));

    const restoredIds = new Set(restored?.canvasItems.map((item) => item.id));
    for (const id of mint(createAfterReload, 50)) {
      expect(restoredIds.has(id)).toBe(false);
    }

    window.localStorage.clear();
  });

  it('uses crypto.randomUUID when the environment provides it', async () => {
    // jsdom does not implement randomUUID, so this branch only ever runs in a
    // browser unless it is stood up here.
    const randomUUID = jest
      .fn<string, []>()
      .mockReturnValueOnce('11111111-1111-4111-8111-111111111111')
      .mockReturnValueOnce('22222222-2222-4222-8222-222222222222');
    Object.defineProperty(globalThis.crypto, 'randomUUID', { configurable: true, value: randomUUID });

    try {
      const createFirst = await reloadItemIds();
      const createSecond = await reloadItemIds();

      expect(randomUUID).toHaveBeenCalledTimes(2);
      expect(createFirst('symbol')).toBe('symbol-11111111111141118111111111111111-1');
      expect(createSecond('symbol')).toBe('symbol-22222222222242228222222222222222-1');
    } finally {
      Reflect.deleteProperty(globalThis.crypto, 'randomUUID');
    }
  });

  it('still mints unique ids where Web Crypto is missing entirely', async () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
    Object.defineProperty(globalThis, 'crypto', { configurable: true, value: undefined });

    try {
      const createFirst = await reloadItemIds();
      const first = mint(createFirst, 50);
      const createSecond = await reloadItemIds();
      const second = mint(createSecond, 50);

      expect(new Set([...first, ...second]).size).toBe(100);
    } finally {
      if (original) Object.defineProperty(globalThis, 'crypto', original);
      else Reflect.deleteProperty(globalThis, 'crypto');
    }
  });
});
