import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// Migrations should use a DIRECT (non-pooled) connection on Neon.
// Runtime queries use DATABASE_URL (pooled) via the pg adapter in src/lib/prisma.ts.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: process.env['DIRECT_URL'] ?? process.env['DATABASE_URL'],
    shadowDatabaseUrl: process.env['SHADOW_DATABASE_URL'],
  },
});
