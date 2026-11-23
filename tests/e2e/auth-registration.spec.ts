import { expect, test } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { assertDisposableTestTarget } from '../integration/target';

let db: PrismaClient;

test.beforeAll(() => {
  db = new PrismaClient({ adapter: new PrismaPg(new pg.Pool({ connectionString: assertDisposableTestTarget() })) });
});

test.afterAll(async () => { await db?.$disconnect(); });

test('registration signs in a normal unverified USER and that account can log in again', async ({ page }) => {
  const email = `registration-${randomUUID()}@example.test`;
  const password = 'A distinct local test passphrase 4821!';

  await page.goto('/register');
  await page.getByLabel('Full name').fill('Disposable Registration Test');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByLabel('Confirm password').fill(password);
  await page.getByRole('button', { name: 'Create Account' }).click();
  await expect(page).toHaveURL(/\/colleges$/);

  const user = await db.user.findUniqueOrThrow({ where: { email } });
  expect(user.role).toBe('USER');
  expect(user.emailVerified).toBeNull();

  await page.context().clearCookies();
  await page.goto('/login');
  await page.getByLabel('Email address').fill(email);
  await page.getByPlaceholder('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Login' }).click();
  await expect(page).toHaveURL(/\/colleges$/);
  expect((await db.user.findUniqueOrThrow({ where: { id: user.id } })).emailVerified).toBeNull();
});
