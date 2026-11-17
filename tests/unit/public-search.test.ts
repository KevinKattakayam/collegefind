import { expect, it } from 'vitest';
import { filterPublicColleges } from '@/server/public-search';
import { collegesQuerySchema } from '@/lib/validation';
import type { College } from '@/types';

const row = (overrides: Partial<College>): College => ({
 slug: 'fixture', annualFees: 100, naacGrade: 'A', courses: ['B.Tech'], rating: 4,
 establishedYear: 2000, ...overrides,
} as unknown as College);

it('excludes unknown fees from budget filters and sorts known values before unknowns', () => {
 const rows = [{slug:'unknown',annualFees:null},{slug:'known',annualFees:50}] as never;
 expect(filterPublicColleges(rows,collegesQuerySchema.parse({maxFees:'100'})).map((c)=>c.slug)).toEqual(['known']);
 expect(filterPublicColleges(rows,collegesQuerySchema.parse({sort:'fees_asc'})).map((c)=>c.slug)).toEqual(['known','unknown']);
});

it('applies reviewed-data filters without admitting unknown values at boundary values', () => {
 const colleges = [
   row({slug:'match'}),
   row({slug:'unknown-fee',annualFees:null}),
   row({slug:'wrong-course',courses:['MBA']}),
   row({slug:'no-grade',naacGrade:null}),
   row({slug:'no-rating',rating:null}),
   row({slug:'no-year',establishedYear:null}),
 ];
 expect(filterPublicColleges(colleges,collegesQuerySchema.parse({minFees:'100',maxFees:'100'})).map(c=>c.slug)).toEqual(['match','wrong-course','no-grade','no-rating','no-year']);
 expect(filterPublicColleges(colleges,collegesQuerySchema.parse({naac:'A',courses:'B.Tech',minRating:'4'})).map(c=>c.slug)).toEqual(['match','unknown-fee','no-year']);
 expect(filterPublicColleges(colleges,collegesQuerySchema.parse({established:'1990_2010'})).map(c=>c.slug)).toEqual(expect.arrayContaining(['match','unknown-fee','wrong-course','no-grade','no-rating']));
 expect(filterPublicColleges(colleges,collegesQuerySchema.parse({established:'after_2010'})).map(c=>c.slug)).toEqual([]);
});

it('honors establishment period boundaries and all deterministic sort modes', () => {
 const colleges = [
   row({slug:'older',establishedYear:1959,rating:4,annualFees:300}),
   row({slug:'middle',establishedYear:1960,rating:5,annualFees:100}),
   row({slug:'later',establishedYear:1990,rating:3,annualFees:null}),
   row({slug:'recent',establishedYear:2011,rating:null,annualFees:200}),
 ];
 expect(filterPublicColleges(colleges,collegesQuerySchema.parse({established:'before_1960'})).map(c=>c.slug)).toEqual(['older']);
 expect(filterPublicColleges(colleges,collegesQuerySchema.parse({established:'1960_1990'})).map(c=>c.slug)).toEqual(['middle']);
 expect(filterPublicColleges(colleges,collegesQuerySchema.parse({established:'1990_2010'})).map(c=>c.slug)).toEqual(['later']);
 expect(filterPublicColleges(colleges,collegesQuerySchema.parse({established:'after_2010'})).map(c=>c.slug)).toEqual(['recent']);
 expect(filterPublicColleges(colleges,collegesQuerySchema.parse({sort:'rating'})).map(c=>c.slug)).toEqual(['middle','older','later','recent']);
 expect(filterPublicColleges(colleges,collegesQuerySchema.parse({sort:'fees_desc'})).map(c=>c.slug)).toEqual(['older','recent','middle','later']);
 expect(filterPublicColleges(colleges,collegesQuerySchema.parse({sort:'name'})).map(c=>c.slug)).toEqual(['older','middle','later','recent']);
});
