import { readFile } from 'node:fs/promises';
import { test, expect, type Page } from '@playwright/test';

// Exports used to be serialized off the live canvas, so anything the editor was
// drawing at the time -- the dashed outline, the handles, the alignment toolbar
// -- ended up in the downloaded file. Having something selected is the normal
// state right after placing an item, so this is what an ordinary export looked
// like.
const EDITOR_CHROME = ['stroke-dasharray', 'foreignObject', 'resize-handle', 'rotate-handle', 'marquee-rect'];

test('an export taken with items selected has no editor chrome in it', async ({ page }) => {
  // The export renders the canvas a second time off-screen; React complains
  // loudly on the console if that render is done wrong.
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    // The analytics scripts in the app shell can't always be fetched (offline
    // runs, sandboxes behind a proxy) and say nothing about the export.
    if (/Failed to load resource/i.test(message.text())) return;
    consoleErrors.push(message.text());
  });

  await page.goto('/creator');

  // Place a symbol (which leaves it selected), then select everything so the
  // multi-select alignment toolbar is on screen too.
  await page.locator('.symbol-button').first().click();
  await expect(page.locator('.canvas-item rect[stroke-dasharray]')).toHaveCount(1);

  await page.keyboard.press('ControlOrMeta+a');
  await expect(page.locator('.artboard .canvas-item rect[stroke-dasharray]').first()).toBeVisible();
  await expect(page.locator('.artboard foreignObject')).toHaveCount(1);
  await expect(page.locator('.artboard .rotate-handle').first()).toBeVisible();

  const download = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export SVG' }).click(),
  ]).then(([event]) => event);

  expect(download.suggestedFilename()).toBe('micrographic.svg');
  const file = await download.path();
  const markup = await readFile(file, 'utf8');

  expect(markup).toContain('xmlns="http://www.w3.org/2000/svg"');
  expect(markup).toContain('<text');
  expect(markup, 'the artwork itself should survive the export').toContain('QUIET');
  for (const chrome of EDITOR_CHROME) {
    expect(markup, `exported SVG should not contain ${chrome}`).not.toContain(chrome);
  }

  expect(consoleErrors).toEqual([]);

  // The canvas itself is untouched: this is about what gets serialized.
  await expect(page.locator('.artboard foreignObject')).toHaveCount(1);
  await expect(page.locator('.artboard .canvas-item rect[stroke-dasharray]').first()).toBeVisible();
});

// The alignment toolbar is a <foreignObject> of HTML buttons, which no browser
// rasterizes once the SVG is loaded as an image, so it could only ever damage a
// PNG. Check the PNG the same way a user would find out -- by downloading one.
test('the PNG export rasterizes with items selected', async ({ page }) => {
  await page.goto('/creator');

  await page.locator('.symbol-button').first().click();
  await page.keyboard.press('ControlOrMeta+a');
  await expect(page.locator('.artboard foreignObject')).toHaveCount(1);

  const download = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export PNG' }).click(),
  ]).then(([event]) => event);

  expect(download.suggestedFilename()).toBe('micrographic.png');
  const png = await readFile(await download.path());

  // A real raster, not an error or an empty blob. The byte count is not a blank
  // detector -- a flat fill of this size still compresses to tens of kilobytes --
  // so the markup assertions above carry the actual no-chrome guarantee; this
  // test guards the step they cannot reach: the browser decoding the exported
  // SVG and drawing it to a canvas.
  expect([...png.subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
  expect(png.byteLength).toBeGreaterThan(1000);
});

// The PNG used to be a hardcoded 2400x1600 with no way to ask for anything
// else, and every failure along the way was silent. Both are user-visible, so
// check them the way a user meets them: pick a size, export, read the file.
function pngSize(png: Buffer) {
  // IHDR is the first chunk of every PNG: width and height as big-endian
  // uint32s at byte 16 and byte 20.
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
}

async function downloadPng(page: Page) {
  const download = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export PNG' }).click(),
  ]).then(([event]) => event);

  expect(download.suggestedFilename()).toBe('micrographic.png');
  return readFile(await download.path());
}

test('the PNG export size is selectable and the default is unchanged', async ({ page }) => {
  await page.goto('/creator');
  await page.locator('.symbol-button').first().click();

  const defaultPng = await downloadPng(page);
  expect(pngSize(defaultPng)).toEqual({ width: 2400, height: 1600 });
  // Success is confirmed, naming the file that was written -- exports used to
  // say nothing at all, whether they worked or not.
  await expect(page.getByRole('status')).toHaveText('Saved micrographic.png (2400 × 1600).');

  await page.getByRole('combobox', { name: 'PNG size' }).click();
  await page.getByRole('option', { name: '4× · 4800 × 3200' }).click();

  const largePng = await downloadPng(page);
  expect(pngSize(largePng)).toEqual({ width: 4800, height: 3200 });
  expect(largePng.byteLength).toBeGreaterThan(defaultPng.byteLength);
  await expect(page.getByRole('status')).toHaveText('Saved micrographic.png (4800 × 3200).');

  // The smallest option is there too, and it really is smaller.
  await page.getByRole('combobox', { name: 'PNG size' }).click();
  await page.getByRole('option', { name: '1× · 1200 × 800' }).click();

  const smallPng = await downloadPng(page);
  expect(pngSize(smallPng)).toEqual({ width: 1200, height: 800 });
});

// Firefox will not rasterize an SVG loaded through an <img> unless its root
// carries width and height, so the PNG path depends on these being written.
// That cannot be exercised here -- this suite runs Chromium only -- but the
// attributes themselves can be, and they ride along in the downloaded .svg.
test('the exported SVG declares its own size alongside the viewBox', async ({ page }) => {
  await page.goto('/creator');

  const download = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export SVG' }).click(),
  ]).then(([event]) => event);

  const markup = await readFile(await download.path(), 'utf8');

  expect(markup).toContain('width="1200"');
  expect(markup).toContain('height="800"');
  expect(markup).toContain('viewBox="0 0 1200 800"');
  await expect(page.getByRole('status')).toHaveText('Saved micrographic.svg (1200 × 800).');
});

// A PNG export has several steps that genuinely fail in the wild -- a browser
// that will not decode the SVG, a refused 2D context, an encode that gives up
// on a 4800 x 3200 canvas. Each one used to leave the user with no file and
// nothing said. Stand in for that by refusing the context.
test('a PNG export that fails says so instead of going quiet', async ({ page }) => {
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function patched(this: HTMLCanvasElement, ...args: unknown[]) {
      if (args[0] === '2d') return null;
      return (getContext as (...a: unknown[]) => unknown).apply(this, args);
    } as typeof HTMLCanvasElement.prototype.getContext;
  });

  await page.goto('/creator');
  await page.getByRole('button', { name: 'Export PNG' }).click();

  await expect(page.getByRole('status')).toHaveText('Could not export the PNG: this browser gave no 2D canvas to draw into.');
});
