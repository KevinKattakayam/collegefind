import navigation from '../../data/pilot/profile-navigation.json';

type ReadingLink = {
  url: string;
  label: string;
  category: string;
  scope: string;
  checkedAt: string;
};

// Editorial navigation only. Never read evidence rows as a fallback for these links.
const links: Readonly<Record<string, readonly ReadingLink[]>> = navigation;

export function collegeSourceLinks(slug: string): readonly ReadingLink[] {
  return Object.hasOwn(links, slug) ? links[slug] : [];
}
