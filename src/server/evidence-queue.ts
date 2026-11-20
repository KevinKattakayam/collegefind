import { Prisma, type PrismaClient } from '@prisma/client';
import { z } from 'zod';

const states = ['ALL', 'STAGED', 'HELD', 'VERIFIED', 'REJECTED', 'DEMO', 'EXPIRED', 'NOT_YET_VALID', 'CONFLICTED'] as const;
const freshnesses = ['ALL', 'CURRENT', 'UNDATED', 'SOURCE_UNDATED', 'EXPIRED', 'FUTURE', 'OLDER'] as const;

export const queueQuery = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  // Legacy values remain accepted for bookmarked review links.
  status: z.enum([...states, 'PENDING', 'APPROVED', 'STALE', 'CONFLICT']).default('STAGED'),
  q: z.string().trim().max(120).default(''),
  college: z.string().trim().max(120).default(''),
  campus: z.string().trim().max(120).default(''),
  field: z.string().trim().max(100).default(''),
  academicYear: z.preprocess((value) => value === '' ? undefined : value, z.coerce.number().int().min(1900).max(2200).optional()),
  freshness: z.enum(freshnesses).default('ALL'),
});

type QueueState = typeof states[number];

/** PostgreSQL classifies, filters, counts and paginates in one statement snapshot.
 * Substantive facts precede link-only claims; every ordering has an ID tie-breaker.
 */
export async function evidenceQueue(db: PrismaClient, raw: unknown) {
  const query = queueQuery.parse(raw);
  const { page, pageSize, q, college, campus, field, academicYear, freshness } = query;
  const year = academicYear ?? null;
  const status: QueueState | 'STALE' = query.status === 'PENDING' ? 'STAGED'
    : query.status === 'APPROVED' ? 'VERIFIED' : query.status === 'CONFLICT' ? 'CONFLICTED' : query.status;
  const filteredCte = Prisma.sql`
    WITH base AS (
      SELECT e.*, d.status AS decision_status, s."publishedAt" AS source_published_at
      FROM "FieldEvidence" e
      JOIN "College" c ON c.id=e."collegeId"
      JOIN "Source" s ON s.id=e."sourceId"
      LEFT JOIN LATERAL (
        SELECT status FROM "EvidenceDecision"
        WHERE "evidenceId"=e.id ORDER BY "createdAt" DESC,id DESC LIMIT 1
      ) d ON true
    ), classified AS (
      SELECT b.*, CASE
        WHEN b."isFixture" THEN 'DEMO'
        WHEN b.decision_status='REJECTED' THEN 'REJECTED'
        WHEN b.decision_status='PENDING' THEN 'HELD'
        WHEN b."validUntil" < CURRENT_TIMESTAMP THEN 'EXPIRED'
        WHEN b."validFrom" > CURRENT_TIMESTAMP THEN 'NOT_YET_VALID'
        WHEN EXISTS (
          SELECT 1 FROM base o
          WHERE o.id<>b.id AND NOT o."isFixture" AND o.decision_status IS DISTINCT FROM 'REJECTED'
            AND (o."validUntil" IS NULL OR o."validUntil" >= CURRENT_TIMESTAMP)
            AND (o."validFrom" IS NULL OR o."validFrom" <= CURRENT_TIMESTAMP)
            AND o."collegeId"=b."collegeId" AND o.field=b.field
            AND o."programScope" IS NOT DISTINCT FROM b."programScope"
            AND o."academicYear" IS NOT DISTINCT FROM b."academicYear" AND o.value<>b.value
            AND NOT EXISTS (SELECT 1 FROM base s WHERE s."supersedesId"=o.id AND s.decision_status='APPROVED')
        ) THEN 'CONFLICTED'
        WHEN b.decision_status='APPROVED' THEN 'VERIFIED'
        ELSE 'STAGED' END AS state,
        CASE WHEN b."validUntil" < CURRENT_TIMESTAMP THEN 'EXPIRED'
             WHEN b."validFrom" > CURRENT_TIMESTAMP THEN 'FUTURE'
             WHEN b.source_published_at IS NULL THEN 'SOURCE_UNDATED'
             WHEN b.source_published_at < CURRENT_TIMESTAMP - INTERVAL '2 years' THEN 'OLDER'
             WHEN b."academicYear" IS NULL THEN 'UNDATED'
             ELSE 'CURRENT' END AS freshness
      FROM base b
    ), filtered AS (
      SELECT e.id,e."createdAt",e.state,e.freshness,
        CASE WHEN e.field='website' OR (e.field='admissions' AND jsonb_typeof(e.value)='string' AND e.value #>> '{}' LIKE 'https://%') THEN 1 ELSE 0 END AS link_rank
      FROM classified e JOIN "College" c ON c.id=e."collegeId"
      WHERE (${q}='' OR POSITION(lower(${q}) IN lower(e.id))>0 OR POSITION(lower(${q}) IN lower(e.field))>0 OR POSITION(lower(${q}) IN lower(c.name))>0 OR POSITION(lower(${q}) IN lower(c.slug))>0 OR POSITION(lower(${q}) IN lower(e."programScope"))>0)
        AND (${college}='' OR POSITION(lower(${college}) IN lower(c.name))>0 OR POSITION(lower(${college}) IN lower(c.slug))>0)
        AND (${campus}='' OR POSITION(lower(${campus}) IN lower(c.city))>0 OR POSITION(lower(${campus}) IN lower(c.state))>0 OR EXISTS (
          SELECT 1 FROM "InstitutionAlias" a WHERE a."collegeId"=c.id AND (
            POSITION(lower(${campus}) IN lower(COALESCE(a.campus,'')))>0 OR POSITION(lower(${campus}) IN lower(a.value))>0)
        ))
        AND (${field}='' OR POSITION(lower(${field}) IN lower(e.field))>0)
        AND (${year}::integer IS NULL OR e."academicYear"=${year})
        AND (${freshness}='ALL' OR e.freshness=${freshness})
        AND (${status}='ALL' OR e.state=${status} OR (${status}='STALE' AND e.state IN ('EXPIRED','NOT_YET_VALID')))
    )`;
  const pageRows = await db.$queryRaw<{ id: string; state: QueueState; freshness: string; total: bigint }[]>(Prisma.sql`
    ${filteredCte}
    SELECT id,state,freshness,count(*) OVER() AS total FROM filtered
    ORDER BY link_rank ASC,"createdAt" DESC,id DESC LIMIT ${pageSize} OFFSET ${(page-1)*pageSize}`);
  const total = pageRows.length ? Number(pageRows[0].total) : Number((await db.$queryRaw<{ total: bigint }[]>(Prisma.sql`${filteredCte} SELECT count(*) AS total FROM filtered`))[0].total);
  const ids = pageRows.map((row) => row.id);
  const fetched = ids.length ? await db.fieldEvidence.findMany({
    where: { id: { in: ids } },
    include: { college: { include: { aliases: { orderBy: [{ namespace: 'asc' }, { value: 'asc' }] } } }, source: true, decisions: { include: { reviewer: { select: { id: true, name: true } } }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] } },
  }) : [];
  const byId = new Map(fetched.map((item) => [item.id, item]));
  const conflictIds = pageRows.filter((row) => row.state === 'CONFLICTED').map((row) => row.id);
  const conflicts = conflictIds.length ? await db.$queryRaw<{ evidenceId: string; peerId: string }[]>(Prisma.sql`
    SELECT a.id AS "evidenceId", b.id AS "peerId" FROM "FieldEvidence" a
    JOIN "FieldEvidence" b ON b."collegeId"=a."collegeId" AND b.field=a.field
      AND b."programScope" IS NOT DISTINCT FROM a."programScope" AND b."academicYear" IS NOT DISTINCT FROM a."academicYear"
      AND b.value<>a.value AND b.id<>a.id
    WHERE a.id IN (${Prisma.join(conflictIds)}) AND NOT a."isFixture" AND NOT b."isFixture"
      AND (b."validUntil" IS NULL OR b."validUntil">=CURRENT_TIMESTAMP)
      AND (b."validFrom" IS NULL OR b."validFrom"<=CURRENT_TIMESTAMP)
      AND NOT EXISTS (SELECT 1 FROM "EvidenceDecision" d WHERE d."evidenceId"=b.id
        AND d.status='REJECTED' AND d."createdAt"=(SELECT max(d2."createdAt") FROM "EvidenceDecision" d2 WHERE d2."evidenceId"=b.id))
      AND NOT EXISTS (SELECT 1 FROM "FieldEvidence" s JOIN "EvidenceDecision" sd ON sd."evidenceId"=s.id AND sd.status='APPROVED' WHERE s."supersedesId"=b.id)
  `) : [];
  const peerIds = [...new Set(conflicts.map((row) => row.peerId))];
  const peers = peerIds.length ? await db.fieldEvidence.findMany({ where: { id: { in: peerIds } }, include: { source: true, decisions: { include: { reviewer: { select: { id: true, name: true } } }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] } } }) : [];
  const peerMap = new Map(peers.map((peer) => [peer.id, peer]));
  const conflictMap = new Map<string, typeof peers>();
  for (const row of conflicts) {
    const peer = peerMap.get(row.peerId);
    if (peer) conflictMap.set(row.evidenceId, [...(conflictMap.get(row.evidenceId) ?? []), peer]);
  }
  const items = pageRows.flatMap((row) => {
    const item = byId.get(row.id);
    return item ? [{ ...item, queueState: row.state, freshness: row.freshness, conflicts: conflictMap.get(row.id) ?? [] }] : [];
  });
  return { ...query, total, hasMore: page * pageSize < total, items };
}
