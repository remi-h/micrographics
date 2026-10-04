import { useState, type FormEvent } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { MessageSquare } from 'lucide-react';
import { FEEDBACK_KINDS, MAX_FEEDBACK_DETAILS, feedbackIssueUrl, type FeedbackKind } from '../lib/feedback';

// A "Feedback?" button under the canvas that opens a short form and hands it
// to GitHub as a prefilled issue (see lib/feedback). It is laptop-only: the
// stage footer it sits in is hidden below the three-column layout.
export function FeedbackDialog({ templateName }: { templateName?: string }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<FeedbackKind>('idea');
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;
    window.open(feedbackIssueUrl({ kind, title, details, templateName }), '_blank', 'noopener,noreferrer');
    setOpen(false);
    setKind('idea');
    setTitle('');
    setDetails('');
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger className="feedback-trigger">
        <MessageSquare size={14} aria-hidden="true" />
        Feedback?
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="dialog-backdrop" />
        <Dialog.Popup className="dialog-popup feedback-dialog">
          <Dialog.Title className="dialog-title">Send feedback</Dialog.Title>
          <Dialog.Description className="dialog-description">
            Found a bug or have an idea? This opens a GitHub issue with your note filled in, for you to check and
            submit. You&rsquo;ll need a GitHub account.
          </Dialog.Description>

          <form className="feedback-form" onSubmit={submit}>
            <div className="feedback-kinds" role="group" aria-label="Kind of feedback">
              {FEEDBACK_KINDS.map((option) => (
                <button
                  aria-pressed={kind === option.kind}
                  className="feedback-kind"
                  key={option.kind}
                  onClick={() => setKind(option.kind)}
                  type="button"
                >
                  {option.label}
                </button>
              ))}
            </div>

            <label className="feedback-field">
              <span>Title</span>
              <input
                className="text-input"
                maxLength={120}
                onChange={(event) => setTitle(event.target.value)}
                placeholder={kind === 'bug' ? 'What went wrong?' : 'In a sentence'}
                required
                value={title}
              />
            </label>

            <label className="feedback-field">
              <span>Details (optional)</span>
              <textarea
                className="text-input feedback-details"
                maxLength={MAX_FEEDBACK_DETAILS}
                onChange={(event) => setDetails(event.target.value)}
                placeholder={kind === 'bug' ? 'What did you do, and what did you expect?' : 'Anything that helps'}
                rows={5}
                value={details}
              />
            </label>

            <button className="feedback-submit" disabled={!title.trim()} type="submit">
              Continue on GitHub
            </button>
          </form>
          <Dialog.Close className="dialog-close">Cancel</Dialog.Close>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
