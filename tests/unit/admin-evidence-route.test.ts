import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/http';

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  enforceRateLimit: vi.fn(),
  reviewFieldEvidence: vi.fn(),
  reviewTypedRecord: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({ prisma: {} }));
vi.mock('@/lib/session', () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock('@/lib/rate-limit', () => ({ enforceRateLimit: mocks.enforceRateLimit }));
vi.mock('@/server/ingest/field-evidence', () => ({
  reviewFieldEvidence: mocks.reviewFieldEvidence,
  reviewTypedRecord: mocks.reviewTypedRecord,
}));

import { POST } from '@/app/api/admin/evidence/route';

const request = (body: unknown, origin = 'https://collegefind.test') => new Request('https://collegefind.test/api/admin/evidence', {
  method: 'POST',
  headers: { origin, host: 'collegefind.test', 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

const result = async (response: Response) => ({ status: response.status, body: await response.json() });

describe('admin evidence review endpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ id: 'admin-1', role: 'ADMIN' });
    mocks.enforceRateLimit.mockResolvedValue(undefined);
    mocks.reviewFieldEvidence.mockResolvedValue({ id: 'decision-1' });
    mocks.reviewTypedRecord.mockResolvedValue({ id: 'decision-2' });
  });

  it('returns authorization errors before reading the request or invoking review services', async () => {
    mocks.requireAdmin.mockRejectedValue(new ApiError(403, 'FORBIDDEN', 'Admin access required'));
    expect(await result(await POST(request({ kind: 'field' })))).toMatchObject({ status: 403 });
    expect(mocks.enforceRateLimit).not.toHaveBeenCalled();
    expect(mocks.reviewFieldEvidence).not.toHaveBeenCalled();
  });

  it('rejects cross-origin, malformed and invalid review payloads without recording a decision', async () => {
    expect(await result(await POST(request({ kind: 'field', id: 'claim-1', status: 'APPROVED', reason: 'Checked' }, 'https://attacker.test')))).toMatchObject({ status: 403 });
    expect(await result(await POST(request({ kind: 'field', id: 'bad/id', status: 'APPROVED', reason: 'Checked' })))).toMatchObject({ status: 400 });
    expect(await result(await POST(request({ kind: 'field', id: 'claim-1', status: 'APPROVED', reason: 'ok', extra: true })))).toMatchObject({ status: 400 });
    expect(mocks.reviewFieldEvidence).not.toHaveBeenCalled();
    expect(mocks.reviewTypedRecord).not.toHaveBeenCalled();
  });

  it('routes field and typed decisions through the audited service and returns no-store', async () => {
    const field = await POST(request({ kind: 'field', id: 'claim-1', status: 'APPROVED', reason: 'Official page checked' }));
    expect(await result(field)).toMatchObject({ status: 200, body: { decisionId: 'decision-1' } });
    expect(field.headers.get('cache-control')).toBe('no-store');
    expect(mocks.enforceRateLimit).toHaveBeenCalledWith('moderation', 'admin-1');
    expect(mocks.reviewFieldEvidence).toHaveBeenCalledWith({}, {
      evidenceId: 'claim-1', reviewerId: 'admin-1', status: 'APPROVED', reason: 'Official page checked',
    });

    const typed = await POST(request({ kind: 'cutoff', id: 'cutoff-1', status: 'REJECTED', reason: 'Wrong academic year' }));
    expect(await result(typed)).toMatchObject({ status: 200, body: { decisionId: 'decision-2' } });
    expect(mocks.reviewTypedRecord).toHaveBeenCalledWith({}, {
      kind: 'cutoff', recordId: 'cutoff-1', reviewerId: 'admin-1', status: 'REJECTED', reason: 'Wrong academic year',
    });
  });

  it('surfaces rate-limit errors without calling the evidence service', async () => {
    mocks.enforceRateLimit.mockRejectedValue(new ApiError(429, 'RATE_LIMITED', 'Too many requests'));
    expect(await result(await POST(request({ kind: 'field', id: 'claim-1', status: 'APPROVED', reason: 'Checked' })))).toMatchObject({ status: 429 });
    expect(mocks.reviewFieldEvidence).not.toHaveBeenCalled();
  });
});
