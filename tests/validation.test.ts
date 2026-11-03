import test from 'node:test';
import { authenticatedRequest, configureTestAuth } from './auth-fixture';
configureTestAuth();
import assert from 'node:assert/strict';
import { defaultRules, interval, validate } from '../lib/validation';
import { createSeed } from '../lib/seed';
import { addDays } from '../lib/dates';
import { POST } from '../app/api/validate/route';
import type { Employee, Shift } from '../lib/types';
const employee: Employee={id:'a',name:'Ana',role:'Técnica',team:'Campo',regime:'5x2',color:'purple',sundayEvery:2};
function shift(date:string,start='08:00',end='17:00',breakMinutes=60,id=date):Shift{return {id,employeeId:'a',date,start,end,breakMinutes};}
const codes=(shifts:Shift[])=>validate(shifts,[employee],defaultRules).filter(i=>i.severity==='error').map(i=>i.code);
test('seed schedule has no blocking conflicts',()=>{const s=createSeed();assert.deepEqual(validate(s.shifts,s.employees,s.rules).filter(i=>i.severity==='error'),[]);});
test('computes overnight paid duration and deducts the break',()=>assert.equal(interval(shift('2026-11-02','22:00','07:00')).hours,8));
test('blocks less than 11h between shifts across midnight',()=>assert.ok(codes([shift('2026-11-02','13:00','22:00'),shift('2026-11-03')]).includes('intershift')));
test('allows exactly 11h of rest',()=>assert.ok(!codes([shift('2026-11-02','13:00','22:00'),shift('2026-11-03','09:00','18:00')]).includes('intershift')));
test('blocks overlapping overnight shifts',()=>assert.ok(codes([shift('2026-11-02','22:00','07:00'),shift('2026-11-03','06:00','15:00')]).includes('overlap')));
test('blocks >8 working hours per day',()=>assert.ok(codes([shift('2026-11-02','08:00','18:00')]).includes('daily')));
test('aggregates split shifts on the same date',()=>assert.ok(codes([shift('2026-11-02','00:00','05:00',15,'a'),shift('2026-11-02','16:00','21:00',15,'b')]).includes('daily')));
test('validates meal breaks at exact thresholds',()=>{assert.ok(!codes([shift('2026-11-02','08:00','12:00',0)]).includes('break'));assert.ok(codes([shift('2026-11-02','08:00','14:00',0)]).includes('break'));assert.ok(!codes([shift('2026-11-02','08:00','14:15',15)]).includes('break'));assert.ok(codes([shift('2026-11-02','08:00','16:00',30)]).includes('break'));});
test('blocks weekly limit of 44h',()=>assert.ok(codes(Array.from({length:6},(_,i)=>shift(addDays('2026-11-02',i)))).includes('weekly')));
test('blocks the seventh consecutive day even across a week boundary',()=>assert.ok(codes(Array.from({length:7},(_,i)=>shift(addDays('2026-11-05',i),'08:00','12:00',0))).includes('consecutive')));
test('a complete weekly rest resets a 6x1 duty streak',()=>assert.ok(!validate([0,1,2,3,4,5,7].map(i=>shift(addDays('2026-11-02',i),'08:00','12:00',0)),[{...employee,regime:'6x1'}],defaultRules).some(i=>i.code==='consecutive')));
test('blocks less than 35h combined rest after six 6x1 duties',()=>assert.ok(validate([...Array.from({length:6},(_,i)=>shift(addDays('2026-11-02',i),'18:00','23:00',15)),shift('2026-11-09','08:00','12:00',0)],[{...employee,regime:'6x1'}],defaultRules).some(i=>i.code==='weekly-rest'&&i.severity==='error')));
test('enforces the employee Sunday rotation',()=>assert.ok(codes([shift('2026-11-01','08:00','12:00',0),shift('2026-11-08','08:00','12:00',0)]).includes('sunday')));
test('does not mix different employees when validating rest',()=>{const other={...employee,id:'b'};const shifts=[shift('2026-11-02','13:00','22:00'),{...shift('2026-11-03'),employeeId:'b'}];assert.deepEqual(validate(shifts,[employee,other],defaultRules).filter(i=>i.severity==='error'),[]);});
test('rejects invalid or negative duration after breaks',()=>assert.ok(codes([shift('2026-11-02','08:00','09:00',90)]).includes('invalid')));
test('API validates a valid schedule and rejects a conflicting one',async()=>{const request=(shifts:Shift[])=>authenticatedRequest('http://localhost/api/validate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({shifts,employees:[employee],rules:defaultRules})});let response=await POST(request([shift('2026-11-02')]));assert.equal(response.status,200);assert.equal((await response.json()).valid,true);response=await POST(request([shift('2026-11-02','08:00','18:00')]));assert.equal((await response.json()).valid,false);});
test('API rejects invalid dates, unknown employees and unsafe rule values',async()=>{for(const override of [{shifts:[shift('2026-02-30')]},{shifts:[{...shift('2026-11-02'),employeeId:'missing'}]},{rules:{...defaultRules,intershiftHours:0}},{rules:{dailyHours:8}}]){const response=await POST(authenticatedRequest('http://localhost/api/validate',{method:'POST',body:JSON.stringify({shifts:[shift('2026-11-02')],employees:[employee],rules:defaultRules,...override})}));assert.equal(response.status,400);}});

test('validation API denies anonymous calls',async()=>{const response=await POST(new Request('http://localhost/api/validate',{method:'POST',body:'{}'}));assert.equal(response.status,401);});

test('six night duties in a 6x1 profile are not counted as seven duties',()=>{const shifts=Array.from({length:6},(_,i)=>shift(addDays('2026-11-02',i),'22:00','06:00'));const issues=validate(shifts,[{...employee,regime:'6x1'}],{...defaultRules,weeklyHours:44});assert.ok(!issues.some(i=>i.code==='consecutive'));});
test('5x2 blocks a sixth period without complete weekly rest',()=>assert.ok(codes(Array.from({length:6},(_,i)=>shift(addDays('2026-11-02',i),'08:00','12:00',0))).includes('consecutive')));
test('an additional short day off is not automatically treated as a failed DSR',()=>assert.ok(!codes([shift('2026-11-02','18:00','23:00',15),shift('2026-11-04','08:00','12:00',0)]).includes('weekly-rest')));
test('individual daily limits apply to that collaborator only',()=>{const other={...employee,id:'b'};const shifts=[shift('2026-11-02'),{...shift('2026-11-02'),id:'b-shift',employeeId:'b'}];const issues=validate(shifts,[{...employee,ruleOverrides:{dailyHours:6}},other],defaultRules);assert.ok(issues.some(i=>i.employeeId==='a'&&i.code==='daily'));assert.ok(!issues.some(i=>i.employeeId==='b'&&i.severity==='error'));});
test('individual weekly limits and general defaults coexist',()=>{const shifts=Array.from({length:5},(_,i)=>shift(addDays('2026-11-02',i)));assert.ok(validate(shifts,[{...employee,ruleOverrides:{weeklyHours:36}}],defaultRules).some(i=>i.code==='weekly'));assert.ok(!validate(shifts,[employee],defaultRules).some(i=>i.code==='weekly'));});
test('exceptions require an agreement reference and cannot reduce intershift below 11h',()=>{assert.ok(validate([shift('2026-11-02')],[{...employee,ruleOverrides:{dailyHours:9}}],defaultRules).some(i=>i.code==='profile'));assert.ok(!validate([shift('2026-11-02')],[{...employee,ruleOverrides:{dailyHours:9},agreementReference:'Referência de teste, sem validade jurídica'}],defaultRules).some(i=>i.code==='profile'));assert.ok(validate([shift('2026-11-02')],[{...employee,ruleOverrides:{intershiftHours:8}}],defaultRules).some(i=>i.code==='profile'));});
test('cross-week night shifts and partial history remain explicit limitations',()=>{const issues=validate([shift('2026-11-08','22:00','07:00')],[employee],defaultRules);assert.ok(issues.some(i=>i.code==='cross-week'&&i.severity==='warning'));assert.ok(issues.some(i=>i.code==='night-pay'));assert.ok(issues.some(i=>i.code==='history'));});

test('fractional day counts and break minutes are not valid rule profiles',()=>{for(const ruleOverrides of [{maxConsecutiveDays:5.5},{longBreakMinutes:30.5}])assert.ok(validate([shift('2026-11-02')],[{...employee,ruleOverrides}],defaultRules).some(i=>i.code==='profile'));});

test('unsupported Sunday rotation is rejected rather than silently accepted',async()=>{const response=await POST(authenticatedRequest('http://localhost/api/validate',{method:'POST',body:JSON.stringify({shifts:[shift('2026-11-02')],employees:[{...employee,sundayEvery:4}],rules:defaultRules})}));assert.equal(response.status,400);});
