import { addDays, monthDays, weekday } from './dates';
import { holidaysOnDate } from './holidays';
import { profileFor, profileProblems } from './rule-profile';
import { interval, shiftTouchesDate } from './shift-time';
import { validate } from './validation';
import type { DayOff, Employee, Issue, Shift, Store } from './types';

export type GeneratorOptions={month:string;start:string;employeeIds:string[];coverage:number;weekdays:number[];restOnHolidays:boolean;allocation:'balanced'|'coverage'};
export type GenerationDay={date:string;required:number;scheduled:number;missing:number;reasons:string[]};
export type GenerationEmployee={id:string;name:string;regime:string;dailyLimit:number;weeklyLimit:number;start:string;end:string;breakMinutes:number;paidMinutes:number;newDays:number;totalDays:number;totalHours:number};
export type GenerationResult={options:GeneratorOptions;shifts:Shift[];dayOffs:DayOff[];daily:GenerationDay[];employees:GenerationEmployee[];issues:Issue[];missing:number};
export class GenerationError extends Error {}
const time=(minutes:number)=>`${String(Math.floor(minutes/60)%24).padStart(2,'0')}:${String(minutes%60).padStart(2,'0')}`;
const maximum=(employee:Employee)=>employee.regime==='5x2'?5:6;
export function generatorTemplate(employee:Employee,store:Store,start:string){
 const profile=profileFor(employee,store.rules),problems=profileProblems(profile);
 if(problems.length)throw new GenerationError(`${employee.name}: ${problems.join(' ')}`);
 const paidMinutes=Math.min(Math.floor(profile.dailyHours*60),Math.floor(profile.weeklyHours*60/maximum(employee)));
 const breakMinutes=paidMinutes>360?profile.longBreakMinutes:paidMinutes>240?15:0;
 const [h,m]=start.split(':').map(Number),endMinutes=h*60+m+paidMinutes+breakMinutes;
 if(paidMinutes<1||endMinutes>1440)throw new GenerationError(`${employee.name}: a jornada calculada ultrapassa meia-noite. Escolha uma entrada mais cedo. O gerador cria turnos no mesmo dia, com término até 00:00; turnos noturnos existentes são preservados.`);
 return {start,end:time(endMinutes),breakMinutes,paidMinutes,dailyLimit:profile.dailyHours,weeklyLimit:profile.weeklyHours};
}
function workedDates(shifts:Shift[]){
 const dates=new Set<string>();
 for(const shift of shifts){dates.add(shift.date);if(shift.end<=shift.start&&shift.end!=='00:00')dates.add(addDays(shift.date,1));}
 return dates;
}
// More conservative than a maximum streak: preserves two/one full calendar
// days without work in every known rolling seven-day window for 5x2/6x1.
function fitsWeek(dates:Set<string>,date:string,limit:number){
 for(let offset=-6;offset<=0;offset++){
  const first=addDays(date,offset);let count=0;
  for(let i=0;i<7;i++){const day=addDays(first,i);if(day===date||dates.has(day))count++;}
  if(count>limit)return false;
 }
 return true;
}
function assertOptions(store:Store,options:GeneratorOptions){
 monthDays(options.month);
 if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(options.start)||!Number.isInteger(options.coverage)||options.coverage<1||options.coverage>100||!Array.isArray(options.weekdays)||!options.weekdays.length||options.weekdays.some(day=>!Number.isInteger(day)||day<0||day>6)||new Set(options.weekdays).size!==options.weekdays.length||typeof options.restOnHolidays!=='boolean'||!['balanced','coverage'].includes(options.allocation))throw new GenerationError('Confira a entrada, a cobertura e os dias de operação.');
 if(!Array.isArray(options.employeeIds)||!options.employeeIds.length||new Set(options.employeeIds).size!==options.employeeIds.length||options.employeeIds.some(id=>!store.employees.some(employee=>employee.id===id)))throw new GenerationError('Selecione ao menos um colaborador válido, sem duplicação.');
 if(store.employees.length>100||store.shifts.length>10000||(store.dayOffs?.length??0)>10000)throw new GenerationError('O gerador atende até 100 colaboradores e 10.000 turnos/folgas por workspace nesta versão.');
 if(new Set(store.shifts.map(s=>s.id)).size!==store.shifts.length||new Set(store.employees.map(e=>e.id)).size!==store.employees.length||store.employees.some(e=>!['5x2','6x1'].includes(e.regime)||![2,3].includes(e.sundayEvery)))throw new GenerationError('Confira os cadastros e as identificações da escala.');
 const errors=validate(store.shifts,store.employees,store.rules,store.dayOffs??[]).filter(issue=>issue.severity==='error');
 if(errors.length)throw new GenerationError(`Corrija os conflitos existentes antes de gerar: ${errors.slice(0,4).map(issue=>`${store.employees.find(e=>e.id===issue.employeeId)?.name}: ${issue.message}`).join(' ')}`);
}
export function generateMonthlySchedule(store:Store,options:GeneratorOptions):GenerationResult{
 assertOptions(store,options);
 const dates=monthDays(options.month),first=dates[0],last=dates.at(-1)!;
 const employees=store.employees.filter(e=>options.employeeIds.includes(e.id));
 const templates=new Map(employees.map(employee=>[employee.id,generatorTemplate(employee,store,options.start)]));
 const requirements=new Map(dates.map(date=>[date,options.weekdays.includes(weekday(date))&&!(options.restOnHolidays&&holidaysOnDate(store.holidays??[],date,store.workspaceLocation).length)?options.coverage:0]));
 const lower=addDays(first,-35),upper=addDays(last,35);
 function trial(rotation:number){
  const personal=new Map(employees.map(employee=>[employee.id,store.shifts.filter(s=>s.employeeId===employee.id&&s.date>=lower&&s.date<=upper)]));
  const offByPerson=new Map(employees.map(e=>[e.id,(store.dayOffs??[]).filter(off=>off.employeeId===e.id&&off.date>=lower&&off.date<=upper)]));
  const occupied=new Map(employees.map(e=>[e.id,workedDates(personal.get(e.id)!)]));
  const loads=new Map(employees.map(e=>[e.id,personal.get(e.id)!.filter(s=>s.date>=first&&s.date<=last).reduce((n,s)=>n+interval(s).hours,0)]));
  const added:Shift[]=[],daily:GenerationDay[]=[];
  for(let index=0;index<dates.length;index++){
   const date=dates[index],required=requirements.get(date)!;
   let scheduled=employees.filter(e=>occupied.get(e.id)!.has(date)).length;
   const reasons=new Set<string>();
   // Stable staggered 5/2 or 6/1 preferences distribute rest days through the
   // week. Coverage can override preferences, never hard constraints.
   const preferred=(position:number)=>((index+position*3+rotation)%7)<maximum(employees[position]);
   const candidates=employees.map((employee,position)=>({employee,position})).sort((a,b)=>Number(preferred(b.position))-Number(preferred(a.position))||loads.get(a.employee.id)!/templates.get(a.employee.id)!.paidMinutes-loads.get(b.employee.id)!/templates.get(b.employee.id)!.paidMinutes||((a.position+rotation)%employees.length)-((b.position+rotation)%employees.length));
   for(const {employee,position} of candidates){
    if(!required)break;
    const id=employee.id,current=personal.get(id)!,worked=occupied.get(id)!;
    if(worked.has(date))continue;
    if(scheduled>=required)break;
    if(offByPerson.get(id)!.some(off=>off.date===date)){reasons.add('Folgas já confirmadas');continue;}
    if(!fitsWeek(worked,date,maximum(employee))){reasons.add('Folgas do regime 5x2/6x1 em sete dias');continue;}
    const template=templates.get(id)!;
    const shift:Shift={id:`draft:${id}:${date}`,employeeId:id,date,start:template.start,end:template.end,breakMinutes:template.breakMinutes};
    const errors=validate([...current,shift],[employee],store.rules,offByPerson.get(id)).filter(issue=>issue.severity==='error');
    if(errors.length){for(const error of errors)reasons.add(error.message);continue;}
    current.push(shift);worked.add(date);loads.set(id,loads.get(id)!+template.paidMinutes/60);added.push(shift);scheduled++;
   }
   daily.push({date,required,scheduled,missing:Math.max(0,required-scheduled),reasons:scheduled<required?[...reasons]:[]});
  }
  // Reserve coverage for the complete month first. Only then top up preferred
  // workdays, checking all future reservations so extra work cannot consume
  // the rest needed for an already covered day later in the month.
  if(options.allocation==='balanced')for(let index=0;index<dates.length;index++){
   const date=dates[index];if(!requirements.get(date))continue;
   const candidates=employees.map((employee,position)=>({employee,position})).filter(({employee,position})=>(index+position*3+rotation)%7<maximum(employee)).sort((a,b)=>loads.get(a.employee.id)!/templates.get(a.employee.id)!.paidMinutes-loads.get(b.employee.id)!/templates.get(b.employee.id)!.paidMinutes);
   for(const {employee} of candidates){
    const id=employee.id,current=personal.get(id)!,worked=occupied.get(id)!;
    if(worked.has(date)||offByPerson.get(id)!.some(off=>off.date===date)||!fitsWeek(worked,date,maximum(employee)))continue;
    const template=templates.get(id)!,shift:Shift={id:`draft:${id}:${date}`,employeeId:id,date,start:template.start,end:template.end,breakMinutes:template.breakMinutes};
    if(validate([...current,shift],[employee],store.rules,offByPerson.get(id)).some(issue=>issue.severity==='error'))continue;
    current.push(shift);worked.add(date);loads.set(id,loads.get(id)!+template.paidMinutes/60);added.push(shift);daily[index].scheduled++;daily[index].missing=Math.max(0,daily[index].required-daily[index].scheduled);
   }
  }
  return {added,daily,missing:daily.reduce((n,d)=>n+d.missing,0),spread:Math.max(...loads.values())-Math.min(...loads.values())};
 }
 // Bounded deterministic multi-start heuristic, not an optimizer or a proof of
 // infeasibility. Minimize uncovered person-days, then balance useful work.
 let best=trial(0);
 const attempts=employees.length<=25?7:3;
 for(let rotation=1;rotation<attempts;rotation++){
  const candidate=trial(rotation);
  if(candidate.missing<best.missing||candidate.missing===best.missing&&(options.allocation==='balanced'&&candidate.added.length>best.added.length||candidate.added.length===best.added.length&&candidate.spread<best.spread))best=candidate;
 }
 const ids=new Set([...store.shifts,...store.dayOffs??[]].map(item=>item.id));let sequence=0;
 function nextId(kind:string){let id;do{id=`auto-${kind}-${options.month}-${sequence++}`;}while(ids.has(id));ids.add(id);return id;}
 const shifts=best.added.map(shift=>({...shift,id:nextId('turno')}));
 const allShifts=[...store.shifts,...shifts],dayOffs:DayOff[]=[];
 for(const employee of employees){const worked=workedDates(allShifts.filter(s=>s.employeeId===employee.id));const confirmed=new Set((store.dayOffs??[]).filter(off=>off.employeeId===employee.id).map(off=>off.date));for(const date of dates)if(!worked.has(date)&&!confirmed.has(date))dayOffs.push({id:nextId('folga'),employeeId:employee.id,date});}
 if(allShifts.length>10000||(store.dayOffs?.length??0)+dayOffs.length>10000)throw new GenerationError('O planejamento resultante ultrapassa o limite de 10.000 turnos/folgas. Reduza a seleção ou reveja o volume do histórico.');
 const issues=validate(allShifts,store.employees,store.rules,[...store.dayOffs??[],...dayOffs]);
 if(issues.some(issue=>issue.severity==='error'))throw new GenerationError('A sugestão encontrou um conflito na verificação final. Nenhuma alteração foi aplicada. Revise o histórico e os parâmetros.');
 return {options:{...options,employeeIds:[...options.employeeIds],weekdays:[...options.weekdays]},shifts,dayOffs,daily:best.daily,missing:best.missing,issues,employees:employees.map(employee=>{const personal=allShifts.filter(s=>s.employeeId===employee.id&&s.date>=first&&s.date<=last);return {id:employee.id,name:employee.name,regime:employee.regime,...templates.get(employee.id)!,newDays:shifts.filter(s=>s.employeeId===employee.id).length,totalDays:dates.filter(date=>allShifts.some(s=>s.employeeId===employee.id&&shiftTouchesDate(s,date))).length,totalHours:personal.reduce((n,s)=>n+interval(s).hours,0)};})};
}
