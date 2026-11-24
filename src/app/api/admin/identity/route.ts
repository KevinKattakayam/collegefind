import { z } from 'zod';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/session';
import { assertSameOrigin, readJson, withErrorHandling, ApiError } from '@/lib/http';
import { enforceRateLimit } from '@/lib/rate-limit';
import { aliasSchema } from '@/server/ingest/catalogue';
const schema=aliasSchema.extend({collegeId:z.string().min(1),sourceUrl:z.url().startsWith('https://'),reason:z.string().trim().min(3),validFrom:z.iso.datetime().optional(),validUntil:z.iso.datetime().optional()}).strict();
export const GET=withErrorHandling(async(request:Request)=>{
 await requireAdmin();const url=new URL(request.url);const namespace=url.searchParams.get('namespace');const value=url.searchParams.get('value');const campus=url.searchParams.get('campus');
 if(!namespace||!value||!campus)throw new ApiError(400,'INVALID_INPUT','namespace, value and campus are required');
 const aliases=await prisma.institutionAlias.findMany({where:{namespace,value,campus},include:{college:true},orderBy:[{validFrom:'desc'},{id:'asc'}]});
 const now=Date.now();const active=aliases.filter(a=>(!a.validFrom||a.validFrom.getTime()<=now)&&(!a.validUntil||a.validUntil.getTime()>=now));const ids=new Set(active.map(a=>a.collegeId));
 return NextResponse.json({status:ids.size===0?'UNMATCHED':ids.size>1?'AMBIGUOUS':'MATCHED',college:ids.size===1?active.find(a=>a.collegeId===[...ids][0])?.college:null,aliases},{headers:{'Cache-Control':'no-store'}});
});
export const POST=withErrorHandling(async(request:Request)=>{
 const admin=await requireAdmin();assertSameOrigin(request);await enforceRateLimit('moderation',admin.id);
 const input=await readJson(request,schema);
 if(input.validFrom && input.validUntil && input.validFrom>input.validUntil)throw new ApiError(400,'INVALID_INPUT','Invalid name validity period');
 const result=await prisma.$transaction(async tx=>{
  const competing=await tx.institutionAlias.findMany({where:{namespace:input.namespace,value:input.value,campus:input.campus}});
  if(competing.some(a=>a.collegeId!==input.collegeId))throw new ApiError(409,'CONFLICT','Alias already maps to another college; reconcile manually');
  const {reason,...data}=input;
  const alias=await tx.institutionAlias.upsert({where:{namespace_value_campus_collegeId:{namespace:data.namespace,value:data.value,campus:data.campus,collegeId:data.collegeId}},update:{},create:data});
  await tx.auditLog.create({data:{actorId:admin.id,action:'identity.reconcile',targetType:'College',targetId:data.collegeId,metadata:{aliasId:alias.id,reason}}});return alias;
 },{isolationLevel:'Serializable'});
 return NextResponse.json({id:result.id},{headers:{'Cache-Control':'no-store'}});
});
