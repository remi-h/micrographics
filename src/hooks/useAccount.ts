import { useEffect, useRef, useState } from 'react';
import {
  createCanvas,
  createSymbol,
  deleteCanvas,
  deleteSymbol,
  listCanvases,
  listSymbols,
  loadCanvas,
  renameCanvas,
  saveCanvas,
  type CustomSymbol,
  type SavedCanvas,
} from '../lib/cloud';
import { MAX_SYMBOL_NAME_LENGTH, sanitizeSvg, symbolNameFromFile } from '../lib/customSymbols';
import type { PersistedEditorState } from '../lib/persistence';
import { getSupabase } from '../lib/supabase';
import type { CanvasItem, Settings } from '../types';
import type { Auth } from './useAuth';

// What a signed-in user keeps in their account, and the link between the
// editor and the saved canvas it is showing.
//
// The editor always works on one canvas, autosaved to the browser as before.
// Signed in, that canvas can also be a saved one -- the "current" canvas --
// and then every change is written to the account as well, shortly after it
// is made. With no current canvas the editor is a draft that lives in the
// browser only, until it is saved under a name.

/** Which saved canvas the browser's copy belongs to, kept across reloads. */
export const CANVAS_POINTER_KEY = 'micrographics.canvas';

// Longer than the browser autosave: this one is a network request.
const CLOUD_SAVE_DEBOUNCE_MS = 1200;

type Pointer = { userId: string; id: string; updatedAt: string };

function readPointer(): Pointer | null {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(CANVAS_POINTER_KEY) ?? 'null');
    if (typeof parsed !== 'object' || parsed === null) return null;
    const { userId, id, updatedAt } = parsed as Record<string, unknown>;
    if (typeof userId !== 'string' || typeof id !== 'string' || typeof updatedAt !== 'string') return null;
    return { userId, id, updatedAt };
  } catch {
    return null;
  }
}

function writePointer(pointer: Pointer | null) {
  try {
    if (pointer) window.localStorage.setItem(CANVAS_POINTER_KEY, JSON.stringify(pointer));
    else window.localStorage.removeItem(CANVAS_POINTER_KEY);
  } catch {
    // Storage is unavailable; the link is simply not remembered past a reload.
  }
}

// What decides whether there is anything to save. Zoom is left out: it is
// stored with a canvas, but zooming alone is not an edit.
function artworkKey(state: PersistedEditorState) {
  return JSON.stringify([state.settings, state.canvasItems]);
}

export type SaveStatus = 'saved' | 'saving' | 'error';

type Library = {
  userId: string;
  canvases: SavedCanvas[];
  symbols: CustomSymbol[];
  current: SavedCanvas | null;
};

export type Account = {
  /** False until the account's canvases and symbols have been asked for. */
  loaded: boolean;
  canvases: SavedCanvas[];
  symbols: CustomSymbol[];
  /** The saved canvas the editor is showing, or `null` for a browser-only draft. */
  current: SavedCanvas | null;
  saveStatus: SaveStatus;
  /** The last thing that went wrong, worded for the user. */
  error: string | null;
  clearError: () => void;
  /** Saves what is on the canvas as a new saved canvas and makes it current. */
  saveAsNew: (name: string) => Promise<boolean>;
  openCanvas: (id: string) => Promise<boolean>;
  renameCanvas: (id: string, name: string) => Promise<boolean>;
  deleteCanvas: (id: string) => Promise<boolean>;
  /** Leaves the current canvas saved as it is and starts a fresh draft. */
  startNew: () => Promise<boolean>;
  uploadSymbol: (file: File) => Promise<boolean>;
  deleteSymbol: (id: string) => Promise<boolean>;
};

function recentFirst(canvases: SavedCanvas[], changed: SavedCanvas) {
  return [changed, ...canvases.filter((canvas) => canvas.id !== changed.id)];
}

export function useAccount({
  auth,
  canvasItems,
  settings,
  getState,
  replaceEditor,
  resetEditor,
}: {
  auth: Auth;
  /** With `settings`, what a change to means there may be something to save. */
  canvasItems: CanvasItem[];
  settings: Settings;
  /** The editor's state as of now. */
  getState: () => PersistedEditorState;
  /** Puts a saved canvas on screen in place of what is there. */
  replaceEditor: (state: PersistedEditorState) => void;
  /** Puts a fresh draft on screen. */
  resetEditor: () => void;
}): Account {
  const userId = auth.user?.id ?? null;
  // Tagged with whose it is, and read only while that user is signed in, so
  // signing out or switching accounts needs no reset.
  const [library, setLibrary] = useState<Library | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [error, setError] = useState<string | null>(null);
  const mine = library && library.userId === userId ? library : null;
  const currentId = mine?.current?.id ?? null;

  // The artwork the account last received for the current canvas.
  const savedKeyRef = useRef<string | null>(null);
  // Saves run one after another: two in flight could land out of order and
  // leave the older one in the account.
  const queueRef = useRef<Promise<unknown>>(Promise.resolve());
  const targetRef = useRef<{ userId: string; id: string } | null>(null);
  const callbacksRef = useRef({ getState, replaceEditor, resetEditor });

  useEffect(() => {
    targetRef.current = userId && currentId ? { userId, id: currentId } : null;
    callbacksRef.current = { getState, replaceEditor, resetEditor };
  });

  const patch = (owner: string, change: (current: Library) => Library) =>
    setLibrary((current) => (current && current.userId === owner ? change(current) : current));

  useEffect(() => {
    if (auth.status === 'signedOut') writePointer(null);
  }, [auth.status]);

  // Load the account once someone is signed in.
  useEffect(() => {
    const client = getSupabase();
    if (!client || !userId) return;
    let cancelled = false;

    void (async () => {
      const [canvasResult, symbolResult] = await Promise.allSettled([listCanvases(client), listSymbols(client)]);
      if (cancelled) return;
      const canvases = canvasResult.status === 'fulfilled' ? canvasResult.value : [];
      const symbols = symbolResult.status === 'fulfilled' ? symbolResult.value : [];
      let failure =
        canvasResult.status === 'rejected'
          ? 'Could not load your canvases.'
          : symbolResult.status === 'rejected'
            ? 'Could not load your symbols.'
            : null;

      // Pick up the canvas this browser was editing before the reload.
      let current: SavedCanvas | null = null;
      const pointer = readPointer();
      const row = pointer?.userId === userId ? canvases.find((canvas) => canvas.id === pointer.id) : undefined;
      if (pointer && row) {
        if (row.updatedAt === pointer.updatedAt) {
          current = row;
        } else {
          // Saved from somewhere else since: that copy is the newer one, and
          // writing the browser's over it would undo the work done there.
          try {
            const opened = await loadCanvas(client, row.id);
            if (cancelled) return;
            savedKeyRef.current = artworkKey(opened.state);
            callbacksRef.current.replaceEditor(opened.state);
            current = opened.canvas;
            writePointer({ userId, id: opened.canvas.id, updatedAt: opened.canvas.updatedAt });
          } catch {
            failure = 'Could not open the canvas you were working on.';
          }
        }
      } else if (pointer && canvasResult.status === 'fulfilled') {
        // Deleted elsewhere, or someone else's: what is on screen is a draft.
        writePointer(null);
      }

      setLibrary({ userId, canvases, symbols, current });
      setSaveStatus('saved');
      setError(failure);
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Writes the current canvas to the account if it has changed since the last
  // write. Queued, so it also serves as "wait for the pending save".
  const flush = () => {
    const run = async () => {
      const client = getSupabase();
      const target = targetRef.current;
      if (!client || !target) return;
      const state = callbacksRef.current.getState();
      const key = artworkKey(state);
      if (key === savedKeyRef.current) return;

      const stillCurrent = () => targetRef.current?.id === target.id && targetRef.current.userId === target.userId;
      setSaveStatus('saving');
      try {
        const saved = await saveCanvas(client, target.id, state);
        patch(target.userId, (current) => ({
          ...current,
          canvases: recentFirst(current.canvases, saved),
          current: current.current?.id === saved.id ? saved : current.current,
        }));
        if (!stillCurrent()) return;
        savedKeyRef.current = key;
        writePointer({ userId: target.userId, id: saved.id, updatedAt: saved.updatedAt });
        setSaveStatus('saved');
      } catch {
        if (stillCurrent()) setSaveStatus('error');
      }
    };
    queueRef.current = queueRef.current.then(run, run);
    return queueRef.current;
  };
  const flushRef = useRef(flush);
  useEffect(() => {
    flushRef.current = flush;
  });

  // Autosave the current canvas to the account.
  useEffect(() => {
    if (!userId || !currentId) return;
    const timer = window.setTimeout(() => void flushRef.current(), CLOUD_SAVE_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [canvasItems, settings, currentId, userId]);

  // Runs one account action, turning a failure into the message to show.
  const attempt = async (action: (client: NonNullable<ReturnType<typeof getSupabase>>, owner: string) => Promise<void>) => {
    const client = getSupabase();
    if (!client || !userId) return false;
    setError(null);
    try {
      await action(client, userId);
      return true;
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Something went wrong.');
      return false;
    }
  };

  const makeCurrent = (owner: string, canvas: SavedCanvas, state: PersistedEditorState) => {
    savedKeyRef.current = artworkKey(state);
    writePointer({ userId: owner, id: canvas.id, updatedAt: canvas.updatedAt });
    patch(owner, (current) => ({ ...current, canvases: recentFirst(current.canvases, canvas), current: canvas }));
    setSaveStatus('saved');
  };

  const leaveCurrent = (owner: string) => {
    savedKeyRef.current = null;
    writePointer(null);
    patch(owner, (current) => ({ ...current, current: null }));
  };

  return {
    loaded: mine !== null,
    canvases: mine?.canvases ?? [],
    symbols: mine?.symbols ?? [],
    current: mine?.current ?? null,
    saveStatus,
    error,
    clearError: () => setError(null),

    saveAsNew: (name) =>
      attempt(async (client, owner) => {
        // The canvas being left gets its last changes first.
        await flush();
        const state = callbacksRef.current.getState();
        makeCurrent(owner, await createCanvas(client, name, state), state);
      }),

    openCanvas: (id) =>
      attempt(async (client, owner) => {
        await flush();
        const opened = await loadCanvas(client, id);
        callbacksRef.current.replaceEditor(opened.state);
        makeCurrent(owner, opened.canvas, opened.state);
      }),

    renameCanvas: (id, name) =>
      attempt(async (client, owner) => {
        const renamed = await renameCanvas(client, id, name);
        patch(owner, (current) => ({
          ...current,
          canvases: current.canvases.map((canvas) => (canvas.id === id ? renamed : canvas)),
          current: current.current?.id === id ? renamed : current.current,
        }));
        // Renaming moves the row's timestamp, which the pointer has to match.
        if (targetRef.current?.id === id) writePointer({ userId: owner, id, updatedAt: renamed.updatedAt });
      }),

    deleteCanvas: (id) =>
      attempt(async (client, owner) => {
        // Let a save already under way finish, so it cannot fail against a
        // row that has just gone.
        await queueRef.current;
        await deleteCanvas(client, id);
        // What is on screen stays, as a draft in this browser.
        if (targetRef.current?.id === id) leaveCurrent(owner);
        patch(owner, (current) => ({ ...current, canvases: current.canvases.filter((canvas) => canvas.id !== id) }));
      }),

    startNew: () =>
      attempt(async (_client, owner) => {
        await flush();
        leaveCurrent(owner);
        callbacksRef.current.resetEditor();
      }),

    uploadSymbol: (file) =>
      attempt(async (client, owner) => {
        const cleaned = sanitizeSvg(await file.text());
        if (!cleaned.ok) throw new Error(cleaned.error);
        const name = symbolNameFromFile(file.name).slice(0, MAX_SYMBOL_NAME_LENGTH);
        const symbol = await createSymbol(client, name, cleaned.svg);
        patch(owner, (current) => ({ ...current, symbols: [...current.symbols, symbol] }));
      }),

    deleteSymbol: (id) =>
      attempt(async (client, owner) => {
        await deleteSymbol(client, id);
        patch(owner, (current) => ({ ...current, symbols: current.symbols.filter((symbol) => symbol.id !== id) }));
      }),
  };
}
