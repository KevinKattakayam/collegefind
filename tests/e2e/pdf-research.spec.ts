import { expect, test } from '@playwright/test';

test('disposable PDF pipeline facts render on engineering and law profiles with a demo warning', async ({ page }, testInfo) => {
  await page.goto('/colleges/indian-institute-of-technology-delhi');
  await expect(page.getByRole('heading', { level: 1, name: 'Indian Institute of Technology Delhi' })).toBeVisible();
  await expect(page.getByRole('note').filter({ hasText: 'Development demo catalogue' })).toBeVisible();
  await expect(page.getByText('Median annual salary (INR)', { exact: false }).first()).toBeVisible();
  await expect(page.getByText('₹20,00,000', { exact: false }).first()).toBeVisible();
  await expect(page.getByText('NIRF graduating cohort 2024-25', { exact: false })).toBeVisible();
  await expect(page.getByText(/Ministry of Education, Government of India/)).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('pdf-research-engineering-profile.png'), fullPage: true });

  await page.goto('/colleges/national-law-school-of-india-university');
  await expect(page.getByRole('heading', { level: 1, name: 'National Law School of India University' })).toBeVisible();
  await expect(page.getByText('Tuition and facilities (combined)', { exact: false })).toBeVisible();
  await expect(page.getByText('₹3,18,200', { exact: false })).toBeVisible();
  await expect(page.getByText('Full programme period', { exact: false })).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('pdf-research-law-profile.png'), fullPage: true });
});

test('comparison displays matching historical NIRF facts with source and year context', async ({ page }, testInfo) => {
  await page.goto('/compare?colleges=indian-institute-of-technology-delhi,indian-institute-of-technology-kanpur');
  await expect(page.getByRole('heading', { name: 'Compare Colleges' })).toBeVisible();
  const reviewed = page.getByRole('region', { name: /Reviewed information for Indian Institute of Technology Delhi/ });
  await expect(reviewed).toContainText('Median annual salary');
  await expect(reviewed).toContainText('2024-25');
  await expect(reviewed).toContainText('cohort denominator 818');
  await expect(page.getByRole('region', { name: /Reviewed information for Indian Institute of Technology Kanpur/ })).toContainText('Median annual salary');
  await expect(page.getByRole('region', { name: 'Scrollable source-reported college comparison' })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('pdf-research-comparison.png'), fullPage: true });
});

test('representative engineering, management, medical, law and university profiles retain identity and sections', async ({ page }) => {
  const profiles = [
    ['indian-institute-of-technology-delhi', 'Indian Institute of Technology Delhi'],
    ['iim-kozhikode', 'IIM Kozhikode'],
    ['all-india-institute-of-medical-sciences', 'All India Institute of Medical Sciences'],
    ['national-law-school-of-india-university', 'National Law School of India University'],
    ['university-of-delhi', 'University of Delhi'],
  ];
  for (const [slug, name] of profiles) {
    const response = await page.goto(`/colleges/${slug}`);
    expect(response?.status(), `${slug} response`).toBe(200);
    await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'On this college profile' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Programmes and admissions' })).toBeVisible();
  }
});
