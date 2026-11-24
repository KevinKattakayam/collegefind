import { expect, test } from '@playwright/test';

test('release health, security headers and signed-out boundaries', async ({ page, request }) => {
  const live = await request.get('/api/live');
  expect(live.status()).toBe(200);
  expect(live.headers()['cache-control']).toBe('no-store');
  await expect(live.json()).resolves.toEqual({ status: 'ok' });

  const ready = await request.get('/api/health');
  expect(ready.status()).toBe(200);
  await expect(ready.json()).resolves.toEqual({ status: 'ok', db: 'ok', rateLimit: 'local' });
  expect(ready.headers()['content-security-policy']).toContain("frame-ancestors 'none'");
  expect(ready.headers()['x-content-type-options']).toBe('nosniff');

  expect((await request.post('/api/seed')).status()).toBe(404);
  for (const path of ['/api/account/export', '/api/plans', '/api/admin/moderation']) {
    expect((await request.get(path)).status()).toBe(401);
  }
  await page.goto('/account');
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole('textbox', { name: /email/i })).toBeVisible();
  await page.getByRole('textbox', { name: /email/i }).focus();
  await page.keyboard.press('Tab');
  await expect(page.getByLabel("Password", { exact: true })).toBeFocused();
});
