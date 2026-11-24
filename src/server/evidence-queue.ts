import { Prisma, type PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { latestSourceUseAssessments, type SourceUseStatus } from '@/server/source-use-review';
import { evidenceReviewHold, reviewHoldIds } from '@/server/review-holds';

const states = ['ALL', 'STAGED', 'HELD', 'VERIFIED', 'REJECTED', 'DEMO', 'EXPIRED', 'NOT_YET_VALID', 'CONFLICTED'] as const;
const freshnesses = ['ALL', 'CURRENT', 'UNDATED', 'SOURCE_UNDATED', 'EXPIRED', 'FUTURE', 'OLDER'] as const;

export const queueQuery = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  // Legacy values remain accepted for bookmarked review links.
  status: z.enum([...states, 'PENDING', 'APPROVED', 'STALE', 'CONFLICT']).default('STAGED'),
  q: z.string().trim().max(120).default(''),
  batch: z.enum(['ALL', '060']).default('ALL'),
  college: z.string().trim().max(120).default(''),
  campus: z.string().trim().max(120).default(''),
  program: z.string().trim().max(160).default(''),
  source: z.string().trim().max(160).default(''),
  field: z.string().trim().max(100).default(''),
  factType: z.enum(['ALL', 'programme', 'admission', 'seatIntake', 'fee', 'placement']).default('ALL'),
  historical: z.enum(['ALL', 'HISTORICAL', 'CURRENT']).default('ALL'),
  sourceUse: z.enum(['ALL', 'UNASSESSED', 'CLEARED', 'RESTRICTED', 'UNRESOLVED']).default('ALL'),
  academicYear: z.preprocess((value) => value === '' ? undefined : value, z.coerce.number().int().min(1900).max(2200).optional()),
  freshness: z.enum(freshnesses).default('ALL'),
});

type QueueState = typeof states[number];
type QueueSourceUse = SourceUseStatus | 'UNASSESSED';

/** PostgreSQL classifies, filters, counts and paginates in one statement snapshot.
 * Substantive facts precede link-only claims; every ordering has an ID tie-breaker.
 */
export async function evidenceQueue(db: PrismaClient, raw: unknown) {
  const query = queueQuery.parse(raw);
  const { page, pageSize, q, college, campus, program, source, field, factType, historical, sourceUse, academicYear, freshness, batch } = query;
  const year = academicYear ?? null;
  const heldIds = reviewHoldIds();
  const status: QueueState | 'STALE' = query.status === 'PENDING' ? 'STAGED'
    : query.status === 'APPROVED' ? 'VERIFIED' : query.status === 'CONFLICT' ? 'CONFLICTED' : query.status;
  const filteredCte = Prisma.sql`
    WITH base AS (
      SELECT e.*, d.status AS decision_status, s."publishedAt" AS source_published_at,
        s.id AS source_id, s.publisher AS source_publisher, s.url AS source_url,
        CASE WHEN su.metadata IS NULL THEN 'UNASSESSED'
             WHEN su.metadata->>'status' IN ('CLEARED','RESTRICTED','UNRESOLVED') THEN su.metadata->>'status'
             ELSE 'UNRESOLVED' END AS source_use_status,
        EXISTS (SELECT 1 FROM "AuditLog" st WHERE st.action='official.fact.stage' AND st."targetType"='FieldEvidence'
          AND st."targetId"=e.id AND st.metadata->>'sourceManifestId' LIKE 'b060-%') AS batch_060
      FROM "FieldEvidence" e
      JOIN "College" c ON c.id=e."collegeId"
      JOIN "Source" s ON s.id=e."sourceId"
      LEFT JOIN LATERAL (
        SELECT status FROM "EvidenceDecision"
        WHERE "evidenceId"=e.id ORDER BY "createdAt" DESC,id DESC LIMIT 1
      ) d ON true
      LEFT JOIN LATERAL (
        SELECT metadata FROM "AuditLog" a WHERE a.action='source.use.assessment' AND a."targetType"='Source'
          AND a."targetId"=s.id ORDER BY a."createdAt" DESC,a.id DESC LIMIT 1
      ) su ON true
    ), classified AS (
      SELECT b.*, CASE
        WHEN b."isFixture" THEN 'DEMO'
        WHEN b.decision_status='REJECTED' THEN 'REJECTED'
        WHEN b.decision_status='PENDING' OR b.id IN (${Prisma.join(heldIds)}) THEN 'HELD'
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
        AND (${program}='' OR POSITION(lower(${program}) IN lower(e."programScope"))>0 OR POSITION(lower(${program}) IN lower(e.value::text))>0)
        AND (${source}='' OR POSITION(lower(${source}) IN lower(e.source_publisher))>0 OR POSITION(lower(${source}) IN lower(e.source_url))>0)
        AND (${field}='' OR POSITION(lower(${field}) IN lower(e.field))>0)
        AND (${factType}='ALL' OR e.value->>'kind'=${factType})
        AND (${historical}='ALL' OR (${historical}='HISTORICAL' AND e.historical=true) OR (${historical}='CURRENT' AND e.historical=false))
        AND (${sourceUse}='ALL' OR e.source_use_status=${sourceUse})
        AND (${batch}='ALL' OR (${batch}='060' AND e.batch_060))
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
  const sourceUseAssessmentMap = await latestSourceUseAssessments(db, [...new Set(fetched.map((item) => item.sourceId))]);
  const items = pageRows.flatMap((row) => {
    const item = byId.get(row.id);
    if (!item) return [];
    const assessment = sourceUseAssessmentMap.get(item.sourceId);
    return [{ ...item, queueState: row.state, freshness: row.freshness, conflicts: conflictMap.get(row.id) ?? [],
      sourceUseStatus: assessment?.status ?? 'UNASSESSED',
      sourceUseAssessment: assessment ?? null }];
  });
  const placementCohorts: Array<{
    collegeId: string; collegeName: string; collegeSlug: string; sourceId: string; sourcePublisher: string; sourceUrl: string;
    sourceUseStatus: QueueSourceUse; sourceRetrievedAt: Date; programScope: string | null; campusScope: string | null; publisherPeriod: string | null; academicYear: number | null; historical: boolean; cohort: string; claims: Array<{ id: string; metric: string; value: number; denominator: number; definition: string; evidenceLocation: string | null; reviewState: string; holdReason: string | null }>;
  }> = [];
  if (batch === '060' && factType === 'placement') {
    const rows = await db.$queryRaw<Array<{ id: string; collegeId: string; collegeName: string; collegeSlug: string; sourceId: string; sourcePublisher: string; sourceUrl: string; sourceRetrievedAt: Date; programScope: string | null; campusScope: string | null; publisherPeriod: string | null; academicYear: number | null; historical: boolean; value: { cohort: string; metric: string; value: number; denominator: number; definition: string }; evidenceLocation: string | null; latestDecisionStatus: string | null; validUntil: Date | null }>>(Prisma.sql`
      SELECT e.id,e."collegeId",c.name AS "collegeName",c.slug AS "collegeSlug",e."sourceId",
        s.publisher AS "sourcePublisher",s.url AS "sourceUrl",s."retrievedAt" AS "sourceRetrievedAt",e."programScope",e."campusScope",e."publisherPeriod",e."academicYear",
        e.historical,e.value,e."evidenceLocator" AS "evidenceLocation",e."validUntil",
        d.status AS "latestDecisionStatus"
      FROM "FieldEvidence" e JOIN "College" c ON c.id=e."collegeId" JOIN "Source" s ON s.id=e."sourceId"
      LEFT JOIN LATERAL (SELECT status FROM "EvidenceDecision" WHERE "evidenceId"=e.id ORDER BY "createdAt" DESC,id DESC LIMIT 1) d ON true
      WHERE e.field='structured.placement' AND e.value->>'kind'='placement'
        AND EXISTS (SELECT 1 FROM "AuditLog" a WHERE a.action='official.fact.stage' AND a."targetType"='FieldEvidence'
          AND a."targetId"=e.id AND a.metadata->>'sourceManifestId' LIKE 'b060-%')
      ORDER BY c.name,e."programScope",e."academicYear",e.id`);
    const sourceUseMap = await latestSourceUseAssessments(db, [...new Set(rows.map((row) => row.sourceId))]);
    const groups = new Map<string, typeof placementCohorts[number]>();
    for (const row of rows) {
      // programScope includes the metric name, so grouping on it would split
      // PLACED_COUNT/MEDIAN/HIGHER_STUDIES_COUNT into false separate cohorts.
      const key = JSON.stringify([row.collegeId,row.campusScope,row.sourceId,row.publisherPeriod,row.academicYear,row.historical,row.value.cohort]);
      const group = groups.get(key) ?? {
        collegeId: row.collegeId, collegeName: row.collegeName, collegeSlug: row.collegeSlug, sourceId: row.sourceId,
        sourcePublisher: row.sourcePublisher, sourceUrl: row.sourceUrl, sourceRetrievedAt: row.sourceRetrievedAt, sourceUseStatus: sourceUseMap.get(row.sourceId)?.status ?? 'UNASSESSED',
        programScope: row.value.cohort, campusScope: row.campusScope, publisherPeriod: row.publisherPeriod, academicYear: row.academicYear, historical: row.historical, cohort: row.value.cohort, claims: [],
      };
      const holdReason = evidenceReviewHold(row.id);
      const reviewState = holdReason || row.latestDecisionStatus === 'PENDING' ? 'HELD'
        : row.latestDecisionStatus === 'REJECTED' ? 'REJECTED'
        : (row.validUntil && row.validUntil < new Date()) ? 'EXPIRED'
        : row.latestDecisionStatus === 'APPROVED' ? 'VERIFIED' : 'STAGED';
      group.claims.push({ id: row.id, metric: row.value.metric, value: row.value.value, denominator: row.value.denominator, definition: row.value.definition, evidenceLocation: row.evidenceLocation, reviewState, holdReason });
      groups.set(key, group);
    }
    const match = (value: string, queryValue: string) => !queryValue || value.toLowerCase().includes(queryValue.toLowerCase());
    placementCohorts.push(...[...groups.values()].filter((group) =>
      match(group.collegeName, college) || match(group.collegeSlug, college)
    ).filter((group) => match(group.cohort, program) || match(group.programScope ?? '', program))
      .filter((group) => !academicYear || group.academicYear === academicYear)
      .filter((group) => match(group.sourcePublisher, source) || match(group.sourceUrl, source))
      .filter((group) => sourceUse === 'ALL' || group.sourceUseStatus === sourceUse)
      .filter((group) => historical === 'ALL' || (historical === 'HISTORICAL' ? group.historical : !group.historical)));
  }
  return { ...query, total, hasMore: page * pageSize < total, items, placementCohorts };
}
