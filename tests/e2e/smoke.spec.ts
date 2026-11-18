import { comparisonFixture } from './fixtures';
import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { assertDisposableTestTarget } from '../integration/target';

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
  const connectionString = assertDisposableTestTarget();
  expect(process.env.DATABASE_URL).toBe(connectionString);
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  const slug = `synthetic-search-${randomUUID()}`;
  const name = `Synthetic Search College ${slug.slice(-12)}`;
  try {
    await db.college.create({
      data: { slug, name, shortName: 'Synthetic Search', city: 'Test City', state: 'Test State', type: 'PRIVATE', dataStatus: 'DEMO' },
    });
    await page.goto('/colleges');
    await page.getByLabel('Search colleges, cities, or states').fill(name);
    await expect.poll(() => new URL(page.url()).searchParams.get('search')).toBe(name);
    const result = page.getByRole('article').filter({ hasText: name });
    await expect(result).toBeVisible({ timeout: 10_000 });
    await result.getByRole('link', { name: 'View details' }).click();
    await expect(page).toHaveURL(new RegExp(`/colleges/${slug}$`));
    await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
    await expect(page.getByText('Demo data').first()).toBeVisible();
  } finally {
    try { await db.college.deleteMany({ where: { slug } }); }
    finally { await db.$disconnect(); }
  }
});

test('a missing college returns a real 404', async ({ page }) => {
  const res = await page.goto('/colleges/this-college-does-not-exist');
  expect(res?.status()).toBe(404);
});

test('the predictor validates input and excludes unreviewed demo cutoffs', async ({ page }) => {
  await page.goto('/predictor');
  await page.getByLabel('Exam').selectOption('CAT');
  await page.getByLabel('Percentile (0–100)').fill('150');
  await page.getByRole('button', { name: 'Estimate my chances' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'CAT percentile' })).toContainText('between 0 and 100');

  await page.getByLabel('Exam').selectOption('JEE Main (JoSAA: NITs, IIITs, GFTIs)');
  await page.getByLabel('CRL (Common Rank List) rank').fill('12000');
  await page.getByRole('button', { name: 'Estimate my chances' }).click();
  await expect(page.getByRole('heading', { name: 'No official cutoff data loaded for this exam yet' })).toBeVisible();
  await expect(page.getByText('Why this estimate?')).toHaveCount(0);
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

test('comparison share URL serializes canonical slugs', async ({ page }) => {
  await page.route('**/api/colleges/*', (route) => route.fulfill({ json: { college: comparisonFixture(route.request().url().split('/').pop()!) } }));
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', { configurable: true, value: async (data: ShareData) => { (window as Window & { sharedUrl?: string }).sharedUrl = data.url; } });
  });
  await page.goto('/compare?colleges=iit-bombay,nit-trichy');
  await page.getByRole('button', { name: 'Share' }).click();
  await expect.poll(() => page.evaluate(() => (window as Window & { sharedUrl?: string }).sharedUrl)).toContain('/compare?colleges=iit-bombay,nit-trichy');
});
