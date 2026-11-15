import { Fragment, useState } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { Keyboard } from 'lucide-react';
import { SHORTCUT_GROUPS } from '../data/shortcuts';
import { isApplePlatform, keyLabel } from '../lib/shortcuts';

// A "Shortcuts" button under the canvas, beside Feedback?, that lists the
// editor's keyboard and pointer shortcuts. Like Feedback? it is laptop-only:
// the stage footer it sits in is hidden below the three-column layout, and a
// phone has no keyboard to use them with.
export function ShortcutsDialog() {
  const [open, setOpen] = useState(false);
  // Read only while open: the list is never rendered on the server, so the
  // Cmd/Ctrl choice cannot mismatch during hydration.
  const apple = open && isApplePlatform(navigator.userAgent);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger className="stage-footer-button">
        <Keyboard size={14} aria-hidden="true" />
        Shortcuts
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="dialog-backdrop" />
        <Dialog.Popup className="dialog-popup shortcuts-dialog">
          <Dialog.Title className="dialog-title">Keyboard shortcuts</Dialog.Title>
          <div className="shortcuts-groups">
            {SHORTCUT_GROUPS.map((group) => (
              <section className="shortcuts-group" key={group.title} aria-label={group.title}>
                <h3 className="shortcuts-group-title">{group.title}</h3>
                <dl className="shortcuts-list">
                  {group.shortcuts.map((shortcut) => (
                    <div className="shortcuts-row" key={shortcut.label}>
                      <dt>{shortcut.label}</dt>
                      <dd>
                        {shortcut.keys.map((combo, index) => (
                          <Fragment key={combo.join('+')}>
                            {index > 0 && <span className="shortcuts-or">or</span>}
                            <span className="shortcuts-combo">
                              {combo.map((key) => (
                                <kbd key={key}>{keyLabel(key, apple)}</kbd>
                              ))}
                            </span>
                          </Fragment>
                        ))}
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            ))}
          </div>
          <Dialog.Close className="dialog-close">Close</Dialog.Close>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
