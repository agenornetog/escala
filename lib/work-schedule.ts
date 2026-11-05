import { profileFor, profileProblems } from './rule-profile';
import type { Employee, EmployeeWorkSchedule, Rules } from './types';
const CLOCK=/^([01]\d|2[0-3]):[0-5]\d$/;
const minutes=(value:string)=>Number(value.slice(0,2))*60+Number(value.slice(3));
const clock=(value:number)=>`${String(Math.floor(value/60)%24).padStart(2,'0')}:${String(value%60).padStart(2,'0')}`;
export function normalizeWorkSchedule(value:unknown):EmployeeWorkSchedule|undefined{
 if(value===undefined)return undefined;
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Horário de trabalho inválido.');
 const raw=value as Record<string,unknown>;
 if(typeof raw.start!=='string'||!CLOCK.test(raw.start))throw new Error('Informe um horário de entrada válido.');
 if(raw.end===undefined){if(raw.breakMinutes!==undefined)throw new Error('Informe a saída para definir um intervalo fixo.');return {start:raw.start};}
 if(typeof raw.end!=='string'||!CLOCK.test(raw.end)||raw.end===raw.start)throw new Error('Informe uma saída válida, diferente da entrada.');
 if(typeof raw.breakMinutes!=='number'||!Number.isInteger(raw.breakMinutes)||raw.breakMinutes<0||raw.breakMinutes>120)throw new Error('O intervalo fixo deve ter de 0 a 120 minutos inteiros.');
 return {start:raw.start,end:raw.end,breakMinutes:raw.breakMinutes};
}
export function fixedWorkMinutes(schedule:EmployeeWorkSchedule){
 if(schedule.end===undefined)return undefined;
 let span=minutes(schedule.end)-minutes(schedule.start);if(span<=0)span+=1440;
 return span-schedule.breakMinutes!;
}
export function workScheduleProblems(employee:Employee,rules:Rules):string[]{
 let schedule:EmployeeWorkSchedule|undefined;
 try{schedule=normalizeWorkSchedule(employee.workSchedule);}catch(error){return [error instanceof Error?error.message:'Horário de trabalho inválido.'];}
 if(!schedule?.end)return [];
 const profile=profileFor(employee,rules);if(profileProblems(profile).length)return [];
 const paid=fixedWorkMinutes(schedule)!;
 const problems:string[]=[];
 if(paid<=0)problems.push('O intervalo do horário habitual deve ser menor que a duração do turno.');
 if(paid>profile.dailyHours*60+1e-7)problems.push(`O horário habitual excede o limite diário de ${profile.dailyHours}h do colaborador.`);
 if(paid>profile.weeklyHours*60+1e-7)problems.push('Um turno do horário habitual excede o limite semanal do colaborador.');
 const minimum=paid>360?profile.longBreakMinutes:paid>240?15:0;
 if(schedule.breakMinutes!<minimum)problems.push(`O horário habitual exige pelo menos ${minimum} min de intervalo neste perfil.`);
 return problems;
}
export function workShiftTemplate(employee:Employee,rules:Rules,fallbackStart='08:00'){
 const profile=profileFor(employee,rules),problems=[...profileProblems(profile),...workScheduleProblems(employee,rules)];
 if(problems.length)throw new Error(`${employee.name}: ${problems.join(' ')}`);
 if(!CLOCK.test(fallbackStart))throw new Error('Informe uma entrada padrão válida.');
 const schedule=normalizeWorkSchedule(employee.workSchedule),start=schedule?.start??fallbackStart;
 const paidMinutes=schedule?.end?fixedWorkMinutes(schedule)!:Math.min(Math.floor(profile.dailyHours*60),Math.floor(profile.weeklyHours*60/(employee.regime==='5x2'?5:6)));
 const breakMinutes=schedule?.end?schedule.breakMinutes!:paidMinutes>360?profile.longBreakMinutes:paidMinutes>240?15:0;
 const endMinutes=minutes(start)+paidMinutes+breakMinutes;
 return {start,end:schedule?.end??clock(endMinutes),breakMinutes,paidMinutes,dailyLimit:profile.dailyHours,weeklyLimit:profile.weeklyHours,endsAfterMidnight:endMinutes>1440,source:schedule?'individual' as const:'generation' as const};
}
export function workScheduleLabel(schedule:EmployeeWorkSchedule|undefined){
 if(!schedule)return 'Horário definido por turno';
 return schedule.end?`${schedule.start}–${schedule.end}${schedule.end<=schedule.start?' (+1 dia)':''} · ${schedule.breakMinutes} min de intervalo`:`Entrada às ${schedule.start} · saída calculada`;
}
