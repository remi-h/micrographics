import { render, screen, within } from '@testing-library/react';
import LandingPage from './LandingPage';

describe('LandingPage', () => {
  it('renders the primary heading and a link into the creator tool', () => {
    render(<LandingPage />);

    expect(screen.getAllByRole('link', { name: /open tool/i })[0]).toHaveAttribute('href', '/creator');
  });

  it('asks for feedback in the footer, with the GitHub mark and a link to open an issue', () => {
    const { container } = render(<LandingPage />);

    const feedback = container.querySelector('.landing-footer-feedback') as HTMLElement;
    expect(feedback).toHaveTextContent('Feedback is welcome. If you have any, open an issue on GitHub.');

    // Between the description and the copyright.
    const lines = [...container.querySelectorAll('.landing-footer-brand p')].map((line) => line.className);
    expect(lines).toEqual(['', 'landing-footer-feedback', 'landing-footer-copyright']);

    const repo = within(feedback).getByRole('link', { name: 'GitHub repository' });
    expect(repo).toHaveAttribute('href', 'https://github.com/remi-h/micrographics');
    expect(repo.querySelector('svg')).toBeInTheDocument();
    const issue = within(feedback).getByRole('link', { name: 'open an issue on GitHub' });
    expect(issue).toHaveAttribute('href', 'https://github.com/remi-h/micrographics/issues/new');
    for (const link of [repo, issue]) {
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    }
  });
});
