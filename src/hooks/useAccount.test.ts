import { act, renderHook, waitFor } from '@testing-library/react';
import { initialSettings } from '../data';
import * as cloud from '../lib/cloud';
import type { PersistedEditorState } from '../lib/persistence';
import type { CanvasItem } from '../types';
import { CANVAS_POINTER_KEY, useAccount } from './useAccount';
import type { Auth } from './useAuth';

jest.mock('../lib/supabase', () => ({ getSupabase: () => ({}) }));
jest.mock('../lib/cloud', () => ({
  ...jest.requireActual('../lib/cloud'),
  createCanvas: jest.fn(),
  createSymbol: jest.fn(),
  deleteCanvas: jest.fn(),
  deleteSymbol: jest.fn(),
  listCanvases: jest.fn(),
  listSymbols: jest.fn(),
  loadCanvas: jest.fn(),
  renameCanvas: jest.fn(),
  saveCanvas: jest.fn(),
}));

const api = cloud as jest.Mocked<typeof cloud>;

const USER = { id: 'user-1', email: 'ada@example.com' };
const signedIn: Auth = { status: 'signedIn', user: USER, error: null, signIn: jest.fn(), signOut: jest.fn() };
const signedOut: Auth = { ...signedIn, status: 'signedOut', user: null };

function symbol(id: string): CanvasItem {
  return { id, kind: 'symbol', mark: 'ring', rotate: 0, size: 42, x: 100, y: 200 };
}

const canvas = (id: string, updatedAt = '2026-01-01T00:00:00.000Z', name = `Canvas ${id}`) => ({ id, name, updatedAt });

function setUp(initial: { auth?: Auth; items?: CanvasItem[] } = {}) {
  const replaceEditor = jest.fn();
  const resetEditor = jest.fn();
  const hook = renderHook(
    ({ auth, items }: { auth: Auth; items: CanvasItem[] }) =>
      useAccount({
        auth,
        canvasItems: items,
        settings: initialSettings,
        getState: (): PersistedEditorState => ({ canvasItems: items, canvasZoom: 1, settings: initialSettings }),
        replaceEditor,
        resetEditor,
      }),
    { initialProps: { auth: initial.auth ?? signedIn, items: initial.items ?? [symbol('a')] } },
  );
  return { ...hook, replaceEditor, resetEditor };
}

const pointer = () => JSON.parse(window.localStorage.getItem(CANVAS_POINTER_KEY) ?? 'null');

beforeEach(() => {
  jest.useFakeTimers();
  window.localStorage.clear();
  jest.clearAllMocks();
  api.listCanvases.mockResolvedValue([]);
  api.listSymbols.mockResolvedValue([]);
});

afterEach(() => {
  jest.useRealTimers();
});

describe('useAccount', () => {
  it('loads the account once signed in, and holds nothing signed out', async () => {
    api.listCanvases.mockResolvedValue([canvas('c1')]);
    api.listSymbols.mockResolvedValue([{ id: 's1', name: 'Logo', svg: '<svg/>' }]);
    const { result, rerender } = setUp({ auth: signedOut });
    expect(result.current.loaded).toBe(false);
    expect(api.listCanvases).not.toHaveBeenCalled();

    rerender({ auth: signedIn, items: [symbol('a')] });
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.canvases).toEqual([canvas('c1')]);
    expect(result.current.symbols).toHaveLength(1);
    expect(result.current.current).toBeNull();

    rerender({ auth: signedOut, items: [symbol('a')] });
    expect(result.current.canvases).toEqual([]);
    expect(result.current.symbols).toEqual([]);
  });

  it('saves the canvas under a name, then autosaves only what changed', async () => {
    api.createCanvas.mockResolvedValue(canvas('c1', 't1'));
    api.saveCanvas.mockResolvedValue(canvas('c1', 't2'));
    const { result, rerender } = setUp();
    await waitFor(() => expect(result.current.loaded).toBe(true));

    await act(async () => {
      expect(await result.current.saveAsNew('Poster')).toBe(true);
    });
    expect(result.current.current).toEqual(canvas('c1', 't1'));
    expect(pointer()).toEqual({ userId: USER.id, id: 'c1', updatedAt: 't1' });

    // Nothing has changed since the save: no write.
    await act(async () => {
      await jest.advanceTimersByTimeAsync(2000);
    });
    expect(api.saveCanvas).not.toHaveBeenCalled();

    const edited = [symbol('a'), symbol('b')];
    rerender({ auth: signedIn, items: edited });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(2000);
    });
    expect(api.saveCanvas).toHaveBeenCalledTimes(1);
    expect(api.saveCanvas.mock.calls[0][1]).toBe('c1');
    expect(api.saveCanvas.mock.calls[0][2].canvasItems).toEqual(edited);
    expect(result.current.saveStatus).toBe('saved');
    expect(pointer().updatedAt).toBe('t2');
  });

  it('reports a failed autosave and tries again on the next change', async () => {
    api.createCanvas.mockResolvedValue(canvas('c1'));
    api.saveCanvas.mockRejectedValueOnce(new Error('offline')).mockResolvedValue(canvas('c1', 't2'));
    const { result, rerender } = setUp();
    await waitFor(() => expect(result.current.loaded).toBe(true));
    await act(async () => void (await result.current.saveAsNew('Poster')));

    rerender({ auth: signedIn, items: [symbol('b')] });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(2000);
    });
    expect(result.current.saveStatus).toBe('error');

    rerender({ auth: signedIn, items: [symbol('c')] });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(2000);
    });
    expect(result.current.saveStatus).toBe('saved');
  });

  it('writes pending changes to the canvas being left before opening another', async () => {
    const opened = { canvasItems: [symbol('z')], canvasZoom: 1, settings: initialSettings };
    api.createCanvas.mockResolvedValue(canvas('c1'));
    api.saveCanvas.mockResolvedValue(canvas('c1', 't2'));
    api.loadCanvas.mockResolvedValue({ canvas: canvas('c2'), state: opened });
    const { result, rerender, replaceEditor } = setUp();
    await waitFor(() => expect(result.current.loaded).toBe(true));
    await act(async () => void (await result.current.saveAsNew('Poster')));

    rerender({ auth: signedIn, items: [symbol('b')] });
    await act(async () => void (await result.current.openCanvas('c2')));

    expect(api.saveCanvas).toHaveBeenCalledTimes(1);
    expect(api.saveCanvas.mock.invocationCallOrder[0]).toBeLessThan(api.loadCanvas.mock.invocationCallOrder[0]);
    expect(replaceEditor).toHaveBeenCalledWith(opened);
    expect(result.current.current?.id).toBe('c2');
    expect(pointer().id).toBe('c2');

    // The opened artwork is what the account already has: no write for it.
    rerender({ auth: signedIn, items: opened.canvasItems });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(2000);
    });
    expect(api.saveCanvas).toHaveBeenCalledTimes(1);
  });

  it('carries on with the canvas this browser was editing after a reload', async () => {
    window.localStorage.setItem(CANVAS_POINTER_KEY, JSON.stringify({ userId: USER.id, id: 'c1', updatedAt: 't1' }));
    api.listCanvases.mockResolvedValue([canvas('c1', 't1')]);
    const { result, replaceEditor } = setUp();

    await waitFor(() => expect(result.current.current?.id).toBe('c1'));
    expect(api.loadCanvas).not.toHaveBeenCalled();
    expect(replaceEditor).not.toHaveBeenCalled();
  });

  it('takes the account\'s copy when the canvas was saved from elsewhere since', async () => {
    const newer = { canvasItems: [symbol('remote')], canvasZoom: 1, settings: initialSettings };
    window.localStorage.setItem(CANVAS_POINTER_KEY, JSON.stringify({ userId: USER.id, id: 'c1', updatedAt: 't1' }));
    api.listCanvases.mockResolvedValue([canvas('c1', 't9')]);
    api.loadCanvas.mockResolvedValue({ canvas: canvas('c1', 't9'), state: newer });
    const { result, replaceEditor } = setUp();

    await waitFor(() => expect(result.current.current?.id).toBe('c1'));
    expect(replaceEditor).toHaveBeenCalledWith(newer);
    expect(pointer().updatedAt).toBe('t9');
  });

  it('drops the link to a canvas that is gone or belongs to another account', async () => {
    window.localStorage.setItem(CANVAS_POINTER_KEY, JSON.stringify({ userId: 'someone-else', id: 'c1', updatedAt: 't1' }));
    api.listCanvases.mockResolvedValue([canvas('c1', 't1')]);
    const { result } = setUp();

    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.current).toBeNull();
    expect(pointer()).toBeNull();
  });

  it('keeps the artwork as a draft when the current canvas is deleted', async () => {
    api.createCanvas.mockResolvedValue(canvas('c1'));
    api.deleteCanvas.mockResolvedValue();
    const { result, rerender, resetEditor } = setUp();
    await waitFor(() => expect(result.current.loaded).toBe(true));
    await act(async () => void (await result.current.saveAsNew('Poster')));
    await act(async () => void (await result.current.deleteCanvas('c1')));

    expect(result.current.current).toBeNull();
    expect(result.current.canvases).toEqual([]);
    expect(pointer()).toBeNull();
    expect(resetEditor).not.toHaveBeenCalled();

    rerender({ auth: signedIn, items: [symbol('b')] });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(2000);
    });
    expect(api.saveCanvas).not.toHaveBeenCalled();
  });

  it('cleans an uploaded SVG before storing it, and refuses what is not one', async () => {
    api.createSymbol.mockImplementation(async (_client, name, svg) => ({ id: 's1', name, svg }));
    const { result } = setUp();
    await waitFor(() => expect(result.current.loaded).toBe(true));
    const file = (name: string, text: string) => ({ name, text: async () => text }) as unknown as File;

    await act(async () => {
      const source = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 4"><script>x()</script><rect/></svg>';
      expect(await result.current.uploadSymbol(file('my-mark.svg', source))).toBe(true);
    });
    expect(result.current.symbols).toEqual([{ id: 's1', name: 'my mark', svg: expect.not.stringContaining('script') }]);

    await act(async () => {
      expect(await result.current.uploadSymbol(file('notes.svg', 'hello'))).toBe(false);
    });
    expect(result.current.error).toMatch(/could not be read as an SVG/);
    expect(api.createSymbol).toHaveBeenCalledTimes(1);
  });

  it('forgets the link on sign-out, so the next person starts from a draft', async () => {
    api.createCanvas.mockResolvedValue(canvas('c1'));
    const { result, rerender } = setUp();
    await waitFor(() => expect(result.current.loaded).toBe(true));
    await act(async () => void (await result.current.saveAsNew('Poster')));
    expect(pointer()).not.toBeNull();

    rerender({ auth: signedOut, items: [symbol('a')] });
    expect(pointer()).toBeNull();
    expect(result.current.current).toBeNull();
  });
});
