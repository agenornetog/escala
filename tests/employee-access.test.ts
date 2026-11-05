import test, { before, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { employeeDatabaseFixture } from './fixtures/employee-database.mjs';
import { configureTestAuth, authenticatedRequest } from './auth-fixture';
import { createSession, verifySession } from '../lib/auth';
import { createEmployeeSession, readEmployeeSession, isEmployeeToken } from '../lib/employee-session';
import { employeeSchedule, scheduleForMonth, scheduleFromStore } from '../lib/employee-schedule';
import { currentEmployee, authenticateEmployee, employeeAccessConfigured } from '../lib/employee-storage';
import { GET as getAccess, PUT as saveAccess } from '../app/api/admin/employee-access/route';
import { GET as mySchedule } from '../app/api/employee/me/route';
import { POST as login } from '../app/api/auth/login/route';
import { POST as validate } from '../app/api/validate/route';
import { proxy } from '../proxy';
import { createSeed } from '../lib/seed';
let database:Awaited<ReturnType<typeof employeeDatabaseFixture>>;
const id='person-a',email='employee@example.test',password='employee-test-password-2026';
const schedule={employee:{id,name:'Pessoa A',role:'Técnica',regime:'5x2',privateNotes:'DO NOT SEND'},shifts:[{id:'s',employeeId:id,date:'2026-10-31',start:'22:00',end:'06:00',breakMinutes:60}],dayOffs:[{id:'off',employeeId:id,date:'2026-11-02'}],holidays:[],rules:{secret:'DO NOT SEND'}};
const payload=(extra={})=>({employeeId:id,email,password,enabled:true,schedule,...extra});
const save=(body:unknown,origin='http://localhost')=>saveAccess(authenticatedRequest('http://localhost/api/admin/employee-access',{method:'PUT',headers:{origin},body:JSON.stringify(body)}));
const own=(token:string,query='month=2026-11')=>new Request('http://localhost/api/employee/me?'+query,{headers:{cookie:'escala_session='+token}});
before(async()=>{
 configureTestAuth();Object.assign(process.env,{SUPABASE_URL:'https://employee-fixture.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'test-key',ESCALA_WORKSPACE_ID:'unit-test'});
 database=await employeeDatabaseFixture();mock.method(globalThis,'fetch',database.transport);
});
after(async()=>{mock.restoreAll();await database.db.close();});
test('publication keeps only an allowlist of this employee and rejects foreign shifts and folgas',()=>{
 const data=employeeSchedule(schedule,id);assert.equal('privateNotes' in data.employee,false);assert.equal('rules' in data,false);
 assert.throws(()=>employeeSchedule({...schedule,shifts:[{...schedule.shifts[0],employeeId:'person-b'}]},id));
 assert.throws(()=>employeeSchedule({...schedule,dayOffs:[{...schedule.dayOffs[0],employeeId:'person-b'}]},id));
 assert.throws(()=>employeeSchedule({...schedule,shifts:[{...schedule.shifts[0],date:'2026-02-30'}]},id));
 assert.throws(()=>employeeSchedule(schedule,'person-b'));
 const holiday={id:'h',name:'Feriado',date:'2026-11-02',scope:'nacional',annual:true,notes:'INTERNAL',reference:'INTERNAL'};
 const withHolidays=employeeSchedule({...schedule,holidays:[holiday,{...holiday,id:'other-location',scope:'municipal',state:'RN',city:'Mossoró'}]},id);
 assert.equal(withHolidays.holidays.length,1);assert.equal('notes' in withHolidays.holidays[0],false);assert.equal('reference' in withHolidays.holidays[0],false);assert.equal(scheduleForMonth(withHolidays,'2026-12').holidays.length,0);
 const store=createSeed();const personal=scheduleFromStore(store,store.employees[0].id);assert.equal(personal.shifts.every(s=>s.employeeId===personal.employee.id),true);assert.equal('employees' in personal,false);
 assert.equal(scheduleForMonth(data,'2026-11').shifts[0].date,'2026-10-31');assert.equal(scheduleForMonth(data,'2026-12').shifts.length,0);
});
test('employee cookies cannot become admin sessions, expire and reject signatures and future issuance',()=>{
 const now=Date.now(),token=createEmployeeSession({id,version:'version'},now);
 assert.equal(isEmployeeToken(token),true);assert.deepEqual(readEmployeeSession(token,now),{id,version:'version'});
 assert.equal(verifySession(token),false);assert.equal(readEmployeeSession(createSession()),null);
 assert.equal(readEmployeeSession(token+'x'),null);assert.equal(readEmployeeSession(token,now-1000),null);assert.equal(readEmployeeSession(token,now+8*3600*1000),null);
});
test('all access management requires an admin session and same-origin writes even in public mode',async()=>{
 process.env.ESCALA_REQUIRE_LOGIN='false';
 try{
  assert.equal((await getAccess(new Request('http://localhost/api/admin/employee-access?employeeId='+id))).status,401);
  assert.equal((await saveAccess(new Request('http://localhost/api/admin/employee-access',{method:'PUT',body:JSON.stringify(payload())}))).status,401);
  assert.equal((await save(payload(),'https://evil.example')).status,403);
  const token=createEmployeeSession({id,version:'v'});
  assert.equal((await saveAccess(own(token))).status,401);
  assert.equal((await validate(own(token))).status,403);
  assert.equal(proxy(new NextRequest('http://localhost/api/validate',{headers:{cookie:'escala_session='+token}})).status,403);
  assert.match(proxy(new NextRequest('http://localhost/',{headers:{cookie:'escala_session='+token}})).headers.get('location')!,/\/colaborador$/);
 }finally{configureTestAuth();}
});
test('creates access with hashed password, logs in, returns only own data regardless of query id',async()=>{
 assert.equal((await save(payload({password:'short'}))).status,400);
 const saved=await save(payload());assert.equal(saved.status,200);const stored=await database.db.query<{password_hash:string}>('select password_hash from public.escala_employee_access where employee_id=$1',[id]);assert.match(stored.rows[0].password_hash,/^scrypt\$/);assert.notEqual(stored.rows[0].password_hash,password);assert.equal((await saved.text()).includes('password'),false);
 const response=await login(new Request('http://localhost/api/auth/login',{method:'POST',headers:{origin:'http://localhost'},body:JSON.stringify({email,password})}));assert.equal(response.status,200);assert.deepEqual(await response.json(),{ok:true,redirectTo:'/colaborador'});
 assert.match(response.headers.get('set-cookie')!,/HttpOnly/);
 const identity=await authenticateEmployee(email.toUpperCase(),password);assert.ok(identity);
 const token=createEmployeeSession(identity!),result=await mySchedule(own(token,'month=2026-11&employeeId=person-b'));assert.equal(result.status,200);
 const text=await result.text();assert.equal(text.includes('DO NOT SEND'),false);assert.equal(text.includes('password_hash'),false);assert.equal(JSON.parse(text).employee.id,id);assert.equal(JSON.parse(text).shifts.length,1);assert.equal(result.headers.get('cache-control'),'private, no-store');
 assert.equal((await mySchedule(own(createSession()))).status,401);assert.equal((await mySchedule(own(token,'month=invalid'))).status,400);
});
test('publishing preserves sessions; password reset, email change and disable revoke previous sessions',async()=>{
 const first=(await authenticateEmployee(email,password))!,token=createEmployeeSession(first);
 assert.equal((await save(payload({password:''}))).status,200);assert.ok(await currentEmployee(token));
 const newPassword='changed-employee-password-2026';assert.equal((await save(payload({password:newPassword}))).status,200);
 assert.equal(await currentEmployee(token),null);assert.equal(await authenticateEmployee(email,password),null);
 const second=(await authenticateEmployee(email,newPassword))!;
 assert.equal((await save(payload({password:'',email:'changed@example.test'}))).status,200);assert.equal(await currentEmployee(createEmployeeSession(second)),null);
 const third=(await authenticateEmployee('changed@example.test',newPassword))!;
 assert.equal((await save(payload({password:'',email:'changed@example.test',enabled:false}))).status,200);
 assert.equal(await currentEmployee(createEmployeeSession(third)),null);assert.equal(await authenticateEmployee('changed@example.test',newPassword),null);
});
test('prevents duplicate emails and requires a password for new accounts',async()=>{
 const other={...schedule,employee:{...schedule.employee,id:'person-b'},shifts:[],dayOffs:[]};
 assert.equal((await save(payload({employeeId:'person-b',schedule:other,password:''}))).status,400);
 assert.equal((await save(payload({employeeId:'person-b',schedule:other,email:'changed@example.test'}))).status,409);
});
test('workspace isolation prevents an identically named account in another installation from being selected',async()=>{
 const previous=process.env.ESCALA_WORKSPACE_ID;
 process.env.ESCALA_WORKSPACE_ID='another-installation';
 try{assert.equal(await authenticateEmployee('changed@example.test',password),null);const response=await getAccess(authenticatedRequest('http://localhost/api/admin/employee-access?employeeId='+id));assert.equal((await response.json()).access,null);}finally{process.env.ESCALA_WORKSPACE_ID=previous;}
});
test('shared PostgreSQL limiter bounds 20 attempts per account across callers',async()=>{
 const outcomes=await Promise.all(Array.from({length:25},()=>database.db.query<{allowed:boolean}>('select public.escala_employee_login_allowed($1,$2) as allowed',['limiter-test','email-hash'])));
 assert.equal(outcomes.filter(result=>result.rows[0].allowed).length,20);
});
test('SQL permissions deny anon/authenticated access to credential tables and privileged RPCs',async()=>{
 await database.db.exec('set role service_role');
 try{assert.ok(await database.db.query('select employee_id from public.escala_employee_access'));}finally{await database.db.exec('reset role');}
 for(const role of ['anon','authenticated']){
  await database.db.exec(`set role ${role}`);
  try{await assert.rejects(database.db.query('select * from public.escala_employee_access'),/permission denied/);await assert.rejects(database.db.query("select public.escala_employee_login_allowed('x','y')"),/permission denied/);}finally{await database.db.exec('reset role');}
 }
});
test('missing backend configuration and outages fail closed without exposing secrets',async()=>{
 const previous=process.env.SUPABASE_SERVICE_ROLE_KEY;delete process.env.SUPABASE_SERVICE_ROLE_KEY;
 try{assert.equal(employeeAccessConfigured(),false);const result=await getAccess(authenticatedRequest('http://localhost/api/admin/employee-access?employeeId='+id));assert.deepEqual(await result.json(),{configured:false});assert.equal((await save(payload())).status,503);}finally{process.env.SUPABASE_SERVICE_ROLE_KEY=previous;}
 const identity=createEmployeeSession({id,version:'v'});const failure=mock.method(globalThis,'fetch',async()=>{throw new Error('SECRET URL');});
 try{const result=await mySchedule(own(identity));assert.equal(result.status,503);assert.equal((await result.text()).includes('SECRET'),false);}finally{failure.mock.restore();}
});
