import {readFileSync,writeFileSync} from 'node:fs';
import {parseArgs} from 'node:util';
import {PrismaClient} from '@prisma/client';
import {PrismaPg} from '@prisma/adapter-pg';
import pg from 'pg';
import {assertDisposableTestTarget} from '../tests/integration/target';
import {importOfficialReference} from '../src/server/ingest/official-reference';
async function main(){
 const {values}=parseArgs({options:{file:{type:'string'},apply:{type:'boolean'},report:{type:'string'},offset:{type:'string',default:'0'},limit:{type:'string',default:'25'}}});if(!values.file)throw new Error('--file required');
 const offset=Number(values.offset),limit=Number(values.limit);if(!Number.isInteger(offset)||offset<0||!Number.isInteger(limit)||limit<1||limit>25)throw new Error('Invalid batch range');
 const connectionString=assertDisposableTestTarget();const db=new PrismaClient({adapter:new PrismaPg(new pg.Pool({connectionString}))});
 try{const results=[];for(const [index,row] of JSON.parse(readFileSync(values.file,'utf8')).slice(offset,offset+limit).entries()){try{results.push(await importOfficialReference(db,row,!values.apply));}catch{results.push({row:offset+index+1,status:'REJECTED',reason:'Validation/identity/transaction failed; inspect this row before retry'});process.exitCode=2;}if(values.report)writeFileSync(values.report,JSON.stringify(results,null,2)+'\n');}const report=JSON.stringify(results,null,2);if(values.report)writeFileSync(values.report,report+'\n');console.log(report);}finally{await db.$disconnect();}
}
main().catch(()=>{console.error('Reference import failed; no credentials logged');process.exitCode=1;});
