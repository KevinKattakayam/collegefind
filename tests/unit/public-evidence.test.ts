import { describe, expect, it } from 'vitest';
import { projectPublicCollege } from '@/server/public-evidence';
const now = new Date('2026-11-17');
const claim = { id: 'one', field: 'naacGrade', value: 'A', academicYear: 2026, publishedAt: new Date('2026-01-01'), validFrom: null, validUntil: new Date('2027-01-01'), supersedesId: null, decisions: [{status: 'APPROVED', createdAt: new Date('2026-01-02')}], source: {url:'https://example.edu/accreditation',publisher:'Institution',retrievedAt:new Date('2026-01-01')} };
describe('public field projection', () => {
 it('withholds legacy values even if the college says VERIFIED', () => {
   expect(projectPublicCollege({dataStatus:'VERIFIED',naacGrade:'A++',annualFees:123},now)).toMatchObject({dataStatus:'UNVERIFIED',naacGrade:null,annualFees:null});
 });
 it('publishes only individually reviewed current evidence', () => {
   expect(projectPublicCollege({naacGrade:'fake',evidence:[claim]},now).naacGrade).toBe('A');
   expect(projectPublicCollege({naacGrade:'fake',evidence:[{...claim,decisions:[]}]},now).naacGrade).toBeNull();
   expect(projectPublicCollege({naacGrade:'fake',evidence:[{...claim,validUntil:new Date('2020-01-01')}]},now).naacGrade).toBeNull();
 });
 it('withholds conflicting values and rejected evidence', () => {
   expect(projectPublicCollege({naacGrade:'fake',evidence:[claim,{...claim,id:'two',value:'B'}]},now).naacGrade).toBeNull();
   expect(projectPublicCollege({naacGrade:'fake',evidence:[{...claim,decisions:[{status:'REJECTED',createdAt:now}]}]},now).naacGrade).toBeNull();
 });

 it('rejects insecure, credentialed, future-retrieved and not-yet-published sources', () => {
   for (const source of [
     { ...claim.source, url: 'http://example.edu/report' },
     { ...claim.source, url: 'https://user:password@example.edu/report' },
     { ...claim.source, publisher: '   ' },
     { ...claim.source, retrievedAt: new Date('2027-01-01') },
   ]) {
     expect(projectPublicCollege({naacGrade:'legacy',evidence:[{...claim,source}]},now).naacGrade).toBeNull();
   }
   expect(projectPublicCollege({naacGrade:'legacy',evidence:[{...claim,publishedAt:new Date('2027-01-01')}]},now).naacGrade).toBeNull();
 });

 it('validates typed values, array fields, decision recency, and current comparable fees', () => {
   expect(projectPublicCollege({establishedYear:1900,evidence:[{...claim,field:'establishedYear',value:'unknown'}]},now).establishedYear).toBeNull();
   expect(projectPublicCollege({courses:['legacy'],evidence:[{...claim,field:'courses',value:'not-json'}]},now).courses).toEqual([]);
   expect(projectPublicCollege({topRecruiters:['legacy'],evidence:[{...claim,field:'topRecruiters',value:'[1,2]'}]},now).topRecruiters).toEqual([]);
   expect(projectPublicCollege({naacGrade:'legacy',evidence:[{...claim,decisions:[
     {status:'APPROVED',createdAt:new Date('2026-01-01')},{status:'REJECTED',createdAt:new Date('2026-01-02')},
   ]}]},now).naacGrade).toBeNull();
   const fee = {amountInr:100000,programId:null,feeType:'TUITION_PER_YEAR',year:2026,decisions:[{status:'APPROVED',createdAt:new Date('2026-01-02')}],source:claim.source};
   expect(projectPublicCollege({annualFees:500,evidence:[],feesRecords:[fee]},now).annualFees).toBe(100000);
   expect(projectPublicCollege({annualFees:500,evidence:[],feesRecords:[{...fee,programId:'program-1'}]},now).annualFees).toBeNull();
   expect(projectPublicCollege({annualFees:500,evidence:[],feesRecords:[fee,{...fee,amountInr:200000}]},now).annualFees).toBeNull();
 });
});
