import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { hash } from 'bcryptjs';
import { assertDisposableTestTarget } from '../integration/target';

test('staged official candidate requires review and publishes across student views', async ({ page, request, isMobile }) => {
  test.skip(process.env.COLLEGEFIND_OWNER_STAGE_BROWSER !== 'true', 'Requires the dedicated staged archive rehearsal');
  const target = new URL(assertDisposableTestTarget());
  if (target.hostname !== '127.0.0.1' || target.port !== '35442' || target.username !== 'cf_owner_rehearsal' ||
    !/^\/collegefind_owner_rehearsal_[a-z0-9]+$/.test(target.pathname)) {
    throw new Error('This test requires the independently verified owner-staging rehearsal clone with Batch 029 already staged.');
  }
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: target.href }) });
  try {
    const slug = isMobile ? 'galgotias-university' : 'dit-university';
    const programme = isMobile ? 'B.Tech in Computer Science and Engineering' : 'B.Tech in Civil Engineering';
    const query = isMobile ? 'Computer Science and Engineering' : 'Civil Engineering';
    const college = await db.college.findUniqueOrThrow({ where: { slug } });
    const claim = await db.fieldEvidence.findFirstOrThrow({ where: {
      collegeId: college.id, field: 'structured.programme', value: { path: ['programme'], equals: programme },
    }, include: { source: true } });
    const profile = '/colleges/' + slug;
    const previousReviews = await db.auditLog.count({ where: { action: 'evidence.review', targetId: claim.id } });
    expect(await db.college.count()).toBe(205);
    await page.goto(profile);
    await expect(page.getByRole('navigation', { name: 'On this college profile' })).toBeVisible();
    await expect(page.locator('#programmes-and-admissions').getByText(programme, { exact: true })).toHaveCount(0);
    expect((await request.get('/api/admin/evidence')).status()).toBe(401);

    const email = `stage-rehearsal-${slug}-${Date.now()}@example.test`;
    const password = 'Disposable browser test only 6729!';
    await db.user.create({ data: { name: 'Rehearsal reviewer', email, password: await hash(password, 12), role: 'ADMIN' } });
    await page.goto('/login');
    await page.getByPlaceholder('Email address', { exact: true }).fill(email);
    await page.getByPlaceholder('Password', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Login', exact: true }).click();
    await expect.poll(() => new URL(page.url()).pathname).not.toBe('/login');

    const review = '/admin/enrichment?status=ALL&q=' + claim.id;
    await page.goto(review);
    const article = page.locator(`article[data-claim-id="${claim.id}"]`);
    await expect(article).toContainText(claim.evidenceLocator!);
    await expect(article.getByRole('link', { name: claim.source.url, exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: /Next unreviewed packet claim/ })).toBeVisible();
    await article.getByLabel('Review reason').fill('Disposable hold while checking programme scope');
    const heldResponse = page.waitForResponse((response) => response.url().endsWith('/api/admin/evidence') && response.request().method() === 'POST');
    await article.getByRole('button', { name: 'Hold', exact: true }).click();
    const held = await heldResponse;
    expect(held.status()).toBe(200);
    await expect(article.getByText('HELD', { exact: true })).toBeVisible();
    await page.reload();
    await expect(article.getByText('HELD', { exact: true })).toBeVisible();
    await article.getByLabel('Review reason').fill('Synthetic approval in disposable staging rehearsal');
    await article.getByRole('button', { name: 'Approve', exact: true }).click();
    await expect(article.getByText('VERIFIED', { exact: true })).toBeVisible();

    const year = new Date().getUTCFullYear();
    const fee = await db.fieldEvidence.create({ data: {
      collegeId: college.id, sourceId: claim.sourceId, field: 'structured.fee', academicYear: year, identityKey: randomUUID(),
      programScope: JSON.stringify([programme.toLowerCase(), 'rehearsal cohort', 'tuition', 'synthetic fee', 'semester']),
      value: { kind: 'fee', programme, category: 'Rehearsal cohort', feeType: 'TUITION',
        component: 'Synthetic fee', period: 'SEMESTER', amountInr: 12345 },
    } });
    const decision = { kind: 'field', id: fee.id, reason: 'Synthetic fee presentation test on disposable archive only' };
    expect((await page.request.post('/api/admin/evidence', { data: { ...decision, status: 'APPROVED' } })).status()).toBe(200);

    await page.goto(profile);
    const fees = page.locator('#fees');
    await expect(fees.getByRole('heading', { name: 'Fees (INR) · ' + year })).toBeVisible();
    await expect(fees.getByText('Per semester', { exact: true })).toBeVisible();
    await expect(fees.getByText('₹12,345', { exact: true })).toBeVisible();
    await expect(fees.getByText('Rehearsal cohort', { exact: true })).toBeVisible();
    await expect(fees.getByRole('link', { name: claim.source.publisher, exact: true })).toHaveAttribute('href', claim.source.url);
    expect((await page.request.post('/api/admin/evidence', { data: { ...decision, status: 'REJECTED' } })).status()).toBe(200);
    const programmes = page.locator('#programmes-and-admissions');
    await expect(programmes.getByText(programme, { exact: true })).toBeVisible();
    await expect(programmes.getByText('4 years', { exact: true })).toBeVisible();
    await expect(programmes.getByRole('link', { name: claim.source.publisher, exact: true })).toHaveAttribute('href', claim.source.url);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const search = await request.get('/api/colleges?programme=' + encodeURIComponent(query));
    expect(search.ok()).toBe(true);
    expect((await search.json()).colleges.map((row: { slug: string }) => row.slug)).toContain(slug);
    await page.goto('/compare?colleges=' + slug + ',indian-institute-of-technology-roorkee');
    await expect(page.getByText(programme, { exact: false }).first()).toBeVisible();
    await page.goto('/collegefit?programme=' + encodeURIComponent(query));
    const fit = page.locator('article').filter({ has: page.getByRole('link', { name: college.name, exact: true }) });
    await expect(fit.getByText('Comparable on selected preferences', { exact: false })).toBeVisible();

    await page.goto(review);
    await article.getByLabel('Review reason').fill('Synthetic rejection after the publication assertion');
    await article.getByRole('button', { name: 'Reject', exact: true }).click();
    await expect(article.getByText('REJECTED', { exact: true })).toBeVisible();
    await page.goto(profile);
    await expect(page.locator('#programmes-and-admissions').getByText(programme, { exact: true })).toHaveCount(0);
    expect(await db.auditLog.count({ where: { action: 'evidence.review', targetId: claim.id } })).toBe(previousReviews + 3);
    expect(await db.college.count()).toBe(205);
  } finally {
    await db.$disconnect();
  }
});
