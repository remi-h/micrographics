import { SHORTCUT_GROUPS } from '../data/shortcuts';
import { isApplePlatform, keyLabel } from './shortcuts';

describe('isApplePlatform', () => {
  it('spots macOS and iOS user agents', () => {
    expect(isApplePlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15')).toBe(true);
    expect(isApplePlatform('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)')).toBe(true);
    expect(isApplePlatform('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe(false);
    expect(isApplePlatform('Mozilla/5.0 (X11; Linux x86_64)')).toBe(false);
  });
});

describe('keyLabel', () => {
  it('names the modifier keys as the keyboard prints them', () => {
    expect(keyLabel('Mod', true)).toBe('Cmd');
    expect(keyLabel('Mod', false)).toBe('Ctrl');
    expect(keyLabel('Alt', true)).toBe('Option');
    expect(keyLabel('Alt', false)).toBe('Alt');
  });

  it('leaves every other key as written', () => {
    expect(keyLabel('Shift', true)).toBe('Shift');
    expect(keyLabel('[', false)).toBe('[');
  });
});

describe('SHORTCUT_GROUPS', () => {
  it('gives every shortcut at least one non-empty key combination', () => {
    for (const group of SHORTCUT_GROUPS) {
      expect(group.shortcuts.length).toBeGreaterThan(0);
      for (const shortcut of group.shortcuts) {
        expect(shortcut.keys.length).toBeGreaterThan(0);
        for (const combo of shortcut.keys) expect(combo.length).toBeGreaterThan(0);
      }
    }
  });
});
