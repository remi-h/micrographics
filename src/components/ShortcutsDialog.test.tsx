import { fireEvent, render, screen, within } from '@testing-library/react';
import { SHORTCUT_GROUPS } from '../data/shortcuts';
import { ShortcutsDialog } from './ShortcutsDialog';

describe('ShortcutsDialog', () => {
  const userAgent = jest.spyOn(window.navigator, 'userAgent', 'get');
  afterEach(() => userAgent.mockReset());

  const openDialog = () => {
    render(<ShortcutsDialog />);
    fireEvent.click(screen.getByRole('button', { name: 'Shortcuts' }));
    return screen.getByRole('dialog');
  };

  it('lists every group from the Shortcuts button', () => {
    const dialog = openDialog();
    expect(within(dialog).getByText('Keyboard shortcuts')).toBeInTheDocument();
    for (const group of SHORTCUT_GROUPS) {
      expect(within(dialog).getByRole('region', { name: group.title })).toBeInTheDocument();
    }
    expect(within(dialog).getByText('Snap a rotate-handle drag to 90°')).toBeInTheDocument();
  });

  it('names Cmd and Option on a Mac', () => {
    userAgent.mockReturnValue('Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5)');
    const dialog = openDialog();
    const undo = within(dialog).getByText('Undo').closest('.shortcuts-row') as HTMLElement;
    expect(within(undo).getByText('Cmd')).toBeInTheDocument();
    const quarter = within(dialog).getByText('Rotate to the next 90°').closest('.shortcuts-row') as HTMLElement;
    expect(within(quarter).getAllByText('Option')).toHaveLength(2);
  });

  it('names Ctrl and Alt elsewhere', () => {
    userAgent.mockReturnValue('Mozilla/5.0 (Windows NT 10.0; Win64; x64)');
    const dialog = openDialog();
    const undo = within(dialog).getByText('Undo').closest('.shortcuts-row') as HTMLElement;
    expect(within(undo).getByText('Ctrl')).toBeInTheDocument();
    expect(within(dialog).queryByText('Cmd')).toBeNull();
  });
});
