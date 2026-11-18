import { beforeEach, expect, it } from 'vitest';
import { resetDb, testDb } from './db';
import { importCatalogue, reconcile } from '@/server/ingest/catalogue';
import { projectPublicCollege } from '@/server/public-evidence';
import { reviewFieldEvidence } from '@/server/ingest/field-evidence';
const db=testDb();
beforeEach(resetDb);
const bundle={fixture:true,source:{url:'https://example.test/fixture',publisher:'LOCAL FIXTURE',collectedAt:'2026-01-01T00:00:00Z'},rows:[{collegeSlug:'fixture',field:'description',value:'Fictional fixture description',academicYear:2026,validUntil:'2027-01-01T00:00:00Z',locator:'row 1',snippet:'Fictional fixture description'}]};
it('stages idempotently, reports rejects, keeps dry run empty and preserves college identity',async()=>{
 const c=await db.college.create({data:{slug:'fixture',name:'Fixture',shortName:'F',city:'Fixture',state:'Fixture',type:'PRIVATE'}});
 expect(reconcile('fixture',[c],[{collegeId:'other'}]).status).toBe('AMBIGUOUS');
 await importCatalogue(db,bundle);
 expect(await db.source.count()).toBe(0);
 await importCatalogue(db,bundle,false);await importCatalogue(db,bundle,false);
 expect(await db.fieldEvidence.count()).toBe(1);expect(await db.auditLog.count()).toBe(1);
 const claim=await db.fieldEvidence.findFirstOrThrow();expect(claim.isFixture).toBe(true);
 const publicResult=projectPublicCollege({slug:'fixture',dataStatus:'DEMO',description:null,evidence:[{...claim,source:await db.source.findUniqueOrThrow({where:{id:claim.sourceId}}),decisions:[{status:'APPROVED',createdAt:new Date()}]}]});
 expect(publicResult.description).toBeNull();
 const admin=await db.user.create({data:{email:'review@example.test',name:'Fixture reviewer',password:'fixture',role:'ADMIN'}});
 await expect(reviewFieldEvidence(db,{evidenceId:claim.id,reviewerId:admin.id,status:'APPROVED',reason:'fixture'})).rejects.toThrow('Fixture');
 expect(await db.evidenceDecision.count()).toBe(0);
 await reviewFieldEvidence(db,{evidenceId:claim.id,reviewerId:admin.id,status:'REJECTED',reason:'fixture'});
 expect(await db.evidenceDecision.count()).toBe(1);
 const user=await db.user.create({data:{email:'user@example.test',name:'User',password:'fixture'}});
 await expect(reviewFieldEvidence(db,{evidenceId:claim.id,reviewerId:user.id,status:'REJECTED',reason:'Not authorized'})).rejects.toThrow('Reviewer access');
 expect(await db.evidenceDecision.count()).toBe(1);
 await importCatalogue(db,{...bundle,rows:[{...bundle.rows[0],value:'Changed fixture value'}]},false);
 expect(await db.fieldEvidence.count()).toBe(2);
 expect(await db.importRun.count()).toBe(2);
 expect(await importCatalogue(db,{...bundle,rows:[{}]})).toMatchObject({rejected:1});
 expect((await db.college.findUniqueOrThrow({where:{id:c.id}})).slug).toBe('fixture');
});
it('rolls back staged claims when audit persistence fails',async()=>{
 await db.college.create({data:{slug:'fixture',name:'Fixture',shortName:'F',city:'Fixture',state:'Fixture',type:'PRIVATE'}});
 // Inject failure after staging to exercise the actual database transaction rollback.
 const proxy=new Proxy(db,{get(target,key){if(key==='$transaction')return (fn: Parameters<typeof db.$transaction>[0])=>db.$transaction(async tx=>{const wrapped=new Proxy(tx,{get(t,k){if(k==='auditLog')return {create:async()=>{throw new Error('audit unavailable');}};return Reflect.get(t,k);}});return (fn as unknown as (t:typeof tx)=>Promise<unknown>)(wrapped);});return Reflect.get(target,key);}});
 await expect(importCatalogue(proxy,bundle,false)).rejects.toThrow();
 expect(await db.source.count()).toBe(0);expect(await db.fieldEvidence.count()).toBe(0);
});
