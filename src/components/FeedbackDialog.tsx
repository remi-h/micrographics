import { useRef, useState, type FormEvent } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { MessageSquare } from 'lucide-react';
import { FEEDBACK_KINDS, MAX_FEEDBACK_DETAILS, feedbackIssue, type FeedbackKind } from '../lib/feedback';

// A "Feedback?" button under the canvas that opens a short form and hands it
// to GitHub as a prefilled issue (see lib/feedback). It is laptop-only: the
// stage footer it sits in is hidden below the three-column layout.
export function FeedbackDialog({ templateName }: { templateName?: string }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<FeedbackKind>('idea');
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  const titleRef = useRef<HTMLInputElement>(null);
  const issue = feedbackIssue({ kind, title, details, templateName });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;
    window.open(issue.url, '_blank', 'noopener,noreferrer');
    setOpen(false);
    // Cut details are kept, so the rest can be copied from here into the issue.
    if (issue.cut) return;
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
        {/* Focus starts in Title, where typing begins. On a button instead,
            Backspace and the other editing keys would reach the canvas's
            shortcuts behind the dialog, which only stand down for text
            fields. */}
        <Dialog.Popup className="dialog-popup feedback-dialog" initialFocus={titleRef}>
          <Dialog.Title className="dialog-title">Send feedback</Dialog.Title>
          <Dialog.Description className="dialog-description">
            Found a bug or have an idea? This opens a GitHub issue with your note filled in, for you to check and
            submit. You&rsquo;ll need a GitHub account.
          </Dialog.Description>

          <form className="feedback-form" onSubmit={submit}>
            {/* Native radios: one choice of three, announced and arrow-keyed
                as such. */}
            <div className="feedback-kinds" role="radiogroup" aria-label="Kind of feedback">
              {FEEDBACK_KINDS.map((option) => (
                <label className="feedback-kind" key={option.kind}>
                  <input
                    checked={kind === option.kind}
                    name="feedback-kind"
                    onChange={() => setKind(option.kind)}
                    type="radio"
                    value={option.kind}
                  />
                  {option.label}
                </label>
              ))}
            </div>

            <label className="feedback-field">
              <span>Title</span>
              <input
                className="text-input"
                maxLength={120}
                ref={titleRef}
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

            {issue.cut && (
              <p className="feedback-note" role="status">
                That&rsquo;s more than a GitHub link can carry, so the end of the details will be cut. Your text stays
                here, to copy the rest into the issue.
              </p>
            )}

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
