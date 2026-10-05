import { parse } from 'csv-parse/sync';
import type { CollegeType, PrismaClient, SeatCategory, SeatPool } from '@prisma/client';

/**
 * Parser + importer for JoSAA "Opening and Closing Ranks" tables exported to CSV.
 * Expected columns (as published by JoSAA):
 *   Institute, Academic Program Name, Quota, Seat Type, Gender, Opening Rank, Closing Rank
 * Notes from the JoSAA page itself:
 *   - OPEN seat ranks are CRL; EWS/OBC-NCL/SC/ST seat ranks are category ranks.
 *   - PwD seat ranks are PwD ranks within the respective category.
 *   - A 'P' suffix means the rank is from the Preparatory Rank List.
 * Verify the header row of every new year's file before importing.
 */

export interface ParsedRank {
  value: number;
  isPreparatory: boolean;
}

export interface JosaaRow {
  institute: string;
  program: string;
  quota: string;
  category: SeatCategory;
  isPwd: boolean;
  seatPool: SeatPool;
  opening: ParsedRank | null;
  closing: ParsedRank;
}

export interface Rejected {
  line: number;
  reason: string;
}

const CATEGORY_MAP: Record<string, SeatCategory> = {
  OPEN: 'OPEN',
  EWS: 'EWS',
  'OBC-NCL': 'OBC_NCL',
  SC: 'SC',
  ST: 'ST',
};

export function parseSeatType(raw: string): { category: SeatCategory; isPwd: boolean } | null {
  const s = raw.trim().toUpperCase().replace(/\s+/g, ' ');
  const m = /^(OPEN|EWS|OBC-NCL|SC|ST)( \(PWD\))?$/.exec(s);
  if (!m) return null;
  return { category: CATEGORY_MAP[m[1]], isPwd: Boolean(m[2]) };
}

export function parseGender(raw: string): SeatPool | null {
  const s = raw.trim().toLowerCase();
  if (s.startsWith('gender-neutral') || s === 'gender neutral') return 'GENDER_NEUTRAL';
  if (s.startsWith('female-only') || s.startsWith('female only')) return 'FEMALE_ONLY';
  return null;
}

export function parseRank(raw: string | undefined): ParsedRank | null {
  if (raw === undefined) return null;
  const m = /^(\d+(?:\.\d+)?)\s*(P?)$/i.exec(raw.trim().replace(/,/g, ''));
  if (!m) return null;
  const value = Number(m[1]);
  if (!Number.isFinite(value) || value <= 0) return null;
  return { value, isPreparatory: m[2].toUpperCase() === 'P' };
}

/** "Computer Science and Engineering (4 Years, Bachelor of Technology)" -> parts. */
export function parseProgramName(name: string): { branch: string; degree: string | null; durationYears: number | null } {
  const m = /^(.*?)\s*\((\d+(?:\.\d+)?)\s*Years?,\s*(.+)\)\s*$/i.exec(name.trim());
  if (!m) return { branch: name.trim(), degree: null, durationYears: null };
  return { branch: m[1].trim(), durationYears: Number(m[2]), degree: m[3].trim() };
}

export function examForInstitute(institute: string): 'JEE_ADVANCED' | 'JEE_MAIN' {
  // IITs (including "Indian Institute of Technology (ISM) Dhanbad") admit via JEE Advanced.
  // "Indian Institute of Information Technology ..." does NOT match this prefix.
  return /^indian institute of technology\b/i.test(institute.trim()) ? 'JEE_ADVANCED' : 'JEE_MAIN';
}

const HEADER_ALIASES: Record<string, keyof RawRecord> = {
  institute: 'institute',
  'academic program name': 'program',
  'academic program': 'program',
  quota: 'quota',
  'seat type': 'seatType',
  gender: 'gender',
  'opening rank': 'opening',
  'closing rank': 'closing',
};

interface RawRecord {
  institute?: string;
  program?: string;
  quota?: string;
  seatType?: string;
  gender?: string;
  opening?: string;
  closing?: string;
}

export function naturalKey(r: Pick<JosaaRow, 'institute' | 'program' | 'quota' | 'category' | 'isPwd' | 'seatPool'>) {
  return [r.institute, r.program, r.quota, r.category, r.isPwd, r.seatPool].join('|');
}

export function parseJosaaCsv(text: string): { rows: JosaaRow[]; rejected: Rejected[]; duplicates: number } {
  const records = parse(text, {
    columns: (header: string[]) =>
      header.map((h) => HEADER_ALIASES[h.trim().toLowerCase().replace(/\s+/g, ' ')] ?? `__ignored_${h}`),
    skip_empty_lines: true,
    trim: true,
    bom: true,
    relax_column_count: true,
  }) as RawRecord[];

  const rejected: Rejected[] = [];
  const byKey = new Map<string, JosaaRow>();
  let duplicates = 0;

  records.forEach((rec, i) => {
    const line = i + 2; // header is line 1
    const missing = (['institute', 'program', 'quota', 'seatType', 'gender', 'closing'] as const).filter((k) => !rec[k]);
    if (missing.length) return rejected.push({ line, reason: `missing ${missing.join(', ')}` });
    const seat = parseSeatType(rec.seatType!);
    if (!seat) return rejected.push({ line, reason: `unknown seat type "${rec.seatType}"` });
    const seatPool = parseGender(rec.gender!);
    if (!seatPool) return rejected.push({ line, reason: `unknown gender "${rec.gender}"` });
    const closing = parseRank(rec.closing);
    if (!closing) return rejected.push({ line, reason: `bad closing rank "${rec.closing}"` });
    const opening = rec.opening ? parseRank(rec.opening) : null;
    if (rec.opening && !opening) return rejected.push({ line, reason: `bad opening rank "${rec.opening}"` });
    if (opening && !opening.isPreparatory && !closing.isPreparatory && opening.value > closing.value) {
      return rejected.push({ line, reason: 'opening rank is worse than closing rank' });
    }
    const quota = rec.quota!.trim().toUpperCase();
    if (!/^[A-Z]{2,3}$/.test(quota)) return rejected.push({ line, reason: `unknown quota "${rec.quota}"` });

    const row: JosaaRow = {
      institute: rec.institute!.replace(/\s+/g, ' ').trim(),
      program: rec.program!.replace(/\s+/g, ' ').trim(),
      quota,
      ...seat,
      seatPool,
      opening,
      closing,
    };
    const key = naturalKey(row);
    if (byKey.has(key)) duplicates++;
    byKey.set(key, row);
  });

  return { rows: [...byKey.values()], rejected, duplicates };
}

export interface InstituteMapping {
  josaaName: string;
  slug: string;
  name: string;
  shortName: string;
  city: string;
  state: string;
  type: CollegeType;
}

export function parseInstituteMapping(text: string): Map<string, InstituteMapping> {
  const recs = parse(text, { columns: true, skip_empty_lines: true, trim: true, bom: true }) as Record<string, string>[];
  const map = new Map<string, InstituteMapping>();
  for (const r of recs) {
    const type = r.type?.toUpperCase();
    if (!r.josaa_name || !r.slug || !r.name || !r.city || !r.state || (type !== 'GOVERNMENT' && type !== 'PRIVATE')) {
      throw new Error(`Invalid institute mapping row: ${JSON.stringify(r)}`);
    }
    map.set(r.josaa_name.replace(/\s+/g, ' ').trim(), {
      josaaName: r.josaa_name,
      slug: r.slug,
      name: r.name,
      shortName: r.short_name || r.name,
      city: r.city,
      state: r.state,
      type,
    });
  }
  return map;
}

export interface ImportOptions {
  year: number;
  round: number;
  source: { name: string; publisher: string; url: string; license?: string; retrievedAt: Date; notes?: string };
  institutes: Map<string, InstituteMapping>;
  examOverride?: 'JEE_MAIN' | 'JEE_ADVANCED';
  dryRun?: boolean;
}

export interface ImportSummary {
  upserted: number;
  unmatchedInstitutes: string[];
  colleges: number;
  programs: number;
}

/**
 * Idempotent: re-running the same file updates values in place (natural key
 * = program + exam + year + round + quota + category + PwD + gender pool).
 * Institutes are matched by the mapping file first, then by exact College.name.
 * Unmatched institutes are reported and skipped, never guessed.
 */
export async function importJosaaRows(db: PrismaClient, rows: JosaaRow[], opts: ImportOptions): Promise<ImportSummary> {
  const byInstitute = new Map<string, JosaaRow[]>();
  for (const r of rows) byInstitute.set(r.institute, [...(byInstitute.get(r.institute) ?? []), r]);

  const summary: ImportSummary = { upserted: 0, unmatchedInstitutes: [], colleges: 0, programs: 0 };
  if (opts.dryRun) {
    for (const name of byInstitute.keys()) {
      const known = opts.institutes.has(name) || (await db.college.findFirst({ where: { name }, select: { id: true } }));
      if (!known) summary.unmatchedInstitutes.push(name);
    }
    summary.upserted = rows.filter((r) => !summary.unmatchedInstitutes.includes(r.institute)).length;
    return summary;
  }

  const source = await db.source.create({ data: opts.source });

  for (const [institute, instRows] of byInstitute) {
    const mapping = opts.institutes.get(institute);
    let collegeId: string | undefined;
    if (mapping) {
      const c = await db.college.upsert({
        where: { slug: mapping.slug },
        update: {},
        create: {
          slug: mapping.slug,
          name: mapping.name,
          shortName: mapping.shortName,
          city: mapping.city,
          state: mapping.state,
          type: mapping.type,
          dataStatus: 'UNVERIFIED',
        },
        select: { id: true },
      });
      collegeId = c.id;
    } else {
      collegeId = (await db.college.findFirst({ where: { name: institute }, select: { id: true } }))?.id;
    }
    if (!collegeId) {
      summary.unmatchedInstitutes.push(institute);
      continue;
    }
    summary.colleges++;
    const exam = opts.examOverride ?? examForInstitute(institute);

    await db.$transaction(async (tx) => {
      const programIds = new Map<string, string>();
      for (const r of instRows) {
        if (!programIds.has(r.program)) {
          const parts = parseProgramName(r.program);
          const p = await tx.program.upsert({
            where: { collegeId_name: { collegeId: collegeId!, name: r.program } },
            update: {},
            create: { collegeId: collegeId!, name: r.program, ...parts },
            select: { id: true },
          });
          programIds.set(r.program, p.id);
          summary.programs++;
        }
        const programId = programIds.get(r.program)!;
        const values = {
          openingValue: r.opening?.value ?? null,
          closingValue: r.closing.value,
          isPreparatory: r.closing.isPreparatory,
          sourceId: source.id,
          metric: 'RANK' as const,
        };
        await tx.cutoffRecord.upsert({
          where: {
            naturalKey: {
              programId,
              exam,
              year: opts.year,
              round: opts.round,
              quota: r.quota,
              category: r.category,
              isPwd: r.isPwd,
              seatPool: r.seatPool,
            },
          },
          update: values,
          create: {
            programId,
            exam,
            year: opts.year,
            round: opts.round,
            quota: r.quota,
            category: r.category,
            isPwd: r.isPwd,
            seatPool: r.seatPool,
            ...values,
          },
        });
        summary.upserted++;
      }
    });
  }
  return summary;
}
