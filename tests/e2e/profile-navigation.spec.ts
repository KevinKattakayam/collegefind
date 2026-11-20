import { expect, test } from '@playwright/test';

test('sparse and sourced archive profiles guide students without leaking unreviewed claims', async ({ page, request }) => {
  test.skip(process.env.COLLEGEFIND_OWNER_STAGE_BROWSER !== 'true', 'Requires independently verified archive rehearsal');
  await page.goto('/colleges/psg-college-of-technology');
  await expect(page.getByRole('heading', { level: 1, name: /PSG/ })).toBeVisible();
  await expect(page.getByText('Catalogue identity', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/Coimbatore, Tamil Nadu/).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'AISHE directory' })).toHaveAttribute('href', 'https://dashboard.aishe.gov.in/');
  const localNav = page.getByRole('navigation', { name: 'On this college profile' });
  await localNav.getByRole('link', { name: 'Hostels & facilities' }).click();
  await expect(page).toHaveURL(/#facilities$/);
  await expect(page.getByRole('heading', { name: 'Hostels and facilities' })).toBeVisible();
  await page.getByRole('link', { name: 'Open the cutoff explorer for this college' }).click();
  await expect(page).toHaveURL(/\/cutoffs\?college=psg-college-of-technology/);

  await page.goto('/colleges/op-jindal-university');
  await expect(page.getByRole('link', { name: 'Official institution website' })).toHaveAttribute('href', 'https://jgu.edu.in/');
  await expect(page.getByRole('link', { name: 'Institution admissions information' })).toHaveAttribute('href', 'https://jgu.edu.in/admissions/');
  await expect(page.locator('a[href*="opju.ac.in"]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Save college', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Saved', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Add to compare', exact: true }).click();
  await expect(page.getByRole('button', { name: 'In compare', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Saved', exact: true })).toHaveAttribute('aria-pressed', 'true');

  await page.goto('/colleges/iiit-bangalore');
  await expect(page.getByRole('link', { name: 'B.Tech and integrated M.Tech admissions, fees and aid (2026–27 reference)' })).toBeVisible();
  await expect(page.getByText('IIIT Bangalore · 2026–27 closed intake', { exact: false })).toBeVisible();
  await expect(page.locator('#fees')).toContainText('Not verified yet');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  const response = await request.get('/api/colleges/dit-university');
  expect(response.ok()).toBe(true);
  expect(await response.json()).toMatchObject({ college: { slug: 'dit-university', annualFees: null, placementPct: null, structuredFacts: [] } });
});
