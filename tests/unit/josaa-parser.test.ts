import { describe, expect, it } from 'vitest';
import { parseInstituteMapping, parseJosaaCsv, parseProgramName } from '@/server/ingest/josaa';

describe('JoSAA import parser edge cases', () => {
  it('rejects invalid quotas, unsupported gender pools, invalid opening ranks and reversed rank ranges', () => {
    const csv = `Institute,Academic Program Name,Quota,Seat Type,Gender,Opening Rank,Closing Rank
Institute,"Course (4 Years, Degree)",A,OPEN,Gender-Neutral,1,2
Institute,"Course (4 Years, Degree)",AI,OPEN,Unknown Pool,1,2
Institute,"Course (4 Years, Degree)",AI,OPEN,Gender-Neutral,invalid,2
Institute,"Course (4 Years, Degree)",AI,OPEN,Gender-Neutral,9,2
Institute,"Course (4 Years, Degree)",AI,OPEN,Gender-Neutral,1,invalid`;
    const parsed = parseJosaaCsv(csv);
    expect(parsed.rows).toEqual([]);
    expect(parsed.rejected).toHaveLength(5);
    expect(parsed.rejected.map((row) => row.reason)).toEqual(expect.arrayContaining([
      expect.stringMatching(/quota/), expect.stringMatching(/gender/), expect.stringMatching(/opening rank/),
      expect.stringMatching(/worse than closing/), expect.stringMatching(/closing rank/),
    ]));
  });

  it('counts duplicate natural keys while keeping the last parsed row', () => {
    const csv = `Institute,Academic Program Name,Quota,Seat Type,Gender,Opening Rank,Closing Rank
Institute,Course,AI,OPEN,Gender-Neutral,1,10
Institute,Course,AI,OPEN,Gender-Neutral,1,12`;
    const parsed = parseJosaaCsv(csv);
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.duplicates).toBe(1);
    expect(parsed.rows[0].closing.value).toBe(12);
  });

  it('keeps unparsed program titles as opaque names and rejects malformed institute mappings', () => {
    expect(parseProgramName('Integrated course')).toEqual({ branch: 'Integrated course', degree: null, durationYears: null });
    expect(() => parseInstituteMapping('josaa_name,slug,name,city,state,type\nInstitute,,,,,OTHER')).toThrow(/Invalid institute mapping row/);
    expect(parseInstituteMapping('josaa_name,slug,name,city,state,type\nInstitute,institute,Institute,Kochi,Kerala,government').get('Institute')).toMatchObject({
      slug: 'institute', type: 'GOVERNMENT', shortName: 'Institute',
    });
  });
});
