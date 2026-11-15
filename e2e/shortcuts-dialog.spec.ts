import { test, expect } from '@playwright/test';

// The Shortcuts button under the canvas lists the editor's shortcuts, and
// while it is open the canvas shortcuts stand down: focus starts on its Close
// button, and Delete there must not take the selection with it.
test('Shortcuts under the canvas lists the shortcuts, and keys pressed in it stay in it', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/creator');

  const rows = page.locator('.layer-row');
  const before = await rows.count();
  await page.locator('.symbol-button').first().click();
  await expect(rows).toHaveCount(before + 1);

  const button = page.getByRole('button', { name: 'Shortcuts' });
  const [buttonBox, artboardBox] = await Promise.all([
    button.boundingBox(),
    page.locator('.artboard-wrap').boundingBox(),
  ]);
  expect(buttonBox!.y).toBeGreaterThanOrEqual(artboardBox!.y + artboardBox!.height);

  await button.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Keyboard shortcuts')).toBeVisible();
  await expect(dialog.getByText('Snap a rotate-handle drag to 15°')).toBeVisible();

  // The whole list fits a laptop screen without scrolling the dialog.
  const fits = await dialog.evaluate((node) => node.scrollHeight <= node.clientHeight);
  expect(fits).toBe(true);

  await page.keyboard.press('Delete');
  await expect(rows).toHaveCount(before + 1);

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});
