/** Disposable-only old-schema upgrade rehearsal. Never targets runtime DATABASE_URL. */
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import pg from 'pg';
import { assertDisposableTestTarget } from '../tests/integration/target';

async function main() {
  const target = assertDisposableTestTarget();
  const client = new pg.Client({ connectionString: target });
  await client.connect();
  try {
    const identity = await client.query('SELECT current_database() AS name');
    const empty = await client.query("SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public'");
    assert.equal(empty.rows[0].n, 0, 'Upgrade rehearsal requires a newly provisioned empty database');
    for (const migration of ['20260430_init', '20261005000000_trust_and_provenance']) {
      await client.query(readFileSync(`prisma/migrations/${migration}/migration.sql`, 'utf8'));
    }
    await client.query(`INSERT INTO "College" (id,slug,name,"shortName",city,state,type,"dataStatus",courses,"topRecruiters","updatedAt") VALUES ('preserved-college','preserved-slug','Fixture','Fixture','Fixture','Kerala','GOVERNMENT','DEMO',ARRAY[]::text[],ARRAY[]::text[],now());
      INSERT INTO "User" (id,name,email,password,"updatedAt") VALUES ('preserved-user','Fixture','upgrade@example.test','unused-fixture',now());
      INSERT INTO "SavedCollege" (id,"userId","collegeId") VALUES ('preserved-save','preserved-user','preserved-college');
      INSERT INTO "SavedComparison" (id,"userId",signature,"collegeIds") VALUES ('preserved-comparison','preserved-user','fixture',ARRAY['preserved-college']);
      INSERT INTO "Source" (id,name,publisher,url,"retrievedAt") VALUES ('preserved-source','Fixture','Fixture','https://example.edu/fixture',now());
      INSERT INTO "Program" (id,"collegeId",name) VALUES ('preserved-program','preserved-college','Fixture');
      INSERT INTO "CutoffRecord" (id,"programId",exam,year,round,quota,category,"seatPool","closingValue","sourceId") VALUES ('preserved-cutoff','preserved-program','JEE_MAIN',2025,6,'AI','OPEN','GENDER_NEUTRAL',1000,'preserved-source');`);
    const tables = ['College','User','SavedCollege','SavedComparison','Source','Program','CutoffRecord'];
    const before = await Promise.all(tables.map(async (table) => (await client.query(`SELECT row_to_json(t) AS row FROM "${table}" t ORDER BY id`)).rows));
    await client.query(readFileSync('prisma/migrations/20261117000000_field_evidence_import_runs/migration.sql','utf8'));
    for (let i=0;i<tables.length;i++) {
      const after = (await client.query(`SELECT row_to_json(t) AS row FROM "${tables[i]}" t ORDER BY id`)).rows;
      // Source has two new nullable metadata columns; compare all original columns.
      for (let n=0;n<before[i].length;n++) for (const key of Object.keys(before[i][n].row)) assert.deepEqual(after[n].row[key],before[i][n].row[key]);
      assert.equal(after.length,before[i].length);
    }
    console.log(`PASS upgrade preservation: ${identity.rows[0].name}, ${tables.length} legacy tables, unchanged IDs/values/relationships`);
  } finally { await client.end(); }
}
main().catch((error) => { console.error(error instanceof assert.AssertionError ? error.message : 'Upgrade verification failed (no connection URL logged)'); process.exitCode=1; });
