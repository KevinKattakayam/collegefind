import { validateOfficialFacts, type OfficialFactsManifest } from './official-facts';

const userAgent = 'CollegeFind-SourceCheck';
const maxBytes = 2 * 1024 * 1024;
const source = new URL('https://iitp.ac.in/departments/computer-science-engineering');
const use = 'IIT Patna public department page. Read robots before a single exact-page request. Record one independently written programme name and duration with attribution, with no stored page, descriptions, faculty information or bulk reuse.';

function checkedCrawlDelay(robots: string, path: string): number | null {
  const groups: { agents: string[]; instructions: [string, string][] }[] = [];
  for (const row of robots.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const line = row.split('#', 1)[0].trim();
    if (!line) continue;
    const separator = line.indexOf(':');
    if (separator < 0) return null;
    const key = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    if (key === 'user-agent') {
      if (!groups.length || groups.at(-1)!.instructions.length) groups.push({ agents: [], instructions: [] });
      groups.at(-1)!.agents.push(value.toLowerCase());
    } else if (key !== 'sitemap') {
      groups.at(-1)?.instructions.push([key, value]);
    }
  }
  const named = groups.filter(({ agents }) => agents.some((agent) => agent !== '*' && agent && userAgent.toLowerCase().startsWith(agent)));
  const applicable = named.length ? named : groups.filter(({ agents }) => agents.includes('*'));
  if (!applicable.length) return null;
  const instructions = applicable.flatMap((group) => group.instructions);
  // Unrecognized limits and patterns require manual review.
  const delays = instructions.filter(([key]) => key === 'crawl-delay').map(([, delay]) => /^\d+$/.test(delay) ? Number(delay) : NaN);
  if (delays.some((seconds) => !Number.isSafeInteger(seconds) || seconds > 30)) return null;
  const rules = instructions.filter(([key]) => key !== 'crawl-delay');
  if (rules.some(([key, pattern]) => !['allow', 'disallow'].includes(key) || (pattern && !/^\/[\x21-\x7e]*$/.test(pattern)))) return null;
  const matching = rules.filter(([, pattern]) => {
    if (!pattern) return false;
    const anchor = pattern.endsWith('$');
    const body = (anchor ? pattern.slice(0, -1) : pattern).split('*').map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*');
    return new RegExp(`^${body}${anchor ? '$' : ''}`, 'u').test(path);
  });
  // Either matching allow or no matching exclusion. If rules overlap, any
  // deny is conservative and the provider can be reviewed manually.
  if (matching.some(([key]) => key === 'disallow')) return null;
  return Math.max(1.5, ...delays) * 1000;
}

export function robotsPermitPath(robots: string, path: string) {
  return checkedCrawlDelay(robots, path) !== null;
}

async function readPage(url: URL, type: string, get: typeof fetch, canStop?: (prefix: string) => boolean) {
  const response = await get(url, {
    signal: AbortSignal.timeout(12_000), redirect: 'error', credentials: 'omit',
    headers: { 'User-Agent': userAgent, Accept: type },
  });
  if (!response.ok || !response.body || response.headers.get('Content-Type')?.split(';')[0].trim() !== type) {
    await response.body?.cancel();
    throw new Error(`Collection blocked by HTTP status or media type (${response.status})`);
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let text = '';
  let bytes = 0;
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) return text + decoder.decode();
      bytes += chunk.value.byteLength;
      if (bytes > maxBytes) throw new Error('Collection blocked by response size');
      text += decoder.decode(chunk.value, { stream: true });
      if (canStop?.(text)) return text;
    }
  } finally {
    await reader.cancel();
  }
}

export function extractIitPatnaCandidate(html: string, collectedAt: Date) {
  // A deliberately narrow text adapter. It fails closed if the department
  // changes this page's programme labels or the layout of the duration row.
  const visible = html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->|<[^>]*>/g, ' ').replace(/&nbsp;|&#160;/g, ' ').replace(/\s+/g, ' ');
  const segment = visible.match(/Programs Offered\s+(.{1,850}?)\s+List of Faculty Members/i)?.[1];
  const matches = [...(segment?.matchAll(/B\.Tech\.\s+in Artificial Intelligence and Data Science\s+Duration\s*:\s*4 years\b/gi) ?? [])];
  if (!/Department of Computer Science\s*(?:&amp;|&)\s*Engineering/i.test(visible) ||
      !/Indian Institute of Technology Patna/i.test(visible) || !/Bihta/i.test(visible) || matches.length !== 1) {
    throw new Error('IIT Patna campus, programme or duration anchor did not match');
  }

  const location = 'Department of CSE, Programs Offered, Artificial Intelligence and Data Science entry and Duration row';
  const id = 'iit-patna-cse-official-collector';
  const manifest = {
    scope: 'RESEARCH_NOTES_WITH_IMPORTABLE_CANDIDATES',
    sources: [{ id, institutionSlug: 'iit-patna', publisher: 'Indian Institute of Technology Patna', url: source.href,
      publicationDate: null, academicYear: null, retrievedAt: collectedAt.toISOString(), access: 'PUBLIC_HTML_READ',
      reuseConditions: use, evidenceLocations: [location] }],
    candidateClaims: [{ institutionSlug: 'iit-patna', sourceIds: [id], academicYear: null, evidenceLocation: location,
      field: 'structured', value: { kind: 'programme', programme: 'B.Tech in Artificial Intelligence and Data Science', durationMonths: 48, level: 'UG' },
      status: 'RESEARCHED_READY_FOR_UNREVIEWED_STAGING', reviewState: 'UNREVIEWED', stageable: true }],
  } satisfies OfficialFactsManifest;
  validateOfficialFacts(manifest, collectedAt);
  return manifest;
}

export async function collectIitPatna(get = fetch, delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))) {
  const robots = await readPage(new URL('/robots.txt', source), 'text/plain', get);
  const ms = checkedCrawlDelay(robots, source.pathname);
  if (ms === null) throw new Error('Collection blocked by robots instructions');
  await delay(ms);
  // Stop after the complete programme block and campus markers arrive. Leave
  // the unrelated remainder of this large page unread and never persist HTML.
  const html = await readPage(source, 'text/html', get, (prefix) =>
    ['Programs Offered', 'List of Faculty Members', 'Bihta', 'Indian Institute of Technology Patna'].every((needle) => prefix.includes(needle)));
  return extractIitPatnaCandidate(html, new Date());
}
