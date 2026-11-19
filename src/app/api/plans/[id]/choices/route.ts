import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { ApiError, assertSameOrigin, CACHE_NONE, readJson, withErrorHandling } from '@/lib/http';
import { requireUser } from '@/lib/session';
import { enforceRateLimit } from '@/lib/rate-limit';
const id = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);
const create = z.object({ collegeId: id.optional(), programId: id.optional(), label: z.string().trim().min(1).max(200), note: z.string().max(2000).optional() }).strict();
const order = z.object({ ids: z.array(id).min(1).max(100) }).strict();
async function owned(planId: string,userId: string){const row=await prisma.admissionPlan.findFirst({where:{id:planId,userId},select:{id:true,cycle:true}});if(!row)throw new ApiError(404,'NOT_FOUND','Plan not found');return row}
export const POST=withErrorHandling(async(request:Request,ctx:{params:Promise<{id:string}>})=>{
 const user=await requireUser();assertSameOrigin(request);await enforceRateLimit('save',user.id);const {id:planId}=await ctx.params;const plan=await owned(id.parse(planId),user.id);const input=await readJson(request,create);
 if(input.programId&&!input.collegeId)throw new ApiError(400,'INVALID_PROGRAM','A catalogue programme must be attached to its college');
 if(input.collegeId&&!await prisma.college.findUnique({where:{id:input.collegeId},select:{id:true}}))throw new ApiError(404,'NOT_FOUND','College not found');
 if(input.programId&&!await prisma.program.findFirst({where:{id:input.programId,collegeId:input.collegeId},select:{id:true}}))throw new ApiError(400,'INVALID_PROGRAM','Programme is not attached to the selected college');
 try {const choice=await prisma.$transaction(async tx=>{await tx.$queryRaw`SELECT id FROM "AdmissionPlan" WHERE id = ${plan.id} FOR UPDATE`;const duplicate=await tx.planChoice.findFirst({where:{planId,cycle:plan.cycle,label:{equals:input.label,mode:'insensitive'}}});if(duplicate)throw new ApiError(409,'DUPLICATE_CHOICE','This choice is already in your plan');const position=await tx.planChoice.count({where:{planId,cycle:plan.cycle}});return tx.planChoice.create({data:{...input,planId,cycle:plan.cycle,position}})});return NextResponse.json({choice},{status:201,headers:{'Cache-Control':CACHE_NONE}})}catch(error){if(error instanceof ApiError)throw error;throw error}
});
export const PATCH=withErrorHandling(async(request:Request,ctx:{params:Promise<{id:string}>})=>{
 const user=await requireUser();assertSameOrigin(request);await enforceRateLimit('save',user.id);const {id:planId}=await ctx.params;await owned(id.parse(planId),user.id);const {ids}=await readJson(request,order);
 await prisma.$transaction(async tx=>{await tx.$queryRaw`SELECT id FROM "AdmissionPlan" WHERE id = ${planId} FOR UPDATE`;const rows=await tx.planChoice.findMany({where:{planId},select:{id:true}});if(rows.length!==ids.length||new Set(ids).size!==ids.length||ids.some(id=>!rows.some(row=>row.id===id)))throw new ApiError(400,'INVALID_ORDER','Order must include each choice exactly once');for(const [i,id] of ids.entries())await tx.planChoice.update({where:{id},data:{position:1000000+i}});for(const [i,id] of ids.entries())await tx.planChoice.update({where:{id},data:{position:i}})});
 return NextResponse.json({order:ids},{headers:{'Cache-Control':CACHE_NONE}})
});
