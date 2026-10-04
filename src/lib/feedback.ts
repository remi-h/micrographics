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

/** Long enough for a real report. What fits in the link can be less: see MAX_ISSUE_URL. */
export const MAX_FEEDBACK_DETAILS = 2000;

/**
 * The longest link to hand GitHub. It answers 414 URI Too Long a little past
 * 8,200 characters, and the cap has to be on the encoded link, not on what was
 * typed: a non-ASCII character encodes to six to nine characters, so 2,000
 * characters of Cyrillic or Chinese come out at 12,000 to 19,000.
 */
export const MAX_ISSUE_URL = 8000;

const CUT_NOTE = '\n\n[Cut short to fit a GitHub link.]';

const TITLE_PREFIX: Record<FeedbackKind, string> = { bug: '[Bug]', idea: '[Idea]', other: '[Feedback]' };

export type Feedback = {
  kind: FeedbackKind;
  title: string;
  details: string;
  /** The template open when the feedback was sent, for context on a bug. */
  templateName?: string;
};

/**
 * GitHub's new-issue page for this repository, prefilled with `feedback`, and
 * whether the details had to be cut short to keep the link within
 * MAX_ISSUE_URL.
 */
export function feedbackIssue({ kind, title, details, templateName }: Feedback): { url: string; cut: boolean } {
  const footer = `_Sent with the Feedback button in Micrographics Creator${templateName ? ` (template: ${templateName})` : ''}._`;
  const urlFor = (text: string) => {
    const body = [text, '', '---', footer].join('\n');
    const params = new URLSearchParams({ title: `${TITLE_PREFIX[kind]} ${title.trim()}`, body });
    return `${REPO_URL}/issues/new?${params.toString()}`;
  };

  // By code point, so a cut never splits an emoji or other surrogate pair.
  const characters = Array.from(details.trim()).slice(0, MAX_FEEDBACK_DETAILS);
  const whole = urlFor(characters.join(''));
  if (whole.length <= MAX_ISSUE_URL) return { url: whole, cut: characters.length < Array.from(details.trim()).length };

  // The longest start of the details that fits, found by halving.
  let fits = 0;
  let tooLong = characters.length;
  while (tooLong - fits > 1) {
    const middle = Math.floor((fits + tooLong) / 2);
    if (urlFor(characters.slice(0, middle).join('') + CUT_NOTE).length <= MAX_ISSUE_URL) fits = middle;
    else tooLong = middle;
  }
  return { url: urlFor(characters.slice(0, fits).join('') + CUT_NOTE), cut: true };
}

/** The link alone; see feedbackIssue. */
export function feedbackIssueUrl(feedback: Feedback): string {
  return feedbackIssue(feedback).url;
}
