import batch from '../../data/pilot/substantive-research-batch-029.json';

type ReadingLink = { url: string; label: string };

// Editorial navigation only. Public evidence and recommendation queries do not use this list.
const links: Readonly<Record<string, readonly ReadingLink[]>> = batch.publicReadingLinks;

export function collegeSourceLinks(slug: string): readonly ReadingLink[] {
  return Object.hasOwn(links, slug) ? links[slug] : [];
}
