import { readFile } from 'node:fs/promises';
import { test, expect, type Page } from '@playwright/test';
import { signInWithFakeAccount, TEST_USER } from './account';

const layers = (page: Page) => page.locator('.layer-row');
const status = (page: Page) => page.locator('.account-bar [role="status"]');

async function saveAs(page: Page, name: string) {
  await page.getByRole('button', { name: 'Canvases' }).click();
  const dialog = page.getByRole('dialog', { name: 'Your canvases' });
  await dialog.getByLabel('Canvas name').fill(name);
  await dialog.getByRole('button', { name: /Save canvas|Save a copy/ }).click();
  await expect(dialog.getByRole('list', { name: 'Saved canvases' }).getByText(name)).toBeVisible();
  await dialog.getByRole('button', { name: 'Close' }).click();
}

test('signed out, the editor offers the Google sign-in and works without it', async ({ page }) => {
  await page.goto('/creator');

  await expect(page.getByRole('button', { name: 'Sign in with Google' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Canvases' })).toHaveCount(0);

  await page.getByRole('tab', { name: 'Custom' }).click();
  await expect(page.locator('.symbol-custom-empty')).toContainText('Upload your own SVG symbols');
  await expect(page.locator('.symbol-custom-empty').getByRole('button', { name: 'Sign in with Google' })).toBeVisible();

  // The built-in tabs still add symbols.
  const before = await layers(page).count();
  await page.getByRole('tab', { name: 'Daily' }).click();
  await page.locator('.symbol-button').first().click();
  await expect(layers(page)).toHaveCount(before + 1);
});

test('a canvas is saved to the account, autosaved, and reopened later', async ({ page }) => {
  const account = await signInWithFakeAccount(page);
  await page.goto('/creator');

  await expect(page.locator('.account-canvas-name')).toHaveText('Unsaved canvas');
  await expect(status(page)).toHaveText('Only in this browser');
  const templateCount = await layers(page).count();

  await saveAs(page, 'Poster');
  await expect(page.locator('.account-canvas-name')).toHaveText('Poster');
  await expect(status(page)).toHaveText('Saved to your account');

  // A group is one row in Layers, so items are counted in what was stored.
  const storedItems = () => (account.canvases[0].data as { canvasItems: unknown[] }).canvasItems;
  const itemCount = storedItems().length;

  // An edit reaches the account without being asked to.
  await page.locator('.symbol-button').first().click();
  await expect(layers(page)).toHaveCount(templateCount + 1);
  await expect.poll(() => account.writes.filter((write) => write.method === 'PATCH').length).toBe(1);
  await expect(status(page)).toHaveText('Saved to your account');
  expect(storedItems()).toHaveLength(itemCount + 1);

  // A second canvas, started fresh.
  await page.getByRole('button', { name: 'Canvases' }).click();
  await page.getByRole('button', { name: 'New canvas' }).click();
  await expect(page.locator('.account-canvas-name')).toHaveText('Unsaved canvas');
  await expect(layers(page)).toHaveCount(templateCount);
  await page.getByRole('button', { name: 'Start from scratch' }).click();
  await expect(layers(page)).toHaveCount(0);
  await saveAs(page, 'Blank one');
  expect(account.canvases).toHaveLength(2);

  // Back to the first: what was saved is what opens.
  await page.getByRole('button', { name: 'Canvases' }).click();
  await page.getByRole('dialog').getByRole('button', { name: /^Poster/ }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.account-canvas-name')).toHaveText('Poster');
  await expect(layers(page)).toHaveCount(templateCount + 1);

  // Opening a canvas is not an edit the other one can be undone into.
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(layers(page)).toHaveCount(templateCount + 1);

  // A reload carries on with the same canvas.
  await page.reload();
  await expect(page.locator('.account-canvas-name')).toHaveText('Poster');
  await expect(layers(page)).toHaveCount(templateCount + 1);
  expect((account.canvases.find((canvas) => canvas.name === 'Blank one')!.data as { canvasItems: unknown[] }).canvasItems).toEqual([]);
});

test('opening another canvas asks before replacing an unsaved draft', async ({ page }) => {
  await signInWithFakeAccount(page, {
    canvases: [
      {
        id: 'c1',
        name: 'Earlier work',
        updated_at: '2025-12-01T10:00:00.000Z',
        data: {
          version: 1,
          canvasZoom: 1,
          canvasItems: [],
          settings: {
            template: 'blank',
            artboard: { width: 1200, height: 800 },
            paletteIndex: 0,
            backgroundImage: null,
            grid: false,
            showBackground: true,
          },
        },
      },
    ],
  });
  await page.goto('/creator');
  const draftCount = await layers(page).count();
  expect(draftCount).toBeGreaterThan(0);

  await page.getByRole('button', { name: 'Canvases' }).click();
  const row = page.getByRole('dialog').getByRole('button', { name: /^Earlier work/ });

  page.once('dialog', (dialog) => void dialog.dismiss());
  await row.click();
  await expect(layers(page)).toHaveCount(draftCount);

  page.once('dialog', (dialog) => void dialog.accept());
  await row.click();
  await expect(layers(page)).toHaveCount(0);
  await expect(page.locator('.account-canvas-name')).toHaveText('Earlier work');
});

test('a saved canvas can be renamed and deleted', async ({ page }) => {
  const account = await signInWithFakeAccount(page);
  await page.goto('/creator');
  await saveAs(page, 'Draft');

  await page.getByRole('button', { name: 'Canvases' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Rename Draft' }).click();
  await dialog.getByLabel('New name for Draft').fill('Launch poster');
  await dialog.getByRole('button', { name: 'Save name' }).click();
  await expect(dialog.getByRole('button', { name: /^Launch poster/ })).toBeVisible();
  await expect(page.locator('.account-canvas-name')).toHaveText('Launch poster');

  // Deleting takes two clicks, and leaves the artwork on screen as a draft.
  const count = await layers(page).count();
  await dialog.getByRole('button', { name: 'Delete Launch poster' }).click();
  expect(account.canvases).toHaveLength(1);
  await dialog.getByRole('button', { name: 'Delete for good' }).click();
  await expect(dialog.getByText('No saved canvases yet.')).toBeVisible();
  expect(account.canvases).toHaveLength(0);
  await dialog.getByRole('button', { name: 'Close' }).click();
  await expect(page.locator('.account-canvas-name')).toHaveText('Unsaved canvas');
  await expect(layers(page)).toHaveCount(count);
});

test('an uploaded SVG becomes a symbol in the Custom tab and on the canvas', async ({ page }) => {
  const account = await signInWithFakeAccount(page);
  await page.goto('/creator');
  const before = await layers(page).count();

  await page.getByRole('tab', { name: 'Custom' }).click();
  await page.getByLabel('SVG file').setInputFiles({
    name: 'team-logo.svg',
    mimeType: 'image/svg+xml',
    buffer: Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" onload="alert(1)">' +
        '<script>alert(1)</script><circle cx="12" cy="12" r="10" fill="#e4572e"/></svg>',
    ),
  });

  const symbol = page.locator('.symbol-custom-item').getByRole('button', { name: 'team logo', exact: true });
  await expect(symbol).toBeVisible();
  // Stored cleaned: no script, no handler, and a viewBox so it scales.
  const stored = String(account.symbols[0].svg);
  expect(stored).not.toMatch(/script|onload/);
  expect(stored).toContain('viewBox="0 0 24 24"');

  await symbol.click();
  await expect(layers(page)).toHaveCount(before + 1);
  await expect(layers(page).first()).toContainText('team logo');
  await expect(page.locator('.artboard-wrap svg image[href^="data:image/svg+xml"]')).toHaveCount(1);

  // Not an SVG: refused, with the reason shown.
  await page.getByLabel('SVG file').setInputFiles({
    name: 'notes.svg',
    mimeType: 'image/svg+xml',
    buffer: Buffer.from('just some text'),
  });
  await expect(page.locator('.symbol-custom-note')).toContainText('could not be read as an SVG');

  // Deleting it from the tab leaves the one already on the canvas.
  await page.getByRole('button', { name: 'Delete team logo' }).click();
  await expect(page.locator('.symbol-custom-item')).toHaveCount(0);
  expect(account.symbols).toHaveLength(0);
  await expect(page.locator('.artboard-wrap svg image[href^="data:image/svg+xml"]')).toHaveCount(1);
});

// An uploaded symbol is an image inside the artwork, and a PNG is made by
// drawing the exported SVG to a canvas: the browser has to decode an SVG held
// inside an SVG. Checked on the pixels, since the markup cannot show it.
test('an uploaded symbol is in the exported PNG', async ({ page }) => {
  await signInWithFakeAccount(page, {
    symbols: [
      {
        id: 's1',
        name: 'Block',
        svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="#ff00ff"/></svg>',
      },
    ],
  });
  await page.goto('/creator');
  await page.getByRole('button', { name: 'Start from scratch' }).click();
  await page.getByRole('tab', { name: 'Custom' }).click();
  await page.locator('.symbol-custom-item').getByRole('button', { name: 'Block', exact: true }).click();
  await expect(layers(page)).toHaveCount(1);

  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('.size-option').filter({ hasText: /^1×/ }).click(),
  ]);
  const png = (await readFile(await download.path())).toString('base64');

  const magenta = await page.evaluate(async (data) => {
    const image = new Image();
    image.src = `data:image/png;base64,${data}`;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext('2d')!;
    context.drawImage(image, 0, 0);
    const { data: pixels } = context.getImageData(0, 0, canvas.width, canvas.height);
    let count = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      if (pixels[index] > 240 && pixels[index + 1] < 15 && pixels[index + 2] > 240) count += 1;
    }
    return count;
  }, png);
  // The symbol is drawn about 35 units square on a 1200 x 800 frame.
  expect(magenta).toBeGreaterThan(500);
});

test('signing out returns the editor to a browser-only canvas', async ({ page }) => {
  await signInWithFakeAccount(page);
  await page.goto('/creator');
  await expect(page.getByRole('button', { name: `Sign out` })).toHaveAttribute('title', `Sign out ${TEST_USER.email}`);
  const count = await layers(page).count();

  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByRole('button', { name: 'Sign in with Google' })).toBeVisible();
  await expect(layers(page)).toHaveCount(count);
});
