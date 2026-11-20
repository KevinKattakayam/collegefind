import { describe, expect, it } from 'vitest';
import { collegeSourceLinks } from '@/server/college-source-links';
import { evidenceReviewHold } from '@/server/review-holds';
import navigation from '../../data/pilot/profile-navigation.json';
import batch from '../../data/pilot/substantive-research-batch-029.json';
import archive from '../../data/pilot/staged-evidence-after-batch-027.json';

describe('profile reading links', () => {
  it('exposes unique HTTPS navigation with a known identity, scope, and check date', () => {
    const identities = new Set(archive.collegeIdentity.map(({ slug }) => slug));
    for (const [slug, links] of Object.entries(navigation)) {
      expect(identities.has(slug)).toBe(true);
      expect(collegeSourceLinks(slug)).toEqual(links);
      expect(new Set(links.map(({ url }) => url)).size).toBe(links.length);
      for (const { url, scope, checkedAt, reference } of links) {
        const target = new URL(url);
        expect(target.protocol).toBe('https:');
        expect(target.username + target.password).toBe('');
        expect(scope).not.toBe('');
        expect(checkedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(reference).not.toBe('');
      }
    }
    for (const [slug, links] of Object.entries(batch.publicReadingLinks)) {
      expect(collegeSourceLinks(slug).map(({ url }) => url)).toEqual(expect.arrayContaining(links.map(({ url }) => url)));
    }
  });

  it('keeps blocked and mismatched destinations out of the source guide and review publication', () => {
    expect(collegeSourceLinks('iiit-sri-city')).toEqual([]);
    expect(collegeSourceLinks('__proto__')).toEqual([]);
    expect(collegeSourceLinks('op-jindal-university').map(({ url }) => url)).toEqual(['https://jgu.edu.in/', 'https://jgu.edu.in/admissions/']);
    for (const id of ['cmwkzioa60002b9tvn4vb7p89', 'cmwkz9wpo0022fbtvxixkrfep']) {
      expect(evidenceReviewHold(id)).toContain('Institution mismatch');
    }
  });
});
