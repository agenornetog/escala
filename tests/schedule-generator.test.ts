import test from 'node:test';
import assert from 'node:assert/strict';
import { generateMonthlySchedule, generatorTemplate, type GeneratorOptions } from '../lib/schedule-generator';
import { addDays, monthDays, monday } from '../lib/dates';
import { defaultRules, validate } from '../lib/validation';
import { interval, shiftTouchesDate } from '../lib/shift-time';
import { createSeed } from '../lib/seed';
import type { Employee, Shift, Store } from '../lib/types';
const employee=(id='a',extra:Partial<Employee>={}):Employee=>({id,name:`Pessoa ${id}`,role:'Técnica',team:'Campo',regime:'5x2',color:'blue',sundayEvery:2,...extra});
const workspace=(employees=[employee()]):Store=>({version:1,employees,shifts:[],dayOffs:[],swaps:[],rules:{...defaultRules,coverage:1}});
const options=(store:Store,extra:Partial<GeneratorOptions>={}):GeneratorOptions=>({month:'2026-11',start:'08:00',employeeIds:store.employees.map(e=>e.id),coverage:store.rules.coverage,weekdays:[0,1,2,3,4,5,6],restOnHolidays:false,allocation:'balanced',...extra});
const shift=(date:string,start='08:00',end='17:00'):Shift=>({id:'fixed-'+date,employeeId:'a',date,start,end,breakMinutes:60});
function assertValid(store:Store,result:ReturnType<typeof generateMonthlySchedule>){assert.deepEqual(validate([...store.shifts,...result.shifts],store.employees,store.rules,[...store.dayOffs??[],...result.dayOffs]).filter(i=>i.severity==='error'),[]);}
test('generates an entire month with individual profiles, real breaks and no blocking conflicts',()=>{
 const store=workspace([employee(),employee('b',{ruleOverrides:{dailyHours:6,weeklyHours:30}}),employee('c',{regime:'6x1',sundayEvery:3})]);
 const before=JSON.stringify(store),result=generateMonthlySchedule(store,options(store));
 assert.equal(JSON.stringify(store),before);assertValid(store,result);assert.equal(result.daily.length,30);assert.ok(result.shifts.length>45);
 assert.ok(result.shifts.filter(s=>s.employeeId==='b').every(s=>interval(s).hours<=6&&s.breakMinutes===15));
 assert.ok(result.shifts.filter(s=>s.employeeId==='a').every(s=>interval(s).hours===8&&s.breakMinutes===60));
 assert.ok(result.shifts.filter(s=>s.employeeId==='c').every(s=>s.end==='16:20'&&s.breakMinutes===60));
 for(const person of store.employees)for(const date of monthDays('2026-11'))assert.equal(result.shifts.some(s=>s.employeeId===person.id&&shiftTouchesDate(s,date))||result.dayOffs.some(d=>d.employeeId===person.id&&d.date===date),true);
 assert.deepEqual(generateMonthlySchedule(store,options(store)),result);
});
test('5x2 has at most five worked dates per rolling seven-day window, 6x1 at most six',()=>{
 const store=workspace([employee(),employee('b',{regime:'6x1',sundayEvery:3})]);const result=generateMonthlySchedule(store,options(store));
 for(const person of store.employees)for(const first of monthDays('2026-11')){const worked=new Set(result.shifts.filter(s=>s.employeeId===person.id).map(s=>s.date));assert.ok(Array.from({length:7},(_,i)=>addDays(first,i)).filter(d=>worked.has(d)).length<=(person.regime==='5x2'?5:6));}
 assertValid(store,result);
});
test('company configuration and agreement-backed daily limits determine personal templates',()=>{
 const store=workspace([employee(),employee('b',{ruleOverrides:{dailyHours:8.8,weeklyHours:44,longBreakMinutes:30},agreementReference:'Acordo de teste'})]);
 store.rules.dailyHours=7;store.rules.weeklyHours=35;
 assert.equal(generatorTemplate(store.employees[0],store,'08:00').end,'16:00');
 const own=generatorTemplate(store.employees[1],store,'08:00');assert.equal(own.paidMinutes,528);assert.equal(own.end,'17:18');assert.equal(own.breakMinutes,30);
 for(const [weekly,expected] of [[20,0],[30,15],[40,60]]){const person=employee('tiny',{ruleOverrides:{weeklyHours:weekly}});assert.equal(generatorTemplate(person,store,'08:00').breakMinutes,expected);}
});
test('preserves all existing shifts, confirmed folgas, swaps and employees outside the selection',()=>{
 const store=workspace([employee(),employee('b')]);store.shifts=[shift('2026-11-02'),{...shift('2026-11-03'),id:'b-fixed',employeeId:'b'}];store.dayOffs=[{id:'fixed-off',employeeId:'a',date:'2026-11-04'}];store.swaps=[{id:'swap',fromShiftId:store.shifts[0].id,toShiftId:'b-fixed',status:'pending',createdAt:'2026-11-01T12:00:00Z'}];
 const original=structuredClone(store);const result=generateMonthlySchedule(store,options(store,{employeeIds:['a']}));assert.deepEqual(store,original);assert.ok(result.shifts.every(s=>s.employeeId==='a'&&s.date!=='2026-11-02'&&s.date!=='2026-11-04'));assert.ok(result.dayOffs.every(d=>d.employeeId==='a'&&d.date!=='2026-11-04'));assertValid(store,result);
});
test('uses previous and next month for weekly limits, intershift rest and Sunday rotation',()=>{
 const store=workspace();store.shifts=[shift('2026-10-31','14:00','23:00'),shift('2026-12-01','03:00','12:00')];const result=generateMonthlySchedule(store,options(store));
 assert.equal(result.shifts.some(s=>s.date==='2026-11-01'),false);assert.equal(result.shifts.some(s=>s.date==='2026-11-30'),false);assertValid(store,result);
 const other=workspace();other.shifts=[shift('2026-10-25'),shift('2026-12-06')];const next=generateMonthlySchedule(other,options(other));assert.equal(next.shifts.some(s=>s.date==='2026-11-01'||s.date==='2026-11-29'),false);assertValid(other,next);
});
test('does not create folgas on a previous-month overnight continuation and counts its presence',()=>{
 const store=workspace();store.shifts=[shift('2026-10-31','22:00','06:00')];const result=generateMonthlySchedule(store,options(store));assert.equal(result.dayOffs.some(d=>d.date==='2026-11-01'),false);assert.equal(result.shifts.some(s=>s.date==='2026-11-01'),false);assert.equal(result.daily[0].scheduled,1);assertValid(store,result);
});
test('honors operation weekdays and holiday locality only for newly generated shifts',()=>{
 const store=workspace([employee(),employee('b')]);store.workspaceLocation={state:'RN',city:'Mossoró'};store.holidays=[{id:'h',name:'Feriado cadastrado',date:'2020-11-10',scope:'nacional',annual:true},{id:'other',name:'Outro município',date:'2026-11-11',scope:'municipal',state:'SP',city:'São Paulo',annual:false}];store.shifts=[shift('2026-11-10')];
 const result=generateMonthlySchedule(store,options(store,{weekdays:[1,2,3,4,5],restOnHolidays:true}));assert.ok(result.shifts.every(s=>![0,6].includes(new Date(s.date+'T12:00Z').getUTCDay())&&s.date!=='2026-11-10'));assert.equal(result.daily.find(d=>d.date==='2026-11-10')?.required,0);assert.equal(result.daily.find(d=>d.date==='2026-11-11')?.required,1);assertValid(store,result);
});
test('returns honest daily coverage deficits without relaxing limits and coverage-only avoids overstaffing',()=>{
 const store=workspace([employee(),employee('b')]);const result=generateMonthlySchedule(store,options(store,{coverage:3,allocation:'coverage'}));assert.ok(result.missing>=30);assert.equal(result.missing,result.daily.reduce((n,d)=>n+d.missing,0));assert.ok(result.daily.every(d=>d.scheduled<=2));assertValid(store,result);
 const pool=workspace(Array.from({length:8},(_,i)=>employee(String(i))));const minimum=generateMonthlySchedule(pool,options(pool,{coverage:3,allocation:'coverage'}));assert.equal(minimum.missing,0);assert.ok(minimum.daily.every(d=>d.scheduled===3));assertValid(pool,minimum);const balanced=generateMonthlySchedule(pool,options(pool,{coverage:3,allocation:'balanced'}));assert.equal(balanced.missing,0);assert.ok(balanced.shifts.length>minimum.shifts.length);assertValid(pool,balanced);
});
test('does not reset individual limits at the first day of the month and respects long weekly rest',()=>{
 const store=workspace([employee('a',{regime:'6x1',ruleOverrides:{dailyHours:6,weeklyHours:18,intershiftHours:16,weeklyRestHours:48,maxConsecutiveDays:2}})]);
 store.shifts=[{...shift('2026-10-30','08:00','11:00'),breakMinutes:0},{...shift('2026-10-31','08:00','11:00'),breakMinutes:0}];
 const result=generateMonthlySchedule(store,options(store));assert.equal(result.shifts.some(s=>s.date==='2026-11-01'),false);assertValid(store,result);
 for(const week of new Set(result.shifts.map(s=>monday(s.date))))assert.ok(result.shifts.filter(s=>monday(s.date)===week).reduce((n,s)=>n+interval(s).hours,0)<=18);
});
test('supports leap-year calendars, unique identifiers and idempotent completion',()=>{
 const store=workspace();store.dayOffs=[{id:'auto-turno-2028-02-0',employeeId:'a',date:'2028-02-01'}];const result=generateMonthlySchedule(store,options(store,{month:'2028-02'}));assert.equal(result.daily.length,29);assert.equal(new Set([...store.dayOffs,...result.shifts,...result.dayOffs].map(s=>s.id)).size,store.dayOffs.length+result.shifts.length+result.dayOffs.length);
 const next={...store,shifts:result.shifts,dayOffs:[...store.dayOffs,...result.dayOffs]};const again=generateMonthlySchedule(next,options(next,{month:'2028-02'}));assert.equal(again.shifts.length,0);assert.equal(again.dayOffs.length,0);
});
test('refuses invalid options, existing conflicts and unsupported late start without mutation',()=>{
 const store=workspace();for(const extra of [{month:'2026-13'},{employeeIds:[]},{employeeIds:['a','a']},{employeeIds:['missing']},{weekdays:[]},{weekdays:[7]},{start:'25:00'},{start:'22:00'},{coverage:0},{coverage:1.5}])assert.throws(()=>generateMonthlySchedule(store,options(store,extra)));
 store.employees[0].ruleOverrides={dailyHours:9};assert.throws(()=>generateMonthlySchedule(store,options(store)),/acordo|instrumento/);delete store.employees[0].ruleOverrides;
 store.shifts=[shift('2026-11-01','08:00','18:00')];const before=JSON.stringify(store);assert.throws(()=>generateMonthlySchedule(store,options(store)),/conflitos existentes/);assert.equal(JSON.stringify(store),before);
});
test('works with the existing mixed-regime demonstration and its preserved planning',()=>{const store=createSeed();const month=store.shifts[0].date.slice(0,7);const result=generateMonthlySchedule(store,options(store,{month,coverage:store.rules.coverage}));assertValid(store,result);assert.ok(result.shifts.length>0);});
