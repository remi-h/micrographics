import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Accounts are optional. A deployment with these two variables unset has no
// client, and the editor is what it was before accounts: one canvas, kept in
// the browser. Both values are public by design -- they are sent to every
// browser -- and what protects the data is row-level security in the database
// (see supabase/migrations).
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** Where the client keeps the session in localStorage. */
export const AUTH_STORAGE_KEY = 'micrographics.auth';

let client: SupabaseClient | null | undefined;

/** The Supabase client, or `null` when this deployment has no accounts. */
export function getSupabase(): SupabaseClient | null {
  if (client !== undefined) return client;
  client =
    url && key && typeof window !== 'undefined'
      ? createClient(url, key, {
          auth: { flowType: 'pkce', storageKey: AUTH_STORAGE_KEY },
        })
      : null;
  return client;
}

export const accountsEnabled = Boolean(url && key);
