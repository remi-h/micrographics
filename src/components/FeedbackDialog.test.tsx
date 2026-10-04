import { fireEvent, render, screen } from '@testing-library/react';
import { FeedbackDialog } from './FeedbackDialog';

describe('FeedbackDialog', () => {
  let open: jest.SpyInstance;
  beforeEach(() => {
    open = jest.spyOn(window, 'open').mockImplementation(() => null);
  });
  afterEach(() => open.mockRestore());

  const openDialog = () => {
    render(<FeedbackDialog templateName="001 Quiet" />);
    fireEvent.click(screen.getByRole('button', { name: /Feedback\?/ }));
  };

  it('opens a form from the Feedback? button', () => {
    openDialog();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Send feedback')).toBeInTheDocument();
  });

  it('needs a title before it will continue', () => {
    openDialog();
    const submit = screen.getByRole('button', { name: 'Continue on GitHub' });
    expect(submit).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: '   ' } });
    expect(submit).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Export fails' } });
    expect(submit).toBeEnabled();
  });

  it('opens a prefilled GitHub issue in a new tab and closes', () => {
    openDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Bug' }));
    expect(screen.getByRole('button', { name: 'Bug' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Export fails' } });
    fireEvent.change(screen.getByLabelText('Details (optional)'), { target: { value: 'GIF never finishes' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue on GitHub' }));

    expect(open).toHaveBeenCalledTimes(1);
    const [url, target, features] = open.mock.calls[0];
    const params = new URL(url).searchParams;
    expect(params.get('title')).toBe('[Bug] Export fails');
    expect(params.get('body')).toContain('GIF never finishes');
    expect(params.get('body')).toContain('template: 001 Quiet');
    expect(target).toBe('_blank');
    expect(features).toContain('noopener');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('starts empty the next time it opens', () => {
    openDialog();
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Dark mode' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue on GitHub' }));
    fireEvent.click(screen.getByRole('button', { name: /Feedback\?/ }));
    expect(screen.getByLabelText('Title')).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Idea' })).toHaveAttribute('aria-pressed', 'true');
  });
});
