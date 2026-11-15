import { LogIn, LogOut } from 'lucide-react';
import type { Account } from '../hooks/useAccount';
import type { Auth } from '../hooks/useAuth';
import { CanvasesDialog } from './CanvasesDialog';

// The account's place in the left panel: a way in when signed out; signed in,
// which saved canvas is on screen, whether it has been saved, and the way to
// the others. Renders nothing on a deployment without accounts.
export function AccountBar({
  account,
  auth,
  hasArtwork,
}: {
  account: Account;
  auth: Auth;
  /** Whether there is anything on the canvas to lose by replacing it. */
  hasArtwork: boolean;
}) {
  if (auth.status === 'disabled') return null;

  // Signed out and signed in are laid out the same -- two lines of text over a
  // row of buttons -- and that frame is held, empty, while the session is
  // still being read. The toolbar below it therefore never moves: a row that
  // appeared a moment after the page did would slide the toolbar out from
  // under a click already on its way.
  if (auth.status !== 'signedIn') {
    const loading = auth.status === 'loading';
    return (
      <div className="account-bar" aria-busy={loading || undefined}>
        <p className="account-note account-intro" role={auth.error ? 'alert' : undefined}>
          {loading ? null : (auth.error ?? 'Sign in to save canvases and add your own symbols.')}
        </p>
        <button
          className="account-button account-sign-in"
          onClick={auth.signIn}
          style={loading ? { visibility: 'hidden' } : undefined}
          type="button"
        >
          <LogIn size={15} aria-hidden="true" />
          Sign in with Google
        </button>
      </div>
    );
  }

  const status = !account.loaded
    ? 'Loading your account…'
    : !account.current
      ? 'Only in this browser'
      : account.saveStatus === 'saving'
        ? 'Saving…'
        : account.saveStatus === 'error'
          ? 'Not saved — will retry on the next change'
          : 'Saved to your account';

  return (
    <div className="account-bar">
      <div className="account-canvas">
        <span className="account-canvas-name">{account.current?.name ?? 'Unsaved canvas'}</span>
        <span className="account-note" data-state={account.current ? account.saveStatus : undefined} role="status">
          {status}
        </span>
      </div>
      <div className="account-actions">
        <CanvasesDialog account={account} email={auth.user?.email ?? null} hasArtwork={hasArtwork} />
        <button
          aria-label="Sign out"
          className="account-button account-sign-out"
          onClick={auth.signOut}
          title={auth.user?.email ? `Sign out ${auth.user.email}` : 'Sign out'}
          type="button"
        >
          <LogOut size={15} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
