import { expect, test } from '@playwright/test';

test('sparse and sourced archive profiles guide students without leaking unreviewed claims', async ({ page, request }) => {
  test.skip(process.env.COLLEGEFIND_OWNER_STAGE_BROWSER !== 'true' && process.env.COLLEGEFIND_REPORTED_BROWSER !== 'true',
    'Requires independently verified archive rehearsal');
  const main = page.locator('#main');
  await page.goto('/colleges/psg-college-of-technology');
  await expect(main.getByRole('heading', { level: 1, name: /PSG/ })).toBeVisible();
  await expect(main.getByText('Catalogue identity', { exact: true }).first()).toBeVisible();
  await expect(main.getByText(/Coimbatore, Tamil Nadu/).first()).toBeVisible();
  await expect(main.getByRole('link', { name: 'AISHE directory' })).toHaveAttribute('href', 'https://dashboard.aishe.gov.in/');
  const localNav = main.getByRole('navigation', { name: 'On this college profile' });
  await localNav.getByRole('link', { name: 'Hostels & facilities' }).click();
  await expect(page).toHaveURL(/#facilities$/);
  await expect(main.getByRole('heading', { name: 'Hostels and facilities' })).toBeVisible();
  await main.getByRole('link', { name: 'Open the cutoff explorer for this college' }).click();
  await expect(page).toHaveURL(/\/cutoffs\?college=psg-college-of-technology/);

  await page.goto('/colleges/op-jindal-university');
  await expect(main.getByRole('link', { name: 'Official institution website' })).toHaveAttribute('href', 'https://jgu.edu.in/');
  await expect(main.getByRole('link', { name: 'Institution admissions information', exact: true })).toHaveAttribute('href', 'https://jgu.edu.in/admissions/');
  await expect(main.locator('a[href*="opju.ac.in"]')).toHaveCount(0);
  await main.getByRole('button', { name: 'Save college', exact: true }).click();
  await expect(main.getByRole('button', { name: 'Saved', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await main.getByRole('button', { name: 'Add to compare', exact: true }).click();
  await expect(main.getByRole('button', { name: 'In compare', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await expect(main.getByRole('button', { name: 'Saved', exact: true })).toHaveAttribute('aria-pressed', 'true');

  await page.goto('/colleges/iiit-bangalore');
  await expect(main.getByRole('link', { name: 'B.Tech and integrated M.Tech admissions, fees and aid (2026–27 reference)', exact: true })).toBeVisible();
  await expect(main.getByText('IIIT Bangalore · 2026–27 closed intake', { exact: false })).toBeVisible();
  await expect(main.locator('#fees')).toContainText('Not verified yet');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  const examples = [
    { slug: 'bits-pilani', institution: /BITS Pilani/, label: 'B.E. Computer Science programme', url: 'https://www.bits-pilani.ac.in/academics/integrated-first-degree/b-e-computer-science/' },
    { slug: 'maulana-azad-medical-college', institution: /Maulana Azad/, label: 'Undergraduate programme information', url: 'https://mamc.delhi.gov.in/mamc/undergraduate-admission' },
    { slug: 'nirma-university', institution: /Nirma/, label: 'Institute of Law programmes and CLAT 2027 information', url: 'https://law.nirmauni.ac.in/admission-aid/frequently-asked-questions/' },
    { slug: 'iim-nagpur', institution: /Nagpur/, label: 'MBA fees and financial aid (2026–28 reference)', url: 'https://www.iimnagpur.ac.in/admissions/mba/fees-financial-aid-scholarship/' },
    { slug: 'ashoka-university', institution: /Ashoka/, label: 'Undergraduate admissions and first-year fees (August 2027)', url: 'https://www.ashoka.edu.in/admissions/undergraduate-students/' },
    { slug: 'loyola-college', institution: /Loyola/, label: 'Programmes by shift', url: 'https://www.loyolacollege.edu//admission/courses-offered' },
  ];
  for (const { slug, institution, label, url } of examples) {
    await page.goto('/colleges/' + slug);
    await expect(main.getByRole('heading', { level: 1, name: institution })).toBeVisible();
    await expect(main.getByRole('link', { name: label, exact: true })).toHaveAttribute('href', url);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
  await page.goto('/colleges/iim-nagpur');
  await main.locator('#fees').getByRole('link', { name: /Source guide: MBA fees/ }).click();
  await expect(page).toHaveURL(/#official-source-1$/);
  await expect(main.locator('#official-source-1')).toContainText('2026–28');

  const response = await request.get('/api/colleges/dit-university');
  expect(response.ok()).toBe(true);
  expect(await response.json()).toMatchObject({ college: { slug: 'dit-university', annualFees: null, placementPct: null, structuredFacts: [] } });
});
