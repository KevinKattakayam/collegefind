// Vercel build: generate the Prisma client, apply migrations ONLY for the
// production deployment (previews must never migrate the production DB), then build.
import { execSync } from 'node:child_process';

const run = (cmd) => execSync(cmd, { stdio: 'inherit' });

run('npx prisma generate');
if (process.env.VERCEL_ENV === 'production') {
  if (!process.env.DIRECT_URL && !process.env.DATABASE_URL) {
    throw new Error('DIRECT_URL or DATABASE_URL must be set to run migrations');
  }
  run('npx prisma migrate deploy');
} else {
  console.log(`Skipping migrations (VERCEL_ENV=${process.env.VERCEL_ENV ?? 'unset'})`);
}
run('npx next build');
