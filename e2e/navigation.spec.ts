import { test, expect } from '@playwright/test';

test('landing page links into the creator tool', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();

  await page.getByRole('link', { name: /open tool/i }).first().click();

  await expect(page).toHaveURL('/creator');
});

test('creator tool renders its control panel', async ({ page }) => {
  await page.goto('/creator');

  await expect(page.locator('svg').first()).toBeVisible();
});
