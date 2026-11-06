import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAbsence, normalizeAbsences, normalizeInstrument, normalizeLabor, employeeWithInstrument, absenceOverlaps } from '../lib/labor-rules';
import { assessLabor } from '../lib/labor-assessment';
import { defaultRules, validate } from '../lib/validation';
import { generateMonthlySchedule } from '../lib/schedule-generator';
import { buildMonthlyReport, dayPlan } from '../lib/monthly-report';
import { createMonthlyPdf } from '../lib/monthly-pdf';
import { employeeSchedule, scheduleFromStore, scheduleForMonth } from '../lib/employee-schedule';
import { POST } from '../app/api/validate/route';
import { authenticatedRequest, configureTestAuth } from './auth-fixture';
import type { Employee, LaborInstrument, Shift, Store } from '../lib/types';
configureTestAuth();
const person:Employee={id:'a',name:'Pessoa de teste',role:'Técnica',team:'Campo',regime:'5x2',color:'blue',sundayEvery:3};
const instrument:LaborInstrument={id:'cct',kind:'CCT',name:'Instrumento fictício',unionName:'Sindicato fictício de teste',reference:'REFERÊNCIA SEM VALIDADE JURÍDICA',category:'Técnicos',state:'RN',city:'Mossoró',startsOn:'2026-01-01',endsOn:'2026-12-31',sourceUrl:'https://example.test/cct',clauseReference:'Cláusulas fictícias para testes',reviewedBy:'Responsável fictício',reviewedOn:'2026-01-02',limits:{dailyHours:6,weeklyHours:30,intershiftHours:12,weeklyRestHours:36,maxConsecutiveDays:5,longBreakMinutes:60},sundayEvery:2,holidayWork:'prohibited'};
const store=():Store=>({version:1,employees:[{...person,laborCondition:'general',sundayReference:'Fundamento de teste'}],rules:{...defaultRules,coverage:1},shifts:[],swaps:[],dayOffs:[],workspaceLocation:{state:'RN',city:'Mossoró'},labor:{activity:'Serviços de teste',category:'Técnicos',defaultInstrumentId:'cct',instruments:[structuredClone(instrument)]}});
const shift=(date:string,start='08:00',end='17:00',breakMinutes=60):Shift=>({id:'s-'+date,employeeId:'a',date,start,end,breakMinutes});
const api=(data:Store,reviewMonth?:string)=>POST(authenticatedRequest('http://localhost/api/validate',{method:'POST',body:JSON.stringify({...data,reviewMonth})}));
test('instrument registry validates identity, scope, validity, clauses and safe source links',()=>{
 assert.equal(normalizeInstrument(instrument).unionName,instrument.unionName);
 for(const patch of [{unionName:''},{state:'XX'},{endsOn:'2025-01-01'},{startsOn:'2026-02-30'},{sourceUrl:'javascript:alert(1)'},{sourceUrl:'https://user:pass@example.test'},{reviewedBy:''},{limits:{weeklyHours:50}},{clauseReference:''},{sundayEvery:4}])assert.throws(()=>normalizeInstrument({...instrument,...patch}));
 assert.throws(()=>normalizeLabor({activity:'',category:'',defaultInstrumentId:'missing',instruments:[instrument]}));assert.throws(()=>normalizeLabor({instruments:[instrument,instrument]}));assert.equal(normalizeLabor(undefined),undefined);
});
test('absence registry rejects malformed, unknown, duplicate and overlapping periods without retaining medical notes',()=>{
 const value={id:'off',employeeId:'a',kind:'ferias',startsOn:'2026-12-01',endsOn:'2026-12-10',diagnosis:'DO NOT RETAIN'};
 assert.equal('diagnosis' in normalizeAbsence(value),false);
 for(const patch of [{endsOn:'2026-11-30'},{kind:'unknown'},{startsOn:'2026-02-30'}])assert.throws(()=>normalizeAbsence({...value,...patch}));
 assert.throws(()=>normalizeAbsences([value,value]));assert.throws(()=>normalizeAbsences([value],new Set(['b'])));assert.throws(()=>normalizeAbsences([value,{...value,id:'other',startsOn:'2026-12-10',endsOn:'2026-12-20'}]));
 assert.equal(normalizeAbsences([value,{...value,id:'next',startsOn:'2026-12-11',endsOn:'2026-12-20'}]).length,2);
});
test('collective constraints tighten individual profiles and cannot silently relax them',()=>{
 const data=store();assert.equal(employeeWithInstrument(person,data.rules,data).ruleOverrides?.dailyHours,6);assert.equal(employeeWithInstrument(person,data.rules,data).sundayEvery,2);
 data.labor!.instruments[0].limits={dailyHours:10,intershiftHours:11,longBreakMinutes:30};const effective=employeeWithInstrument({...person,ruleOverrides:{dailyHours:4,intershiftHours:14,longBreakMinutes:90}},data.rules,data);assert.equal(effective.ruleOverrides?.dailyHours,4);assert.equal(effective.ruleOverrides?.intershiftHours,14);assert.equal(effective.ruleOverrides?.longBreakMinutes,90);assert.equal(employeeWithInstrument(person,data.rules,data,'2027-01-01'),person);
});
test('collective daily, weekly and intershift rules are enforced by the server',async()=>{
 const data=store();data.shifts=[shift('2026-12-01')];let response=await api(data);assert.equal(response.status,200);assert.ok((await response.json()).issues.some((i:{code:string})=>i.code==='cct-daily'));
 data.labor!.instruments[0].limits={weeklyHours:36,intershiftHours:12};data.shifts=[1,2,3,4,5].map(day=>shift(`2026-12-${String(day).padStart(2,'0')}`));response=await api(data);assert.ok((await response.json()).issues.some((i:{code:string})=>i.code==='cct-weekly'));
 data.shifts=[shift('2026-12-01','13:00','22:00'),shift('2026-12-02','09:00','18:00')];assert.ok(validate(data.shifts,data.employees,data.rules,[],data).some(i=>i.code==='cct-intershift'));
});
test('collective breaks, combined rest and Sunday rotation cannot be bypassed by legacy personal limits',()=>{
 const data=store();data.labor!.instruments[0].limits={longBreakMinutes:90,weeklyRestHours:48,maxConsecutiveDays:2};data.shifts=[shift('2026-12-01')];assert.ok(validate(data.shifts,data.employees,data.rules,[],data).some(i=>i.code==='cct-break'));
 data.shifts=[shift('2026-12-01','08:00','12:00',0),shift('2026-12-02','08:00','12:00',0),shift('2026-12-04','08:00','12:00',0)];assert.ok(validate(data.shifts,data.employees,data.rules,[],data).some(i=>i.code==='cct-weekly-rest'));
 data.shifts=[shift('2026-12-06','08:00','12:00',0),shift('2026-12-13','08:00','12:00',0)];assert.ok(validate(data.shifts,data.employees,data.rules,[],data).some(i=>i.code==='cct-sunday'));
});
test('absence dates are inclusive, cover overnight continuations and exclude an exact midnight ending',async()=>{
 const data=store();data.absences=[{id:'vacation',employeeId:'a',kind:'ferias',startsOn:'2026-12-01',endsOn:'2026-12-05'}];const night=shift('2026-11-30','22:00','06:00');assert.equal(absenceOverlaps(night,data.absences[0]),true);assert.equal(absenceOverlaps({...night,end:'00:00'},data.absences[0]),false);
 data.shifts=[night];const response=await api(data);assert.ok((await response.json()).issues.some((i:{code:string})=>i.code==='absence'));assert.equal(absenceOverlaps({...night,employeeId:'b'},data.absences[0]),false);
});
test('holiday prohibitions include actual locality and a night continuation on the first day of validity',()=>{
 const data=store();data.labor!.instruments[0].startsOn='2026-12-01';data.labor!.instruments[0].limits=undefined;data.holidays=[{id:'h',name:'Feriado fictício',date:'2026-12-01',scope:'municipal',state:'RN',city:'Mossoró',annual:false}];data.shifts=[shift('2026-11-30','22:00','06:00')];assert.ok(validate(data.shifts,data.employees,data.rules,[],data).some(i=>i.code==='holiday-work'));
 data.holidays[0].city='Natal';assert.equal(validate(data.shifts,data.employees,data.rules,[],data).some(i=>i.code==='holiday-work'),false);
});
test('generator respects collective duration, confirmed absences and does not mislabel vacation as folga',()=>{
 const data=store();data.absences=[{id:'v',employeeId:'a',kind:'ferias',startsOn:'2026-12-01',endsOn:'2026-12-10'}];const result=generateMonthlySchedule(data,{month:'2026-12',start:'08:00',employeeIds:['a'],coverage:1,weekdays:[0,1,2,3,4,5,6],restOnHolidays:false,allocation:'balanced'});
 assert.ok(result.shifts.length>0);assert.ok(result.shifts.every(s=>s.date>'2026-12-10'&&s.end==='14:15'&&s.breakMinutes===15));assert.ok(result.dayOffs.every(o=>o.date>'2026-12-10'));assert.equal(result.issues.some(i=>i.severity==='error'),false);assert.ok(result.laborReview.pending>0);
 data.employees[0].laborCondition='special';assert.throws(()=>generateMonthlySchedule(data,result.options),/especial/);
});
test('review reports missing, expired, mismatched or unreviewed CCTs and never fabricates certification',()=>{
 const data=store();assert.equal(assessLabor(data,'2026-12').certified,false);assert.ok(assessLabor(data,'2026-12').checks.some(c=>c.id==='history'&&c.status==='pending'));assert.ok(assessLabor(data,'2026-12').checks.some(c=>c.id==='calendar'&&c.status==='pending'));
 data.labor!.instruments[0].endsOn='2026-11-30';assert.ok(assessLabor(data,'2026-12').blocked>0);data.labor!.instruments[0].endsOn='2026-12-31';data.workspaceLocation!.city='Natal';assert.ok(assessLabor(data,'2026-12').checks.some(c=>c.title.includes('abrangência')&&c.status==='blocked'));
 data.workspaceLocation!.city='Mossoró';data.labor!.instruments[0].reviewedBy=undefined;assert.ok(assessLabor(data,'2026-12').checks.some(c=>c.title.includes('conferência')&&c.status==='pending'));delete data.labor;assert.ok(assessLabor(data,'2026-12').checks.some(c=>c.title.includes('CCT/ACT')&&c.status==='pending'));
});
test('review explicitly retains limitations for night work, vacation entitlement and pay/compensation',()=>{
 const data=store();data.shifts=[shift('2026-12-06','22:00','07:00')];data.absences=[{id:'v',employeeId:'a',kind:'ferias',startsOn:'2026-12-10',endsOn:'2026-12-20'}];const result=assessLabor(data,'2026-12');for(const id of ['night','week-split','vacation','scope'])assert.ok(result.checks.some(c=>c.id===id&&c.status==='pending'));
});
test('API returns a server-computed monthly assessment and rejects invalid context and orphan links',async()=>{
 const data=store();let response=await api(data,'2026-12');assert.equal(response.status,200);assert.equal((await response.json()).assessment.certified,false);
 assert.equal((await api(data,'invalid')).status,400);data.employees[0].laborInstrumentId='missing';assert.equal((await api(data)).status,400);data.employees[0].laborInstrumentId=undefined;data.absences=[{id:'x',employeeId:'unknown',kind:'licenca',startsOn:'2026-12-01',endsOn:'2026-12-02'}];assert.equal((await api(data)).status,400);
});
test('monthly matrix, daily list and collaborator snapshot distinguish own absences and protect foreign data',()=>{
 const data=store();data.absences=[{id:'v',employeeId:'a',kind:'ferias',startsOn:'2026-12-01',endsOn:'2026-12-05'}];assert.equal(dayPlan('a','2026-12-01',[],[],data.absences).status,'absent');const report=buildMonthlyReport(data,{month:'2026-12'});assert.equal(report.totals.absent,5);assert.equal(report.totals.off,0);assert.equal(report.daily[0].absent[0].absence.kind,'ferias');assert.ok(createMonthlyPdf(report).getNumberOfPages()>0);
 const own=scheduleFromStore(data,'a');assert.equal(own.absences!.length,1);assert.throws(()=>employeeSchedule({...own,shifts:[shift('2026-12-01')]},'a'),/ausência/);assert.equal('labor' in own,false);assert.equal('laborCondition' in own.employee,false);assert.equal(scheduleForMonth(own,'2027-01').absences!.length,0);assert.throws(()=>employeeSchedule({...own,absences:[{...data.absences![0],employeeId:'b'}]},'a'));
});
