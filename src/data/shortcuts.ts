// What the Shortcuts dialog lists. The keyboard ones are bound in
// hooks/useKeyboardShortcuts and the text editor in MicrographicSvg; the
// pointer ones in MicrographicSvg. `Mod` is Cmd on a Mac and Ctrl elsewhere,
// and `Alt` is Option on a Mac (see lib/shortcuts).

export type Shortcut = {
  /** Each entry is one way to do it; the keys within one are pressed together. */
  keys: string[][];
  label: string;
};

export type ShortcutGroup = { shortcuts: Shortcut[]; title: string };

export const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: 'Edit',
    shortcuts: [
      { label: 'Undo', keys: [['Mod', 'Z']] },
      {
        label: 'Redo',
        keys: [
          ['Shift', 'Mod', 'Z'],
          ['Mod', 'Y'],
        ],
      },
      { label: 'Copy', keys: [['Mod', 'C']] },
      { label: 'Cut', keys: [['Mod', 'X']] },
      { label: 'Paste', keys: [['Mod', 'V']] },
      { label: 'Duplicate', keys: [['Mod', 'D']] },
      { label: 'Delete', keys: [['Delete'], ['Backspace']] },
    ],
  },
  {
    title: 'Select',
    shortcuts: [
      { label: 'Select all', keys: [['Mod', 'A']] },
      { label: 'Add to the selection', keys: [['Shift', 'Click']] },
      { label: 'Clear the selection', keys: [['Esc']] },
      { label: 'Group', keys: [['Mod', 'G']] },
      { label: 'Ungroup', keys: [['Shift', 'Mod', 'G']] },
    ],
  },
  {
    title: 'Move and rotate',
    shortcuts: [
      { label: 'Nudge', keys: [['Arrow keys']] },
      { label: 'Nudge 10 times as far', keys: [['Shift', 'Arrow keys']] },
      { label: 'Rotate 15°', keys: [['['], [']']] },
      {
        label: 'Rotate 45°',
        keys: [
          ['Shift', '['],
          ['Shift', ']'],
        ],
      },
      {
        label: 'Rotate to the next 90°',
        keys: [
          ['Alt', '['],
          ['Alt', ']'],
        ],
      },
      { label: 'Snap a rotate-handle drag to 15°', keys: [['Shift', 'Drag']] },
      { label: 'Snap a rotate-handle drag to 90°', keys: [['Alt', 'Drag']] },
    ],
  },
  {
    title: 'Text',
    shortcuts: [
      { label: 'Edit text', keys: [['Double-click']] },
      { label: 'Finish editing', keys: [['Mod', 'Enter']] },
      { label: 'Cancel editing', keys: [['Esc']] },
    ],
  },
  {
    title: 'View',
    shortcuts: [
      { label: 'Zoom in', keys: [['Mod', '+']] },
      { label: 'Zoom out', keys: [['Mod', '-']] },
      { label: 'Reset zoom', keys: [['Mod', '0']] },
    ],
  },
];
