import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';
import { prisma } from '@/lib/prisma';
import { COURSE_SLUGS } from '@/content/courses';
import { EXAMS } from '@/content/exams';
import { logger, errorFields } from '@/lib/logger';

export const revalidate = 86400;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const staticPaths = ['', '/colleges', '/compare', '/predictor', '/rankings', '/exams', '/courses', '/articles'];
  const entries: MetadataRoute.Sitemap = [
    ...staticPaths.map((p) => ({ url: `${SITE_URL}${p}`, lastModified: now })),
    ...COURSE_SLUGS.map((s) => ({ url: `${SITE_URL}/courses/${s}`, lastModified: now })),
    ...EXAMS.map((e) => ({ url: `${SITE_URL}/exams/${e.id}`, lastModified: now })),
  ];
  try {
    const colleges = await prisma.college.findMany({ select: { slug: true, updatedAt: true }, take: 50000 });
    entries.push(...colleges.map((c) => ({ url: `${SITE_URL}/colleges/${c.slug}`, lastModified: c.updatedAt })));
  } catch (err) {
    // Sitemap must not break the build if the DB is unreachable.
    logger.warn('sitemap_db_unavailable', errorFields(err));
  }
  return entries;
}
