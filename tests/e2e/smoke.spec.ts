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

test('college search input and filters restore from browser history', async ({ page }) => {
  await page.goto('/colleges?search=first-query&city=Chennai&type=GOVERNMENT');
  const search = page.getByLabel('Search colleges, cities, or states');
  await expect(search).toHaveValue('first-query');
  await search.fill('second-query');
  await expect.poll(() => new URL(page.url()).searchParams.get('search')).toBe('second-query');
  await page.goBack();
  await expect.poll(() => new URL(page.url()).searchParams.get('search')).toBe('first-query');
  await expect(search).toHaveValue('first-query');
  await expect(new URL(page.url()).searchParams.get('city')).toBe('Chennai');
  await page.reload();
  await expect(search).toHaveValue('first-query');
});

test('mobile college filter sheet manages keyboard focus and Escape dismissal', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Mobile filter sheet only');
  await page.goto('/colleges');
  const trigger = page.getByRole('button', { name: 'Filters' });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: 'Filters' });
  const close = dialog.getByRole('button', { name: 'Close filters' });
  await expect(close).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(dialog.locator(':focus')).toHaveCount(1);
  await page.keyboard.press('Tab');
  await expect(close).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test('a missing college renders the not-found page and is excluded from indexing', async ({ page }) => {
  await page.goto('/colleges/this-college-does-not-exist');
  await expect(page.getByRole('heading', { name: '404', level: 1 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Page Not Found', level: 2 })).toBeVisible();
  await expect(page.locator('head meta[name="robots"][content*="noindex"]').first()).toHaveAttribute('content', /noindex/);
  await expect(page.locator('head meta[name="robots"][content*="index, follow"]')).toHaveCount(0);
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

test('a visitor can keep a temporary shortlist on this device', async ({ page }) => {
  const connectionString = assertDisposableTestTarget();
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  const slug = `guest-shortlist-${randomUUID()}`;
  const name = `Guest Shortlist Fixture ${slug.slice(-10)}`;
  try {
    await db.college.create({ data: { slug, name, shortName: 'Guest shortlist', city: 'Test City', state: 'Test State', type: 'PRIVATE', dataStatus: 'DEMO' } });
    await page.goto(`/colleges?search=${encodeURIComponent(name)}`);
    const card = page.getByRole('article').filter({ hasText: name });
    await expect(card).toBeVisible();
    await card.getByRole('button', { name: `Save ${name}` }).click();
    await page.goto('/saved');
    await expect(page.getByText('saved on this device')).toBeVisible();
    await expect(page.getByRole('article').filter({ hasText: name })).toBeVisible();
    await page.getByRole('button', { name: `Remove ${name} from saved` }).click();
    await expect(page.getByRole('heading', { name: 'Nothing saved yet' })).toBeVisible();
  } finally {
    try { await db.college.deleteMany({ where: { slug } }); }
    finally { await db.$disconnect(); }
  }
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

test('cutoff explorer keeps filters in the URL and restores them after navigation', async ({ page }) => {
  await page.goto('/cutoffs?q=phase4-no-match&yearFrom=2020&yearTo=2024&category=OBC_NCL&pageSize=25');
  await expect(page.getByRole('heading', { name: 'Cutoff explorer' })).toBeVisible();
  await expect(page.getByLabel('Search institution or programme')).toHaveValue('phase4-no-match');
  await expect(page.getByLabel('From year')).toHaveValue('2020');
  await expect(page.getByLabel('To year')).toHaveValue('2024');
  await expect(page.locator('main').getByText('No reviewed official cutoff records match these filters.').first()).toBeVisible();

  await page.getByLabel('Search institution or programme').fill('another-no-match');
  await page.getByRole('button', { name: 'Apply filters' }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get('q')).toBe('another-no-match');
  await expect(page.getByLabel('Reservation category')).toHaveValue('OBC_NCL');
  await page.goBack();
  await expect.poll(() => new URL(page.url()).searchParams.get('q')).toBe('phase4-no-match');
  await expect(page.getByLabel('Search institution or programme')).toHaveValue('phase4-no-match');
  await page.goForward();
  await expect.poll(() => new URL(page.url()).searchParams.get('q')).toBe('another-no-match');
  await page.reload();
  await expect(page.getByLabel('Search institution or programme')).toHaveValue('another-no-match');
  await expect(page.getByLabel('Reservation category')).toHaveValue('OBC_NCL');
});

test('cutoff explorer handles invalid filters and stays within a narrow viewport', async ({ page }) => {
  await page.goto('/cutoffs?yearFrom=2025&yearTo=2020');
  await expect(page.getByRole('heading', { name: 'Invalid cutoff filters' })).toBeVisible();
  await expect(page.locator('main').getByRole('alert')).toContainText('Year ranges must be ordered');
  await page.getByRole('link', { name: 'Clear filters' }).click();
  await expect(page.getByRole('heading', { name: 'Cutoff explorer' })).toBeVisible();
  const dimensions = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.width);
  await expect(page.getByLabel('Counselling system')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Cutoff result pages' })).toBeVisible();
});

test('keyboard users can filter cutoffs and receive an announced result count', async ({ page }) => {
  await page.goto('/cutoffs');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to main content' })).toBeFocused();

  const search = page.getByLabel('Search institution or programme');
  for (let index = 0; index < 40 && !(await search.evaluate((element) => element === document.activeElement)); index++) {
    await page.keyboard.press('Tab');
  }
  await expect(search).toBeFocused();
  expect(await search.evaluate((element) => element.matches(':focus-visible'))).toBe(true);
  await page.keyboard.type('keyboard-empty-result');

  const apply = page.getByRole('button', { name: 'Apply filters' });
  for (let index = 0; index < 20 && !(await apply.evaluate((element) => element === document.activeElement)); index++) {
    await page.keyboard.press('Tab');
  }
  await expect(apply).toBeFocused();
  await page.keyboard.press('Enter');
  await expect.poll(() => new URL(page.url()).searchParams.get('q')).toBe('keyboard-empty-result');
  await expect(page.locator('#main [aria-live="polite"]').filter({ hasText: 'Reviewed records' })).toContainText('0 results');
  await expect(page.getByLabel('Institution', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Rank definition')).toBeVisible();
});

test('a college profile links to its own reviewed cutoff history', async ({ page }) => {
  const connectionString = assertDisposableTestTarget();
  expect(process.env.DATABASE_URL).toBe(connectionString);
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  const slug = `synthetic-cutoff-profile-${randomUUID()}`;
  let userId: string | undefined;
  let sourceId: string | undefined;
  let collegeId: string | undefined;
  let programId: string | undefined;
  const cutoffIds: string[] = [];
  try {
    const user = await db.user.create({ data: { name: 'Synthetic cutoff reviewer', email: `${slug}@example.test`, password: 'fixture', role: 'ADMIN' } });
    userId = user.id;
    const source = await db.source.create({ data: { name: 'Synthetic cutoff source', publisher: 'SYNTHETIC TEST AUTHORITY', url: 'https://example.test/cutoffs', retrievedAt: new Date() } });
    sourceId = source.id;
    const college = await db.college.create({ data: { slug, name: 'Synthetic Cutoff College', shortName: 'Synthetic Cutoff', city: 'Test City', state: 'Test State', type: 'GOVERNMENT', dataStatus: 'UNVERIFIED' } });
    collegeId = college.id;
    const program = await db.program.create({ data: { collegeId, name: 'Synthetic Bachelor of Technology (4 Years)', branch: 'Synthetic Engineering', degree: 'B.Tech', durationYears: 4 } });
    programId = program.id;
    const dimensions = { programId, exam: 'GATE' as const, counsellingSystem: 'OTHER' as const, rankType: 'MERIT' as const, quota: 'TEST', category: 'OPEN' as const, seatPool: 'GENDER_NEUTRAL' as const, metric: 'RANK' as const, isPwd: false, sourceId };
    const cutoffs = await Promise.all([
      db.cutoffRecord.create({ data: { ...dimensions, evidenceLocator: 'Synthetic table row 2', year: 2022, round: 1, openingValue: 500, closingValue: 900 } }),
      db.cutoffRecord.create({ data: { ...dimensions, evidenceLocator: 'Synthetic table row 3', year: 2025, round: 1, openingValue: 400, closingValue: 800 } }),
      db.cutoffRecord.create({ data: { ...dimensions, evidenceLocator: 'Synthetic table row 4', year: 2025, round: 2, openingValue: null, closingValue: 700 } }),
    ]);
    cutoffIds.push(...cutoffs.map(({ id }) => id));
    await db.evidenceDecision.createMany({ data: cutoffIds.map((cutoffId) => ({ cutoffId, reviewerId: userId!, status: 'APPROVED', reason: 'Synthetic browser publication fixture only' })) });

    await page.goto(`/colleges/${slug}`);
    await expect(page.getByRole('heading', { name: 'Reviewed historical cutoffs' })).toBeVisible();
    await expect(page.getByText('Synthetic Engineering', { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'SYNTHETIC TEST AUTHORITY' }).first()).toHaveAttribute('href', 'https://example.test/cutoffs');
    await page.getByRole('link', { name: 'Open the cutoff explorer for this college' }).click();
    await expect(page).toHaveURL(new RegExp(`/cutoffs\\?college=${slug}$`));
    await expect(page.getByRole('heading', { name: 'Cutoff explorer' })).toBeVisible();
    await expect(page.getByText('Synthetic Engineering', { exact: true }).first()).toBeVisible();
    await page.goto(`/cutoffs?college=${slug}&program=Synthetic%20Engineering&counsellingSystem=OTHER&rankType=MERIT&exam=GATE&category=OPEN&quota=TEST&seatPool=GENDER_NEUTRAL&isPwd=false&metric=RANK`);
    await expect(page.getByRole('heading', { name: 'Historical rank trend' })).toBeVisible();
    await expect(page.getByLabel('Rank definition')).toHaveValue('MERIT');
    await expect(page.getByRole('img', { name: /Opening and closing rank history/ })).toBeVisible();
    await expect(page.getByRole('table', { name: /Opening and closing rank values and official sources/ })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Scrollable cutoff trend chart' })).toHaveAttribute('tabindex', '0');
    await expect(page.getByRole('region', { name: 'Cutoff trend data table' })).toHaveAttribute('tabindex', '0');
    await expect(page.getByText('No reviewed record for this year and round; no value is estimated.').first()).toBeVisible();
    const trendTable = page.getByRole('region', { name: 'Cutoff trend data table' });
    await expect(trendTable.getByText('Evidence location: Synthetic table row 2')).toBeVisible();
    await expect(trendTable.getByRole('link', { name: 'SYNTHETIC TEST AUTHORITY' })).toHaveCount(3);
    const viewport = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
    expect(viewport.scrollWidth).toBeLessThanOrEqual(viewport.width);
  } finally {
    if (cutoffIds.length) await db.evidenceDecision.deleteMany({ where: { cutoffId: { in: cutoffIds } } });
    if (cutoffIds.length) await db.cutoffRecord.deleteMany({ where: { id: { in: cutoffIds } } });
    if (programId) await db.program.delete({ where: { id: programId } });
    if (collegeId) await db.college.delete({ where: { id: collegeId } });
    if (sourceId) await db.source.delete({ where: { id: sourceId } });
    if (userId) await db.user.delete({ where: { id: userId } });
    await db.$disconnect();
  }
});
