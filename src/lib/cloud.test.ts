import type { SupabaseClient } from '@supabase/supabase-js';
import { initialSettings } from '../data';
import { STORAGE_VERSION } from './persistence';
import { cleanCanvasName, createCanvas, listCanvases, loadCanvas, saveCanvas } from './cloud';

// A query builder that records the calls made on it and resolves to `result`.
function fakeClient(result: { data: unknown; error: unknown }) {
  const calls: [string, ...unknown[]][] = [];
  const builder: Record<string, unknown> = {
    then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve),
  };
  for (const method of ['select', 'insert', 'update', 'delete', 'eq', 'order', 'single']) {
    builder[method] = (...args: unknown[]) => {
      calls.push([method, ...args]);
      return builder;
    };
  }
  const client = {
    from: (table: string) => {
      calls.push(['from', table]);
      return builder;
    },
  } as unknown as SupabaseClient;
  return { calls, client };
}

const state = { canvasItems: [], canvasZoom: 1.5, settings: initialSettings };
const row = { id: 'c1', name: 'Poster', updated_at: '2026-01-01T00:00:00.000Z' };

describe('cleanCanvasName', () => {
  it('trims, caps and never returns an empty name', () => {
    expect(cleanCanvasName('  Poster  ')).toBe('Poster');
    expect(cleanCanvasName('   ')).toBe('Untitled canvas');
    expect(cleanCanvasName('x'.repeat(200))).toHaveLength(80);
  });
});

describe('canvases', () => {
  it('lists names without downloading the artwork', async () => {
    const { calls, client } = fakeClient({ data: [row], error: null });
    await expect(listCanvases(client)).resolves.toEqual([{ id: 'c1', name: 'Poster', updatedAt: row.updated_at }]);
    expect(calls).toContainEqual(['select', 'id, name, updated_at']);
  });

  it('stores the same versioned shape the browser save uses', async () => {
    const { calls, client } = fakeClient({ data: row, error: null });
    await createCanvas(client, ' Poster ', state);
    expect(calls).toContainEqual([
      'insert',
      { name: 'Poster', data: { version: STORAGE_VERSION, canvasItems: [], canvasZoom: 1.5, settings: initialSettings } },
    ]);
  });

  it('saves to the one canvas named, and fails when it is gone', async () => {
    const ok = fakeClient({ data: row, error: null });
    await saveCanvas(ok.client, 'c1', state);
    expect(ok.calls).toContainEqual(['eq', 'id', 'c1']);
    expect(ok.calls).toContainEqual(['single']);

    const gone = fakeClient({ data: null, error: { code: 'PGRST116' } });
    await expect(saveCanvas(gone.client, 'c1', state)).rejects.toThrow('Could not save the canvas.');
  });

  it('opens a canvas through the save validator', async () => {
    const data = { version: STORAGE_VERSION, canvasItems: [], canvasZoom: 9, settings: initialSettings };
    const good = fakeClient({ data: { ...row, data }, error: null });
    await expect(loadCanvas(good.client, 'c1')).resolves.toEqual({
      canvas: { id: 'c1', name: 'Poster', updatedAt: row.updated_at },
      // Out-of-range zoom is clamped, as it is for a browser save.
      state: { canvasItems: [], canvasZoom: 2.5, settings: initialSettings },
    });

    const corrupt = fakeClient({ data: { ...row, data: { version: 999 } }, error: null });
    await expect(loadCanvas(corrupt.client, 'c1')).rejects.toThrow('cannot open');
  });
});
