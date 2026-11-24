import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ findFirst: vi.fn(), findMany: vi.fn() }));
vi.mock('@/lib/prisma', () => ({ prisma: { college: mocks } }));

import { GET } from '@/app/api/colleges/similar/[id]/route';

const request = () => new Request('https://collegefind.test/api/colleges/similar/primary');
const primary = (annualFees: number | null) => ({
  id: 'primary', state: 'Kerala', type: 'GOVERNMENT', dataStatus: 'UNVERIFIED', annualFees,
});
const candidate = (id: string, name: string, annualFees: number | null) => ({
  id, slug: id, name, state: 'Tamil Nadu', type: 'GOVERNMENT', dataStatus: 'UNVERIFIED', annualFees,
});

describe('similar-college recommendation ordering', () => {
  beforeEach(() => vi.clearAllMocks());

  it('uses a reviewed projected fee despite profile status and leaves unknown fees after known matches', async () => {
    mocks.findFirst.mockResolvedValue(primary(100));
    mocks.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([
      candidate('unknown', 'A unknown fee', null),
      candidate('far', 'B far fee', 300),
      candidate('near', 'C near fee', 110),
    ]);
    const response = await GET(request(), { params: Promise.resolve({ id: 'primary' }) });
    expect(response.status).toBe(200);
    expect((await response.json()).colleges.map((college: { id: string }) => college.id)).toEqual(['near', 'far', 'unknown']);
  });

  it('uses alphabetical fallback when the fee is unknown and skips fallback when three peers exist', async () => {
    mocks.findFirst.mockResolvedValue(primary(null));
    mocks.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([
      candidate('b', 'Beta', 100), candidate('a', 'Alpha', 100),
    ]);
    const noFee = await GET(request(), { params: Promise.resolve({ id: 'primary' }) });
    expect((await noFee.json()).colleges.map((college: { name: string }) => college.name)).toEqual(['Alpha', 'Beta']);

    mocks.findFirst.mockResolvedValue(primary(100));
    mocks.findMany.mockResolvedValueOnce([
      candidate('one', 'One', 90), candidate('two', 'Two', 110), candidate('three', 'Three', null),
    ]);
    const full = await GET(request(), { params: Promise.resolve({ id: 'primary' }) });
    expect((await full.json()).colleges).toHaveLength(3);
    expect(mocks.findMany).toHaveBeenCalledTimes(3);
  });

  it('returns a safe 404 for a stale primary identifier', async () => {
    mocks.findFirst.mockResolvedValue(null);
    const response = await GET(request(), { params: Promise.resolve({ id: 'deleted' }) });
    expect(response.status).toBe(404);
    expect(mocks.findMany).not.toHaveBeenCalled();
  });
});
