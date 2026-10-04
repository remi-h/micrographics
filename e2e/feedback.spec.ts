import { test, expect } from '@playwright/test';

// Feedback leaves the app for GitHub's new-issue page. The page itself is
// stubbed here: what matters is the address the app sends people to.
test.beforeEach(async ({ context }) => {
  await context.route('https://github.com/**', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<title>GitHub</title>' }),
  );
});

const feedbackButton = (page: import('@playwright/test').Page) => page.getByRole('button', { name: 'Feedback?' });

test('on a laptop, Feedback? under the canvas opens a prefilled GitHub issue', async ({ page, context }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/creator');

  // Under the artboard, not over it.
  const button = feedbackButton(page);
  await expect(button).toBeVisible();
  const [buttonBox, artboardBox] = await Promise.all([
    button.boundingBox(),
    page.locator('.artboard-wrap').boundingBox(),
  ]);
  expect(buttonBox!.y).toBeGreaterThanOrEqual(artboardBox!.y + artboardBox!.height);
  expect(buttonBox!.y + buttonBox!.height).toBeLessThanOrEqual(900);

  await button.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Bug' }).click();
  await dialog.getByLabel('Title').fill('GIF export stalls');
  await dialog.getByLabel('Details (optional)').fill('Rendering frames never finishes.');

  const [issue] = await Promise.all([
    context.waitForEvent('page'),
    dialog.getByRole('button', { name: 'Continue on GitHub' }).click(),
  ]);
  await issue.waitForLoadState();
  const url = new URL(issue.url());
  expect(`${url.origin}${url.pathname}`).toBe('https://github.com/remi-h/micrographics/issues/new');
  expect(url.searchParams.get('title')).toBe('[Bug] GIF export stalls');
  expect(url.searchParams.get('body')).toContain('Rendering frames never finishes.');
  expect(url.searchParams.get('body')).toContain('template: 001 Quiet');

  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('Feedback? is not offered below laptop width', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 900 });
  await page.goto('/creator');

  await expect(page.locator('.artboard-wrap')).toBeVisible();
  await expect(feedbackButton(page)).toBeHidden();
});

test('the homepage footer links to the repository', async ({ page }) => {
  await page.goto('/');
  const link = page.getByRole('navigation', { name: 'Footer' }).getByRole('link', { name: 'GitHub' });
  await expect(link).toHaveAttribute('href', 'https://github.com/remi-h/micrographics');
  await expect(link).toHaveAttribute('target', '_blank');
});
