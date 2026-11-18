import { z } from 'zod';
import type { PrismaClient } from '@prisma/client';
import { checksum, sourceIdentity } from './identity';
// Deliberately limited to manually observed official page references, not a crawler
// or a licence to import arbitrary text/financial/admission claims.
export const referenceSchema=z.object({slug:z.string().min(1),field:z.enum(['website','admissions']).optional(),publisher:z.string().min(1),url:z.url().startsWith('https://'),collectedAt:z.iso.datetime(),publishedAt:z.iso.datetime().nullable(),locator:z.string().min(1),access:z.literal('PUBLIC_HTML_OBSERVED'),use:z.literal('LINK_REFERENCE_ONLY'),reviewState:z.literal('UNREVIEWED')}).strict();
export async function importOfficialReference(db:PrismaClient,input:unknown,dryRun=true){
 const row=referenceSchema.parse(input);const field=row.field??'website';const url=new URL(row.url);
 if(url.username||url.password||new Date(row.collectedAt)>new Date())throw new Error('Invalid source metadata');
 const college=await db.college.findUniqueOrThrow({where:{slug:row.slug}});
 const key=sourceIdentity(row,checksum(row));
 if(dryRun)return {slug:college.slug,status:'DRY_RUN',field};
 return db.$transaction(async tx=>{
 const source=await tx.source.upsert({where:{identityKey:key},update:{},create:{identityKey:key,name:'Official website reference',publisher:row.publisher,url:row.url,retrievedAt:new Date(row.collectedAt),publishedAt:row.publishedAt?new Date(row.publishedAt):null,license:'Link reference only; document reproduction and automated bulk collection not authorized',notes:row.locator}});
 const run=await tx.importRun.upsert({where:{identityKey:key},update:{},create:{identityKey:key,checksum:checksum(row),sourceId:source.id}});
 await tx.importRun.update({where:{id:run.id},data:{identityKey:key}});
 const claimKey=checksum([key,college.id,field,row.url]);
 const claim=await tx.fieldEvidence.upsert({where:{identityKey:claimKey},update:{},create:{identityKey:claimKey,collegeId:college.id,field,value:row.url,sourceId:source.id,isFixture:false,validUntil:new Date(new Date(row.collectedAt).getTime()+90*86400000),evidenceLocator:row.locator}});
 if(!run.finishedAt){await tx.auditLog.create({data:{action:'official.reference.stage',targetType:'FieldEvidence',targetId:claim.id,metadata:{runId:run.id,reviewState:'UNREVIEWED'}}});await tx.importRun.update({where:{id:run.id},data:{status:'STAGED',finishedAt:new Date(),summary:{collegeId:college.id,field,claims:1,reviewState:'UNREVIEWED'}}});}
 return {slug:college.slug,claimId:claim.id,sourceId:source.id,status:'STAGED',field};
 });
}
