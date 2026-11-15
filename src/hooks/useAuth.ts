import { useEffect, useState } from 'react';
import { accountsEnabled, getSupabase } from '../lib/supabase';

export type AuthUser = { id: string; email: string | null };

/**
 * `disabled`: this deployment has no accounts. `loading`: there may be a
 * session, and the client has not said yet. The editor is usable throughout;
 * only what needs an account waits on this.
 */
export type AuthStatus = 'disabled' | 'loading' | 'signedOut' | 'signedIn';

export type Auth = {
  status: AuthStatus;
  user: AuthUser | null;
  error: string | null;
  signIn: () => void;
  signOut: () => void;
};

export function useAuth(): Auth {
  const [status, setStatus] = useState<AuthStatus>(accountsEnabled ? 'loading' : 'disabled');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;

    // Fires once with the stored session (or none) and then on every change,
    // including the one that finishes a sign-in after Google redirects back.
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      const next = session?.user;
      // Kept as the same object while the id is, so a token refresh does not
      // look like a different person to the effects that depend on the user.
      setUser((current) =>
        next ? (current?.id === next.id ? current : { id: next.id, email: next.email ?? null }) : null,
      );
      setStatus(next ? 'signedIn' : 'signedOut');
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const signIn = () => {
    const supabase = getSupabase();
    if (!supabase) return;
    setError(null);
    void supabase.auth
      .signInWithOAuth({
        provider: 'google',
        // Back to the editor, not the landing page.
        options: { redirectTo: `${window.location.origin}/creator` },
      })
      .then(({ error: failure }) => {
        if (failure) setError('Could not start the Google sign-in.');
      });
  };

  const signOut = () => {
    const supabase = getSupabase();
    if (!supabase) return;
    // `local`: this browser only, so signing out here leaves other devices in.
    void supabase.auth.signOut({ scope: 'local' });
  };

  return { status, user, error, signIn, signOut };
}
