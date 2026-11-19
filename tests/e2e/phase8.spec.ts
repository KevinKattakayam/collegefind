import { test, expect, type Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { hash } from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { assertDisposableTestTarget } from '../integration/target';

let db: PrismaClient;
let suffix: string;
let collegeId: string;
let slug: string;
let userEmail: string;
let memberEmail: string;
let adminEmail: string;
const password = 'Phase8 browser fixture 6839!';

test.beforeAll(async () => {
  db = new PrismaClient({ adapter: new PrismaPg({ connectionString: assertDisposableTestTarget() }) });
  suffix = randomUUID(); slug = `phase8-${suffix}`;
  userEmail = `${suffix}@student.example.test`; memberEmail = `${suffix}+member@student.example.test`; adminEmail = `${suffix}+admin@student.example.test`;
  const passwordHash = await hash(password, 10);
  await db.user.createMany({
    data: [
      { name: 'Phase 8 student', email: userEmail, password: passwordHash },
      { name: 'Phase 8 member', email: memberEmail, password: passwordHash },
      { name: 'Phase 8 moderator', email: adminEmail, password: passwordHash, role: 'ADMIN' },
    ]
  });
  const college = await db.college.create({ data: { slug, name: `Phase 8 Fixture ${suffix.slice(0, 8)}`, shortName: 'P8F', city: 'Test City', state: 'Test State', type: 'PRIVATE', dataStatus: 'DEMO' } });
  collegeId = college.id;
});

test.afterAll(async () => {
  if (collegeId) await db.college.deleteMany({ where: { id: collegeId } });
  if (userEmail) await db.user.deleteMany({ where: { email: { in: [userEmail, memberEmail, adminEmail] } } });
  await db?.$disconnect();
});

async function login(page: Page, email: string) {
  await page.goto('/login');
  await page.getByPlaceholder('Email address', { exact: true }).fill(email);
  await page.getByPlaceholder('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect.poll(() => new URL(page.url()).pathname).not.toBe('/login');
}

test('account and community flows stay usable, owned, moderated and responsive', async ({ page, browser }, testInfo) => {
  expect((await page.request.get('/api/account')).status()).toBe(401);
  await page.goto('/account');
  await expect(page).toHaveURL(/\/login/);
  await login(page, userEmail);
  await page.goto('/account');
  await expect(page.getByRole('heading', { name: 'Account and privacy' })).toBeVisible();
  await page.getByLabel('Display name').fill('Updated Phase 8 student');
  await page.getByLabel('Default planner timezone').fill('Asia/Kolkata');
  await page.getByRole('button', { name: 'Save settings' }).click();
  await expect(page.getByText('Account settings saved.')).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Display name')).toHaveValue('Updated Phase 8 student');
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('link', { name: 'Download account data' }).click()]);
  expect(download.suggestedFilename()).toBe('collegefind-account-export.json');

  await page.goto(`/colleges/${slug}`);
  const community = page.getByRole('region', { name: 'Questions and answers' });
  await expect(community.getByText(/personal experiences and opinions, not official or verified/)).toBeVisible();
  const originalQuestion = `How do I find the official admission process? (${testInfo.project.name})`;
  const editedQuestion = `Where can I find the official admission process? (${testInfo.project.name})`;
  await community.getByLabel('Ask a question').fill(originalQuestion);
  await community.getByRole('button', { name: 'Post question' }).click();
  const question = community.locator('li').filter({ hasText: originalQuestion });
  await expect(question).toBeVisible();
  await question.getByRole('button', { name: 'Edit', exact: true }).click();
  await question.getByLabel('Edit question').fill(editedQuestion);
  await question.getByRole('button', { name: 'Save edit' }).click();
  await expect(community.getByText(editedQuestion, { exact: true })).toBeVisible();

  const memberContext = await browser.newContext({ baseURL: new URL(page.url()).origin });
  const member = await memberContext.newPage();
  await login(member, memberEmail);
  await member.goto(`/colleges/${slug}`);
  const memberCommunity = member.getByRole('region', { name: 'Questions and answers' });
  const publicQuestion = memberCommunity.locator('li').filter({ hasText: editedQuestion });
  await publicQuestion.getByRole('button', { name: 'Report' }).click();
  await publicQuestion.getByRole('button', { name: 'Send report' }).click();
  await expect(member.getByText('Report sent to moderators')).toBeVisible();

  const moderatorContext = await browser.newContext({ baseURL: new URL(page.url()).origin });
  const moderator = await moderatorContext.newPage();
  await login(moderator, adminEmail);
  await moderator.goto('/admin/community');
  await expect(moderator.getByRole('heading', { name: 'Community moderation' })).toBeVisible();
  const report = moderator.locator('li').filter({ hasText: editedQuestion });
  await expect(report).toBeVisible();
  await report.getByLabel('Moderator reason').fill('Fixture report reviewed in isolated browser test');
  await report.getByRole('button', { name: 'Hide and resolve' }).click();
  await expect(moderator.locator('li').filter({ hasText: editedQuestion })).toHaveCount(0);
  await member.reload();
  await expect(member.getByText(editedQuestion)).toHaveCount(0);
  await moderatorContext.close(); await memberContext.close();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/account');
  await expect(page.getByRole('heading', { name: 'Account and privacy' })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
  await page.keyboard.press('Tab');
  await expect(page.locator(':focus')).toBeVisible();
});

test('a regular member is denied access to moderation routes and page', async ({ page }) => {
  await login(page, memberEmail);
  expect((await page.request.get('/api/admin/moderation')).status()).toBe(403);
  await page.goto('/admin/community');
  await expect(page.getByRole('heading', { name: 'Access denied' })).toBeVisible();
});
