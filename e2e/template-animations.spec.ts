import { test, expect, type Page } from '@playwright/test';
import { templates } from '../src/data';

// Every template opens with a group or two already playing an entrance, so a
// new user meets Play and a working group without setting either up. Which
// groups, and the order they play in, is unit-tested in
// src/components/templates/animations.test.ts; this proves the editor shows
// and plays them.

const groupRows = (page: Page) => page.locator('.layer-row[data-group]');
const playButton = (page: Page) => page.locator('.stage-play');

async function chooseTemplate(page: Page, name: string) {
  await page.locator('.select-trigger').first().click();
  await page.locator('.select-item', { hasText: name }).click();
  await expect(page.locator('.select-trigger').first()).toContainText(name);
}

/** Each animated text item's delay in ms, by its text, after pressing Play. */
async function playedDelays(page: Page) {
  await playButton(page).click();
  return page.evaluate(() =>
    Object.fromEntries(
      [...document.querySelectorAll('g[class^="mg-anim-"]')].map((node) => {
        const effect = (node as SVGGElement).getAnimations()[0]?.effect as KeyframeEffect | undefined;
        return [node.querySelector('text')?.textContent ?? '', Number(effect?.getTiming().delay)];
      }),
    ),
  );
}

test('the default template opens with its headline group ready to play, top to bottom', async ({ page }) => {
  await page.goto('/creator');

  await expect(playButton(page)).toBeVisible();
  await expect(groupRows(page)).toHaveCount(1);
  await expect(groupRows(page)).toContainText('Group of 3');
  await expect(groupRows(page).locator('.layer-animate[data-on]')).toHaveCount(1);

  const delays = await playedDelays(page);
  // The word, then the rule and the caption under it -- and only those.
  expect(Object.keys(delays)).toHaveLength(3);
  const word = delays['QUIET'];
  const rule = Object.entries(delays).find(([text]) => text.startsWith('-'))?.[1];
  const caption = delays['NO SIGNAL DETECTED BETWEEN 04:00 AND 05:00'];
  expect(word).toBe(0);
  expect(rule).toBeGreaterThan(word);
  expect(caption).toBeGreaterThan(rule!);
});

for (const template of templates) {
  test(`${template.name} opens with one or two groups playing an entrance`, async ({ page }) => {
    await page.goto('/creator');
    await chooseTemplate(page, template.name);

    await expect(playButton(page)).toBeVisible();
    const count = await groupRows(page).count();
    expect(count).toBeGreaterThanOrEqual(1);
    expect(count).toBeLessThanOrEqual(2);
    await expect(groupRows(page).locator('.layer-animate[data-on]')).toHaveCount(count);
  });
}

test('starting from scratch leaves nothing to play', async ({ page }) => {
  await page.goto('/creator');
  await page.getByRole('button', { name: 'Start from scratch' }).click();

  await expect(groupRows(page)).toHaveCount(0);
  await expect(playButton(page)).toHaveCount(0);
});
