import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  extension: null as unknown,
  adapterOptions: null as unknown,
}));

vi.mock('@/lib/env', () => ({ getEnv: () => ({
  DATABASE_URL: 'postgresql://postgres:postgres@127.0.0.1:5432/fixture',
  DB_POOL_MAX: 3,
}) }));
vi.mock('@prisma/adapter-pg', () => ({ PrismaPg: class { constructor(options: unknown) { state.adapterOptions = options; } } }));
vi.mock('@prisma/client', () => ({ PrismaClient: class { $extends(extension: unknown) { state.extension = extension; return this; } } }));

import { prisma } from '@/lib/prisma';

type QueryInput = { model: string; operation: string; args: Record<string, unknown>; query: (args: unknown) => Promise<unknown> };
type Operation = (input: QueryInput) => Promise<unknown>;
const operation = () => (state.extension as { query: { $allModels: { $allOperations: Operation } } }).query.$allModels.$allOperations;
const approved = (at = '2026-01-01T00:00:00.000Z') => [{ status: 'APPROVED', createdAt: new Date(at) }];

describe('Prisma public evidence query extension', () => {
  beforeEach(() => {
    expect(prisma).toBeDefined();
  });

  it('validates pool construction settings and filters before distinct/pagination', async () => {
    expect(state.adapterOptions).toMatchObject({ connectionString: expect.stringContaining('127.0.0.1'), max: 3, connectionTimeoutMillis: 10000, idleTimeoutMillis: 30000 });
    const args: Record<string, unknown> = { take: 1, skip: 1, distinct: ['year'], select: { year: true } };
    const query = vi.fn().mockResolvedValue([
      { id: 'a', year: 2026, decisions: approved() },
      { id: 'b', year: 2026, decisions: approved() },
      { id: 'rejected', year: 2025, decisions: [{ status: 'REJECTED', createdAt: new Date() }] },
      { id: 'c', year: 2024, decisions: approved() },
    ]);
    const rows = await operation()({ model: 'CutoffRecord', operation: 'findMany', args, query }) as Array<Record<string, unknown>>;
    expect(args).not.toHaveProperty('take');
    expect(args).not.toHaveProperty('skip');
    expect(args).not.toHaveProperty('distinct');
    expect((args.select as Record<string, unknown>).decisions).toBe(true);
    expect(rows).toEqual([{ id: 'c', year: 2024 }]);
  });

  it('uses include for typed-record lookups and withholds rejected or tied conflicting decisions', async () => {
    const args: Record<string, unknown> = { include: { program: true } };
    const findFirst = vi.fn().mockResolvedValue({ id: 'fee', decisions: approved(), amountInr: 100 });
    await expect(operation()({ model: 'FeesRecord', operation: 'findFirst', args, query: findFirst }))
      .resolves.toEqual({ id: 'fee', amountInr: 100 });
    expect((args.include as Record<string, unknown>).decisions).toBe(true);

    const rejected = vi.fn().mockResolvedValue({ id: 'old', decisions: [{ status: 'REJECTED', createdAt: new Date() }] });
    await expect(operation()({ model: 'PlacementRecord', operation: 'findUnique', args: {}, query: rejected })).resolves.toBeNull();
    const tie = new Date();
    const conflicting = vi.fn().mockResolvedValue({ id: 'tie', decisions: [
      { status: 'APPROVED', createdAt: tie }, { status: 'REJECTED', createdAt: tie },
    ] });
    await expect(operation()({ model: 'NirfRanking', operation: 'findUnique', args: {}, query: conflicting })).resolves.toBeNull();
  });

  it('projects college reads and leaves writes untouched', async () => {
    const college = { id: 'demo-id', slug: 'demo-college', dataStatus: 'DEMO', annualFees: 12, placementPct: 90 };
    await expect(operation()({ model: 'College', operation: 'findMany', args: {}, query: async () => [college] }))
      .resolves.toMatchObject([{ id: 'demo-id', annualFees: null, placementPct: null }]);
    const write = { id: 'created', dataStatus: 'DEMO', annualFees: 12 };
    await expect(operation()({ model: 'College', operation: 'create', args: {}, query: async () => write })).resolves.toBe(write);
  });
});
