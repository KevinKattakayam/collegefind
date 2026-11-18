import {it,expect,beforeEach} from 'vitest';
import {testDb,resetDb} from './db';
import {importOfficialReference} from '@/server/ingest/official-reference';
import {projectPublicCollege} from '@/server/public-evidence';
const db=testDb();beforeEach(resetDb);
it('stages references idempotently without approving or exposing them',async()=>{
 const c=await db.college.create({data:{slug:'reference-test',name:'TEST',shortName:'T',city:'Test',state:'Test',type:'PRIVATE'}});
 const row={slug:c.slug,publisher:'TEST',url:'https://example.test/',collectedAt:'2026-01-01T00:00:00Z',publishedAt:null,locator:'Test HTML heading',access:'PUBLIC_HTML_OBSERVED',use:'LINK_REFERENCE_ONLY',reviewState:'UNREVIEWED'};
 await importOfficialReference(db,row);expect(await db.source.count()).toBe(0);
 await importOfficialReference(db,row,false);await importOfficialReference(db,row,false);
 expect(await db.fieldEvidence.count()).toBe(1);expect(await db.auditLog.count()).toBe(1);expect(await db.evidenceDecision.count()).toBe(0);
 const claim=await db.fieldEvidence.findFirstOrThrow({include:{source:true,decisions:true}});
 expect(projectPublicCollege({...c,website:null,evidence:[claim]}).website).toBeNull();
 await importOfficialReference(db,{...row,field:'admissions'},false);expect(await db.fieldEvidence.count({where:{field:'admissions'}})).toBe(1);
 await expect(importOfficialReference(db,{...row,use:'COPY_DOCUMENT'},false)).rejects.toThrow();
});
