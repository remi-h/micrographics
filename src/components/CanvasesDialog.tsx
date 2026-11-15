import { useRef, useState, type FormEvent } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { Check, FolderOpen, Pencil, Plus, Trash2, X } from 'lucide-react';
import type { Account } from '../hooks/useAccount';
import { MAX_CANVAS_NAME_LENGTH } from '../lib/cloud';

function savedOn(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

// Every saved canvas in the account: save what is on screen under a name,
// open another, rename or delete one, or start a new one.
export function CanvasesDialog({
  account,
  email,
  hasArtwork,
}: {
  account: Account;
  email: string | null;
  hasArtwork: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const { current } = account;

  const run = async (action: () => Promise<boolean>) => {
    setBusy(true);
    try {
      return await action();
    } finally {
      setBusy(false);
    }
  };

  // A draft exists nowhere but this browser, so replacing it is the one step
  // here that can lose work. A saved canvas is written before it is left.
  const mayReplace = () =>
    current !== null ||
    !hasArtwork ||
    window.confirm('The canvas on screen has not been saved to your account. Replace it anyway?');

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (await run(() => account.saveAsNew(name))) setName('');
  };

  const openCanvas = async (id: string) => {
    if (id === current?.id) return setOpen(false);
    if (!mayReplace()) return;
    if (await run(() => account.openCanvas(id))) setOpen(false);
  };

  const startNew = async () => {
    if (!mayReplace()) return;
    if (await run(account.startNew)) setOpen(false);
  };

  const rename = async (event: FormEvent) => {
    event.preventDefault();
    if (!renaming) return;
    if (await run(() => account.renameCanvas(renaming.id, renaming.name))) setRenaming(null);
  };

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        setRenaming(null);
        setConfirmingDelete(null);
        account.clearError();
      }}
    >
      <Dialog.Trigger className="account-button">
        <FolderOpen size={15} aria-hidden="true" />
        Canvases
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="dialog-backdrop" />
        {/* Focus starts in the name field: on a button, Backspace and the
            other editing keys would reach the canvas's shortcuts behind the
            dialog, which only stand down for text fields. */}
        <Dialog.Popup className="dialog-popup canvases-dialog" initialFocus={nameRef}>
          <Dialog.Title className="dialog-title">Your canvases</Dialog.Title>
          <Dialog.Description className="dialog-description">
            {current
              ? `You are editing “${current.name}”. Changes to it are saved to your account as you work.`
              : 'The canvas on screen is kept in this browser only. Save it to your account to keep it and come back to it from anywhere.'}
            {email ? ` Signed in as ${email}.` : ''}
          </Dialog.Description>

          <form className="canvases-save" onSubmit={save}>
            <input
              aria-label="Canvas name"
              className="text-input"
              maxLength={MAX_CANVAS_NAME_LENGTH}
              onChange={(event) => setName(event.target.value)}
              placeholder={current ? 'Name for a copy' : 'Name this canvas'}
              ref={nameRef}
              value={name}
            />
            {/* Not before the account has loaded: the list this adds to is not there yet. */}
            <button className="add-button" disabled={busy || !account.loaded || !name.trim()} type="submit">
              {current ? 'Save a copy' : 'Save canvas'}
            </button>
          </form>

          <div className="canvases-note" role="alert">
            {account.error}
          </div>

          {account.canvases.length === 0 ? (
            <p className="canvases-empty">{account.loaded ? 'No saved canvases yet.' : 'Loading…'}</p>
          ) : (
            <ul className="canvases-list" aria-label="Saved canvases">
              {account.canvases.map((canvas) => {
                const isCurrent = canvas.id === current?.id;
                if (renaming?.id === canvas.id) {
                  return (
                    <li className="canvases-row" key={canvas.id}>
                      <form className="canvases-rename" onSubmit={rename}>
                        <input
                          aria-label={`New name for ${canvas.name}`}
                          autoFocus
                          className="text-input"
                          maxLength={MAX_CANVAS_NAME_LENGTH}
                          onChange={(event) => setRenaming({ id: canvas.id, name: event.target.value })}
                          value={renaming.name}
                        />
                        <button
                          aria-label="Save name"
                          className="canvases-icon"
                          disabled={busy || !renaming.name.trim()}
                          type="submit"
                        >
                          <Check size={15} aria-hidden="true" />
                        </button>
                        <button
                          aria-label="Cancel rename"
                          className="canvases-icon"
                          onClick={() => setRenaming(null)}
                          type="button"
                        >
                          <X size={15} aria-hidden="true" />
                        </button>
                      </form>
                    </li>
                  );
                }
                return (
                  <li className="canvases-row" data-current={isCurrent} key={canvas.id}>
                    <button
                      aria-current={isCurrent ? 'true' : undefined}
                      className="canvases-open"
                      disabled={busy}
                      onClick={() => void openCanvas(canvas.id)}
                      type="button"
                    >
                      <span className="canvases-name">{canvas.name}</span>
                      <span className="canvases-date">{isCurrent ? 'Open now' : savedOn(canvas.updatedAt)}</span>
                    </button>
                    {confirmingDelete === canvas.id ? (
                      <>
                        <button
                          className="canvases-confirm"
                          disabled={busy}
                          onClick={() =>
                            void run(() => account.deleteCanvas(canvas.id)).then(() => setConfirmingDelete(null))
                          }
                          type="button"
                        >
                          Delete for good
                        </button>
                        <button
                          aria-label="Keep canvas"
                          className="canvases-icon"
                          onClick={() => setConfirmingDelete(null)}
                          type="button"
                        >
                          <X size={15} aria-hidden="true" />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          aria-label={`Rename ${canvas.name}`}
                          className="canvases-icon"
                          disabled={busy}
                          onClick={() => setRenaming({ id: canvas.id, name: canvas.name })}
                          title="Rename"
                          type="button"
                        >
                          <Pencil size={15} aria-hidden="true" />
                        </button>
                        <button
                          aria-label={`Delete ${canvas.name}`}
                          className="canvases-icon"
                          disabled={busy}
                          onClick={() => setConfirmingDelete(canvas.id)}
                          title="Delete"
                          type="button"
                        >
                          <Trash2 size={15} aria-hidden="true" />
                        </button>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          <div className="canvases-footer">
            <button
              className="stage-footer-button"
              disabled={busy || !account.loaded}
              onClick={() => void startNew()}
              type="button"
            >
              <Plus size={14} aria-hidden="true" />
              New canvas
            </button>
            <Dialog.Close className="dialog-close">Close</Dialog.Close>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
