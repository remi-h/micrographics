import { MAX_FEEDBACK_DETAILS, MAX_ISSUE_URL, feedbackIssue, feedbackIssueUrl } from './feedback';

const parse = (url: string) => {
  const parsed = new URL(url);
  return {
    path: `${parsed.origin}${parsed.pathname}`,
    title: parsed.searchParams.get('title'),
    body: parsed.searchParams.get('body'),
  };
};

describe('feedbackIssueUrl', () => {
  it("opens a new issue on the project's repository", () => {
    const { path } = parse(feedbackIssueUrl({ kind: 'idea', title: 'More templates', details: '' }));
    expect(path).toBe('https://github.com/remi-h/micrographics/issues/new');
  });

  it('prefixes the title with the kind of feedback', () => {
    expect(parse(feedbackIssueUrl({ kind: 'bug', title: 'Export fails', details: '' })).title).toBe(
      '[Bug] Export fails',
    );
    expect(parse(feedbackIssueUrl({ kind: 'idea', title: 'Dark mode', details: '' })).title).toBe('[Idea] Dark mode');
    expect(parse(feedbackIssueUrl({ kind: 'other', title: 'Hello', details: '' })).title).toBe('[Feedback] Hello');
  });

  it('trims what was typed and keeps characters a URL would otherwise mangle', () => {
    const { title, body } = parse(
      feedbackIssueUrl({ kind: 'bug', title: '  Pop & slide #2?  ', details: '  a=1&b=2\nline two  ' }),
    );
    expect(title).toBe('[Bug] Pop & slide #2?');
    expect(body?.startsWith('a=1&b=2\nline two\n')).toBe(true);
  });

  it('says where the feedback came from, with the template when there is one', () => {
    expect(
      parse(feedbackIssueUrl({ kind: 'bug', title: 'x', details: 'y', templateName: '005 Levels' })).body,
    ).toContain('Sent with the Feedback button in Micrographics Creator (template: 005 Levels)');
    expect(parse(feedbackIssueUrl({ kind: 'bug', title: 'x', details: 'y' })).body).toContain(
      'Sent with the Feedback button in Micrographics Creator._',
    );
  });

  it('caps the details at MAX_FEEDBACK_DETAILS characters', () => {
    const url = feedbackIssueUrl({ kind: 'other', title: 'Long', details: 'x'.repeat(MAX_FEEDBACK_DETAILS * 3) });
    expect(parse(url).body?.match(/x+/)?.[0]).toHaveLength(MAX_FEEDBACK_DETAILS);
  });

  it('leaves details that fit whole, and says so', () => {
    const issue = feedbackIssue({ kind: 'other', title: 'Short', details: 'a'.repeat(MAX_FEEDBACK_DETAILS) });
    expect(issue.cut).toBe(false);
    expect(parse(issue.url).body).toContain('a'.repeat(MAX_FEEDBACK_DETAILS));
    expect(parse(issue.url).body).not.toContain('Cut short');
  });

  // A non-ASCII character encodes to six to nine characters of link, so a
  // character cap alone let 2,000 of them through as a 12,000-19,000
  // character link, which GitHub refuses with 414 URI Too Long.
  it.each([
    ['accented Latin', 'é'],
    ['Cyrillic', 'ж'],
    ['Chinese', '漢'],
    ['emoji', '🎨'],
    ['punctuation a link has to escape', '&'],
  ])('keeps the encoded link within what GitHub accepts for %s', (_name, character) => {
    const details = character.repeat(MAX_FEEDBACK_DETAILS);
    const issue = feedbackIssue({ kind: 'bug', title: '漢'.repeat(120), details, templateName: '005 Levels' });

    expect(issue.url.length).toBeLessThanOrEqual(MAX_ISSUE_URL);
    const { body } = parse(issue.url);
    expect(body).toContain('[Cut short to fit a GitHub link.]');
    expect(body).toContain('template: 005 Levels');
    // As much as fits, not a token amount: the link ends within one encoded
    // character (at most 12 link characters, for an emoji) of the limit.
    const kept = body!.slice(0, body!.indexOf('\n\n[Cut short'));
    expect(kept).toBe(character.repeat(Array.from(kept).length));
    expect(issue.url.length).toBeGreaterThan(MAX_ISSUE_URL - 13);
    expect(Array.from(kept).length).toBeGreaterThan(100);
  });
});
