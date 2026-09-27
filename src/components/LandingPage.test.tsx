import { render, screen } from '@testing-library/react';
import LandingPage from './LandingPage';

describe('LandingPage', () => {
  it('renders the primary heading and a link into the creator tool', () => {
    render(<LandingPage />);

    expect(screen.getAllByRole('link', { name: /open tool/i })[0]).toHaveAttribute(
      'href',
      '/creator',
    );
  });
});
