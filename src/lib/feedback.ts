import { REPO_URL } from '../data/links';

// Feedback goes to the repository's issue tracker. The app has no backend and
// must not carry a GitHub token, so it does not file the issue itself: it
// opens GitHub's new-issue page with the form already filled in, and the
// person reviews it and submits it there, signed in as themselves.

export type FeedbackKind = 'bug' | 'idea' | 'other';

export const FEEDBACK_KINDS: Array<{ kind: FeedbackKind; label: string }> = [
  { kind: 'bug', label: 'Bug' },
  { kind: 'idea', label: 'Idea' },
  { kind: 'other', label: 'Other' },
];

/** Long enough for a real report, short enough that the URL stays well under GitHub's limit. */
export const MAX_FEEDBACK_DETAILS = 2000;

const TITLE_PREFIX: Record<FeedbackKind, string> = { bug: '[Bug]', idea: '[Idea]', other: '[Feedback]' };

export type Feedback = {
  kind: FeedbackKind;
  title: string;
  details: string;
  /** The template open when the feedback was sent, for context on a bug. */
  templateName?: string;
};

/** GitHub's new-issue page for this repository, prefilled with `feedback`. */
export function feedbackIssueUrl({ kind, title, details, templateName }: Feedback): string {
  const body = [
    details.trim().slice(0, MAX_FEEDBACK_DETAILS),
    '',
    '---',
    `_Sent with the Feedback button in Micrographics Creator${templateName ? ` (template: ${templateName})` : ''}._`,
  ].join('\n');
  const params = new URLSearchParams({ title: `${TITLE_PREFIX[kind]} ${title.trim()}`, body });
  return `${REPO_URL}/issues/new?${params.toString()}`;
}
