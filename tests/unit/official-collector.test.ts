import { describe, expect, it, vi } from 'vitest';
import { collectIitPatna, extractIitPatnaCandidate, robotsPermitPath } from '../../src/server/ingest/official-collector';

const html = `
  <title>Department of Computer Science &amp; Engineering | Indian Institute of Technology Patna</title>
  <h2>Programs Offered</h2>
  <h3>B.Tech. in Artificial Intelligence and Data Science</h3><p>Duration : 4 years</p>
  <h2>List of Faculty Members</h2><footer>Bihta</footer>
`;
const collectedAt = new Date('2026-11-20T14:00:00Z');

describe('exact-page official source collector', () => {
  it('only emits an attributed candidate compatible with the existing evidence importer', () => {
    expect(extractIitPatnaCandidate(html, collectedAt)).toMatchObject({
      sources: [{ institutionSlug: 'iit-patna', retrievedAt: collectedAt.toISOString(),
        url: 'https://iitp.ac.in/departments/computer-science-engineering', academicYear: null }],
      candidateClaims: [{ stageable: true, reviewState: 'UNREVIEWED', value: {
        kind: 'programme', programme: 'B.Tech in Artificial Intelligence and Data Science', durationMonths: 48, level: 'UG',
      } }],
    });
    expect(() => extractIitPatnaCandidate(html.replace('Bihta', 'Wrong campus'), collectedAt)).toThrow(/campus/);
    expect(() => extractIitPatnaCandidate(html.replace('4 years', '18 Months'), collectedAt)).toThrow(/duration/);
  });

  it('honours exact and wildcard deny rules and fails closed on unsupported limits', () => {
    expect(robotsPermitPath('User-agent: *\nAllow: /\nDisallow: /admin/', '/departments/cse')).toBe(true);
    expect(robotsPermitPath('User-agent: *\nDisallow: /dep*$', '/departments/cse')).toBe(false);
    expect(robotsPermitPath('User-agent: *\nCrawl-delay: tomorrow', '/departments/cse')).toBe(false);
    expect(robotsPermitPath('<html>Not available</html>', '/departments/cse')).toBe(false);
  });

  it('does not fetch a disallowed page or retry an access denial', async () => {
    const blocked = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response('User-agent: *\nDisallow: /departments/', {
      headers: { 'Content-Type': 'text/plain' },
    }));
    await expect(collectIitPatna(blocked)).rejects.toThrow(/robots/);
    expect(blocked).toHaveBeenCalledTimes(1);
    const denial = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(null, { status: 403 }));
    await expect(collectIitPatna(denial)).rejects.toThrow(/403/);
    expect(denial).toHaveBeenCalledTimes(1);
  });

  it('uses the exact authorized URL, rejects redirects and fetches after the delay', async () => {
    const get = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('User-agent: *\nAllow: /\nCrawl-delay: 2', { headers: { 'Content-Type': 'text/plain' } }))
      .mockResolvedValueOnce(new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } }));
    const delay = vi.fn(async (_ms: number) => { void _ms; });
    await expect(collectIitPatna(get, delay)).resolves.toMatchObject({ candidateClaims: [{ field: 'structured' }] });
    expect(delay).toHaveBeenCalledExactlyOnceWith(2000);
    expect(get.mock.calls.map(([url, options]) => [String(url), options?.redirect, options?.credentials])).toEqual([
      ['https://iitp.ac.in/robots.txt', 'error', 'omit'],
      ['https://iitp.ac.in/departments/computer-science-engineering', 'error', 'omit'],
    ]);
  });
});
