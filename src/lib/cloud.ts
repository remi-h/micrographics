import type { SupabaseClient } from '@supabase/supabase-js';
import { parseEditorState, serializeEditorState, type PersistedEditorState } from './persistence';

// What an account holds: saved canvases and uploaded symbols. Each function
// takes the client so the callers decide whether there is one, and each throws
// on failure with a message fit to show.

export const MAX_CANVAS_NAME_LENGTH = 80;

export type SavedCanvas = { id: string; name: string; updatedAt: string };
export type CustomSymbol = { id: string; name: string; svg: string };

type CanvasRow = { id: string; name: string; updated_at: string };

const CANVAS_COLUMNS = 'id, name, updated_at';

function toSavedCanvas(row: CanvasRow): SavedCanvas {
  return { id: row.id, name: row.name, updatedAt: row.updated_at };
}

export function cleanCanvasName(name: string) {
  return name.trim().slice(0, MAX_CANVAS_NAME_LENGTH) || 'Untitled canvas';
}

// The list leaves `data` out: a canvas with an uploaded background is
// megabytes, and the list only shows names.
export async function listCanvases(client: SupabaseClient): Promise<SavedCanvas[]> {
  const { data, error } = await client
    .from('canvases')
    .select(CANVAS_COLUMNS)
    .order('updated_at', { ascending: false });
  if (error) throw new Error('Could not load your canvases.');
  return (data as CanvasRow[]).map(toSavedCanvas);
}

export async function createCanvas(
  client: SupabaseClient,
  name: string,
  state: PersistedEditorState,
): Promise<SavedCanvas> {
  const { data, error } = await client
    .from('canvases')
    .insert({ name: cleanCanvasName(name), data: serializeEditorState(state) })
    .select(CANVAS_COLUMNS)
    .single();
  if (error) throw new Error('Could not save the canvas.');
  return toSavedCanvas(data as CanvasRow);
}

export async function saveCanvas(
  client: SupabaseClient,
  id: string,
  state: PersistedEditorState,
): Promise<SavedCanvas> {
  // `.single()` turns "no row matched" into an error: a canvas deleted from
  // another tab must not look like a save that landed.
  const { data, error } = await client
    .from('canvases')
    .update({ data: serializeEditorState(state) })
    .eq('id', id)
    .select(CANVAS_COLUMNS)
    .single();
  if (error) throw new Error('Could not save the canvas.');
  return toSavedCanvas(data as CanvasRow);
}

export async function renameCanvas(client: SupabaseClient, id: string, name: string): Promise<SavedCanvas> {
  const { data, error } = await client
    .from('canvases')
    .update({ name: cleanCanvasName(name) })
    .eq('id', id)
    .select(CANVAS_COLUMNS)
    .single();
  if (error) throw new Error('Could not rename the canvas.');
  return toSavedCanvas(data as CanvasRow);
}

export async function deleteCanvas(client: SupabaseClient, id: string): Promise<void> {
  const { error } = await client.from('canvases').delete().eq('id', id);
  if (error) throw new Error('Could not delete the canvas.');
}

export async function loadCanvas(
  client: SupabaseClient,
  id: string,
): Promise<{ canvas: SavedCanvas; state: PersistedEditorState }> {
  const { data, error } = await client.from('canvases').select(`${CANVAS_COLUMNS}, data`).eq('id', id).single();
  if (error) throw new Error('Could not open the canvas.');
  const row = data as CanvasRow & { data: unknown };
  const state = parseEditorState(row.data);
  if (!state) throw new Error('That canvas was saved in a form this version cannot open.');
  return { canvas: toSavedCanvas(row), state };
}

export async function listSymbols(client: SupabaseClient): Promise<CustomSymbol[]> {
  const { data, error } = await client
    .from('symbols')
    .select('id, name, svg')
    .order('created_at', { ascending: true });
  if (error) throw new Error('Could not load your symbols.');
  return data as CustomSymbol[];
}

export async function createSymbol(client: SupabaseClient, name: string, svg: string): Promise<CustomSymbol> {
  const { data, error } = await client.from('symbols').insert({ name, svg }).select('id, name, svg').single();
  if (error) throw new Error('Could not add the symbol.');
  return data as CustomSymbol;
}

export async function deleteSymbol(client: SupabaseClient, id: string): Promise<void> {
  const { error } = await client.from('symbols').delete().eq('id', id);
  if (error) throw new Error('Could not delete the symbol.');
}
