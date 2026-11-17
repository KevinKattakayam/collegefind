import { expect, test } from '@playwright/test';

test('demo college details and recommendations never promote demo peers', async ({ page, request }) => {
 const catalogue = await (await request.get('/api/colleges?limit=1')).json();
 const college = catalogue.colleges[0];
 expect(college.annualFees).toBeNull();
 const response = await request.get(`/api/colleges/similar/${college.slug}`);
 expect(response.status()).toBe(200);
 expect((await response.json()).colleges).toEqual([]);
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
 await expect(page.getByRole('heading',{name:'Current alpha',exact:true})).toBeVisible();
 await page.reload();
 await expect(page.getByRole('heading',{name:'Current beta',exact:true})).toBeVisible();
 await expect(page.getByText('Lowest listed annual fees:')).toHaveCount(0);
});
test('invalid duplicate and missing identifiers do not retain stale comparisons', async ({page}) => {
 await page.goto('/compare?colleges=alpha,alpha');
 await expect(page.getByText('This comparison link is invalid.')).toBeVisible();
 await page.route('**/api/colleges/missing', route => route.fulfill({status:404,json:{error:'Not found'}}));
 await page.route('**/api/colleges/alpha', route => route.fulfill({json:{college:fixture('alpha')}}));
 await page.goto('/compare?colleges=alpha,missing');
 await expect(page.getByText('One or more colleges in this comparison are no longer available.')).toBeVisible();
});
test('old persisted snapshots are replaced by current server records', async ({page}) => {
 await page.addInitScript(() => localStorage.setItem('compareList:v2',JSON.stringify([{id:'alpha',slug:'alpha',name:'Stale snapshot',annualFees:1},{id:'beta',slug:'beta'}])));
 await page.route('**/api/colleges/*', route => route.fulfill({json:{college:fixture(route.request().url().split('/').pop()!)}}));
 await page.goto('/compare');
 await expect(page.getByRole('heading',{name:'Current alpha',exact:true})).toBeVisible();
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
 await first.getByRole('button',{name:/^Save /}).click();
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
 await expect(page.getByRole('heading',{name:pair[0].name,exact:true})).toBeVisible();
 await page.reload();
 await expect(page.getByRole('heading',{name:pair[1].name,exact:true})).toBeVisible();
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
