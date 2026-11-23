import { expect, test } from '@playwright/test';
import { hash } from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { assertDisposableTestTarget } from '../integration/target';

let fixtureDb: PrismaClient;
test.beforeAll(async () => {
 fixtureDb = new PrismaClient({ adapter: new PrismaPg(new pg.Pool({ connectionString: assertDisposableTestTarget() })) });
 // The browser suite must not depend on a pre-seeded runtime database. These
 // explicitly synthetic DEMO rows exercise trusted filters against tempting
 // non-null sample metrics without making them public facts.
 await fixtureDb.college.createMany({
  data: Array.from({ length: 20 }, (_, i) => ({
   slug: `e2e-demo-filter-fixture-${i + 1}`,
   name: `E2E Demo Filter Fixture ${i + 1}`,
   shortName: `E2E Demo ${i + 1}`,
   city: 'Synthetic', state: 'Synthetic', type: 'GOVERNMENT' as const,
   dataStatus: 'DEMO' as const, courses: ['Synthetic B.Tech'],
   annualFees: 125000 + i, placementPct: 90 + (i % 10), avgPackage: 18 + i,
   highestPackage: 40 + i, naacGrade: 'A++', metricsYear: 2026,
  })),
  skipDuplicates: true,
 });
});
test.afterAll(async () => { await fixtureDb?.$disconnect(); });
async function createBrowserUser(label: string) {
 const email = `${label}-${Date.now()}-${Math.random().toString(16).slice(2)}@example.test`;
 const password = `Synthetic ${label} account 3841!`;
 await fixtureDb.user.create({ data: { name: `Synthetic ${label} account`, email, password: await hash(password, 4), role: 'USER' } });
 return { email, password };
}
async function signInBrowserUser(page: import('@playwright/test').Page, email: string, password: string) {
 await page.goto('/login?callbackUrl=/saved');
 await page.getByPlaceholder('Email address', { exact: true }).fill(email);
 await page.getByPlaceholder('Password', { exact: true }).fill(password);
 await page.getByRole('button', { name: 'Login', exact: true }).click();
 await expect.poll(() => new URL(page.url()).pathname).toBe('/saved');
}

test('demo college details and recommendations never promote demo peers', async ({ page, request }) => {
 const catalogue = await (await request.get('/api/colleges?limit=1')).json();
 const college = catalogue.colleges[0];
 expect(college.annualFees).toBeNull();
 const response = await request.get(`/api/colleges/similar/${college.slug}`);
 expect(response.status()).toBe(200);
 const recommendations = (await response.json()).colleges as { dataStatus: string; annualFees: number | null }[];
 expect(recommendations.every((recommended) => recommended.dataStatus !== 'DEMO' && recommended.annualFees === null)).toBe(true);
 await page.goto(`/colleges/${college.slug}`);
 await expect(page.getByRole('heading', { level: 1 })).toHaveText(college.name);
 await expect(page.getByText('Demo data').first()).toBeVisible();
});

test('catalogue navigation is usable from the mobile menu', async ({ page, isMobile }) => {
 test.skip(!isMobile, 'Mobile drawer only');
 await page.goto('/');
 await page.getByRole('button', { name: 'Open menu' }).click();
 await page.locator('div.fixed.right-0').getByRole('link', { name: 'Colleges', exact: true }).click();
 await expect(page).toHaveURL(/\/colleges$/);
 await expect(page.getByLabel('Search colleges, cities, or states')).toBeVisible();
});
const fixture = (slug:string) => ({id:slug,slug,name:`Current ${slug}`,shortName:slug,city:'Fixture',state:'Kerala',type:'GOVERNMENT',dataStatus:'UNVERIFIED',annualFees:null,placementPct:null,avgPackage:null,highestPackage:null,naacGrade:null,establishedYear:null,totalStudents:null,metricsYear:null,rating:null,reviewCount:0,courses:[],topRecruiters:[],fieldEvidence:{}});
test('a clean browser and refresh load current records from a shared URL', async ({page}) => {
 await page.route('**/api/colleges/*', route => route.fulfill({json:{college:fixture(route.request().url().split('/').pop()!)}}));
 await page.goto('/compare?colleges=alpha,beta');
 await expect(page.getByRole('region', { name: 'Comparison slot for Current alpha' }).getByRole('heading',{name:'Current alpha',exact:true})).toBeVisible();
 await page.reload();
 await expect(page.getByRole('region', { name: 'Comparison slot for Current beta' }).getByRole('heading',{name:'Current beta',exact:true})).toBeVisible();
 await expect(page.getByText('Lowest listed annual fees:')).toHaveCount(0);
});
test('comparison keeps source-reported admissions facts separate from reviewed facts', async ({page}) => {
 const sourceReported = {
  ref: 'comparison-source-fixture',
  value: { kind: 'admission', programme: 'B.Tech', route: 'JoSAA counselling', category: 'UG', exam: 'JEE Advanced' },
  campus: 'Main campus', publisher: 'Official fixture source', url: 'https://example.edu/admissions',
  evidenceLocation: 'Admissions page, undergraduate section', sourceTitle: 'Fixture admissions route',
  collectedAt: '2026-01-02T00:00:00.000Z', publicationDate: null, academicYear: '2026-27',
  publisherPeriod: '2026-27 intake', historical: true, checkedAt: '2026-01-03T00:00:00.000Z',
  status: 'OFFICIAL_SOURCE_REPORTED',
 };
 await page.route('**/api/colleges/alpha', route => route.fulfill({json:{college:{...fixture('alpha'),sourceReportedFacts:[sourceReported]}}}));
 await page.route('**/api/colleges/beta', route => route.fulfill({json:{college:fixture('beta')}}));
 await page.goto('/compare?colleges=alpha,beta');
 const table = page.getByRole('table', {name:/Source-reported programmes/});
 await expect(table).toBeVisible();
 await expect(table.getByText('B.Tech · JoSAA counselling · UG · JEE Advanced')).toBeVisible();
 await expect(table.getByText(/Source-reported; not independently verified · Main campus · Academic year 2026-27 · Historical/)).toBeVisible();
 await expect(table.getByRole('link', {name:'Open cited official source'})).toHaveAttribute('href','https://example.edu/admissions');
 await expect(page.getByRole('region', {name:'Reviewed information for Current alpha'}).getByText('No current reviewed structured facts available.')).toBeVisible();
 await expect(table.getByText('Not available').first()).toBeVisible();
});
test('invalid duplicate and missing identifiers do not retain stale comparisons', async ({page}) => {
 await page.goto('/compare?colleges=alpha,alpha');
 await expect(page.getByText('This comparison link is invalid.')).toBeVisible();
 await page.route('**/api/colleges/missing', route => route.fulfill({status:404,json:{error:'Not found'}}));
 await page.route('**/api/colleges/alpha', route => route.fulfill({json:{college:fixture('alpha')}}));
 await page.goto('/compare?colleges=alpha,missing');
 await expect(page.getByText('One or more colleges in this comparison are no longer available.')).toBeVisible();
});

test('signed-in student manages personal deadlines and checklist tasks across refresh', async ({page}) => {
 const user=await createBrowserUser('planner-tasks');
 await page.goto('/login?callbackUrl=/planner');
 await page.getByPlaceholder('Email address',{exact:true}).fill(user.email);
 await page.getByPlaceholder('Password',{exact:true}).fill(user.password);
 await page.getByRole('button',{name:'Login',exact:true}).click();
 await expect(page).toHaveURL(/\/planner$/);
 await page.getByRole('textbox',{name:'Plan name'}).fill('Personal admission plan');
 await page.getByRole('textbox',{name:'Application cycle'}).fill('2027');
 await page.getByRole('button',{name:'Create plan'}).click();
 await expect(page.getByRole('heading',{name:'Personal admission plan'})).toBeVisible();
 await page.getByRole('textbox',{name:'Title'}).fill('Missed personal reminder');
 await page.getByLabel('Task type').selectOption('DEADLINE');
 await page.getByLabel('Due date').fill('2020-01-15');
 await page.getByRole('button',{name:'Add personal task'}).click();
 await expect(page.getByText('Missed personal reminder')).toBeVisible();
 await expect(page.getByText('Overdue personal reminders (1)',{exact:true})).toBeVisible();
 await page.getByRole('textbox',{name:'Title'}).first().fill('Upcoming personal deadline');
 await page.getByLabel('Task type').first().selectOption('DEADLINE');
 await page.getByLabel('Due date').first().fill('2027-01-15');
 await page.getByRole('button',{name:'Add personal task'}).click();
 await expect(page.getByRole('heading',{name:'Upcoming personal reminders (1)',exact:true})).toBeVisible();
 await page.getByRole('textbox',{name:'Title'}).first().fill('Prepare transcripts');
 await page.getByLabel('Task type').first().selectOption('CHECKLIST');
 await expect(page.getByLabel('Task type').first()).toHaveValue('CHECKLIST');
 const checklistResponse=page.waitForResponse(response=>response.url().includes('/tasks')&&response.request().method()==='POST');
 await page.getByRole('button',{name:'Add personal task'}).click();
 const createdChecklist=await (await checklistResponse).json();
 expect(createdChecklist.task.kind).toBe('CHECKLIST');
 await expect(page.getByText('Prepare transcripts')).toBeVisible();
 await page.getByRole('button',{name:'Mark complete'}).last().press('Enter');
 await expect(page.getByRole('status')).toContainText('Task marked complete');
 await expect(page.getByRole('button',{name:'Reopen'})).toBeVisible();
 await page.reload();
 await expect(page.getByRole('heading',{name:'Personal admission plan'})).toBeVisible();
 await expect(page.getByRole('button',{name:'Reopen'})).toBeVisible();
 await page.getByText('Edit personal task').last().click();
 await page.getByRole('textbox',{name:'Title'}).last().fill('Prepare updated transcripts');
 await page.getByRole('textbox',{name:'Private note'}).last().fill('Check the personal checklist');
 await page.getByRole('button',{name:'Save task changes'}).click();
 await expect(page.getByText('Prepare updated transcripts')).toBeVisible();
 await page.getByRole('button',{name:'Reopen'}).click();
 page.once('dialog',dialog=>dialog.accept());
 await page.getByRole('button',{name:'Delete'}).last().click();
 await expect(page.getByText('Prepare updated transcripts')).toHaveCount(0);
 const layout=await page.evaluate(()=>({width:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth}));
 expect(layout.scrollWidth).toBeLessThanOrEqual(layout.width);
});

test('a comparison slot can be replaced and the shared URL follows the updated selection', async ({ page }) => {
 await page.route('**/api/colleges/*', (route) => route.fulfill({ json: { college: fixture(route.request().url().split('/').pop()!) } }));
 await page.route('**/api/colleges?**', (route) => route.fulfill({ json: { colleges: [fixture('gamma')], total: 1, page: 1, limit: 10, totalPages: 1 } }));
 await page.goto('/compare?colleges=alpha,beta');
 await expect(page.getByRole('region', { name: 'Comparison slot for Current alpha' }).getByRole('heading', { name: 'Current alpha', exact: true })).toBeVisible();
 await page.getByRole('button', { name: 'Replace college' }).first().click();
 const dialog = page.getByRole('dialog', { name: 'Choose a college' });
 const search = page.getByRole('searchbox', { name: 'Search colleges to compare' });
 await expect(search).toBeFocused();
 await search.press('Shift+Tab');
 await expect(dialog.getByRole('button', { name: 'Close' })).toBeFocused();
 await dialog.getByRole('button', { name: 'Close' }).press('Shift+Tab');
 await expect(search).toBeFocused();
 await search.press('Tab');
 await expect(dialog.getByRole('button', { name: 'Close' })).toBeFocused();
 await search.focus();
 await search.fill('gamma');
 await page.getByRole('button', { name: /Current gamma/ }).click();
 await expect(page.locator('[data-compare-heading]')).toBeFocused();
 await expect(page).toHaveURL(/colleges=gamma,beta/);
 await expect(page.getByRole('region', { name: 'Comparison slot for Current gamma' }).getByRole('heading', { name: 'Current gamma', exact: true })).toBeVisible();
 await page.reload();
 await expect(page.getByRole('region', { name: 'Comparison slot for Current gamma' }).getByRole('heading', { name: 'Current gamma', exact: true })).toBeVisible();
});

test('structured reviewed facts keep their own scope, year and official source attribution', async ({ page }) => {
 const sourced = {
  ...fixture('alpha'),
  structuredFacts: [{
   key: 'structured.fee:programme-scope:2025',
   value: { kind: 'fee', programme: 'B.Tech Computer Science', category: 'OBC_NCL', component: 'Tuition', feeType: 'TUITION', period: 'SEMESTER', amountInr: 95000 },
   academicYear: 2025, validUntil: null,
   source: { url: 'https://example.edu/fees', publisher: 'Example Institute', publishedAt: '2025-03-01T00:00:00.000Z', retrievedAt: '2025-04-01T00:00:00.000Z', reviewedAt: '2025-04-02T00:00:00.000Z' },
  }],
 };
 await page.route('**/api/colleges/alpha', (route) => route.fulfill({ json: { college: sourced } }));
 await page.route('**/api/colleges/beta', (route) => route.fulfill({ json: { college: fixture('beta') } }));
 await page.goto('/compare?colleges=alpha,beta');
 const reviewed = page.getByRole('region', { name: 'Reviewed information for Current alpha' });
 await expect(reviewed.getByText(/B\.Tech Computer Science · OBC_NCL · Tuition: ₹95,000 per semester/)).toBeVisible();
 await expect(reviewed.getByText('Academic year 2025 · Example Institute')).toBeVisible();
 await expect(reviewed.getByRole('link', { name: 'Open official source' })).toHaveAttribute('href', 'https://example.edu/fees');
 const dimensions = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
 expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.width);
});
test('old persisted snapshots are replaced by current server records', async ({page}) => {
 await page.addInitScript(() => localStorage.setItem('compareList:v2',JSON.stringify([{id:'alpha',slug:'alpha',name:'Stale snapshot',annualFees:1},{id:'beta',slug:'beta'}])));
 await page.route('**/api/colleges/*', route => route.fulfill({json:{college:fixture(route.request().url().split('/').pop()!)}}));
 await page.goto('/compare');
 await expect(page.getByRole('region', { name: 'Comparison slot for Current alpha' }).getByRole('heading',{name:'Current alpha',exact:true})).toBeVisible();
 await expect(page.getByText('Stale snapshot')).toHaveCount(0);
});

test('public reviewer mutation is denied and catalogue errors remain errors', async ({page,request}) => {
 const denied = await request.post('/api/admin/evidence',{data:{kind:'field',id:'fixture',status:'APPROVED',reason:'Unauthorized fixture'}});
 expect(denied.status()).toBe(401);
 await page.route('**/api/colleges?**',route=>route.fulfill({status:503,json:{error:'Fixture outage'}}));
 await page.goto('/colleges');
 await expect(page.getByText('We could not load colleges. Check your connection and try again.')).toBeVisible();
 await expect(page.getByText('No colleges found',{exact:true})).toHaveCount(0);
});

test('a real local session can save and retrieve a college without leaking demo metrics',async({page,request})=>{
 const email=`browser-${Date.now()}-${Math.random().toString(16).slice(2)}@example.test`;
 const created=await request.post('/api/auth/register',{data:{name:'Browser fixture',email,password:'Unique fixture phrase 6729!'}});
 expect(created.status()).toBe(201);
 await page.goto('/login?callbackUrl=/colleges');
 await page.getByPlaceholder('Email address',{exact:true}).fill(email);
 await page.getByPlaceholder('Password',{exact:true}).fill('Unique fixture phrase 6729!');
 await page.getByRole('button',{name:'Login',exact:true}).click();
 await expect.poll(() => new URL(page.url()).pathname).toBe('/colleges');
 const forbidden=await page.request.post('/api/admin/evidence',{data:{kind:'field',id:'fixture',status:'APPROVED',reason:'Unauthorized user fixture'}});
 expect(forbidden.status()).toBe(403);
 const first=page.getByRole('article').first();
 await expect(first).toBeVisible();
 const saveResponse=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/saved'&&response.request().method()==='POST');
 await first.getByRole('button',{name:/^Save /}).click();
 expect((await saveResponse).status()).toBe(201);
 await page.goto('/saved');
 await expect(page.getByRole('article').first()).toBeVisible();
 const saved=await page.request.get('/api/saved');
 expect(saved.status()).toBe(200);
 const data=await saved.json();
 expect(data.saved.length).toBeGreaterThan(0);
 expect(data.saved[0].annualFees).toBeNull();
 expect(data.saved[0].naacGrade).toBeNull();
 const catalogue=await (await page.request.get('/api/colleges?limit=2')).json();
 const pair=catalogue.colleges;
 const comparison=await page.request.post('/api/comparisons',{data:{collegeIds:pair.map((college:{id:string})=>college.id)}});
 expect(comparison.status()).toBe(201);
 await page.reload();
 await page.getByRole('link',{name:'Open compare page'}).click();
 await expect(page).toHaveURL(/colleges=/);
 await expect(page.getByRole('region', { name: `Comparison slot for ${pair[0].name}` }).getByRole('heading',{name:pair[0].name,exact:true})).toBeVisible();
 await page.reload();
 await expect(page.getByRole('region', { name: `Comparison slot for ${pair[1].name}` }).getByRole('heading',{name:pair[1].name,exact:true})).toBeVisible();
});

test('signing in merges the device shortlist once into the authenticated account', async ({ page, request }) => {
 const catalogue = await (await request.get('/api/colleges?limit=1')).json();
 const college = catalogue.colleges[0];
 const email = `shortlist-merge-${Date.now()}-${Math.random().toString(16).slice(2)}@example.test`;
 const password = 'Unique shortlist fixture 7864!';
 expect((await request.post('/api/auth/register', { data: { name: 'Shortlist fixture', email, password } })).status()).toBe(201);
 await page.addInitScript((slug: string) => localStorage.setItem('collegefind:shortlist:v1', JSON.stringify([slug])), college.slug);
 await page.goto('/login?callbackUrl=/saved');
 await page.getByPlaceholder('Email address', { exact: true }).fill(email);
 await page.getByPlaceholder('Password', { exact: true }).fill(password);
 const merge = page.waitForResponse((response) => new URL(response.url()).pathname === '/api/saved' && response.request().method() === 'POST');
 await page.getByRole('button', { name: 'Login', exact: true }).click();
 expect((await merge).status()).toBe(200);
 await expect(page).toHaveURL(/\/saved$/);
 await expect(page.getByRole('article').filter({ hasText: college.name })).toBeVisible();
 const stored = await (await page.request.get('/api/saved')).json();
 expect(stored.saved.map((savedCollege: { id: string }) => savedCollege.id)).toContain(college.id);
 expect(await page.evaluate(() => localStorage.getItem('collegefind:shortlist:v1'))).toBe('[]');
});

test('an authenticated shortlist restores in a fresh browser context with the same stable order', async ({ browser, page, request }) => {
 const catalogue = await (await request.get('/api/colleges?limit=3&sort=name')).json();
 const colleges = catalogue.colleges as { id: string; slug: string; name: string }[];
 expect(colleges).toHaveLength(3);
 const { email, password } = await createBrowserUser('cross-device');
 const baseURL = process.env.NEXTAUTH_URL ?? `http://127.0.0.1:${process.env.E2E_PORT ?? 3100}`;
 const secondContext = await browser.newContext({ baseURL });
 try {
  const firstPage = page;
  await signInBrowserUser(firstPage, email, password);

  const secondPage = await secondContext.newPage();
  await signInBrowserUser(secondPage, email, password);
  const secondSession = await (await secondPage.request.get('/api/auth/session')).json();
  expect(secondSession.user?.email).toBe(email);
  const [firstResult, secondResult] = await Promise.all([
   firstPage.request.post('/api/saved', { data: { collegeKeys: [colleges[0].slug, colleges[1].slug] } }),
   secondPage.request.post('/api/saved', { data: { collegeKeys: [colleges[1].slug, colleges[2].slug] } }),
  ]);
  expect(firstResult.status()).toBe(200);
  expect(secondResult.status()).toBe(200);
  const firstRead = await (await firstPage.request.get('/api/saved')).json();
  await secondPage.reload();
  await expect(secondPage.getByRole('heading', { name: 'Saved Colleges', exact: true })).toBeVisible();
  const secondRead = await (await secondPage.request.get('/api/saved')).json();
  expect(secondRead.saved.map((college: { id: string }) => college.id)).toEqual(firstRead.saved.map((college: { id: string }) => college.id));
  expect(firstRead.saved).toHaveLength(3);
  const visible = await secondPage.locator('article h3').allTextContents();
  expect(visible).toEqual(firstRead.saved.map((college: { name: string }) => college.name));
 } finally {
  await secondContext.close();
 }
});

test('a failed device-shortlist merge keeps local selections for a successful retry', async ({ page, request }) => {
 const catalogue = await (await request.get('/api/colleges?limit=1')).json();
 const college = catalogue.colleges[0] as { slug: string; name: string };
 const { email, password } = await createBrowserUser('merge-retry');
 await page.addInitScript((slug: string) => localStorage.setItem('collegefind:shortlist:v1', JSON.stringify([slug])), college.slug);
 await page.route('**/api/saved', (route) => route.request().method() === 'POST'
  ? route.fulfill({ status: 503, json: { error: 'Service unavailable' } })
  : route.continue());
 await signInBrowserUser(page, email, password);
 await expect(page.getByText('Your device shortlist is safe. We could not sync it yet; retry after reconnecting.')).toBeVisible();
 expect(await page.evaluate(() => localStorage.getItem('collegefind:shortlist:v1'))).toBe(JSON.stringify([college.slug]));
 await page.unroute('**/api/saved');
 await page.reload();
 await expect.poll(() => page.evaluate(() => localStorage.getItem('collegefind:shortlist:v1'))).toBe('[]');
 await expect(page.getByRole('article').filter({ hasText: college.name })).toBeVisible();
 const saved = await page.request.get('/api/saved');
 expect(saved.status()).toBe(200);
 expect((await saved.json()).saved.map((item: { slug: string }) => item.slug)).toContain(college.slug);
});

test('authenticated optimistic save rolls back after a server error', async ({ page }) => {
 const { email, password } = await createBrowserUser('save-rollback');
 await signInBrowserUser(page, email, password);
 await page.goto('/colleges');
 const firstCard = page.getByRole('article').first();
 const saveButton = firstCard.getByRole('button', { name: /^Save / });
 await expect(saveButton).toHaveAttribute('aria-pressed', 'false');
 await page.route('**/api/saved', (route) => route.request().method() === 'POST'
  ? route.fulfill({ status: 503, json: { error: 'Service unavailable' } })
  : route.continue());
 const response = page.waitForResponse((item) => new URL(item.url()).pathname === '/api/saved' && item.request().method() === 'POST');
 await saveButton.click();
 expect((await response).status()).toBe(503);
 await expect(saveButton).toHaveAttribute('aria-pressed', 'false');
 await expect(page.getByText('Service unavailable')).toBeVisible();
});

test('public filters exclude demo measurements and record local API timings',async({request})=>{
 const durations:number[]=[];
 for(let i=0;i<5;i++){
  const started=performance.now();
  const response=await request.get('/api/colleges?limit=12');
  expect(response.status()).toBe(200);
  const body=await response.json();
  expect(body.colleges).toHaveLength(12);
  expect(body.colleges.every((college:{annualFees:unknown;naacGrade:unknown})=>college.annualFees===null&&college.naacGrade===null)).toBe(true);
  durations.push(performance.now()-started);
 }
 const filtered=await request.get('/api/colleges?minFees=1');
 expect((await filtered.json()).total).toBe(0);
 durations.sort((a,b)=>a-b);
 console.log(`Local catalogue API five-request sample: median=${durations[2].toFixed(1)}ms max=${durations[4].toFixed(1)}ms`);
});

test('a signed-in student creates, restores, edits and deletes a private admissions plan', async ({ page, browser }) => {
 const account=await createBrowserUser('planner');
 await signInBrowserUser(page,account.email,account.password);
 await page.goto('/planner');
 await expect(page.getByRole('heading',{name:'Admissions planner'})).toBeVisible();
 await expect(page.getByText('No plans saved')).toBeVisible();
 await page.getByLabel('Plan name').fill('My 2026 plan');
 await page.getByLabel('Application cycle').fill('2026');
 await page.getByRole('button',{name:'Create plan'}).click();
 await expect(page.getByRole('heading',{name:'My 2026 plan'})).toBeVisible();
 await page.getByLabel('Programme or personal label').fill('Personal choice one');
 await page.getByRole('button',{name:'Add choice'}).click();
 await expect(page.getByText('Personal choice one')).toBeVisible();
 await page.getByLabel('Programme or personal label').fill('Personal choice two');
 await page.getByRole('button',{name:'Add choice'}).click();
 const choices=page.locator('ol');
 const secondChoice=choices.getByRole('listitem').nth(1);
 const editAnswers=['Personal choice two edited','My private note'];
 const answerEditDialog=(dialog:import('@playwright/test').Dialog)=>dialog.accept(editAnswers.shift()??'');
 page.on('dialog',answerEditDialog);
 await secondChoice.getByRole('button',{name:'Edit choice'}).first().click();
 page.off('dialog',answerEditDialog);
 await expect(page.getByText('Personal choice two edited')).toBeVisible();
 await expect(page.getByText('Personal entry · no official programme is confirmed')).toHaveCount(2);
 await expect(page.getByText('My private note')).toBeVisible();
 await expect(page.getByRole('button',{name:'Print this personal choice list'})).toBeVisible();
 await page.getByRole('button',{name:'Print this personal choice list'}).click();
 await expect(page.locator('[data-print-choice-list="true"]')).toBeAttached();
 await page.emulateMedia({media:'print'});
 await expect(page.locator('[data-print-choice-list="true"]')).toBeVisible();
 await expect(page.locator('nav').first()).toBeHidden();
 await page.emulateMedia({media:'screen'});
 await choices.getByRole('button',{name:'Move Personal choice one down'}).click();
 await expect(choices.getByRole('listitem').first()).toContainText('Personal choice two edited');
 await page.reload();
 const orderedChoices=page.locator('ol').getByRole('listitem');
 await expect(orderedChoices.first()).toContainText('Personal choice two edited');
 const otherContext=await browser.newContext({baseURL:new URL(page.url()).origin});
 try {
  const otherPage=await otherContext.newPage();
  await signInBrowserUser(otherPage,account.email,account.password);
  await otherPage.goto('/planner');
  await expect(otherPage.locator('ol').getByRole('listitem').first()).toContainText('Personal choice two edited');
 } finally { await otherContext.close(); }
 await orderedChoices.filter({hasText:'Personal choice one'}).getByRole('button',{name:'Remove choice'}).click();
 await expect(page.getByText('Personal choice one')).toHaveCount(0);
 await page.reload();

 await expect(page.getByRole('heading',{name:'My 2026 plan'})).toBeVisible();
 page.once('dialog',dialog=>dialog.accept('Updated private plan'));
 await page.getByRole('button',{name:'Rename'}).click();
 await expect(page.getByRole('heading',{name:'Updated private plan'})).toBeVisible();
 page.once('dialog',dialog=>dialog.accept());
 await page.getByRole('button',{name:'Delete'}).click();
 await expect(page.getByText('No plans saved')).toBeVisible();
});

test('a student privately tracks an application through refresh and can edit or remove it',async({page,browser})=>{
 const account=await createBrowserUser('application-tracker');
 await signInBrowserUser(page,account.email,account.password);
 await page.goto('/planner');
 await page.getByLabel('Plan name').fill('Application cycle plan');
 await page.getByLabel('Application cycle').fill('2026');
 await page.getByRole('button',{name:'Create plan'}).click();
 const tracker=page.getByRole('region',{name:'Application tracker'});
 await expect(tracker.getByText('No applications tracked for this plan yet.')).toBeVisible();
 await tracker.getByLabel('Personal institution name').fill('My personal college entry');
 await tracker.getByLabel('Programme (personal entry)').fill('My preferred programme');
 await tracker.getByLabel('Admission cycle').fill('2026-27');
 await tracker.getByRole('combobox',{name:'Application status'}).selectOption('PREPARING');
 await tracker.getByLabel('Submission date').fill('2026-06-14');
 await tracker.getByLabel('Next action').fill('Submit remaining form');
 await tracker.getByLabel('Application reference (optional)').fill('MY-REF-91');
 await tracker.getByLabel('Private note').fill('Initial private note');
 await tracker.getByRole('button',{name:'Add application'}).click();
 const application=tracker.getByRole('listitem').filter({hasText:'My personal college entry'});
 await expect(application.locator('p').filter({hasText:/^Preparing$/})).toBeVisible();
 await expect(application.getByText('Next action: Submit remaining form')).toBeVisible();
 await page.reload();
 const restored=page.getByRole('region',{name:'Application tracker'}).getByRole('listitem').filter({hasText:'My personal college entry'});
 await expect(restored.locator('p').filter({hasText:/^Preparing$/})).toBeVisible();
 await restored.getByText('Edit application details').click();
 await restored.getByRole('combobox',{name:'Application status'}).selectOption('OFFERED');
 await restored.getByLabel('Next action').fill('Review the offer');
 await restored.getByLabel('Private note').fill('Updated private note');
 await restored.getByRole('button',{name:'Save application changes'}).click();
 await expect(restored.locator('p').filter({hasText:/^Offered$/})).toBeVisible();
 await page.reload();
 const afterEdit=page.getByRole('region',{name:'Application tracker'}).getByRole('listitem').filter({hasText:'My personal college entry'});
 await expect(afterEdit).toContainText('Offered');
 await afterEdit.getByText('Edit application details').click();
 await expect(afterEdit.getByLabel('Private note')).toHaveValue('Updated private note');
 const otherContext=await browser.newContext({baseURL:new URL(page.url()).origin});
 try {
  const otherPage=await otherContext.newPage();
  await signInBrowserUser(otherPage,account.email,account.password);
  await otherPage.goto('/planner');
  const restoredInSession=otherPage.getByRole('region',{name:'Application tracker'}).getByRole('listitem').filter({hasText:'My personal college entry'});
  await expect(restoredInSession.locator('p').filter({hasText:/^Offered$/})).toBeVisible();
 } finally { await otherContext.close(); }
 page.once('dialog',dialog=>dialog.accept());
 await afterEdit.getByRole('button',{name:'Delete application'}).click();
 await expect(page.getByText('No applications tracked for this plan yet.')).toBeVisible();
});
