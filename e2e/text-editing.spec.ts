import { test, expect, type Page } from '@playwright/test';

// A text item used to be drawn two different ways: an SVG <text> when idle,
// and an HTML <textarea> layered over it while editing. The textarea wrapped
// and <text> does not, so a long line filled the box while being edited and
// then rendered as one long line afterwards, and the selection outline was
// sized from the committed text so it could not grow while typing.
//
// Now the <text> draws in both states and the textarea is a transparent input
// layer over it. These tests pin that: the geometry must not change when
// editing starts, and it must follow the draft as lines are added.

async function geometry(page: Page) {
  return page.evaluate(() => {
    const group = document.querySelector('g.canvas-item:has(rect[stroke-dasharray])');
    const text = group?.querySelector('text');
    const outline = group?.querySelector('rect[stroke-dasharray]');
    if (!text || !outline) return null;

    const round = (box: DOMRect) => ({
      x: Math.round(box.x * 10) / 10,
      y: Math.round(box.y * 10) / 10,
      width: Math.round(box.width * 10) / 10,
      height: Math.round(box.height * 10) / 10,
    });
    return { ink: round(text.getBoundingClientRect()), outline: round(outline.getBoundingClientRect()) };
  });
}

async function selectATextItem(page: Page) {
  const rows = page.locator('.layer-row');
  const count = await rows.count();
  for (let index = 0; index < count; index += 1) {
    if (!/symbol/i.test(await rows.nth(index).innerText())) {
      await rows.nth(index).click();
      return;
    }
  }
  throw new Error('expected a text layer in the default template');
}

test('a text item looks the same being edited as it does idle', async ({ page }) => {
  await page.goto('/creator');
  await selectATextItem(page);
  await expect(page.locator('.canvas-item rect[stroke-dasharray]')).toHaveCount(1);

  const idle = await geometry(page);
  expect(idle).not.toBeNull();

  await page.locator('g.canvas-item:has(rect[stroke-dasharray])').dblclick();
  await expect(page.locator('.canvas-text-editor')).toBeVisible();

  // Same element, same metrics: starting an edit must move nothing.
  await expect.poll(() => geometry(page)).toEqual(idle);
});

test('the selection outline grows as lines are added', async ({ page }) => {
  await page.goto('/creator');
  await selectATextItem(page);
  await page.locator('g.canvas-item:has(rect[stroke-dasharray])').dblclick();
  await expect(page.locator('.canvas-text-editor')).toBeVisible();

  const before = await geometry(page);
  expect(before).not.toBeNull();

  await page.keyboard.press('End');
  await page.keyboard.type('\nA SECOND LINE');

  await expect
    .poll(async () => (await geometry(page))?.outline.height ?? 0)
    .toBeGreaterThan(before!.outline.height);
});

test('committed text renders where the draft was', async ({ page }) => {
  await page.goto('/creator');
  await selectATextItem(page);
  await page.locator('g.canvas-item:has(rect[stroke-dasharray])').dblclick();
  await expect(page.locator('.canvas-text-editor')).toBeVisible();

  await page.keyboard.press('End');
  await page.keyboard.type('\nA SECOND LINE');
  await page.waitForFunction(() => {
    const editor = document.querySelector('.canvas-text-editor') as HTMLTextAreaElement | null;
    return !!editor && editor.value.includes('A SECOND LINE');
  });
  const draft = await geometry(page);
  expect(draft).not.toBeNull();

  // Commit by blurring, then re-select the same item.
  await page.locator('.artboard').click({ position: { x: 4, y: 4 } });
  await expect(page.locator('.canvas-text-editor')).toHaveCount(0);
  await selectATextItem(page);

  // What was on screen mid-edit is what is on screen afterwards.
  await expect.poll(() => geometry(page)).toEqual(draft);
});

// While editing, the <text> paints over the textarea. Under SVG's default
// visiblePainted hit-testing that lets the glyph ink swallow a click meant for
// the caret: the event reaches the group's drag handler and blurs the editor,
// so clicking a character to move the caret committed the edit and started
// dragging the item. Clicks landing between glyphs still reached the textarea,
// which made it look intermittent.
test('clicking a character while editing moves the caret, it does not end the edit', async ({ page }) => {
  await page.goto('/creator');
  await selectATextItem(page);
  await page.locator('g.canvas-item:has(rect[stroke-dasharray])').dblclick();

  const editor = page.locator('.canvas-text-editor');
  await expect(editor).toBeVisible();

  // A point inside the rendered glyphs of the item being edited.
  const point = await page.evaluate(() => {
    const group = document.querySelector('g.canvas-item:has(.canvas-text-editor)');
    const text = group?.querySelector('text');
    if (!text) return null;
    const box = text.getBoundingClientRect();
    return { x: box.left + 4, y: box.top + box.height / 2 };
  });
  expect(point, 'expected the edited item to render text').not.toBeNull();

  // The textarea must be what is under the pointer there, not the glyph ink.
  await expect
    .poll(() =>
      page.evaluate((at) => document.elementFromPoint(at.x, at.y)?.tagName, point!),
    )
    .toBe('TEXTAREA');

  await page.mouse.click(point!.x, point!.y);

  // Still editing: the click went to the caret, not to a drag.
  await expect(editor).toBeVisible();
});
