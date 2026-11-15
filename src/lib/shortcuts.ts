// Turns the platform-neutral key names in data/shortcuts into what is printed
// on the keyboard in front of the viewer: Cmd and Option on a Mac, Ctrl and
// Alt elsewhere, matching what useKeyboardShortcuts accepts (it takes either
// Cmd or Ctrl for `Mod`).

export function isApplePlatform(userAgent: string) {
  return /Mac|iPhone|iPad|iPod/.test(userAgent);
}

export function keyLabel(key: string, apple: boolean) {
  if (key === 'Mod') return apple ? 'Cmd' : 'Ctrl';
  if (key === 'Alt') return apple ? 'Option' : 'Alt';
  return key;
}
