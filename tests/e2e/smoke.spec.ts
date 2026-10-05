import { expect, test } from '@playwright/test';

/**
 * Smoke tests against a built app with a seeded database.
 * Run: npm run build && npm run test:e2e
 */
test('home page states what the product does without fake social proof', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByText('Trusted by 10,000+ students')).toHaveCount(0);
  await expect(page.getByText('Priya Sharma')).toHaveCount(0);
});

test('a visitor can search and open a college', async ({ page }) => {
  await page.goto('/colleges');
  await page.getByLabel('Search colleges, cities, or states').fill('Synthetic');
  await expect(page.getByRole('article').first()).toBeVisible({ timeout: 10_000 });
  await page.getByRole('link', { name: 'View details' }).first().click();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByText('Demo data').first()).toBeVisible();
});

test('a missing college returns a real 404', async ({ page }) => {
  const res = await page.goto('/colleges/this-college-does-not-exist');
  expect(res?.status()).toBe(404);
});

test('the predictor validates input and explains its estimates', async ({ page }) => {
  await page.goto('/predictor');
  await page.getByLabel('Exam').selectOption('CAT');
  await page.getByLabel('Percentile (0–100)').fill('150');
  await page.getByRole('button', { name: 'Estimate my chances' }).click();
  await expect(page.getByRole('alert')).toContainText('between 0 and 100');

  await page.getByLabel('Exam').selectOption('JEE Main (JoSAA: NITs, IIITs, GFTIs)');
  await page.getByLabel('CRL (Common Rank List) rank').fill('12000');
  await page.getByRole('button', { name: 'Estimate my chances' }).click();
  await expect(page.getByText('Read this first')).toBeVisible();
  await page.getByText('Why this estimate?').first().click();
  await expect(page.getByText(/Past final-round closing rank/).first()).toBeVisible();
});

test('saving a college requires signing in', async ({ page }) => {
  await page.goto('/saved');
  await expect(page).toHaveURL(/\/login/);
});

test('keyboard users get a skip link and visible focus', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to main content' })).toBeFocused();
});
