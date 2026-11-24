import {test,expect} from '@playwright/test';
import {PrismaClient} from '@prisma/client';
import {PrismaPg} from '@prisma/adapter-pg';
import pg from 'pg';
import {hash} from 'bcryptjs';
import {assertDisposableTestTarget} from '../integration/target';
import {importOfficialFacts} from '../../src/server/ingest/official-facts';
import {join} from 'node:path';
let db:PrismaClient;let email:string;let memberEmail:string;let name:string;
test.beforeAll(async()=>{
 db=new PrismaClient({adapter:new PrismaPg(new pg.Pool({connectionString:assertDisposableTestTarget()}))});
 name='BrowserQueue'+Date.now()+Math.random().toString(16).slice(2);email=name+'@example.test';memberEmail=name+'-member@example.test';
 await db.user.create({data:{name,email,password:await hash('Browser fixture 6729!',12),role:'ADMIN'}});
 await db.user.create({data:{name:name+' member',email:memberEmail,password:await hash('Browser fixture 6729!',12),role:'USER'}});
 const c=await db.college.create({data:{slug:name.toLowerCase(),name,shortName:name,city:'Fixture',state:'Fixture',type:'PRIVATE',dataStatus:'DEMO'}});
 const source=await db.source.create({data:{name:'SYNTHETIC BROWSER TEST',publisher:'SYNTHETIC TEST',url:'https://example.test/browser-fixture',retrievedAt:new Date()}});
 for(let i=0;i<27;i++)await db.fieldEvidence.create({data:{collegeId:c.id,sourceId:source.id,field:'description',value:'Synthetic '+i,identityKey:name+i,isFixture:i>1,academicYear:2026}});
});
test.afterAll(async()=>{await db?.$disconnect();});
test('review queue search, conflicts, decisions, pagination and fixture protection',async({page,request,browser,isMobile})=>{
 expect((await request.get('/api/admin/evidence')).status()).toBe(401);
 await page.goto('/admin/enrichment');await expect(page).toHaveURL(/\/login/);
 await page.goto('/login');await page.getByPlaceholder('Email address',{exact:true}).fill(email);await page.getByPlaceholder('Password',{exact:true}).fill('Browser fixture 6729!');await page.getByRole('button',{name:'Login',exact:true}).click();await expect.poll(()=>new URL(page.url()).pathname).not.toBe('/login');
 if(process.env.COLLEGEFIND_REPORTED_BROWSER==='true'){
   await page.goto('/admin/enrichment');
   const priority=page.getByRole('navigation',{name:'Priority tuition review'});
   await expect(priority.getByRole('link')).toHaveCount(3);
   await priority.getByRole('link',{name:'IIT Roorkee first-year tuition',exact:true}).click();
   const tuition=page.locator('[data-claim-id="cmwm4060u0003lftv8hj4ur0o"]');
   await expect(tuition).toContainText('Tuition fee');
   await expect(tuition).toContainText('excludes other semester charges');
   await page.goto('/admin/enrichment?status=ALL&q=cmwm3rj78000dhxtvxa99f78a');
   const placement=page.locator('[data-claim-id="cmwm3rj78000dhxtvxa99f78a"]');
   await expect(placement).toContainText('Manual hold');
   await placement.getByLabel('Review reason').fill('Verify this disabled approval without recording a decision');
   await expect(placement.getByRole('button',{name:'Approve',exact:true})).toBeDisabled();
 }
 await page.goto('/admin/enrichment?status=ALL&q='+name);await expect(page.getByRole('heading',{name:'Enrichment review'})).toBeVisible();await expect(page.getByRole('article')).toHaveCount(25);
 const packet=page.getByText('First owner review batch · 25 claims · staged for inspection, not approval');await expect(packet).toBeVisible();
 const packetItem=page.locator('li').filter({hasText:'cmwlqtg56000ngvtvlul6b04j'});await expect(packetItem).toContainText('CMI Chennai');await expect(packetItem).toContainText('2027');await expect(packetItem).toContainText('College location: Chennai, Tamil Nadu');await expect(packetItem).toContainText('Source-use review:');await expect(packetItem).toContainText('publication date is not recorded');await expect(packetItem).toContainText('Reviewer question:');await expect(packetItem.getByRole('link',{name:'Open official source'})).toHaveAttribute('href','https://www.cmi.ac.in/admissions/');await expect(packetItem.getByRole('link',{name:'Open this claim in the queue'})).toHaveAttribute('href',/q=cmwlqtg56000ngvtvlul6b04j/);await packetItem.getByText('Source access, reuse and collection notes').click();await expect(packetItem).toContainText('explicit bulk reuse permission not established');
 const searchClaim=await db.fieldEvidence.findFirstOrThrow({where:{identityKey:name+'0'},select:{id:true}});const idSearch=await page.request.get('/api/admin/evidence?status=ALL&q='+encodeURIComponent(searchClaim.id));expect(idSearch.status()).toBe(200);expect((await idSearch.json()).items.map((item:{id:string})=>item.id)).toEqual([searchClaim.id]);
 await expect(page.getByText('No campus alias recorded',{exact:false}).first()).toBeVisible();await expect(page.getByText('https://example.test/browser-fixture',{exact:true}).first()).toBeVisible();
 await page.getByLabel('Field',{exact:true}).fill('description');await page.getByLabel('Academic year',{exact:true}).fill('2026');await page.locator('select[name="freshness"]').selectOption('SOURCE_UNDATED');await page.getByRole('button',{name:'Apply filters',exact:true}).click();await expect(page.getByRole('article')).toHaveCount(25);
 await page.getByRole('link',{name:'Next page'}).click();await expect(page.getByRole('article')).toHaveCount(2);
 await page.getByLabel('Review state').selectOption('CONFLICTED');await page.getByRole('button',{name:'Apply filters',exact:true}).click();await expect(page.getByRole('article')).toHaveCount(2);
 const claim=page.getByRole('article').first();const otherId=await page.getByRole('article').last().getAttribute('data-claim-id');await expect(claim.getByLabel('Conflicting evidence')).toBeVisible();await claim.getByLabel('Review reason').fill('Synthetic browser conflict review');const rejectResponse=page.waitForResponse(r=>r.url().endsWith('/api/admin/evidence')&&r.request().method()==='POST');await claim.getByRole('button',{name:'Reject',exact:true}).click();expect((await rejectResponse).status()).toBe(200);
 await page.goto('/admin/enrichment?status=STAGED&q='+name);const other=page.locator(`[data-claim-id="${otherId}"]`);await expect(other).toBeVisible();await other.getByLabel('Review reason').fill('Synthetic browser decision after resolving peer');const approveResponse=page.waitForResponse(r=>r.url().endsWith('/api/admin/evidence')&&r.request().method()==='POST');await other.getByRole('button',{name:'Approve',exact:true}).click();expect((await approveResponse).status()).toBe(200);
 await page.goto('/admin/enrichment?status=DEMO&q='+name);const fixture=page.getByRole('article').first();await fixture.getByLabel('Review reason').fill('Do not publish fixture');await expect(fixture.getByRole('button',{name:'Approve',exact:true})).toBeDisabled();
 const college=await db.college.findFirstOrThrow({where:{name}});const source=await db.source.findFirstOrThrow({where:{name:'SYNTHETIC BROWSER TEST'}});
 const website=await db.fieldEvidence.create({data:{collegeId:college.id,sourceId:source.id,field:'website',value:'https://example.test/verified-synthetic',validUntil:new Date('2027-01-01'),identityKey:name+'website'}});
 await page.goto('/colleges/'+college.slug);await expect(page.getByRole('link',{name:'https://example.test/verified-synthetic',exact:true})).toHaveCount(0);
 const decide=async(status:string,expectedDecisionId:string|null)=>page.request.post('/api/admin/evidence',{data:{kind:'field',id:website.id,status,reason:'SYNTHETIC publication test only',expectedDecisionId}});
 const published=await decide('APPROVED',null);
 expect(published.status()).toBe(200);
 const {decisionId}=await published.json();
 expect((await decide('REJECTED',null)).status()).toBe(409);
 await page.reload();await expect(page.getByRole('link',{name:'https://example.test/verified-synthetic',exact:true})).toBeVisible();await page.getByText('Sources and verification',{exact:true}).first().click();await expect(page.getByRole('link',{name:'SYNTHETIC TEST'}).first()).toBeVisible();await expect(page.getByText('Demo data:',{exact:true}).first()).toBeVisible();
 expect((await decide('REJECTED',decisionId)).status()).toBe(200);await page.reload();await expect(page.getByRole('link',{name:'https://example.test/verified-synthetic',exact:true})).toHaveCount(0);expect(await db.auditLog.count({where:{targetId:website.id,action:'evidence.review'}})).toBe(2);
 const programme=await db.fieldEvidence.create({data:{collegeId:college.id,sourceId:source.id,field:'structured.programme',programScope:'["synthetic engineering","ug"]',value:{kind:'programme',programme:'Synthetic Engineering',level:'UG',durationMonths:48},identityKey:name+'programme'}});
 await page.reload();
 await expect(page.getByRole('heading',{name:'Reviewed official facts'})).toHaveCount(0);
 expect((await page.request.post('/api/admin/evidence',{data:{kind:'field',id:programme.id,status:'APPROVED',reason:'Synthetic typed publication test',expectedDecisionId:null}})).status()).toBe(200);
 await page.reload();
 await expect(page.getByRole('heading',{name:'Programmes and admissions'})).toBeVisible();
 await expect(page.getByText('Synthetic Engineering',{exact:true}).first()).toBeVisible();
 const fee=await db.fieldEvidence.create({data:{collegeId:college.id,sourceId:source.id,field:'structured.fee',programScope:'["synthetic tuition programme","domestic applicants","tuition","tuition","semester"]',value:{kind:'fee',programme:'Synthetic tuition programme',category:'Domestic applicants',component:'Tuition',feeType:'TUITION',period:'SEMESTER',amountInr:123456},academicYear:2026,identityKey:name+'structured-fee'}});
 await page.reload();await expect(page.getByText('Synthetic tuition programme',{exact:true})).toHaveCount(0);
 expect((await page.request.post('/api/admin/evidence',{data:{kind:'field',id:fee.id,status:'APPROVED',reason:'Synthetic fee publication test only',expectedDecisionId:null}})).status()).toBe(200);
 await page.reload();
 await expect(page.getByRole('heading',{name:'Fees (INR) · 2026'})).toBeVisible();
 await expect(page.getByText('Synthetic tuition programme',{exact:true}).first()).toBeVisible();
 await expect(page.locator('#main').getByText('Domestic applicants',{exact:true}).first()).toBeVisible();
 await expect(page.getByText('₹1,23,456',{exact:true}).first()).toBeVisible();
 await expect(page.getByRole('link',{name:'SYNTHETIC TEST'}).last()).toBeVisible();
 expect(await db.auditLog.count({where:{targetId:fee.id,action:'evidence.review'}})).toBe(1);
 const feesCard = page.locator('#main #fees [data-evidence-status="VERIFIED"]').filter({hasText:'Synthetic tuition programme'});
 await expect(feesCard).toContainText('Per semester');
 const fixtures = [
   {kind:'admission',programme:'Synthetic BBA',route:'Synthetic test and interview',category:'Domestic applicants',eligibility:'Synthetic school requirement'},
   {kind:'scholarship',scheme:'Synthetic tuition waiver',eligibility:'Only tuition is waived. Other semester charges apply.',url:source.url},
   {kind:'placement',metric:'PLACED_COUNT',cohort:'Synthetic B.Tech eligible students',denominator:844,value:703,definition:'Synthetic count of placed students in the eligible reporting cohort.'},
 ] as const;
 for (const value of fixtures) {
   const academicYear = value.kind === 'placement' ? 2024 : 2026;
   const evidenceLocator = 'Synthetic report, page 11, '+value.kind;
   const sourceUrl = source.url+'/'+college.slug+'/'+value.kind;
   const staged = await importOfficialFacts(db,{
     scope:'RESEARCH_NOTES_WITH_IMPORTABLE_CANDIDATES',
     sources:[{id:'synthetic-source',institutionSlug:college.slug,publisher:source.publisher,url:sourceUrl,
       publicationDate:null,academicYear:String(academicYear),retrievedAt:source.retrievedAt.toISOString(),
       access:'PUBLIC_HTML_READ',reuseConditions:'Synthetic browser fixture',evidenceLocations:[evidenceLocator]}],
     candidateClaims:[{institutionSlug:college.slug,field:'structured',value,sourceIds:['synthetic-source'],
       academicYear:String(academicYear),evidenceLocation:evidenceLocator,status:'RESEARCHED_READY_FOR_UNREVIEWED_STAGING',
       reviewState:'UNREVIEWED',stageable:true}],
   },false);
   const [{evidenceId}] = staged.claimResults;
   const section = {admission:'programmes-and-admissions',scholarship:'fees',placement:'placements'}[value.kind];
   const card=page.locator(`#main #${section} [data-evidence-status="VERIFIED"]`).filter({hasText:evidenceLocator});
   await page.reload();
   await expect(card).toHaveCount(0);
   await page.goto('/admin/enrichment?status=ALL&q='+evidenceId);
   const queued=page.locator('[data-claim-id="'+evidenceId+'"]');
   await expect(queued.getByRole('link',{name:sourceUrl,exact:true})).toHaveAttribute('href',sourceUrl);
   await expect(queued).toContainText(evidenceLocator);
   await queued.getByLabel('Review reason').fill('Synthetic scoped evidence publication rehearsal');
   const response=page.waitForResponse(r=>r.url().endsWith('/api/admin/evidence')&&r.request().method()==='POST');
   await queued.getByRole('button',{name:'Approve',exact:true}).click();
   expect((await response).status()).toBe(200);
   await page.goto('/colleges/'+college.slug);
   await expect(card).toContainText(String(academicYear));
   await expect(card.getByRole('link',{name:'SYNTHETIC TEST'})).toHaveAttribute('href',sourceUrl);
   if(value.kind==='admission') {
     await expect(card).toContainText(value.programme);
     await expect(card).toContainText(value.category);
     await expect(card).toContainText(value.eligibility);
   }
   if(value.kind==='scholarship') await expect(card).toContainText(value.eligibility);
   if(value.kind==='placement') {
     await expect(card).toContainText('Students placed');
     await expect(card).toContainText('703');
     await expect(card).toContainText('Eligible cohort: 844');
   }
   if(process.env.CF_PROFILE_SCREENSHOTS) {
     await card.screenshot({path:join(process.env.CF_PROFILE_SCREENSHOTS,`synthetic-reviewed-${value.kind}-${isMobile?'mobile':'desktop'}.png`)});
   }
   await page.goto('/admin/enrichment?status=ALL&q='+evidenceId);
   await queued.getByLabel('Review reason').fill('Synthetic hold after publication');
   const held=page.waitForResponse(r=>r.url().endsWith('/api/admin/evidence')&&r.request().method()==='POST');
   await queued.getByRole('button',{name:'Hold',exact:true}).click();
   expect((await held).status()).toBe(200);
   await page.reload();
   await queued.getByText('Reviewer decision history').click();
   await expect(queued).toContainText('Synthetic hold after publication');
   await page.goto('/colleges/'+college.slug);
   await expect(card).toHaveCount(0);
   expect(await db.auditLog.count({where:{targetId:evidenceId,action:'evidence.review'}})).toBe(2);
 }
 await page.goto('/admin/enrichment?q='+name);
 await page.getByLabel('Search college, claim ID, field or programme',{exact:true}).fill('no-such-claim');await page.getByRole('button',{name:'Apply filters',exact:true}).click();await expect(page.getByText('No claims match these filters.')).toBeVisible();
 const memberPage=await browser.newPage();await memberPage.goto('/login');await memberPage.getByPlaceholder('Email address',{exact:true}).fill(memberEmail);await memberPage.getByPlaceholder('Password',{exact:true}).fill('Browser fixture 6729!');await memberPage.getByRole('button',{name:'Login',exact:true}).click();await expect.poll(()=>new URL(memberPage.url()).pathname).not.toBe('/login');await memberPage.goto('/admin/enrichment');await expect(memberPage.getByRole('heading',{name:'Access denied'})).toBeVisible();await expect(memberPage.getByText(name,{exact:true})).toHaveCount(0);await memberPage.close();
});
