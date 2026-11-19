import { describe, expect, it } from 'vitest';
import { collegeSourceLinks } from '@/server/college-source-links';
import batch from '../../data/pilot/substantive-research-batch-029.json';

describe('profile reading links', () => {
  it('exposes only editorial navigation to credential-free official sources for the matched slug', () => {
    for (const [slug, links] of Object.entries(batch.publicReadingLinks)) {
      expect(collegeSourceLinks(slug)).toEqual(links);
      for (const link of links) {
        const url = new URL(link.url);
        expect(url.protocol).toBe('https:');
        expect(url.username + url.password).toBe('');
        expect(Object.keys(link).sort()).toEqual(['label', 'url']);
      }
    }
    expect(collegeSourceLinks('iiit-sri-city')).toEqual([]);
    expect(collegeSourceLinks('__proto__')).toEqual([]);
  });
});
