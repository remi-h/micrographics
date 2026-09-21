import { test, expect, type Page } from '@playwright/test';

// The global shortcuts run from a single window keydown listener that is bound
// once on mount and routed through a React effect event (see
// src/useKeyboardShortcuts.ts). That listener never re-binds, so every press
// after the first depends on the effect event handing it the current render's
// handlers: `undo` closes over the undo stack of the render that made it, and a
// listener stuck with an older one undoes once and then silently does nothing.
//
// useKeyboardShortcuts.test.ts pins that against the real history and canvas
// hooks, but it runs in jsdom against the React in node_modules. This runs the
// same press twice against the React Next actually bundles, in a real browser,
// because `useEffectEvent` is newly stable API: a React or bundler change that
// quietly altered when an effect event sees new props would break undo for
// users while every unit test stayed green.
function layerRows(page: Page) {
  return page.locator('.layer-row');
}

// The selected item carries the dashed outline, so this follows the selection
// rather than a position in the DOM.
function selectedItem(page: Page) {
  return page.locator('.artboard .canvas-item:has(rect[stroke-dasharray])').first();
}

// Canvas items are placed with `translate(x y) rotate(r)`, so the x is the
// first number in the transform.
async function selectedX(page: Page) {
  const transform = (await selectedItem(page).getAttribute('transform')) ?? '';
  const x = /translate\(\s*(-?[\d.]+)/.exec(transform)?.[1];
  return x === undefined ? null : Number(x);
}

test('undo, redo and nudge keep working from the keyboard', async ({ page }) => {
  await page.goto('/creator');

  const rows = layerRows(page);
  const before = await rows.count();

  const symbols = page.locator('.symbol-button');
  await symbols.first().click();
  await expect(rows).toHaveCount(before + 1);
  await symbols.nth(1).click();
  await expect(rows).toHaveCount(before + 2);

  // ControlOrMeta so the press is Cmd on macOS and Ctrl everywhere else, which
  // is the pair of modifiers the handler accepts.
  await page.keyboard.press('ControlOrMeta+z');
  await expect(rows).toHaveCount(before + 1);

  // The press that matters: a listener holding a stale `undo` does nothing here
  // and the layer count stays where the first undo left it.
  await page.keyboard.press('ControlOrMeta+z');
  await expect(rows).toHaveCount(before);

  await page.keyboard.press('ControlOrMeta+Shift+z');
  await expect(rows).toHaveCount(before + 1);

  // Selecting and then nudging pins the other half: the press has to act on the
  // selection made in the render just before it, not the one the listener was
  // bound with.
  await rows.first().click();
  await expect(selectedItem(page)).toBeVisible();

  const startX = await selectedX(page);
  expect(startX).not.toBeNull();

  await page.keyboard.press('ArrowRight');
  await expect.poll(() => selectedX(page)).toBe((startX as number) + 1);
});
