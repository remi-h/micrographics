import { render, screen, within } from '@testing-library/react';
import LandingPage from './LandingPage';

describe('LandingPage', () => {
  it('renders the primary heading and a link into the creator tool', () => {
    render(<LandingPage />);

    expect(screen.getAllByRole('link', { name: /open tool/i })[0]).toHaveAttribute(
      'href',
      '/creator',
    );
  });

  it('links to the source repository from the footer, in a new tab', () => {
    render(<LandingPage />);

    const footer = screen.getByRole('navigation', { name: 'Footer' });
    const github = within(footer).getByRole('link', { name: 'GitHub' });
    expect(github).toHaveAttribute('href', 'https://github.com/remi-h/micrographics');
    expect(github).toHaveAttribute('target', '_blank');
    expect(github).toHaveAttribute('rel', 'noopener noreferrer');
  });
});
