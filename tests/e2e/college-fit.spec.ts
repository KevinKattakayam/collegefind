import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { assertDisposableTestTarget } from '../integration/target';

function testClient() {
  const connectionString = assertDisposableTestTarget();
  expect(process.env.DATABASE_URL).toBe(connectionString);
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

test('CollegeFit restores keyboard-submitted preferences and keeps unknowns out of fit ranking', async ({ page }) => {
  const db = testClient();
  const key = randomUUID();
  const slug = `fit-${key}`;
  const city = `Fit City ${key.slice(0, 8)}`;
  const name = `Synthetic Fit College ${key.slice(0, 8)}`;
  try {
    await db.college.create({ data: { slug, name, shortName: 'Fit test', city, state: 'Test State', type: 'PRIVATE', dataStatus: 'DEMO', annualFees: 1 } });
    await page.goto('/collegefit');
    await page.getByLabel('City or state').fill(city);
    await page.getByRole('spinbutton', { name: 'Annual tuition budget (₹)', exact: true }).fill('1000');
    const submit = page.getByRole('button', { name: 'Find colleges' });
    await submit.focus();
    await expect(submit).toBeFocused();
    await page.keyboard.press('Enter');
    const result = page.getByRole('article').filter({ hasText: name });
    await expect(result.getByText('City or state · MATCH')).toBeVisible();
    await expect(result.getByText('Annual tuition budget · UNKNOWN')).toBeVisible();
    await expect(result.getByText(/Insufficient evidence for ranking/)).toBeVisible();
    await page.reload();
    await expect(page.getByLabel('City or state')).toHaveValue(city);
    await result.getByRole('button', { name: 'Save college' }).click();
    await expect(result.getByRole('button', { name: 'Saved', exact: true })).toBeVisible();
    await page.getByRole('link', { name: 'Open shortlist' }).click();
    await expect(page.getByText(name, { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(await page.evaluate(() => window.innerWidth));
  } finally {
    await db.college.deleteMany({ where: { slug } });
    await db.$disconnect();
  }
});

test('a selected reviewed cutoff compares a private rank and preserves source and seat scope', async ({ page, request }) => {
  const db = testClient();
  const key = randomUUID();
  const slug = `rank-${key}`;
  const email = `${slug}@example.test`;
  const sourceUrl = `https://example.test/${slug}`;
  try {
    const college = await db.college.create({ data: { slug, name: 'Synthetic Rank College', shortName: 'Rank test', city: 'Test City', state: 'Test State', type: 'PRIVATE' } });
    const program = await db.program.create({ data: { collegeId: college.id, name: 'Synthetic Engineering' } });
    const source = await db.source.create({ data: { name: 'Synthetic report', publisher: 'Synthetic Browser Authority', url: sourceUrl, retrievedAt: new Date() } });
    const user = await db.user.create({ data: { email, name: 'Synthetic Reviewer', password: 'fixture-only', role: 'ADMIN' } });
    await db.cutoffRecord.create({ data: { id: slug, programId: program.id, sourceId: source.id, counsellingSystem: 'JOSAA',
      rankType: 'CATEGORY', exam: 'JEE_ADVANCED', category: 'SC', quota: 'AI', seatPool: 'FEMALE_ONLY', year: 2025, round: 2, openingValue: 20, closingValue: 100 } });
    const before = await request.get(`/api/predict?cutoff=${slug}`);
    expect(await before.json()).toEqual({ status: 'INSUFFICIENT_VERIFIED_EVIDENCE', eligibility: 'NOT_CONFIRMED', observation: null });
    expect((await request.get('/api/predict?exam=JEE_MAIN&rank=10')).status()).toBe(400);
    await db.evidenceDecision.create({ data: { cutoffId: slug, reviewerId: user.id, status: 'APPROVED', reason: 'Synthetic test action' } });
    const year = new Date().getUTCFullYear();
    await db.fieldEvidence.createMany({ data: [
      { id: `${slug}-approved`, identityKey: `${slug}-approved`, collegeId: college.id, sourceId: source.id,
        programScope: 'Synthetic Engineering', academicYear: year, field: 'structured.admission',
        value: { kind: 'admission', programme: 'Synthetic Engineering', route: 'Synthetic counselling', category: 'SC',
          eligibility: 'Synthetic requirement for browser testing.' } },
      { id: `${slug}-staged`, identityKey: `${slug}-staged`, collegeId: college.id, sourceId: source.id,
        programScope: 'Synthetic Engineering / other scope', academicYear: year, field: 'structured.admission',
        value: { kind: 'admission', programme: 'Synthetic Engineering', route: 'Synthetic counselling', category: 'OPEN',
          eligibility: 'Unreviewed browser requirement.' } },
    ] });
    await db.evidenceDecision.create({ data: { evidenceId: `${slug}-approved`, reviewerId: user.id, status: 'APPROVED', reason: 'Synthetic test action' } });

    await page.goto(`/cutoffs?college=${slug}`);
    await page.getByRole('link', { name: 'Compare a rank with this record' }).click();
    await expect(page).toHaveURL(new RegExp(`/predictor\\?cutoff=${slug}$`));
    const history = page.getByRole('region', { name: 'Scrollable official cutoff results table' });
    await expect(history.getByRole('link', { name: 'Synthetic Browser Authority' })).toHaveAttribute('href', sourceUrl);
    await expect(history.getByRole('cell', { name: '2025 · Round 2', exact: true })).toBeVisible();
    await expect(history.getByRole('cell', { name: 'Female-only', exact: true })).toBeVisible();
    await expect(page.getByText('Synthetic requirement for browser testing.')).toBeVisible();
    await expect(page.getByText('Unreviewed browser requirement.')).toHaveCount(0);
    await expect(page.getByText(`Synthetic Engineering · SC · ${year}`)).toBeVisible();
    const rank = page.getByLabel('Your rank using the same rank definition');
    await rank.fill('5.5');
    await rank.press('Enter');
    await expect(page.getByRole('alert').filter({ hasText: 'Enter a whole rank' })).toBeVisible();
    await rank.fill('75');
    await rank.press('Enter');
    await expect(page.getByText('Your rank number is within the published opening and closing range.')).toBeVisible();
    await expect(page.getByText('Future admission probability is unavailable.')).toBeVisible();
    expect(new URL(page.url()).searchParams.has('rank')).toBe(false);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(await page.evaluate(() => window.innerWidth));
  } finally {
    await db.evidenceDecision.deleteMany({ where: { OR: [{ cutoffId: slug }, { evidenceId: `${slug}-approved` }] } });
    await db.fieldEvidence.deleteMany({ where: { id: { in: [`${slug}-approved`, `${slug}-staged`] } } });
    await db.college.deleteMany({ where: { slug } });
    await db.source.deleteMany({ where: { url: sourceUrl } });
    await db.user.deleteMany({ where: { email } });
    await db.$disconnect();
  }
});
