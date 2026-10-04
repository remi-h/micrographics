import { MAX_FEEDBACK_DETAILS, feedbackIssueUrl } from './feedback';

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

  it('caps the details so the link stays within what GitHub accepts', () => {
    const url = feedbackIssueUrl({ kind: 'other', title: 'Long', details: 'x'.repeat(MAX_FEEDBACK_DETAILS * 3) });
    expect(parse(url).body?.match(/x+/)?.[0]).toHaveLength(MAX_FEEDBACK_DETAILS);
    expect(url.length).toBeLessThan(8000);
  });
});
