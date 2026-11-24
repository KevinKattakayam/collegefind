#!/usr/bin/env python3
"""Normalize user-supplied CollegeFind 2026 research PDFs into review-only facts.

This script performs no network access and makes no reviewer decisions. It requires
Poppler (pdfinfo, pdftotext, pdftohtml); source claims remain UNREVIEWED.
"""
from __future__ import annotations
import hashlib
import json
import re
import subprocess
import tempfile
import xml.etree.ElementTree as ET
from datetime import date
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'data/pilot/pdf-research-2026-batch-060.json'
INPUTS = [
    ('CollegeFind_First_40_College_Data_Verified_2026.pdf', 44),
    ('CollegeFind_Colleges_41_to_100_Research_2026.pdf', 66),
    ('CollegeFind_Colleges_101_to_150_Research_2026.pdf', 56),
    ('CollegeFind_Colleges_151_to_205_Research_2026.pdf', 63),
]
SEED = json.loads((ROOT / 'src/server/seed/demo-colleges.json').read_text())
ARCHIVE = json.loads((ROOT / 'data/pilot/staged-evidence-after-batch-027.json').read_text())
CANONICAL = {r['slug']: r['id'] for r in ARCHIVE['collegeIdentity']}
LEDGER = {r['slug']: r for r in json.loads((ROOT / 'docs/PROFILE_COMPLETENESS.json').read_text())['institutions']}


def run(args: list[str]) -> str:
    return subprocess.run(args, check=True, capture_output=True, text=True).stdout


def normalize(s: str) -> str:
    return re.sub(r'[^a-z0-9]+', '', s.casefold())


def one_section(text: str, n: int) -> str:
    match = re.search(rf'(?m)^\s*0?{n}\s+[^\n]+(.*?)(?=^\s*0?{n+1}\s+|^\s*CollegeFind V3\s*\||\Z)', text, re.I | re.S)
    return ' '.join(match.group(1).split()).strip() if match else ''


def classify_level(text: str) -> str | None:
    levels = set()
    for token in re.findall(r'(?i)\b(?:B\.?Tech|B\.?E\.?|B\.?Arch|B\.?Des|B\.?Sc|B\.?A\.?|BBA|BCom|B\.Com|MBBS|MD\s*/\s*MS|MD|MS|M\.?Tech|M\.?Sc|M\.?A\.?|MBA|LLB|LL\.B|LLM|Ph\.?D|PhD|doctoral|diploma)\b', text):
        t = token.casefold().replace('.', '').replace(' ', '')
        if t in {'phd', 'doctoral'}: levels.add('DOCTORAL')
        elif t == 'diploma': levels.add('DIPLOMA')
        elif t in {'btech', 'be', 'barch', 'bdes', 'bsc', 'ba', 'bba', 'bcom', 'mbbs'}: levels.add('UG')
        elif t in {'md/ms', 'md', 'ms', 'mtech', 'msc', 'ma', 'mba', 'llb', 'llm'}: levels.add('PG')
    return next(iter(levels)) if len(levels) == 1 else None


def extract_programme_candidates(text: str) -> tuple[list[dict], list[str]]:
    candidates, holds = [], []
    # Sections use semicolons to separate programme families. Preserve each short factual
    # phrase as printed in the user-provided research pack; do not invent durations.
    for item in [x.strip(' .') for x in re.split(r';\s*', text) if x.strip(' .')]:
        if not re.search(r'(?i)\b(?:B\.?Tech|B\.?E\.?|B\.?Arch|B\.?Des|B\.?Sc|B\.?A\.?|BBA|BCom|MBBS|MD\s*/\s*MS|MD|MS|M\.?Tech|M\.?Sc|M\.?A\.?|MBA|LLB|LL\.B|LLM|Ph\.?D|PhD|doctoral|diploma)\b', item):
            continue
        level = classify_level(item)
        if not level:
            holds.append(f'Programme family mixes degree levels or has ambiguous level: {item[:160]}')
            continue
        if len(item) > 180:
            holds.append(f'Programme family exceeds typed title limit; no lossy truncation: {item[:160]}')
            continue
        claim = {'kind': 'programme', 'programme': item, 'level': level}
        durations = re.findall(r'(?i)\b(\d+(?:\.\d+)?)\s*(?:-\s*\d+(?:\.\d+)?\s*)?(?:years?|yrs?)\b', item)
        if len(set(durations)) == 1:
            months = round(float(durations[0]) * 12)
            if 1 <= months <= 144:
                claim['durationMonths'] = months
        candidates.append(claim)
    return candidates, holds


def extract_outcomes(text: str) -> list[dict]:
    rows = []
    # First pack uses the NIRF table header and a single numeric row.
    year = re.search(r'graduating year\s*(20\d{2}[–-]\d{2})', text, re.I)
    scope = re.search(r'scope:\s*(.*?)\.', text, re.I)
    row = re.search(r'on time\s+Rs/year\s+([\d,]+)\s+([\d,]+)\s+Rs\s*([\d,]+)\s*\(([^)]*)\)\s+([\d,]+)', text, re.I)
    if year and scope and row:
        grad, placed, median, _, higher = row.groups()
        rows.append({'year': year.group(1).replace('–', '-'), 'scope': scope.group(1).strip(), 'graduates': int(grad.replace(',', '')), 'placed': int(placed.replace(',', '')), 'medianInr': int(median.replace(',', '')), 'higherStudies': int(higher.replace(',', ''))})
    # Research packs 2 and 3 transcribe the same official NIRF fields as prose.
    prose = re.compile(r'NIRF filing 2026\s*[|/]\s*(?:Graduating cohort\s*|graduates\s*)(20\d{2}[–-]\d{2})\s*[|,]\s*([^:;|.]{1,150}):\s*(\d[\d,]*)\s+(?:graduated on time|completed in stipulated time);\s*(\d[\d,]*)\s+(?:placed|reported placed);\s*(?:median reported annual salary|annual median)\s*(?:INR|Rs\.?|₹)\s*([\d,]+(?:\.\d+)?)\s*(lakh(?:/yr)?|lpa)?', re.I)
    for m in prose.finditer(text):
        y, sc, grad, placed, amount, unit = m.groups()
        value = float(amount.replace(',', ''))
        median = round(value * 100_000) if unit and ('lakh' in unit.lower() or 'lpa' in unit.lower()) else int(value)
        row = {'year': y.replace('–', '-'), 'scope': sc.strip(' ,'), 'graduates': int(grad.replace(',', '')), 'placed': int(placed.replace(',', '')), 'medianInr': median}
        h = re.search(r';\s*(\d[\d,]*)\s+(?:proceeded to|selected for) higher studies', m.string[m.end():m.end()+100], re.I)
        if h: row['higherStudies'] = int(h.group(1).replace(',', ''))
        rows.append(row)
    # Fourth pack prose; scope and period are explicit but the report does not give the
    # separate higher-studies count in this short fact row.
    fourth = re.search(r'NIRF 2026 filing; graduating year (20\d{2}[–-]\d{2});\s*([^.;]+)\. Completed on time:\s*([\d,]+)\. Reported placed:\s*([\d,]+)\. Median annual salary among placed:\s*(?:INR|Rs\.?|₹)\s*([\d,.]+)\s*(lakh)?', text, re.I)
    if fourth:
        y, sc, grad, placed, amount, unit = fourth.groups()
        value = float(amount.replace(',', ''))
        median = round(value * 100_000) if unit else int(value)
        rows.append({'year': y.replace('–', '-'), 'scope': sc.strip(), 'graduates': int(grad.replace(',', '')), 'placed': int(placed.replace(',', '')), 'medianInr': median})
    # Explicit separate cohort rows are retained only where the pack gives all required scope.
    secondary = re.compile(r'(?:The same NIRF[^.]*?separately reports|same NIRF[^.]*?separately reports)\s*([^:]*?):\s*(\d[\d,]*) graduates,\s*(\d[\d,]*) placed,\s*median\s*(?:INR|Rs\.?|₹)\s*([\d,]+(?:\.\d+)?)\s*(lakh)?', re.I)
    for m in secondary.finditer(text):
        sc, grad, placed, amount, unit = m.groups()
        value = float(amount.replace(',', ''))
        median = round(value * 100_000) if unit else int(value)
        rows.append({'year': '2024-25', 'scope': sc.strip(), 'graduates': int(grad.replace(',', '')), 'placed': int(placed.replace(',', '')), 'medianInr': median})
    # Explicit AIIMS older cohort includes a genuine reported zero, not missing data.
    aiims = re.search(r'(20\d{2}[–-]\d{2})\s+UG\s+5-year cohort:\s*([\d,]+) graduates,\s*([\d,]+) recorded campus placements,\s*([\d,]+) selected for higher studies', text, re.I)
    if aiims:
        y, grad, placed, higher = aiims.groups()
        rows.append({'year': y.replace('–', '-'), 'scope': 'UG 5-year medical; campus placement count, not employment rate', 'graduates': int(grad.replace(',', '')), 'placed': int(placed.replace(',', '')), 'medianInr': None, 'higherStudies': int(higher.replace(',', '')), 'explicitZeroContext': 'Source explicitly records zero campus placements; this is not a zero employment result or placement rate.'})
    dedup, seen = [], set()
    for r in rows:
        key = json.dumps(r, sort_keys=True)
        if key not in seen and r['placed'] <= r['graduates']:
            dedup.append(r); seen.add(key)
    return dedup


def best_url(links: list[tuple[str, str]], pattern: str) -> str | None:
    return next((url for url, label in links if re.search(pattern, url + ' ' + label, re.I)), None)


def source_publisher(profile: dict, source_url: str) -> str:
    """Use the institution name only for its own domain; otherwise retain the actual source host."""
    host = (urlparse(source_url).hostname or '').lower().removeprefix('www.')
    authority_names = {
        'mcc.nic.in': 'Medical Counselling Committee, Government of India',
        'josaa.nic.in': 'Joint Seat Allocation Authority, Ministry of Education, Government of India',
        'csab.nic.in': 'Central Seat Allocation Board, Ministry of Education, Government of India',
        'consortiumofnlus.ac.in': 'Consortium of National Law Universities',
        'jacdelhi.admissions.nic.in': 'Joint Admission Committee Delhi',
        'cetonline.karnataka.gov.in': 'Karnataka Examinations Authority, Government of Karnataka',
    }
    for domain, publisher in authority_names.items():
        if host == domain or host.endswith('.' + domain):
            return publisher
    institution_url = profile.get('institutionUrl')
    if institution_url:
        institution_host = (urlparse(institution_url).hostname or '').lower().removeprefix('www.')
        if institution_host and (host == institution_host or host.endswith('.' + institution_host)):
            return profile['catalogueName']
    return host or 'Publisher host unavailable; source held for review'


def main() -> None:
    pdfs, profile_rows = [], []
    with tempfile.TemporaryDirectory(prefix='collegefind-pdf060-') as temp:
        for filename, expected_pages in INPUTS:
            path = ROOT / filename
            if not path.is_file(): raise SystemExit(f'Missing supplied input PDF: {filename}')
            info = run(['pdfinfo', str(path)])
            match = re.search(r'^Pages:\s+(\d+)', info, re.M)
            if not match or int(match.group(1)) != expected_pages: raise SystemExit(f'Unexpected page count for {filename}')
            text_path = Path(temp) / f'{len(pdfs)}.txt'
            xml_base = Path(temp) / f'{len(pdfs)}'
            run(['pdftotext', '-layout', str(path), str(text_path)])
            run(['pdftohtml', '-xml', '-i', '-q', str(path), str(xml_base)])
            xml_path = xml_base.with_suffix('.xml')
            text_pages = text_path.read_text(errors='replace').split('\f')
            if text_pages and not text_pages[-1].strip(): text_pages.pop()
            xroot = ET.parse(xml_path).getroot()
            html_links = {int(p.attrib['number']): [(a.attrib.get('href', ''), ''.join(a.itertext()).strip()) for a in p.iter('a') if a.attrib.get('href', '').startswith('https://')] for p in xroot.findall('page')}
            pdfs.append({'name': filename, 'pages': expected_pages, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()})
            for page_no, text in enumerate(text_pages, 1):
                match = re.search(r'(?:CollegeFind catalogue\s*#|CollegeFind seed\s*#|Original CollegeFind seed position\s*#|Original catalogue item\s+)(\d+)', text, re.I)
                if not match: continue
                pos = int(match.group(1))
                if not 1 <= pos <= 205: continue
                college = SEED[pos - 1]
                slug = college['slug']
                headline = next((re.match(rf'^\s*{pos}\s+(.+?)\s*$', line) for line in text.splitlines()[:5] if re.match(rf'^\s*{pos}\s+(.+?)\s*$', line)), None)
                if headline and normalize(headline.group(1)) != normalize(college['name']):
                    raise SystemExit(f'Institution heading mismatch at {filename} p.{page_no}: {headline.group(1)!r} vs {college["name"]!r}')
                links = html_links.get(page_no, [])
                sections = {n: one_section(text, n) for n in range(1, 8)}
                programme_section, admission_section, fee_section = sections[1], sections[2], sections[3]
                if pos <= 40: outcome_section, seat_section = sections[4], sections[5]
                else: seat_section, outcome_section = sections[4], sections[5]
                scope_match = re.search(r'(?:Institutional scope|Identity / campus scope)\s*(.*?)(?=\s*(?:01\s|Official institution site|02\s))', text, re.I | re.S)
                campus = ' '.join(scope_match.group(1).split()).strip() if scope_match else f"{college['name']}, {college.get('city','')}, {college.get('state','')} (research pack does not specify campus scope)"
                institution_url = best_url(links, r'institution site|institution website|official institution site|institution website') or college.get('website')
                program_url = best_url(links, r'academic|programme|programmes|course|department|school of') or institution_url
                admission_url = best_url(links, r'admission|admissions|prospectus|application|apply|counselling|counseling') or institution_url
                fee_url = best_url(links, r'fee|fees|financial|tuition|fee structure')
                nfr_candidates = [(u, label) for u, label in links if '.pdf' in u.lower() and re.search(r'nirf|2026', u + ' ' + label, re.I) and not re.search(r'fee|prospectus|admission|placement brochure', u + ' ' + label, re.I)]
                nirf_url = next((u for u, label in nfr_candidates if 'nirf' in (u + ' ' + label).lower()), None)
                if not nirf_url and len(nfr_candidates) == 1: nirf_url = nfr_candidates[0][0]
                if not nirf_url and len([u for u, _ in links if '.pdf' in u.lower() and not re.search(r'fee|prospectus|admission|placement brochure', u, re.I)]) == 1:
                    nirf_url = next(u for u, _ in links if '.pdf' in u.lower() and not re.search(r'fee|prospectus|admission|placement brochure', u, re.I))
                if pos == 48 and not fee_url: fee_url = 'https://www.nls.ac.in/programme/ba-llb-hons/'
                if pos == 49 and not fee_url: fee_url = 'https://www.symlaw.ac.in/academics-ba-llb.php'
                if pos == 122 and not fee_url: fee_url = 'https://www.cmi.ac.in/admissions/brochure/2026/cmi-brochure-2026.pdf'
                if pos == 135 and not fee_url: fee_url = 'https://nlujodhpur.ac.in/university/under-graduate'
                if pos == 199: fee_url = best_url(links, r'prospectus-2026-27') or fee_url
                entry = {
                    'position': pos, 'collegeId': CANONICAL[slug], 'slug': slug, 'catalogueName': college['name'],
                    'city': college.get('city'), 'state': college.get('state'), 'pdf': filename, 'pdfPage': page_no,
                    'campusScope': campus, 'programmeSummary': programme_section, 'admissionSummary': admission_section,
                    'feeSummary': fee_section, 'seatSummary': seat_section, 'outcomeSummary': outcome_section,
                    'otherResearchSummary': sections[6], 'institutionUrl': institution_url, 'programmeUrl': program_url,
                    'admissionUrl': admission_url, 'feeUrl': fee_url, 'nirfUrl': nirf_url,
                    'outcomes': extract_outcomes(outcome_section),
                    'approvedIntake': [],
                    'hasOfficialCutoffValues': False,
                    'pageLinkCount': len(links),
                }
                # Only explicit NIRF historical approved-intake values; no JoSAA cutoff inference.
                if re.search(r'NIRF 2026.*?(?:APPROVED|approved).*?intake', seat_section, re.I):
                    for im in re.finditer(r'\b(UG|PG)\s*(?:\[)?(\d)\s*-year(?:\s+program(?:me)?s?)?(?:\])?\s*(?:programs?)?\s*(\d[\d,]*)', seat_section, re.I):
                        entry['approvedIntake'].append({'programme': f'{im.group(1).upper()} {im.group(2)}-year programme(s)', 'seats': int(im.group(3).replace(',', ''))})
                # Exact cutoff rows are not transcribed in any dossier; textual mentions are links/process notes.
                profile_rows.append(entry)
    assert sum(p['pages'] for p in pdfs) == 229
    assert len(profile_rows) == 205 and len({r['position'] for r in profile_rows}) == 205
    assert {r['position'] for r in profile_rows} == set(range(1, 206))
    assert all(r['collegeId'] == CANONICAL[r['slug']] for r in profile_rows)
    assert all(r['catalogueName'] == SEED[r['position']-1]['name'] for r in profile_rows)
    candidates, dispositions, sources = [], [], {}
    existing = {}

    def add_existing(slug: str, field: str, value: object, year: object) -> None:
        existing.setdefault(slug, []).append({'field': field, 'value': value, 'year': year})

    slug_by_id = {v: k for k, v in CANONICAL.items()}
    for claim in ARCHIVE['claims']:
        slug = slug_by_id.get(claim['collegeId'])
        if slug: add_existing(slug, claim['field'], claim.get('value'), claim.get('academicYear'))
    for batch_path in sorted((ROOT / 'data/pilot').glob('substantive-research-batch-*.json')):
        try: batch = json.loads(batch_path.read_text())
        except (OSError, json.JSONDecodeError): continue
        for claim in batch.get('candidateClaims', []):
            if claim.get('field') == 'structured':
                add_existing(claim.get('institutionSlug', ''), f"structured.{claim.get('value', {}).get('kind')}", claim.get('value'), claim.get('academicYear'))
            else:
                add_existing(claim.get('institutionSlug', ''), claim.get('field', ''), claim.get('value'), claim.get('academicYear'))

    day = '2026-11-23T00:00:00.000Z'
    usage = ('This row is a factual candidate transcribed from a user-supplied CollegeFind research PDF whose stated review date is 23 Nov 2026. The underlying official URL was not individually fetched during normalization except for the separately cited sample documents. No explicit bulk republication licence was established. Source use, exact value, campus/programme scope and freshness require direct reviewer confirmation. No source text/table is stored, no human decision is implied, and this claim must remain UNREVIEWED until authorized review.')

    def add_candidate(profile: dict, source_url: str | None, title: str, publisher: str, access: str,
                      field: str, value: object, year: str | None, locator: str, *,
                      campus: str | None = None, period: str | None = None, publisher_period: str | None = None,
                      historical: bool = False) -> None:
        if not source_url or not source_url.startswith('https://'):
            dispositions.append({'slug': profile['slug'], 'field': field, 'status': 'HELD', 'reason': 'No exact HTTPS source URL in the supplied source register.'})
            return
        source_key = (profile['slug'], source_url, publisher, title)
        source_id = 'b060-' + hashlib.sha256('|'.join(source_key).encode()).hexdigest()[:18]
        source = {
            'id': source_id, 'institutionSlug': profile['slug'], 'publisher': publisher, 'title': title,
            'url': source_url, 'publicationDate': None, 'academicYear': year,
            'retrievedAt': day, 'access': access, 'reuseConditions': usage,
            'evidenceLocations': [locator],
        }
        sources[source_id] = source
        claim = {
            'institutionSlug': profile['slug'], 'sourceIds': [source_id], 'academicYear': year,
            'evidenceLocation': locator, 'status': 'RESEARCHED_READY_FOR_UNREVIEWED_STAGING',
            'reviewState': 'UNREVIEWED', 'stageable': True,
        }
        if field == 'structured':
            claim.update({'field': 'structured', 'value': value})
            if campus: claim['campusScope'] = campus
            if period: claim['applicablePeriod'] = period
            if publisher_period: claim['publisherPeriod'] = publisher_period
            if historical: claim['historical'] = True
        else:
            claim.update({'field': field, 'value': value})
        candidates.append({'collegeId': profile['collegeId'], 'candidate': claim})

    for profile in sorted(profile_rows, key=lambda r: r['position']):
        slug = profile['slug']
        source_prior = LEDGER[slug].get('sourceReportedCategoryCounts', {})
        other_existing = existing.get(slug, [])
        # Only fill a missing published programme domain. Archived exact names still suppress duplicates.
        if not source_prior.get('programmes', 0):
            program_claims, program_holds = extract_programme_candidates(profile['programmeSummary'])
            for reason in program_holds:
                dispositions.append({'slug': slug, 'field': 'structured.programme', 'status': 'HELD', 'reason': reason})
            for fact in program_claims:
                key = normalize(fact['programme'])
                duplicate = any(row['field'] == 'structured.programme' and row['value'].get('programme') and normalize(row['value']['programme']) == key for row in other_existing)
                if duplicate:
                    dispositions.append({'slug': slug, 'field': 'structured.programme', 'status': 'DUPLICATE_EXISTING', 'reason': f"Exact programme name already exists in archived research: {fact['programme']}"})
                    continue
                if re.search(r'affiliat|multiple campuses|across .*campus|parent and constituent', profile['campusScope'], re.I):
                    dispositions.append({'slug': slug, 'field': 'structured.programme', 'status': 'HELD', 'reason': 'Source profile describes multiple/affiliated teaching units without a single campus-level programme mapping.'})
                    continue
                locator = f"User-supplied {profile['pdf']} PDF p.{profile['pdfPage']}, catalogue entry #{profile['position']}, section 01 (programmes and duration); exact source-page locator must be confirmed before approval."
                add_candidate(profile, profile['programmeUrl'], 'Official programme page linked from the research report', source_publisher(profile, profile['programmeUrl']), 'PUBLIC_PDF_READ' if (profile['programmeUrl'] or '').lower().endswith('.pdf') else 'PUBLIC_HTML_READ', 'structured', fact, None, locator, campus=profile['campusScope'], publisher_period='Research report states source reviewed 23 Nov 2026; underlying programme effective year not established.')

        # Admissions are missing from 168 public profiles. Stage only a concise, explicit
        # first route sentence, with an institution-level scope warning rather than eligibility inference.
        if not source_prior.get('admissions', 0):
            text = re.split(r'\bYear / criteria control:', profile['admissionSummary'], flags=re.I)[0].strip()
            route = re.split(r'(?<=[.!?])\s+', text)[0].strip(' .')
            if len(route) > 180:
                route = next((part.strip(' .') for part in re.split(r';\s*', route) if len(part.strip(' .')) <= 180), '')
            exams = []
            for exam in ['JEE Advanced', 'JEE Main', 'NEET-UG', 'NEET UG', 'INI-CET', 'INI-SS', 'CAT', 'GATE', 'CLAT', 'AILET', 'NLSAT', 'CUET', 'KCET', 'COMEDK', 'JoSAA', 'CSAB', 'MCC', 'Consortium', 'XAT', 'NMAT', 'GMAT', 'CMAT', 'KMAT']:
                if re.search(rf'(?<![A-Za-z]){re.escape(exam)}(?![A-Za-z])', route, re.I): exams.append(exam)
            if route and len(route) <= 180 and (exams or re.search(r'application|admission|counselling|counseling|route|selection|exam', route, re.I)):
                program = 'Institution-level admissions route; programme applicability must be confirmed'
                named = re.search(r'\b(?:B\.?Tech|MBBS|MBA|PGP|BA LL\.?B\.?|LL\.?B\.?|M\.?Tech|MD\s*/\s*MS|UG|PG)\b', route, re.I)
                if named: program = named.group(0)
                value = {'kind': 'admission', 'programme': program, 'route': route, 'category': '2026-27 cycle; verify programme and category applicability'}
                if exams: value['exam'] = ', '.join(exams)
                counsel = next((x for x in ['JoSAA', 'CSAB', 'MCC', 'Consortium', 'State CET cell', 'CAP'] if re.search(re.escape(x), route, re.I)), None)
                if counsel: value['counselling'] = counsel
                locator = f"User-supplied {profile['pdf']} PDF p.{profile['pdfPage']}, catalogue entry #{profile['position']}, section 02 (admissions route); 2026-27 cycle, source locator and current/open status must be checked."
                add_candidate(profile, profile['admissionUrl'], 'Official admissions page linked from the research report', source_publisher(profile, profile['admissionUrl']), 'PUBLIC_PDF_READ' if (profile['admissionUrl'] or '').lower().endswith('.pdf') else 'PUBLIC_HTML_READ', 'structured', value, '2026-27', locator, campus=profile['campusScope'], period='2026-27 admission cycle; not an open-application notice', publisher_period='2026-27 intake only; do not reuse for later cycles', historical=True)
            else:
                dispositions.append({'slug': slug, 'field': 'structured.admission', 'status': 'HELD', 'reason': 'No concise route/exam statement could be scoped safely from the supplied profile section.'})

        # Official NIRF placement values: skip the known inaccessible IIT Bombay file,
        # AIIMS timeout, and VIT institution aggregate because the catalogue profile is Vellore-specific.
        for outcome in profile['outcomes']:
            source_url = profile['nirfUrl']
            block = None
            if slug == 'indian-institute-of-technology-bombay': block = 'Official NIRF PDF URL in the report returned 404 during source check; not imported.'
            elif slug == 'all-india-institute-of-medical-sciences': block = 'Official NIRF PDF fetch timed out; no retry/bypass; held until direct source is accessible.'
            elif slug == 'vellore-institute-of-technology' and re.search(r'not Vellore-only|aggregate', outcome['scope'], re.I): block = 'Outcome is explicitly an institution aggregate, not the Vellore catalogue campus; held for scope mismatch.'
            if not source_url or block:
                dispositions.append({'slug': slug, 'field': 'structured.placement', 'status': 'HELD', 'reason': block or 'No direct official institutional NIRF PDF URL supplied.'})
                continue
            year = outcome['year']
            scope = outcome['scope']
            cohort = f"{scope}; NIRF graduating cohort {year}"
            base = f"User-supplied {profile['pdf']} PDF p.{profile['pdfPage']}, catalogue entry #{profile['position']}, section 04/05 placement outcomes, {scope} row. Original NIRF locator: Placement & Higher Studies table, {year} row; reviewer must match institution, campus and row."
            placement_value = {'kind': 'placement', 'cohort': cohort, 'metric': 'PLACED_COUNT', 'denominator': outcome['graduates'], 'value': outcome['placed'], 'definition': f"NIRF submission reports {outcome['placed']} placed among {outcome['graduates']} who graduated in the stipulated time for this row. The denominator is not placement-eligible students; no placement percentage or guarantee is inferred."}
            add_candidate(profile, source_url, 'NIRF 2026 institutional submission — graduate outcomes', 'Ministry of Education, Government of India — NIRF (institution-submitted data)', 'PUBLIC_PDF_READ', 'structured', placement_value, year, base + ' Field: students reported placed.', campus=profile['campusScope'], period=year, publisher_period=f'NIRF 2026 filing; graduating cohort {year}', historical=True)
            if outcome.get('medianInr') is not None and outcome['placed'] > 0:
                median = {'kind': 'placement', 'cohort': cohort, 'metric': 'MEDIAN', 'denominator': outcome['placed'], 'value': outcome['medianInr'], 'definition': f"Annual median salary (INR) among {outcome['placed']} reported placed graduates in this NIRF row. This is a historical cohort median, not an individual salary promise."}
                add_candidate(profile, source_url, 'NIRF 2026 institutional submission — graduate outcomes', 'Ministry of Education, Government of India — NIRF (institution-submitted data)', 'PUBLIC_PDF_READ', 'structured', median, year, base + ' Field: median salary of placed graduates (INR/year).', campus=profile['campusScope'], period=year, publisher_period=f'NIRF 2026 filing; graduating cohort {year}', historical=True)
            if outcome.get('higherStudies') is not None:
                higher = {'kind': 'placement', 'cohort': cohort, 'metric': 'HIGHER_STUDIES_COUNT', 'denominator': outcome['graduates'], 'value': outcome['higherStudies'], 'definition': f"NIRF row explicitly reports {outcome['higherStudies']} graduates proceeding to higher studies out of {outcome['graduates']} who graduated in stipulated time; not an employment result."}
                add_candidate(profile, source_url, 'NIRF 2026 institutional submission — graduate outcomes', 'Ministry of Education, Government of India — NIRF (institution-submitted data)', 'PUBLIC_PDF_READ', 'structured', higher, year, base + ' Field: students proceeding to higher studies.', campus=profile['campusScope'], period=year, publisher_period=f'NIRF 2026 filing; graduating cohort {year}', historical=True)

        for intake in profile['approvedIntake']:
            if slug in {'all-india-institute-of-medical-sciences', 'indian-institute-of-technology-bombay'} or not profile['nirfUrl']:
                dispositions.append({'slug': slug, 'field': 'structured.seatIntake', 'status': 'HELD', 'reason': 'Primary NIRF source inaccessible or unresolved; do not stage historical intake.'})
                continue
            claim_value = {'kind': 'seatIntake', 'programme': intake['programme'], 'seats': intake['seats'], 'measure': 'NIRF_SANCTIONED_APPROVED_INTAKE'}
            locator = f"User-supplied {profile['pdf']} PDF p.{profile['pdfPage']}, catalogue entry #{profile['position']}, section 04/05: NIRF 2026 historical approved intake, AY 2024-25, {intake['programme']} row. Not a current counselling seat matrix."
            add_candidate(profile, profile['nirfUrl'], 'NIRF 2026 institutional submission — sanctioned approved intake', 'Ministry of Education, Government of India — NIRF (institution-submitted data)', 'PUBLIC_PDF_READ', 'structured', claim_value, '2024-25', locator, campus=profile['campusScope'], period='NIRF sanctioned approved intake, AY 2024-25', publisher_period='NIRF 2026 filing; historical institution-submitted approved intake', historical=True)

        # Stage only exact tuition amounts with an explicit payment period and programme.
        # Other totals, refundable deposits, application charges and unsupported periods stay held.
        for m in re.finditer(r'(?is)\btuition(?:\s+(?:component|line))?[^.;]{0,90}?(?:INR|Rs\.?|₹)\s*([\d,]+(?:\.\d+)?)\s*(lakh)?([^.;]{0,100})', profile['feeSummary']):
            amount, lakh, tail = m.groups()
            context = profile['feeSummary'][max(0, m.start()-90):m.end()+50]
            tail = tail + ' ' + context
            period = None
            if re.search(r'per\s+semester|semester\s+tuition|first-semester tuition', tail, re.I): period = 'SEMESTER'
            elif re.search(r'per\s+annum|per\s+year|each\s+year|annual tuition', tail, re.I): period = 'YEAR'
            if not period:
                dispositions.append({'slug': slug, 'field': 'structured.fee', 'status': 'HELD', 'reason': f"Tuition amount has no explicit payment period: {context[:180]}"})
                continue
            if not profile['feeUrl']:
                dispositions.append({'slug': slug, 'field': 'structured.fee', 'status': 'HELD', 'reason': 'No exact official fee/programme URL was supplied for the fee record.'})
                continue
            raw = float(amount.replace(',', ''))
            inr = round(raw * 100_000) if lakh else int(raw)
            prefix = profile['feeSummary'][:m.start()]
            programme = None
            for token in ['B.Tech', 'B.Tech CSE', 'BA LL.B. Hons', 'BA LL.B.', 'MBA', 'PGP', 'PGDM-C', 'BS-MS', 'M.A. Economics', 'Full-time MBA', 'First Degree']:
                if re.search(re.escape(token), profile['feeSummary'], re.I): programme = token; break
            if not programme:
                dispositions.append({'slug': slug, 'field': 'structured.fee', 'status': 'HELD', 'reason': 'Fee programme is not confidently identified in the supplied fee summary.'})
                continue
            component = 'Tuition'
            fee_type = 'TUITION'
            if re.search(r'tuition\s*\+\s*facilities|tuition\s+and\s+facilities', profile['feeSummary'], re.I):
                # Preserve a bundled published amount as a bundle; never call it tuition-only.
                component, fee_type = 'Tuition and facilities (combined)', 'OTHER'
            if programme == 'First Degree':
                programme = 'First Degree programmes (individual course not specified)'
            category = 'Category applicability must be confirmed from the original fee schedule'
            if re.search(r'SC\s*,\s*ST\s*,\s*PwD', tail, re.I): category = 'SC/ST/PwD (as stated; waiver scope requires source check)'
            elif re.search(r'OPEN/EWS/OBC-NCL', profile['feeSummary'], re.I): category = 'OPEN/EWS/OBC-NCL (as stated in the fee note)'
            elif re.search(r'domestic', profile['feeSummary'], re.I): category = 'Domestic students (as stated)'
            elif re.search(r'standard fee-paying category', profile['feeSummary'], re.I): category = 'Standard fee-paying category (exact eligibility grouping requires source confirmation)'
            elif re.search(r'full-fee tuition', profile['feeSummary'], re.I): category = 'Regular full-fee tuition (exact category grouping requires source confirmation)'
            value = {'kind': 'fee', 'programme': programme, 'category': category, 'component': component, 'feeType': fee_type, 'period': period, 'amountInr': inr}
            year_match = re.search(r'20\d{2}[-–](?:\d{2}|20\d{2})', profile['feeSummary'])
            fee_year = year_match.group(0).replace('–', '-') if year_match else None
            if not fee_year:
                dispositions.append({'slug': slug, 'field': 'structured.fee', 'status': 'HELD', 'reason': 'Fee amount has no explicit academic year; do not infer current applicability.'})
                continue
            locator = f"User-supplied {profile['pdf']} PDF p.{profile['pdfPage']}, catalogue entry #{profile['position']}, section 03 fee summary; exact tuition phrase around {amount} {('lakh INR' if lakh else 'INR')} {period.lower()}. Original fee table/page locator must be matched before approval."
            add_candidate(profile, profile['feeUrl'], 'Official fee or programme page linked from the research report', source_publisher(profile, profile['feeUrl']), 'PUBLIC_PDF_READ' if profile['feeUrl'].lower().endswith('.pdf') else 'PUBLIC_HTML_READ', 'structured', value, fee_year, locator, campus=profile['campusScope'], period=f'{fee_year or "period not established"}; {period.lower()} payment', publisher_period='Fee applicability and revision status must be checked against the original schedule.')

    # Exact duplicate elimination across the 377-row archive and research batches 029-059.
    # The importer's own stronger source/value identity checks still run on every chunk.
    filtered, duplicate_count = [], 0
    seen_batch = set()
    for record in candidates:
        claim = record['candidate']; slug = claim['institutionSlug']; field = claim['field']; value = claim['value']; year = claim.get('academicYear')
        norm_value = json.dumps(value, sort_keys=True, ensure_ascii=False)
        key = (slug, field, norm_value, year)
        if key in seen_batch:
            duplicate_count += 1
            dispositions.append({'slug': slug, 'field': field, 'status': 'DUPLICATE_WITHIN_PDF_BATCH', 'reason': 'Exact same normalized value and academic year appears more than once.'})
            continue
        seen_batch.add(key)
        is_duplicate = False
        for old in existing.get(slug, []):
            if old['field'] != field or old.get('year') != year: continue
            ov = old.get('value')
            if field == 'structured.programme' and ov.get('programme') == value.get('programme'): is_duplicate = True
            elif field == 'structured.admission' and all(ov.get(k) == value.get(k) for k in ['programme', 'route', 'category', 'exam']): is_duplicate = True
            elif field == 'structured.placement' and all(ov.get(k) == value.get(k) for k in ['cohort', 'metric', 'value', 'denominator']): is_duplicate = True
            elif field == 'structured.fee' and all(ov.get(k) == value.get(k) for k in ['programme', 'category', 'component', 'feeType', 'period', 'amountInr']): is_duplicate = True
            elif field == 'structured.seatIntake' and all(ov.get(k) == value.get(k) for k in ['programme', 'seats', 'measure']): is_duplicate = True
            elif field == 'courses' and isinstance(ov, list) and isinstance(value, list) and set(map(normalize, ov)) == set(map(normalize, value)): is_duplicate = True
            if is_duplicate: break
        if is_duplicate:
            duplicate_count += 1
            dispositions.append({'slug': slug, 'field': field, 'status': 'DUPLICATE_EXISTING', 'reason': 'Exact normalized value/year already exists in the archived 377 claims or prior batch artifacts.'})
        else: filtered.append(record)

    # Known conflicts are not revived from supplied research.
    held_ids = {x['evidenceId'] for x in json.loads((ROOT / 'docs/DATA_COVERAGE.json').read_text()).get('humanReviewManifest', {}).get('heldClaims', [])}
    held_archive = {c['id']: c for c in ARCHIVE['claims'] if c['id'] in held_ids}
    for c in held_archive.values():
        dispositions.append({'slug': slug_by_id.get(c['collegeId'], 'unknown'), 'field': c['field'], 'status': 'PRESERVED_ARCHIVE_HOLD', 'reason': 'Existing human hold retained; no supplied-PDF candidate overrides it.'})

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    artifact = {
        'schemaVersion': 1, 'batch': 60, 'generatedAt': day, 'readPageCount': 229,
        'inputPdfs': pdfs, 'profileIdentityCount': 205,
        'catalogueIdentityHash': hashlib.sha256('\n'.join(f"{r['id']}|{r['slug']}" for r in ARCHIVE['collegeIdentity']).encode()).hexdigest(),
        'catalogueIdentities': ARCHIVE['collegeIdentity'],
        'profileExtracts': [{
            key: profile[key] for key in (
                'position', 'collegeId', 'slug', 'catalogueName', 'city', 'state', 'pdf',
                'pdfPage', 'campusScope', 'programmeSummary', 'admissionSummary',
                'feeSummary', 'seatSummary', 'outcomeSummary', 'otherResearchSummary',
                'institutionUrl', 'programmeUrl', 'admissionUrl', 'feeUrl', 'nirfUrl',
                'outcomes', 'approvedIntake', 'hasOfficialCutoffValues',
            )
        } for profile in sorted(profile_rows, key=lambda row: row['position'])],
        # Keep source rows next to claims so import never has to infer a publisher,
        # URL, retrieval date or reuse warning from the evidence locator.
        'sources': list(sources.values()), 'candidates': filtered, 'dispositions': dispositions,
        'summary': {
            'pdfPagesRead': 229, 'uniqueCatalogueProfilesMatched': 205,
            'programmeAndAdmissionsSectionsExtracted': 410,
            'profilesWithFeeAmounts': sum(bool(re.search(r'(?:INR|Rs\.?|₹)\s*[\d,]+', p['feeSummary'], re.I)) for p in profile_rows),
            'placementCohortsExtractedBeforeScopeSourceFiltering': sum(len(p['outcomes']) for p in profile_rows),
            'historicalApprovedIntakeRowsExtracted': sum(len(p['approvedIntake']) for p in profile_rows),
            'exactCutoffRowsExtracted': 0, 'candidateClaimsAfterDeduplication': len(filtered),
            'exactDuplicatesExcluded': duplicate_count,
            'heldOrExcludedDispositions': sum(d['status'] == 'HELD' for d in dispositions),
        },
    }
    OUTPUT.write_text(json.dumps(artifact, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(artifact['summary'] | {'candidateKinds': __import__('collections').Counter(c['candidate']['value']['kind'] if c['candidate']['field'] == 'structured' else c['candidate']['field'] for c in filtered), 'output': str(OUTPUT.relative_to(ROOT))}, default=dict, indent=2))
    outcome_rows = sum(len(p['outcomes']) for p in profile_rows)
    fee_profiles = sum(bool(re.search(r'(?:INR|Rs\.?|₹)\s*[\d,]+', p['feeSummary'], re.I)) for p in profile_rows)
    intake_rows = sum(len(p['approvedIntake']) for p in profile_rows)
    print(json.dumps({'pagesRead': 229, 'profilesMapped': len(profile_rows), 'profileSections': {k: sum(bool(p[k]) for p in profile_rows) for k in ['programmeSummary', 'admissionSummary']}, 'feeProfilesWithMoney': fee_profiles, 'placementRows': outcome_rows, 'approvedIntakeRows': intake_rows, 'actualCutoffRows': 0, 'output': str(OUTPUT.relative_to(ROOT))}, indent=2))

if __name__ == '__main__': main()
