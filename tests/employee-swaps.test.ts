import assert from 'node:assert/strict';
import { test } from 'node:test';
import { coveragePlan } from '../lib/employee-swaps';
import { defaultRules } from '../lib/validation';
import type { Store } from '../lib/types';

test('coverage assigns the requested shift to another employee and rejects stale ownership', () => {
  const employee = { name: 'Pessoa', role: 'Suporte', team: 'Suporte', regime: '5x2', color: 'blue', sundayEvery: 3 } as const;
  const shift = { id: 'turno', employeeId: 'solicitante', date: '2030-01-02', start: '08:00', end: '16:00', breakMinutes: 60 };
  const store: Store = { version: 1, employees: [{ ...employee, id: 'solicitante' }, { ...employee, id: 'cobertura' }], shifts: [shift], swaps: [], rules: defaultRules };
  assert.equal(coveragePlan(store, shift, 'cobertura').shifts[0].employeeId, 'cobertura');
  assert.throws(() => coveragePlan(store, { ...shift, employeeId: 'outra-pessoa' }, 'cobertura'));
  assert.throws(() => coveragePlan(store, shift, 'solicitante'));
});

test('saved shifts appear without publication and employee swap decisions are atomic', async () => {
  const { PGlite } = await import('@electric-sql/pglite');
  const { readFile } = await import('node:fs/promises');
  const db = new PGlite();
  const organization = '00000000-0000-4000-8000-000000000001';
  const manager = '00000000-0000-4000-8000-000000000002';
  const employee = '00000000-0000-4000-8000-000000000003';
  const outsider = '00000000-0000-4000-8000-000000000004';
  const shift = { id: 'turno', employeeId: 'pessoa', date: '2099-01-02', start: '08:00', end: '16:00', breakMinutes: 60 };
  const roster = ['pessoa', 'cobertura'].map(id => ({ id, name: id, team: 'Suporte', regime: '5x2', role: 'Suporte', weeklyTargetMinutes: id === 'pessoa' ? 2160 : 2640 }));
  const otherShift = { ...shift, id: 'outro-turno', employeeId: 'cobertura', date: '2099-01-03' };
  const store = { version: 1, employees: roster, rules: {}, shifts: [shift, otherShift], swaps: [] };
  try {
    await db.exec("create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users (id uuid primary key, email text, email_confirmed_at timestamptz);");
    for (const file of [
      '20261111000100_escala_organizations.sql',
      '20261111120000_escala_platform_admin.sql',
      '20261111130000_escala_company_users.sql',
      '20261111140000_escala_membership_status.sql',
      '20261112160000_escala_employee_accounts.sql',
      '20261112190000_escala_live_employee_schedule.sql',
      '20261112200000_escala_employee_weekly_target.sql',
    ]) {
      await db.exec(await readFile('supabase/migrations/' + file, 'utf8'));
    }
    await db.query("insert into auth.users values ($1,'gestor@example.test',now()),($2,'pessoa@example.test',now()),($3,'outro@example.test',now())", [manager, employee, outsider]);
    await db.query("insert into public.escala_organizations(id,name) values ($1,'Empresa')", [organization]);
    await db.query("insert into public.escala_memberships(organization_id,user_id,role) values ($1,$2,'manager')", [organization, manager]);
    await db.query('select public.escala_write_planning($1,$2,0,$3)', [organization, manager, JSON.stringify(store)]);
    const link = (actor: string, allowed: boolean) => db.query(
      'select public.escala_employee_account_link($1,$2,$3,$4,$5)', [organization, actor, 'pessoa', 'pessoa@example.test', allowed],
    );
    await assert.rejects(link(outsider, true), { code: '42501' });
    await link(manager, false);
    const visibleShifts = async () => (await db.query<{ shifts: unknown }>(
      "select public.escala_employee_account_read($1) #> '{0,schedule,shifts}' as shifts", [employee],
    )).rows[0].shifts;
    assert.deepEqual(await visibleShifts(), [shift]);
    assert.deepEqual((await db.query(
      "select public.escala_employee_account_read($1) #> '{0,schedule,employee,weeklyTargetMinutes}' as target", [employee],
    )).rows, [{ target: 2160 }]);
    const submit = (actor: string) => db.query<{ id: string }>(
      'select public.escala_employee_swap_submit($1,$2,$3,$4) as id', [organization, actor, shift.id, 'Preciso de cobertura'],
    );
    await assert.rejects(submit(employee), { code: '42501' });
    await link(manager, true);
    await assert.rejects(submit(outsider), { code: '42501' });
    const [{ id }] = (await submit(employee)).rows;
    await assert.rejects(submit(employee), { code: '23505' });
    const updated = { ...store, shifts: [{ ...shift, employeeId: 'cobertura' }, otherShift] };
    const decide = (actor: string, revision: number) => db.query(
      'select public.escala_employee_swap_decide($1,$2,$3,null,$4,$5,$6)',
      [organization, actor, id, revision, JSON.stringify(updated), '{}'],
    );
    await assert.rejects(decide(employee, 1), { code: '42501' });
    await assert.rejects(decide(manager, 0), { code: '40001' });
    assert.deepEqual((await db.query('select status from public.escala_employee_swap_requests')).rows, [{ status: 'pending' }]);
    await decide(manager, 1);
    await assert.rejects(decide(manager, 2), { code: '40001' });
    assert.deepEqual((await db.query("select employee_id from public.escala_shifts where id='turno'")).rows, [{ employee_id: 'cobertura' }]);
    assert.deepEqual(await visibleShifts(), []);
    await db.query('select public.escala_write_planning($1,$2,2,$3)', [organization, manager, JSON.stringify(store)]);
    assert.deepEqual(await visibleShifts(), [shift]);
  } finally {
    await db.close();
  }
});
