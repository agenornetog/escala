import { addDays, monday, weekday } from './dates';
import { BRAZIL_STATES, holidaysOnDate, normalizePlace, validHolidayDate } from './holidays';
import { profileFor, ruleLimitKeys, validRuleValue } from './rule-profile';
import { interval } from './shift-time';
import type { Absence, Employee, Issue, LaborConfig, LaborContext, LaborInstrument, RuleLimits, Rules, Shift } from './types';
const record=(input:unknown)=>{if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Cadastro trabalhista inválido.');return input as Record<string,unknown>;};
function text(value:unknown,max=500){if(value===undefined||value===null||value==='')return '';if(typeof value!=='string'||value.length>max)throw new Error('Texto do cadastro trabalhista inválido.');return value.trim();}
export function normalizeInstrument(input:unknown):LaborInstrument{
 const raw=record(input),id=text(raw.id,120),name=text(raw.name,150),unionName=text(raw.unionName,200),reference=text(raw.reference),category=text(raw.category,150),state=text(raw.state,2).toUpperCase(),city=text(raw.city,120);
 if(!id||!name||!unionName||!reference||!category||!['CCT','ACT'].includes(String(raw.kind))||!BRAZIL_STATES.some(([uf])=>uf===state))throw new Error('Informe identificação, tipo, nome, sindicato, referência, categoria e UF do instrumento.');
 if(!validHolidayDate(raw.startsOn)||!validHolidayDate(raw.endsOn)||raw.endsOn<raw.startsOn)throw new Error('Informe uma vigência válida para o instrumento.');
 const sourceUrl=text(raw.sourceUrl,1000);if(sourceUrl){let url;try{url=new URL(sourceUrl);}catch{throw new Error('Informe uma fonte HTTPS válida.');}if(url.protocol!=='https:'||url.username||url.password)throw new Error('A fonte do instrumento deve usar HTTPS, sem credenciais.');}
 const clauseReference=text(raw.clauseReference,2000),reviewedBy=text(raw.reviewedBy,150),reviewedOn=text(raw.reviewedOn,10);
 if(reviewedOn&&!validHolidayDate(reviewedOn)||Boolean(reviewedBy)!==Boolean(reviewedOn))throw new Error('Informe juntos o responsável e a data da conferência das cláusulas.');
 let limits:Partial<Omit<RuleLimits,'coverage'>>|undefined;
 if(raw.limits!==undefined){limits={};for(const [key,value] of Object.entries(record(raw.limits))){if(key==='coverage'||!ruleLimitKeys.includes(key as keyof RuleLimits)||!validRuleValue(key as keyof RuleLimits,value))throw new Error('Limite coletivo fora dos valores suportados.');limits[key as keyof Omit<RuleLimits,'coverage'>]=value as number;}}
 if(!['pending','prohibited','authorized'].includes(String(raw.holidayWork)))throw new Error('Selecione a regra para trabalho em feriados.');
 if(raw.sundayEvery!==undefined&&raw.sundayEvery!==2&&raw.sundayEvery!==3)throw new Error('O revezamento suportado é de duas ou três semanas.');
 if((limits&&Object.keys(limits).length||raw.sundayEvery||raw.holidayWork==='authorized')&&!clauseReference)throw new Error('Registre as cláusulas que fundamentam os parâmetros coletivos.');
 return {id,kind:raw.kind as LaborInstrument['kind'],name,unionName,reference,category,state,startsOn:raw.startsOn,endsOn:raw.endsOn,holidayWork:raw.holidayWork as LaborInstrument['holidayWork'],...(city?{city}:{}),...(sourceUrl?{sourceUrl}:{}),...(clauseReference?{clauseReference}:{}),...(reviewedBy?{reviewedBy,reviewedOn}:{}),...(limits?{limits}:{}),...(raw.sundayEvery?{sundayEvery:raw.sundayEvery as 2|3}:{})};
}
export function normalizeLabor(input:unknown):LaborConfig|undefined{
 if(input===undefined)return undefined;const raw=record(input);
 if(!Array.isArray(raw.instruments)||raw.instruments.length>100)throw new Error('Lista de instrumentos inválida.');
 const instruments=raw.instruments.map(normalizeInstrument),defaultInstrumentId=text(raw.defaultInstrumentId,120);
 if(new Set(instruments.map(item=>item.id)).size!==instruments.length)throw new Error('Instrumentos duplicados.');
 if(defaultInstrumentId&&!instruments.some(item=>item.id===defaultInstrumentId))throw new Error('Instrumento padrão não encontrado.');
 return {activity:text(raw.activity,200),category:text(raw.category,150),instruments,...(defaultInstrumentId?{defaultInstrumentId}:{})};
}
export function validateEmployeeLabor(employee:Employee,config?:LaborConfig){
 for(const [key,max] of [['laborInstrumentId',120],['laborCategory',150],['sundayReference',500]] as const){const value=employee[key];if(value!==undefined&&(typeof value!=='string'||value.length>max))throw new Error('Enquadramento individual inválido.');}
 if(employee.laborCondition!==undefined&&!['general','special'].includes(employee.laborCondition))throw new Error('Condição individual inválida.');
 if(employee.laborInstrumentId&&!config?.instruments.some(i=>i.id===employee.laborInstrumentId))throw new Error('Instrumento individual não encontrado.');
}
export function normalizeAbsence(input:unknown):Absence{
 const raw=record(input),id=text(raw.id,120),employeeId=text(raw.employeeId,120);
 if(!id||!employeeId||!['ferias','afastamento','licenca'].includes(String(raw.kind))||!validHolidayDate(raw.startsOn)||!validHolidayDate(raw.endsOn)||raw.endsOn<raw.startsOn)throw new Error('Informe colaborador, tipo e período válido da ausência.');
 return {id,employeeId,kind:raw.kind as Absence['kind'],startsOn:raw.startsOn,endsOn:raw.endsOn};
}
export function normalizeAbsences(input:unknown,employees?:Set<string>):Absence[]{
 if(input===undefined)return [];
 if(!Array.isArray(input)||input.length>10000)throw new Error('Lista de ausências inválida.');
 const result=input.map(normalizeAbsence),ordered=[...result].sort((a,b)=>a.employeeId.localeCompare(b.employeeId)||a.startsOn.localeCompare(b.startsOn));
 if(new Set(result.map(a=>a.id)).size!==result.length||employees&&result.some(a=>!employees.has(a.employeeId)))throw new Error('Ausência duplicada ou de colaborador inexistente.');
 for(let i=1;i<ordered.length;i++)if(ordered[i].employeeId===ordered[i-1].employeeId&&ordered[i].startsOn<=ordered[i-1].endsOn)throw new Error('Períodos de ausência sobrepostos para o mesmo colaborador.');
 return result;
}
export function absenceOverlaps(shift:Shift,absence:Absence){const span=interval(shift);return shift.employeeId===absence.employeeId&&span.start<Date.parse(`${addDays(absence.endsOn,1)}T00:00:00-03:00`)&&span.end>Date.parse(`${absence.startsOn}T00:00:00-03:00`);}
export function instrumentFor(employee:Employee,context:LaborContext,date?:string){
 const id=employee.laborInstrumentId||context.labor?.defaultInstrumentId;
 const instrument=context.labor?.instruments.find(item=>item.id===id);
 return instrument&&(!date||date>=instrument.startsOn&&date<=instrument.endsOn)?instrument:undefined;
}
// Collective clauses can tighten this ordinary profile. No clause silently
// relaxes a statutory/default or individual constraint in this implementation.
export function employeeWithInstrument(employee:Employee,rules:Rules,context:LaborContext,date?:string):Employee{
 const instrument=instrumentFor(employee,context,date);if(!instrument)return employee;
 const base=profileFor(employee,rules),overrides={...employee.ruleOverrides};
 for(const [key,value] of Object.entries(instrument.limits??{})){
  const field=key as keyof Omit<RuleLimits,'coverage'>;
  overrides[field]=['intershiftHours','weeklyRestHours','longBreakMinutes'].includes(field)?Math.max(base[field],value!):Math.min(base[field],value!);
 }
 return {...employee,ruleOverrides:overrides,sundayEvery:Math.min(employee.sundayEvery,instrument.sundayEvery??employee.sundayEvery)};
}
export function laborContextIssues(shifts:Shift[],employees:Employee[],rules:Rules,context:LaborContext):Issue[]{
 const issues:Issue[]=[];
 if(!context.absences?.length&&!context.labor?.instruments.length)return issues;
 const push=(code:string,shift:Shift,message:string)=>issues.push({code,severity:'error',employeeId:shift.employeeId,date:shift.date,message});
 for(const shift of shifts)for(const absence of context.absences??[])if(absenceOverlaps(shift,absence))push('absence',shift,`Turno coincide com ${absence.kind==='ferias'?'férias':absence.kind==='licenca'?'licença':'afastamento'} de ${absence.startsOn} a ${absence.endsOn}, inclusive trabalho após meia-noite.`);
 if(!context.labor?.instruments.length)return issues;
 for(const employee of employees){
  const list=shifts.filter(s=>s.employeeId===employee.id).sort((a,b)=>interval(a).start-interval(b).start);
  const daily=new Map<string,number>(),weekly=new Map<string,number>();
  for(const s of list){daily.set(s.date,(daily.get(s.date)??0)+interval(s).hours);weekly.set(monday(s.date),(weekly.get(monday(s.date))??0)+interval(s).hours);}
  let streak=0,previousEnd:number|undefined,previousDate='';
  for(const shift of list){
   const instrument=instrumentFor(employee,context,shift.date),effective=profileFor(employeeWithInstrument(employee,rules,context,shift.date),rules),span=interval(shift),rest=previousEnd===undefined?Infinity:(span.start-previousEnd)/3600000;
   if(rest>=effective.weeklyRestHours)streak=1;else if(shift.date!==previousDate)streak++;
   if(instrument){
    const suffix=` Instrumento: ${instrument.reference}.`;
    if((daily.get(shift.date)??0)>effective.dailyHours+1e-7)push('cct-daily',shift,`Jornada excede o limite coletivo/individual de ${effective.dailyHours}h.`+suffix);
    if((weekly.get(monday(shift.date))??0)>effective.weeklyHours+1e-7)push('cct-weekly',shift,`Semana excede o limite coletivo/individual de ${effective.weeklyHours}h.`+suffix);
    if(rest>=0&&rest<effective.intershiftHours)push('cct-intershift',shift,`Descanso entre jornadas inferior a ${effective.intershiftHours}h.`+suffix);
    if(span.hours>6&&shift.breakMinutes<effective.longBreakMinutes)push('cct-break',shift,`Intervalo inferior ao mínimo coletivo de ${effective.longBreakMinutes} min.`+suffix);
    if(streak>Math.min(effective.maxConsecutiveDays,employee.regime==='5x2'?5:6))push('cct-weekly-rest',shift,`Sequência sem completar o descanso de ${effective.weeklyRestHours}h excede o perfil coletivo.`+suffix);

   }
   for(const date of [shift.date,...(shift.end<=shift.start&&shift.end!=='00:00'?[addDays(shift.date,1)]:[])]){const dayInstrument=instrumentFor(employee,context,date);if(dayInstrument?.holidayWork==='prohibited'&&holidaysOnDate(context.holidays??[],date,context.workspaceLocation).length)push('holiday-work',shift,`Trabalho em feriado vedado no instrumento cadastrado, incluindo continuação noturna. Instrumento: ${dayInstrument.reference}.`);}
   previousEnd=Math.max(previousEnd??span.end,span.end);previousDate=shift.date;
  }
  const worked=new Set(list.flatMap(s=>[s.date,...(s.end<=s.start&&s.end!=='00:00'?[addDays(s.date,1)]:[])]));let count=0,last='';
  for(const date of [...worked].filter(d=>weekday(d)===0).sort()){
   count=last&&addDays(last,7)===date?count+1:1;last=date;
   const instrument=instrumentFor(employee,context,date);
   if(instrument?.sundayEvery&&count>=Math.min(employee.sundayEvery,instrument.sundayEvery)){const shift=list.find(s=>s.date===date||addDays(s.date,1)===date)!;push('cct-sunday',shift,`Revezamento coletivo exige um domingo livre a cada ${instrument.sundayEvery} semanas. Instrumento: ${instrument.reference}.`);}
  }
 }
 return issues;
}
