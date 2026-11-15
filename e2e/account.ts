import type { Page, Route } from '@playwright/test';
import { AUTH_STORAGE_KEY } from '../src/lib/supabase';

// A stand-in for the account backend. The suite's dev server is pointed at
// `/supabase` on its own origin (playwright.config.ts); this answers the
// requests the editor sends there from two in-memory tables, the way the real
// REST API would, so the specs drive the real client code end to end. Google
// itself is not in the loop: a spec starts already signed in, from a session
// seeded into the browser's storage.

export const TEST_USER = { id: '6f1c2f0e-7a51-4c58-9d1b-0d6f6a3d4a11', email: 'ada@example.com' };

type Row = Record<string, unknown> & { id: string };

export type FakeAccount = {
  canvases: Row[];
  symbols: Row[];
  /** Every write the editor sent, oldest first. */
  writes: { method: string; table: string; body: Record<string, unknown> | null }[];
};

function pick(row: Row, select: string | null) {
  if (!select || select === '*') return row;
  return Object.fromEntries(select.split(',').map((column) => [column.trim(), row[column.trim()]]));
}

/** Seeds a signed-in session and answers the account's requests. */
export async function signInWithFakeAccount(page: Page, seed: Partial<FakeAccount> = {}): Promise<FakeAccount> {
  const account: FakeAccount = { canvases: seed.canvases ?? [], symbols: seed.symbols ?? [], writes: [] };
  let clock = Date.UTC(2026, 0, 1);
  let nextId = 1;
  const now = () => new Date((clock += 1000)).toISOString();

  const session = {
    access_token: 'header.payload.signature',
    refresh_token: 'refresh',
    token_type: 'bearer',
    expires_in: 3600 * 24 * 365,
    expires_at: Math.floor(Date.now() / 1000) + 3600 * 24 * 365,
    user: {
      id: TEST_USER.id,
      email: TEST_USER.email,
      aud: 'authenticated',
      role: 'authenticated',
      app_metadata: {},
      user_metadata: {},
      created_at: '2026-01-01T00:00:00.000Z',
    },
  };
  // Only when there is none, so a spec that signs out stays signed out.
  await page.addInitScript(
    ({ key, value, flag }) => {
      if (window.localStorage.getItem(flag)) return;
      window.localStorage.setItem(flag, '1');
      window.localStorage.setItem(key, value);
    },
    { key: AUTH_STORAGE_KEY, value: JSON.stringify(session), flag: 'e2e.session-seeded' },
  );

  await page.route('**/supabase/auth/v1/**', (route) => route.fulfill({ status: 204, body: '' }));

  await page.route('**/supabase/rest/v1/**', async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    const table = url.pathname.split('/').pop() as 'canvases' | 'symbols';
    const rows = account[table];
    const select = url.searchParams.get('select');
    const idFilter = url.searchParams.get('id')?.replace(/^eq\./, '') ?? null;
    const wantsObject = (request.headers()['accept'] ?? '').includes('vnd.pgrst.object');
    const method = request.method();
    const body = method === 'POST' || method === 'PATCH' ? (request.postDataJSON() as Record<string, unknown>) : null;
    if (method !== 'GET') account.writes.push({ method, table, body });

    let matched = idFilter ? rows.filter((row) => row.id === idFilter) : [...rows];
    if (method === 'POST') {
      const row: Row = {
        ...body,
        id: `00000000-0000-4000-8000-${String(nextId++).padStart(12, '0')}`,
        user_id: TEST_USER.id,
        created_at: now(),
        updated_at: now(),
      };
      rows.push(row);
      matched = [row];
    } else if (method === 'PATCH') {
      for (const row of matched) Object.assign(row, body, { updated_at: now() });
    } else if (method === 'DELETE') {
      account[table] = rows.filter((row) => !matched.includes(row));
      return route.fulfill({ status: 204, body: '' });
    } else if (url.searchParams.get('order')?.startsWith('updated_at.desc')) {
      matched.sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
    }

    if (wantsObject) {
      if (matched.length !== 1) {
        return route.fulfill({
          status: 406,
          contentType: 'application/json',
          body: JSON.stringify({ code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' }),
        });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(pick(matched[0], select)) });
    }
    return route.fulfill({
      status: method === 'POST' ? 201 : 200,
      contentType: 'application/json',
      body: JSON.stringify(matched.map((row) => pick(row, select))),
    });
  });

  return account;
}
