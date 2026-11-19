import { afterAll,beforeEach,describe,expect,it,vi } from 'vitest';
import { resetDb,testDb } from './db';
const db=testDb();
const session=vi.hoisted(()=>({current:null as null|{id:string;role:'USER'|'ADMIN'}}));
vi.mock('@/lib/prisma',async()=>{const {testDb}=await import('./db');return{prisma:testDb()}});
vi.mock('next-auth',()=>({getServerSession:vi.fn(async()=>session.current?{user:session.current}:null)}));
const route=await import('@/app/api/plans/route');
const item=await import('@/app/api/plans/[id]/route');
const req=(body?:unknown)=>new Request('https://collegefind.test/api/plans',{method:'POST',headers:{origin:'https://collegefind.test',host:'collegefind.test','content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
const json=async(r:Response)=>({status:r.status,body:await r.json()});
beforeEach(async()=>{await resetDb();session.current=null});afterAll(async()=>{await resetDb();await db.$disconnect()});
describe('private plan CRUD',()=>{
 it('requires a session and validates input',async()=>{expect((await json(await route.GET())).status).toBe(401);const user=await db.user.create({data:{name:'Plan owner',email:'plan-owner@example.test',password:'unused'}});session.current={id:user.id,role:'USER'};expect((await json(await route.POST(req({name:'',cycle:'26'})))).status).toBe(400)});
 it('creates, lists, renames and deletes plans for the owner only',async()=>{
  const owner=await db.user.create({data:{name:'Owner',email:'owner-plan@example.test',password:'unused'}});const other=await db.user.create({data:{name:'Other',email:'other-plan@example.test',password:'unused'}});session.current={id:owner.id,role:'USER'};
  const created=await json(await route.POST(req({name:'My plan',cycle:'2026',authority:'Personal list'})));expect(created.status).toBe(201);const id=created.body.plan.id as string;
  expect((await json(await route.GET())).body.plans.map((p:{id:string})=>p.id)).toEqual([id]);
  session.current={id:other.id,role:'USER'};expect((await json(await route.GET())).body.plans).toEqual([]);
  expect((await json(await item.PATCH(new Request('https://collegefind.test',{method:'PATCH',headers:{origin:'https://collegefind.test',host:'collegefind.test','content-type':'application/json'},body:JSON.stringify({name:'Other name',cycle:'2026'})}),{params:Promise.resolve({id})}))).status).toBe(404);
  expect((await json(await item.DELETE(new Request('https://collegefind.test',{method:'DELETE',headers:{origin:'https://collegefind.test',host:'collegefind.test'} }),{params:Promise.resolve({id})}))).status).toBe(404);
  session.current={id:owner.id,role:'USER'};const changed=await json(await item.PATCH(new Request('https://collegefind.test',{method:'PATCH',headers:{origin:'https://collegefind.test',host:'collegefind.test','content-type':'application/json'},body:JSON.stringify({name:'Renamed',cycle:'2026'})}),{params:Promise.resolve({id})}));expect(changed.body.plan.name).toBe('Renamed');
  expect((await json(await item.DELETE(new Request('https://collegefind.test',{method:'DELETE',headers:{origin:'https://collegefind.test',host:'collegefind.test'} }),{params:Promise.resolve({id})}))).body.deleted).toBe(true);expect((await json(await route.GET())).body.plans).toEqual([]);
 });
});
