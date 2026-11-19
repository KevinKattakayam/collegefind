import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetDb, testDb } from './db';

const db = testDb();
const session = vi.hoisted(() => ({ current: null as null | { id: string; role: 'USER' | 'ADMIN' } }));
vi.mock('@/lib/prisma', async () => { const { testDb } = await import('./db'); return { prisma: testDb() }; });
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => session.current ? { user: session.current } : null) }));
const collection = await import('@/app/api/plans/[id]/tasks/route');
const single = await import('@/app/api/plans/[id]/tasks/[taskId]/route');
const request = (body?: unknown, method = 'POST') => new Request('https://collegefind.test', { method, headers: { origin:'https://collegefind.test',host:'collegefind.test','content-type':'application/json' }, body:body===undefined?undefined:JSON.stringify(body) });
const json = async (response:Response)=>({status:response.status,body:await response.json()});
const context=(id:string)=>({params:Promise.resolve({id})});
const detail=(id:string,taskId:string)=>({params:Promise.resolve({id,taskId})});
const payload=(overrides:Record<string,unknown>={})=>({title:'Submit the form',description:'Personal description',kind:'DEADLINE',dueDate:'2027-01-12',dueTime:'10:30',timeZone:'Asia/Kolkata',collegeId:null,applicationId:null,note:'Personal reminder',...overrides});

beforeEach(async()=>{await resetDb();session.current=null});
afterAll(async()=>{await resetDb();await db.$disconnect()});

describe('private planner tasks and deadlines',()=>{
 it('supports authenticated CRUD, completion/reopen and restores only for the owner',async()=>{
  const owner=await db.user.create({data:{name:'Task owner',email:'task-owner@example.test',password:'unused'}});
  const other=await db.user.create({data:{name:'Task other',email:'task-other@example.test',password:'unused'}});
  const plan=await db.admissionPlan.create({data:{userId:owner.id,name:'Personal plan',cycle:'2027'}});
  expect((await json(await collection.GET(request(undefined,'GET'),context(plan.id)))).status).toBe(401);
  expect((await json(await collection.POST(request(payload()),context(plan.id)))).status).toBe(401);
  session.current={id:owner.id,role:'USER'};
  const created=await json(await collection.POST(request(payload()),context(plan.id)));
  expect(created.status).toBe(201); expect(created.body.task.dueAt).toBe('2027-01-12T05:00:00.000Z'); expect(created.body.task.version).toBe(0); expect(created.body.task.description).toBe('Personal description');
  const item=created.body.task;
  expect((await json(await collection.GET(request(undefined,'GET'),context(plan.id)))).body.tasks).toHaveLength(1);
  session.current=null;
  expect((await json(await single.PATCH(request({action:'completion',completed:true,expectedVersion:0},'PATCH'),detail(plan.id,item.id)))).status).toBe(401);
  expect((await json(await single.DELETE(request({expectedVersion:0},'DELETE'),detail(plan.id,item.id)))).status).toBe(401);
  session.current={id:other.id,role:'USER'};
  expect((await json(await collection.GET(request(undefined,'GET'),context(plan.id)))).status).toBe(404);
  expect((await json(await single.PATCH(request({action:'completion',completed:true,expectedVersion:0},'PATCH'),detail(plan.id,item.id)))).status).toBe(404);
  expect((await json(await single.DELETE(request({expectedVersion:0},'DELETE'),detail(plan.id,item.id)))).status).toBe(404);
  session.current={id:owner.id,role:'USER'};
  const complete=await json(await single.PATCH(request({action:'completion',completed:true,expectedVersion:0},'PATCH'),detail(plan.id,item.id)));
  expect(complete.status).toBe(200);expect(complete.body.task.completedAt).toBeTruthy();expect(complete.body.task.version).toBe(1);
  const idempotent=await json(await single.PATCH(request({action:'completion',completed:true,expectedVersion:0},'PATCH'),detail(plan.id,item.id)));
  expect(idempotent.status).toBe(200);expect(idempotent.body.task.version).toBe(1);
  const reopened=await json(await single.PATCH(request({action:'completion',completed:false,expectedVersion:1},'PATCH'),detail(plan.id,item.id)));
  expect(reopened.body.task.completedAt).toBeNull();
  const edited=await json(await single.PATCH(request({action:'edit',expectedVersion:2,...payload({title:'Updated reminder',note:'Changed by owner'})},'PATCH'),detail(plan.id,item.id)));
  expect(edited.status).toBe(200);expect(edited.body.task.title).toBe('Updated reminder');expect(edited.body.task.version).toBe(3);
  expect((await json(await single.DELETE(request({expectedVersion:2},'DELETE'),detail(plan.id,item.id)))).status).toBe(409);
  expect((await json(await single.DELETE(request({expectedVersion:3},'DELETE'),detail(plan.id,item.id)))).body.deleted).toBe(true);
 });

 it('rejects invalid dates, timezones, links and time-without-date',async()=>{
  const user=await db.user.create({data:{name:'Task validation',email:'task-validation@example.test',password:'unused'}});
  const plan=await db.admissionPlan.create({data:{userId:user.id,name:'Validation plan',cycle:'2027'}});session.current={id:user.id,role:'USER'};
  for(const body of [payload({dueDate:'2027-02-30'}),payload({timeZone:'Mars/Somewhere'}),payload({dueDate:null,dueTime:'09:00'}),payload({dueDate:'2027-03-14',dueTime:'02:30',timeZone:'America/New_York'})])
    expect((await json(await collection.POST(request(body),context(plan.id)))).status).toBe(400);
  expect(await db.planTask.count({where:{planId:plan.id}})).toBe(0);
 });

 it('keeps optional application and college associations inside the same plan',async()=>{
  const user=await db.user.create({data:{name:'Task link owner',email:'task-link-owner@example.test',password:'unused'}});
  const college=await db.college.create({data:{slug:'task-linked-college',name:'Linked College',shortName:'LC',city:'Pune',state:'Maharashtra',type:'GOVERNMENT'}});
  const otherCollege=await db.college.create({data:{slug:'task-other-linked-college',name:'Other Linked College',shortName:'OLC',city:'Delhi',state:'Delhi',type:'GOVERNMENT'}});
  const plan=await db.admissionPlan.create({data:{userId:user.id,name:'Linked plan',cycle:'2027'}});
  const otherPlan=await db.admissionPlan.create({data:{userId:user.id,name:'Other linked plan',cycle:'2027'}});
  const application=await db.planApplication.create({data:{planId:plan.id,collegeId:college.id,cycle:'2027'}});
  const foreignApplication=await db.planApplication.create({data:{planId:otherPlan.id,institutionName:'Private entry',cycle:'2027'}});
  session.current={id:user.id,role:'USER'};
  const mismatch=await json(await collection.POST(request(payload({applicationId:application.id,collegeId:otherCollege.id})),context(plan.id)));
  expect(mismatch.status).toBe(400);
  const foreign=await json(await collection.POST(request(payload({applicationId:foreignApplication.id})),context(plan.id)));
  expect(foreign.status).toBe(404);
  const linked=await json(await collection.POST(request(payload({applicationId:application.id})),context(plan.id)));
  expect(linked.status).toBe(201);expect(linked.body.task.collegeId).toBe(college.id);expect(linked.body.task.application.id).toBe(application.id);
 });

 it('rejects stale concurrent edits and preserves one complete update',async()=>{
  const user=await db.user.create({data:{name:'Task concurrency',email:'task-concurrency@example.test',password:'unused'}});
  const plan=await db.admissionPlan.create({data:{userId:user.id,name:'Concurrency plan',cycle:'2027'}});const task=await db.planTask.create({data:{planId:plan.id,title:'Initial',kind:'CHECKLIST',timeZone:'UTC'}});session.current={id:user.id,role:'USER'};
  const edit=(title:string)=>single.PATCH(request({action:'edit',expectedVersion:0,...payload({title,dueDate:null,dueTime:null})},'PATCH'),detail(plan.id,task.id));
  const responses=await Promise.all([edit('Edit one'),edit('Edit two')]);
  expect(responses.map(x=>x.status).sort()).toEqual([200,409]);const stored=await db.planTask.findUniqueOrThrow({where:{id:task.id}});expect(stored.version).toBe(1);expect(['Edit one','Edit two']).toContain(stored.title);
 });
});
