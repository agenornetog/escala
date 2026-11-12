import { holidayApplies, holidayOccurrence, normalizeHoliday, normalizeLocation, validHolidayDate } from './holidays';
import { absenceOverlaps, normalizeAbsences } from './labor-rules';
import { interval, shiftTouchesDate } from './shift-time';
import { addDays, monday, monthDays } from './dates';
import type { Absence, DayOff, Holiday, Shift, Store, WorkspaceLocation } from './types';

// This is the complete allowlist sent to a collaborator. Never send Store here.
export type EmployeeSchedule = {
 employee: { id:string; name:string; role:string; regime:string; weeklyTargetMinutes?:number };
 shifts:Shift[];
 dayOffs:DayOff[];
 absences?:Absence[];
 holidays:Holiday[];
 workspaceLocation?:WorkspaceLocation;
};
export type EmployeeWeek = { start: string; end: string; scheduledMinutes: number };
export type EmployeeMonthSchedule = EmployeeSchedule & { weeks: EmployeeWeek[] };

export function validWeeklyTargetMinutes(value: unknown): value is number {
 return typeof value === 'number' && Number.isInteger(value) && value > 0 && value <= 7 * 24 * 60;
}
const object=(value:unknown):Record<string,unknown>=>{
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Planejamento inválido.');
 return value as Record<string,unknown>;
};
const text=(value:unknown,max=120)=>{
 if(typeof value!=='string'||!value.trim()||value.length>max)throw new Error('Dados do colaborador inválidos.');
 return value.trim();
};
export function employeeSchedule(input:unknown,employeeId:string):EmployeeSchedule{
 const data=object(input),employee=object(data.employee);
 if(employee.id!==employeeId)throw new Error('Colaborador diferente do acesso selecionado.');
 if(!['5x2','6x1'].includes(employee.regime as string))throw new Error('Regime inválido.');
 if(!Array.isArray(data.shifts)||data.shifts.length>10000||!Array.isArray(data.dayOffs)||data.dayOffs.length>10000||!Array.isArray(data.holidays)||data.holidays.length>2000)throw new Error('Planejamento inválido.');
 const shifts:Shift[]=data.shifts.map(item=>{
  const s=object(item);
  if(s.employeeId!==employeeId||!validHolidayDate(s.date)||typeof s.start!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(s.start)||typeof s.end!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(s.end)||!Number.isInteger(s.breakMinutes)||Number(s.breakMinutes)<0||Number(s.breakMinutes)>120)throw new Error('Turno inválido ou de outro colaborador.');
  return {id:text(s.id),employeeId,date:s.date,start:s.start,end:s.end,breakMinutes:Number(s.breakMinutes)};
 });
 const absences=normalizeAbsences(data.absences,new Set([employeeId]));
 if(absences.some(a=>shifts.some(s=>absenceOverlaps(s,a))))throw new Error('Turno coincide com ausência cadastrada. Revise a jornada antes de publicar.');
 const dayOffs:DayOff[]=data.dayOffs.map(item=>{const d=object(item);if(d.employeeId!==employeeId||!validHolidayDate(d.date))throw new Error('Folga inválida ou de outro colaborador.');return {id:text(d.id),employeeId,date:d.date};});
 if(new Set(shifts.map(s=>s.id)).size!==shifts.length||new Set(dayOffs.map(d=>d.date)).size!==dayOffs.length)throw new Error('Planejamento duplicado.');
 const workspaceLocation=normalizeLocation(data.workspaceLocation);
 const weeklyTargetMinutes=employee.weeklyTargetMinutes;
 return {employee:{id:text(employee.id),name:text(employee.name),role:text(employee.role),regime:String(employee.regime),...(validWeeklyTargetMinutes(weeklyTargetMinutes)?{weeklyTargetMinutes}:{})},shifts,dayOffs,absences,holidays:data.holidays.map(item=>{const {reference,notes,...holiday}=normalizeHoliday(item);return holiday;}).filter(holiday=>holidayApplies(holiday,workspaceLocation)),workspaceLocation};
}
export function scheduleFromStore(store:Store,employeeId:string){
 const employee=store.employees.find(e=>e.id===employeeId);
 if(!employee)throw new Error('Colaborador não encontrado.');
 return employeeSchedule({employee,absences:(store.absences??[]).filter(a=>a.employeeId===employeeId),shifts:store.shifts.filter(s=>s.employeeId===employeeId),dayOffs:(store.dayOffs??[]).filter(s=>s.employeeId===employeeId),holidays:store.holidays??[],workspaceLocation:store.workspaceLocation},employeeId);
}
export function scheduleForMonth(schedule:EmployeeSchedule,month:string):EmployeeMonthSchedule{
 const dates=monthDays(month),first=dates[0],last=dates.at(-1)!;
 const weeks: EmployeeWeek[] = [...new Set(dates.map(monday))].map(start => {
  const end = addDays(start, 6);
  const scheduledMinutes = schedule.shifts
   .filter(shift => shift.employeeId === schedule.employee.id && shift.date >= start && shift.date <= end)
   .reduce((total, shift) => total + Math.round(interval(shift).hours * 60), 0);
  return { start, end, scheduledMinutes };
 });
 return {...schedule,weeks,absences:(schedule.absences??[]).filter(a=>a.startsOn<=last&&a.endsOn>=first),holidays:schedule.holidays.filter(holiday=>holidayApplies(holiday,schedule.workspaceLocation)&&holidayOccurrence(holiday,Number(month.slice(0,4)))?.startsWith(month+'-')),shifts:schedule.shifts.filter(s=>s.date>=first&&s.date<=last||shiftTouchesDate(s,first)),dayOffs:schedule.dayOffs.filter(d=>d.date>=first&&d.date<=last)};
}
