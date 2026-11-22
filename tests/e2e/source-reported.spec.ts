import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import policy from '../../data/pilot/source-reported-release.json';
import ledger from '../../docs/PROFILE_COMPLETENESS.json';
import { eligibleSourceReported } from '../../src/server/source-reported';

test('source-reported facts render in their sections with campus, scope and provenance', async ({ page, request, isMobile }) => {
  test.skip(process.env.COLLEGEFIND_REPORTED_BROWSER !== 'true', 'Requires the isolated catalogue archive rehearsal');
  test.setTimeout(240_000);
  const browserCheckDate = new Date();
  // The owner-stage scenario mutates these two institutions in its separate rehearsal.
  const main = page.getByRole('main');
  const newSlugs = new Set(policy.records.filter(({ ref }) =>
    ref.startsWith('batch-45:') || ref.startsWith('batch-46:') || ref.startsWith('batch-47:') || ref.startsWith('batch-48:') || ref.startsWith('batch-49:') || ref.startsWith('batch-50:')).map(({ slug }) => slug));
  for (const college of ledger.institutions) {
    const response = await request.get(`/colleges/${college.slug}`);
    expect(response.ok(), `${college.slug} should render`).toBe(true);
    expect(await response.text()).toContain(college.catalogueIdentity.name);
  }
  const reviewScenario = process.env.COLLEGEFIND_OWNER_STAGE_BROWSER === 'true';
  const slugs = [...new Set(policy.records.map(({ slug }) => slug))].filter((slug) =>
    !reviewScenario || !['dit-university', 'galgotias-university'].includes(slug));
  for (const slug of slugs) {
    const records = policy.records.filter((row) => row.slug === slug);
    const expected = eligibleSourceReported({ slug, id: records[0].collegeId }, browserCheckDate);
    expect(expected.every(({ ref }) => records.some((row) => row.ref === ref)),
      `all eligible facts for ${slug} belong to a published source record`).toBe(true);
    await page.goto('/colleges/' + slug + '#programmes-and-admissions');
    if (['delhi-technological-university', 'vjti-mumbai', 'iit-gandhinagar'].includes(slug)) {
      await expect(main.locator('#programmes-and-admissions')).toContainText('Official pages report the details below; CollegeFind has not independently verified them.');
      if (slug === 'iit-gandhinagar') {
        await expect(main.locator('#facilities')).toContainText('Official pages report the facilities below; CollegeFind has not independently verified them.');
      }
    }
    const cards = main.locator('[data-evidence-status="OFFICIAL_SOURCE_REPORTED"]');
    await expect(cards).toHaveCount(expected.length);
    await expect(main.locator('[data-evidence-status="VERIFIED"]')).toHaveCount(0);
    for (const item of expected) {
      const { value } = item;
      const section = value.kind === 'contact' ? '#official-resources' : value.kind === 'facility' ? '#facilities' : '#programmes-and-admissions';
      const name = value.kind === 'contact' ? value.office : value.kind === 'facility' ? value.facility : value.programme;
      const source = page.getByRole('link', { name: item.publisher + ' · ' + item.sourceTitle, exact: true });
      const kindLabel = value.kind === 'admission' ? 'admission route'
        : value.kind === 'contact' ? 'official contact'
        : value.kind === 'facility' ? 'campus facility' : value.kind;
      const matchingCards = main.locator(section).getByRole('list', { name: `Institution-reported ${kindLabel}` })
        .locator('[data-evidence-status="OFFICIAL_SOURCE_REPORTED"]')
        .filter({ has: source }).filter({ has: page.getByRole('heading', { name, exact: true }) });
      const card = value.kind === 'contact'
        ? matchingCards.filter({ hasText: value.contact })
        : matchingCards.filter({ hasText: item.evidenceLocation });
      await expect(card).toHaveCount(1);
      if (value.kind === 'contact') {
        const channel = { EMAIL: 'Email', PHONE: 'Phone', ADDRESS: 'Address' }[value.channel];
        await expect(card.getByText(`${channel} · ${value.contact}`, { exact: true })).toBeVisible();
      }
      if (value.kind === 'facility') await expect(card).toContainText(value.description);
      if (value.kind === 'programme' && value.durationMonths) {
        const level = { UG: 'Undergraduate', PG: 'Postgraduate', DOCTORAL: 'Doctoral', DIPLOMA: 'Diploma' }[value.level];
        const duration = value.durationMonths % 12 === 0
          ? `${value.durationMonths / 12} ${value.durationMonths === 12 ? 'year' : 'years'}`
          : `${value.durationMonths} months`;
        await expect(card).toContainText(`${level} · ${duration}`);
      }
      if (value.kind === 'admission') {
        await expect(card).toContainText(value.route);
        if (value.exam) await expect(card).toContainText(value.exam);
      }
      await expect(card.getByRole('heading', { name, exact: true })).toBeVisible();
      if (slug === 'vjti-mumbai') {
        await expect(card).toContainText('Published 27 Jun 2025');
        await expect(card).toContainText('updated timestamp 22 October 2026');
      }
      if (slug === 'delhi-technological-university') {
        await expect(card).toContainText('last updated 01 September 2026');
        await expect(card).not.toContainText('Published 01 Sep 2026');
      }
      if (item.historical) {
        const historyLabel = value.kind === 'admission' ? 'Historical admission cycle'
          : value.kind === 'programme' ? 'Historical programme listing' : 'Historical source information';
        await expect(card).toContainText(historyLabel);
        if (item.publisherPeriod) await expect(card).toContainText(item.publisherPeriod);
      }
      if (item.ref === 'batch-47:8') await expect(card).not.toContainText('elapsed..');
      if (item.academicYear !== null) await expect(card).toContainText(String(item.publisherPeriod ?? item.academicYear));
      await expect(card.getByText('Source-reported; not independently verified', { exact: true })).toBeVisible();
      await expect(card).toContainText(item.campus);
      await expect(card).toContainText(item.evidenceLocation);
      await expect(card.getByRole('link', { name: item.publisher + ' · ' + item.sourceTitle, exact: true })).toHaveAttribute('href', item.url);
      if (item.scopeVerification) {
        await expect(card).toContainText('Campus scope cross-check');
        await expect(card.getByRole('link', { name: item.scopeVerification.title, exact: false }))
          .toHaveAttribute('href', item.scopeVerification.url);
        await expect(card).toContainText(item.scopeVerification.evidenceLocation);
      }
    }
    if (process.env.CF_PROFILE_SCREENSHOTS && (newSlugs.has(slug) || [
      'all-india-institute-of-medical-sciences', 'university-of-delhi', 'amity-university', 'madras-university',
      'lovely-professional-university', 'jipmer-puducherry', 'university-of-mumbai', 'srm-institute-of-science-and-technology',
      'indian-institute-of-technology-roorkee', 'chandigarh-university', 'manipal-academy-of-higher-education',
      'amrita-vishwa-vidyapeetham', 'nlu-delhi', 'shri-ram-college-of-commerce', 'armed-forces-medical-college',
      'andhra-university', 'loyola-college',
      'nit-kurukshetra', 'madras-medical-college', 'stanley-medical-college',
    ].includes(slug))) {
      const suffix = isMobile ? 'mobile' : 'desktop';
      await main.locator('#programmes-and-admissions').screenshot({ path: join(process.env.CF_PROFILE_SCREENSHOTS, `${slug}-programmes-${suffix}.png`) });
      if (expected.some(({ value }) => value.kind === 'facility')) {
        await main.locator('#facilities').screenshot({ path: join(process.env.CF_PROFILE_SCREENSHOTS, `${slug}-facilities-${suffix}.png`) });
      }
      if (expected.some(({ value }) => value.kind === 'contact')) {
        await main.locator('#official-resources').screenshot({ path: join(process.env.CF_PROFILE_SCREENSHOTS, `${slug}-contacts-${suffix}.png`) });
      }
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
  const search = await request.get('/api/colleges?programme=Digital%20Agriculture');
  expect(search.ok()).toBe(true);
  expect((await search.json()).colleges.map((row: { slug: string }) => row.slug)).not.toContain('iit-ropar');

  if (screenshotDir) {
    const suffix = isMobile ? 'mobile' : 'desktop';
    await page.goto('/colleges/nalsar-university-of-law#programmes-and-admissions');
    const admissions = main.locator('#programmes-and-admissions');
    await expect(admissions).toContainText('Historical admission cycle');
    await admissions.screenshot({ path: join(screenshotDir, `nalsar-admissions-${suffix}.png`) });

    await page.goto('/colleges/indian-institute-of-technology-delhi#facilities');
    const facilities = main.locator('#facilities');
    await expect(facilities.getByRole('heading', { name: 'Central Library' })).toBeVisible();
    await facilities.screenshot({ path: join(screenshotDir, `iit-delhi-facilities-${suffix}.png`) });

    await page.goto('/colleges/pes-university#official-resources');
    const resources = main.locator('#official-resources');
    await expect(resources).toContainText('PES University admissions office');
    await expect(resources).toContainText('The contact listed above is source-reported and not independently verified');
    await expect(resources).not.toContainText('Phone and email details are not verified yet');
    await resources.screenshot({ path: join(screenshotDir, `pes-contact-${suffix}.png`) });

    await page.goto('/colleges/indian-institute-of-technology-kanpur#facilities');
    const iitKanpurFacilities = main.locator('#facilities');
    await expect(iitKanpurFacilities).toContainText('P. K. Kelkar Library');
    await expect(iitKanpurFacilities.locator('[data-evidence-status="OFFICIAL_SOURCE_REPORTED"]')).toHaveCount(1);
    await expect(iitKanpurFacilities.getByRole('link', { name: /Centres and Facilities/ })).toBeVisible();
    await iitKanpurFacilities.screenshot({ path: join(screenshotDir, `iit-kanpur-library-${suffix}.png`) });

    await page.goto('/colleges/indian-school-of-business#programmes-and-admissions');
    const isb = main.locator('#programmes-and-admissions');
    await expect(isb).toContainText('Post Graduate Programme in Management (PGP)');
    await expect(isb).toContainText('Postgraduate · 1 year');
    await expect(isb).toContainText('Class of 2027 application cycle');
    await expect(isb).toContainText('6 December 2026');
    await isb.screenshot({ path: join(screenshotDir, `isb-pgp-admissions-${suffix}.png`) });

    await page.goto('/colleges/st-johns-college#programmes-and-admissions');
    const stJohns = main.locator('#programmes-and-admissions');
    await expect(stJohns).toContainText('Bachelor of Arts');
    await expect(stJohns).toContainText('DBRAU Samarth/University Web-Registration');
    await expect(stJohns).toContainText('page title still says 2025–26');
    await stJohns.screenshot({ path: join(screenshotDir, `st-johns-agra-ug-${suffix}.png`) });

    await page.goto('/colleges/nit-srinagar#programmes-and-admissions');
    const nitSrinagar = main.locator('#programmes-and-admissions');
    await expect(nitSrinagar).toContainText('Historical admission cycle');
    await expect(nitSrinagar).toContainText('MBA, admission cycle 2026');
    await nitSrinagar.screenshot({ path: join(screenshotDir, `nit-srinagar-mba-2026-${suffix}.png`) });
  }

  await page.goto('/colleges/ashoka-university#fees');
  await expect(main.locator('#fees')).toContainText('Not verified yet');
  await expect(main.locator('#fees [data-evidence-status="OFFICIAL_SOURCE_REPORTED"]')).toHaveCount(0);
  await page.goto('/colleges/indian-institute-of-technology-kanpur');
  await expect(main.locator('#facilities [data-evidence-status="OFFICIAL_SOURCE_REPORTED"]')).toHaveCount(1);
  await expect(main.locator('#programmes-and-admissions [data-evidence-status="OFFICIAL_SOURCE_REPORTED"]')).toHaveCount(0);
});

test('source-reported programmes stay outside comparison and CollegeFit', async ({ page }) => {
  test.skip(process.env.COLLEGEFIND_REPORTED_BROWSER !== 'true', 'Requires the isolated catalogue archive rehearsal');
  await page.goto('/compare?colleges=iit-ropar,iit-bhubaneswar');
  await expect(page.getByRole('region', { name: 'Comparison slot for IIT Ropar' })).toBeVisible();
  await expect(page.getByText(/Digital Agriculture/)).toHaveCount(0);

  await page.goto('/collegefit?programme=Digital%20Agriculture&location=Rupnagar');
  const result = page.getByRole('article').filter({ has: page.getByRole('link', { name: 'IIT Ropar', exact: true }) });
  await expect(result.getByText('Programme and degree · UNKNOWN')).toBeVisible();
  await expect(result.getByText('Insufficient evidence for ranking', { exact: false })).toBeVisible();
});
