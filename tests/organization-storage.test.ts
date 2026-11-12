import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';

test('planning tables prevent references across organizations and deny public access', async () => {
  const db = new PGlite();
  try {
    await db.exec('create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users (id uuid primary key);');
    await db.exec(await readFile('supabase/migrations/20261111000100_escala_organizations.sql', 'utf8'));
    const a = '00000000-0000-4000-8000-000000000001';
    const b = '00000000-0000-4000-8000-000000000002';
    await db.query("insert into public.escala_organizations(id,name) values ($1,'A'),($2,'B')", [a, b]);
    assert.equal((await db.query<{ n: number }>('select count(*)::int as n from public.escala_sectors')).rows[0].n, 6);
    await db.query("insert into public.escala_employees values ($1,'legacy-1','Campo','{}')", [a]);
    await assert.rejects(db.query("insert into public.escala_shifts values ($1,'shift-1','legacy-1','{}')", [b]), { code: '23503' });
    const objects = await db.query(`
      select count(*)::int as n, bool_and(c.relrowsecurity) as rls,
             bool_or(has_table_privilege('authenticated', c.oid, 'INSERT,UPDATE,DELETE')) as writes,
             bool_or(has_table_privilege('anon', c.oid, 'SELECT')) as anonymous
      from pg_class c where c.relnamespace='public'::regnamespace and c.relkind='r'
    `);
    assert.deepEqual(objects.rows[0], { n: 12, rls: true, writes: false, anonymous: false });
  } finally {
    await db.close();
  }
});
test('planning saves are revisioned, atomic and scoped to current membership', async () => {
  const db = new PGlite();
  try {
    await db.exec("create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users (id uuid primary key);");
    await db.exec(await readFile('supabase/migrations/20261111000100_escala_organizations.sql', 'utf8'));
    const org = '00000000-0000-4000-8000-000000000001';
    const actor = '00000000-0000-4000-8000-000000000002';
    await db.query('insert into auth.users values ($1)', [actor]);
    await db.query("insert into public.escala_organizations(id,name) values ($1,'A')", [org]);
    await db.query("insert into public.escala_memberships values ($1,$2,'manager')", [org, actor]);
    const store = { version: 1, employees: [{ id: 'old-id', team: 'Campo' }], rules: {}, shifts: [], swaps: [], holidays: [{ id: 'holiday', notes: 'Preservar' }] };
    const save = (revision: number, value: object) => db.query<{ revision: number }>('select public.escala_write_planning($1,$2,$3,$4) as revision', [org, actor, revision, JSON.stringify(value)]);
    const load = async () => (await db.query<{ state: unknown }>('select public.escala_read_planning($1,$2) as state', [org, actor])).rows[0].state;
    assert.equal((await save(0, store)).rows[0].revision, 1);
    assert.deepEqual(await load(), { revision: 1, store });
    await assert.rejects(save(0, store), { code: '40001' });
    await assert.rejects(save(1, { ...store, employees: [] , shifts: [{ id: 's', employeeId: 'missing' }] }), { code: '23503' });
    assert.deepEqual(await load(), { revision: 1, store });
    await db.query('delete from public.escala_memberships where organization_id=$1 and user_id=$2', [org, actor]);
    await assert.rejects(load(), { code: '42501' });
    await assert.rejects(save(1, store), { code: '42501' });
  } finally {
    await db.close();
  }
});

test('custom teams are saved and read only within the manager organization', async () => {
  const db = new PGlite();
  try {
    await db.exec('create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users (id uuid primary key);');
    for (const file of ['20261111000100_escala_organizations.sql', '20261111140000_escala_membership_status.sql', '20261112200000_escala_custom_teams.sql', '20261112210000_escala_remove_custom_teams.sql']) {
      await db.exec(await readFile('supabase/migrations/' + file, 'utf8'));
    }
    const a = '00000000-0000-4000-8000-000000000001';
    const b = '00000000-0000-4000-8000-000000000002';
    const managerA = '00000000-0000-4000-8000-000000000003';
    const managerB = '00000000-0000-4000-8000-000000000004';
    await db.query('insert into auth.users values ($1),($2)', [managerA, managerB]);
    await db.query("insert into public.escala_organizations(id,name) values ($1,'A'),($2,'B')", [a,b]);
    await db.query("insert into public.escala_memberships(organization_id,user_id,role) values ($1,$2,'manager'),($3,$4,'manager')", [a,managerA,b,managerB]);
    await db.exec('set role service_role');
    const store = { version: 1, employees: [], rules: {}, shifts: [], swaps: [] };
    const save = (org: string, actor: string, revision: number, value: object) => db.query('select public.escala_write_planning($1,$2,$3,$4)', [org,actor,revision,JSON.stringify(value)]);
    const teams = async (org: string, actor: string) => (await db.query<{ teams: string[] }>("select public.escala_read_planning($1,$2) #> '{store,teams}' as teams", [org,actor])).rows[0].teams;
    await save(a,managerA,0,{...store,teams:['Logística']});
    await save(a,managerA,1,{...store,employees:[{id:'e1',team:'Logística'}]});
    assert.ok((await teams(a,managerA)).includes('Logística'));
    await save(b,managerB,0,store);
    assert.ok(!(await teams(b,managerB)).includes('Logística'));
    await assert.rejects(teams(a,managerB), { code: '42501' });
    await assert.rejects(save(a,managerB,2,{...store,teams:['Outra']}), { code: '42501' });
    await assert.rejects(save(b,managerB,1,{...store,employees:[{id:'e1',team:'Logística'}]}), { code: '23503' });
    await save(b,managerB,1,{...store,teams:['Logística']});
    assert.ok((await teams(b,managerB)).includes('Logística'));
    await assert.rejects(save(a,managerB,2,{...store,teams:[]}), { code: '42501' });
    await assert.rejects(save(a,managerA,2,{...store,teams:[],employees:[{id:'e1',team:'Logística'}]}), { code: '23503' });
    assert.ok((await teams(a,managerA)).includes('Logística'));
    await save(a,managerA,2,{...store,teams:[],employees:[{id:'e1',team:'Campo'}]});
    assert.deepEqual((await teams(a,managerA)).sort(), ['Atendimento','Campo','Suporte']);
    assert.ok((await teams(b,managerB)).includes('Logística'));
  } finally {
    await db.close();
  }
});
