import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import policy from '../../data/pilot/source-reported-release.json';
import { eligibleSourceReported } from '../../src/server/source-reported';

test('source-reported programmes render with campus, duration and provenance across the pilot', async ({ page, request, isMobile }) => {
  test.skip(process.env.COLLEGEFIND_REPORTED_BROWSER !== 'true', 'Requires the isolated catalogue archive rehearsal');
  test.setTimeout(90_000);
  // Keep the main owner-stage test free to exercise live hold and rejection on its own two colleges.
  const main = page.getByRole('main');
  const slugs = [...new Set(policy.records.map(({ slug }) => slug))].filter((slug) => !['dit-university', 'galgotias-university'].includes(slug));
  for (const slug of slugs) {
    const records = policy.records.filter((row) => row.slug === slug);
    const expected = eligibleSourceReported({ slug, id: records[0].collegeId });
    expect(expected).toHaveLength(records.length);
    await page.goto('/colleges/' + slug + '#programmes-and-admissions');
    const cards = main.locator('#programmes-and-admissions [data-evidence-status="OFFICIAL_SOURCE_REPORTED"]');
    await expect(cards).toHaveCount(expected.length);
    for (const [index, item] of expected.entries()) {
      if (item.value.kind !== 'programme') throw new Error('Expected programme pilot');
      const card = cards.nth(index);
      await expect(card.getByRole('heading', { name: item.value.programme, exact: true })).toBeVisible();
      await expect(card.getByText('Source-reported; not independently verified', { exact: true })).toBeVisible();
      await expect(card).toContainText(item.campus);
      await expect(card).toContainText(item.evidenceLocation);
      await expect(card.getByRole('link', { name: item.publisher + ' · ' + item.sourceTitle, exact: true })).toHaveAttribute('href', item.url);
    }
  }
  await page.goto('/colleges/indian-institute-of-technology-kharagpur#programmes-and-admissions');
  const section = main.locator('#programmes-and-admissions');
  await expect(section).toContainText('Undergraduate · 4 years');
  await expect(section.locator('[data-evidence-status="VERIFIED"]')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const screenshotDir = process.env.CF_PROFILE_SCREENSHOTS;
  if (screenshotDir) await section.screenshot({ path: join(screenshotDir, isMobile ? 'after-mobile.png' : 'after-desktop.png') });
  const profile = await request.get('/api/colleges/indian-institute-of-technology-kharagpur');
  expect(profile.ok()).toBe(true);
  const { college } = await profile.json();
  expect(college.structuredFacts).toEqual([]);
  expect(college).not.toHaveProperty('sourceReported');

  await page.goto('/colleges/ashoka-university#fees');
  await expect(main.locator('#fees')).toContainText('Not verified yet');
  await expect(main.locator('[data-evidence-status="OFFICIAL_SOURCE_REPORTED"]')).toHaveCount(0);
  await page.goto('/colleges/indian-institute-of-technology-kanpur');
  await expect(main.locator('[data-evidence-status="OFFICIAL_SOURCE_REPORTED"]')).toHaveCount(0);
});
