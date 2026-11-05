import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeWorkSchedule, workScheduleProblems, workShiftTemplate, workScheduleLabel } from '../lib/work-schedule';
import { generateMonthlySchedule, generatorTemplate } from '../lib/schedule-generator';
import { defaultRules, validate } from '../lib/validation';
import { POST } from '../app/api/validate/route';
import { authenticatedRequest, configureTestAuth } from './auth-fixture';
import type { Employee, EmployeeWorkSchedule, Store } from '../lib/types';
configureTestAuth();
const employee=(workSchedule?:EmployeeWorkSchedule):Employee=>({id:'a',name:'Ana',role:'Técnica',team:'Campo',regime:'5x2',color:'blue',sundayEvery:2,workSchedule});
const store=(employees:Employee[]=[employee()]):Store=>({version:1,employees,shifts:[],dayOffs:[],swaps:[],rules:{...defaultRules,coverage:1}});
const request=(employees:Employee[],shifts:Store['shifts']=[])=>authenticatedRequest('http://localhost/api/validate',{method:'POST',body:JSON.stringify({employees,shifts,rules:defaultRules})});
test('supports absent preference, start-only and fixed hours while rejecting malformed data',()=>{
 assert.equal(normalizeWorkSchedule(undefined),undefined);assert.deepEqual(normalizeWorkSchedule({start:'09:30',unused:true}),{start:'09:30'});assert.deepEqual(normalizeWorkSchedule({start:'09:00',end:'18:00',breakMinutes:60}),{start:'09:00',end:'18:00',breakMinutes:60});
 for(const input of [null,[],{},'09:00',{start:'9:00'},{start:'24:00'},{start:'08:00',breakMinutes:60},{start:'08:00',end:'17:00'},{start:'08:00',end:'08:00',breakMinutes:60},{start:'08:00',end:'17:00',breakMinutes:15.5},{start:'08:00',end:'17:00',breakMinutes:-1}])assert.throws(()=>normalizeWorkSchedule(input));
});
test('individual entry takes priority and computed exit uses individual duration and interval',()=>{
 const person={...employee({start:'11:30'}),ruleOverrides:{dailyHours:6,weeklyHours:30}};
 const template=generatorTemplate(person,store([person]),'08:00');assert.equal(template.start,'11:30');assert.equal(template.end,'17:45');assert.equal(template.breakMinutes,15);assert.equal(template.source,'individual');
 assert.equal(generatorTemplate(employee(),store(),'07:00').start,'07:00');assert.equal(generatorTemplate(employee(),store(),'07:00').source,'generation');
});
test('fixed start, exit and lunch remain unchanged and still obey limits and weekly capacity',()=>{
 const fixed=employee({start:'09:00',end:'18:00',breakMinutes:60}),other={...employee({start:'12:00',end:'21:00',breakMinutes:60}),id:'b',name:'Bruno',regime:'6x1' as const};
 const data=store([fixed,other]);const result=generateMonthlySchedule(data,{month:'2026-12',start:'06:00',employeeIds:['a','b'],coverage:1,weekdays:[0,1,2,3,4,5,6],restOnHolidays:false,allocation:'balanced'});
 assert.ok(result.shifts.some(s=>s.employeeId==='a'));assert.ok(result.shifts.some(s=>s.employeeId==='b'));assert.ok(result.shifts.every(s=>s.start===(s.employeeId==='a'?'09:00':'12:00')&&s.end===(s.employeeId==='a'?'18:00':'21:00')&&s.breakMinutes===60));assert.equal(result.issues.some(i=>i.severity==='error'),false);
});
test('a fixed pattern exceeding daily/weekly limits or lacking its break is blocked even without shifts',async()=>{
 for(const pattern of [{start:'08:00',end:'18:00',breakMinutes:60},{start:'08:00',end:'16:00',breakMinutes:0},{start:'08:00',end:'09:00',breakMinutes:120}]){
  const person=employee(pattern);assert.ok(workScheduleProblems(person,defaultRules).length);assert.ok(validate([],[person],defaultRules).some(i=>i.code==='profile'&&i.severity==='error'));const response=await POST(request([person]));assert.equal(response.status,200);assert.equal((await response.json()).valid,false);
 }
 assert.ok(workScheduleProblems({...employee({start:'08:00',end:'12:00',breakMinutes:0}),ruleOverrides:{weeklyHours:2}},defaultRules).some(message=>message.includes('semanal')));
});
test('server rejects forged time fields and accepts legacy employees and independent preferences',async()=>{
 for(const malformed of [{start:'not-a-time'},{start:'08:00',end:'17:00',breakMinutes:'60'},{start:'08:00',end:'17:00',breakMinutes:121}]){assert.equal((await POST(request([employee(malformed as EmployeeWorkSchedule)]))).status,400);}
 const person=employee({start:'09:00',end:'18:00',breakMinutes:60});const actual={id:'manual',employeeId:'a',date:'2026-12-01',start:'08:00',end:'17:00',breakMinutes:60};const response=await POST(request([person],[actual]));assert.equal((await response.json()).valid,true);assert.equal((await POST(request([employee()]))).status,200);
});
test('overnight habits can prefill manual shifts, while generator refuses to silently change them',()=>{
 const person=employee({start:'22:00',end:'07:00',breakMinutes:60});assert.deepEqual(workScheduleProblems(person,defaultRules),[]);assert.equal(workShiftTemplate(person,defaultRules).end,'07:00');assert.equal(workShiftTemplate(person,defaultRules).endsAfterMidnight,true);assert.throws(()=>generatorTemplate(person,store([person]),'08:00'),/ultrapassa meia-noite/);
 const midnight=employee({start:'15:00',end:'00:00',breakMinutes:60});assert.equal(generatorTemplate(midnight,store([midnight]),'08:00').end,'00:00');assert.match(workScheduleLabel(person.workSchedule),/\+1 dia/);
});
test('personal entry changes intershift eligibility at the month boundary without modifying existing work',()=>{
 const person=employee({start:'09:00'}),data=store([person]);data.shifts=[{id:'fixed',employeeId:'a',date:'2026-11-30',start:'13:00',end:'22:00',breakMinutes:60}];
 const before=structuredClone(data);const result=generateMonthlySchedule(data,{month:'2026-12',start:'08:00',employeeIds:['a'],coverage:1,weekdays:[0,1,2,3,4,5,6],restOnHolidays:false,allocation:'coverage'});assert.equal(result.shifts.find(s=>s.date==='2026-12-01')?.start,'09:00');assert.deepEqual(data,before);
});
