import { holidaysOnDate } from './holidays';
import { monthDays, monthLabel } from './dates';
import { interval, shiftTouchesDate } from './shift-time';
export { shiftTouchesDate } from './shift-time';
import type { Absence, DayOff, Employee, Shift, Store } from './types';

export type DayPlan = { status:'working'|'off'|'unplanned'|'conflict'|'absent'; shifts:Shift[]; lines:string[]; absence?:Absence };
export type ReportOptions = {month:string;team?:string;employeeId?:string;includeDaily?:boolean;generatedAt?:Date};
function plan(date:string,shifts:Shift[],off:boolean,absence?:Absence):DayPlan{
 const active=shifts.filter(s=>shiftTouchesDate(s,date)).sort((a,b)=>interval(a).start-interval(b).start);
 const lines=active.map(s=>s.date<date?`até ${s.end} (continuação)`:`${s.start}-${s.end}${s.end<=s.start?' (+1 dia)':''}`);
 return {status:active.length?(off||absence?'conflict':'working'):absence?'absent':off?'off':'unplanned',shifts:active,lines,...(absence?{absence}:{})};
}
export function dayPlan(employeeId:string,date:string,shifts:Shift[],dayOffs:DayOff[]=[],absences:Absence[]=[]) {
 return plan(date,shifts.filter(s=>s.employeeId===employeeId),dayOffs.some(off=>off.employeeId===employeeId&&off.date===date),absences.find(a=>a.employeeId===employeeId&&a.startsOn<=date&&a.endsOn>=date));
}
export function buildMonthlyReport(store:Store,options:ReportOptions){
 const dates=monthDays(options.month);
 const employees=store.employees.filter(e=>(!options.team||options.team==='Todas as equipes'||e.team===options.team)&&(!options.employeeId||e.id===options.employeeId)).sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
 const offKeys=new Set((store.dayOffs??[]).map(off=>`${off.employeeId}/${off.date}`));
 const shiftMap=new Map<string,Shift[]>();
 for(const shift of store.shifts){const list=shiftMap.get(shift.employeeId)??[];list.push(shift);shiftMap.set(shift.employeeId,list);}
 const rows=employees.map(employee=>{
  const plans=dates.map(date=>plan(date,shiftMap.get(employee.id)??[],offKeys.has(`${employee.id}/${date}`),(store.absences??[]).find(a=>a.employeeId===employee.id&&a.startsOn<=date&&a.endsOn>=date)));
  return {employee,plans,working:plans.filter(p=>p.status==='working'||p.status==='conflict').length,absent:plans.filter(p=>p.status==='absent').length,off:plans.filter(p=>p.status==='off').length,unplanned:plans.filter(p=>p.status==='unplanned').length,conflicts:plans.filter(p=>p.status==='conflict').length};
 });
 const daily=dates.map((date,i)=>({date,absent:rows.filter(r=>r.plans[i].status==='absent').map(r=>({employee:r.employee,absence:r.plans[i].absence!})),holidays:holidaysOnDate(store.holidays??[],date,store.workspaceLocation),scheduled:rows.filter(r=>r.plans[i].shifts.length).map(r=>({employee:r.employee,plan:r.plans[i]})),off:rows.filter(r=>r.plans[i].status==='off').map(r=>r.employee),unplanned:rows.filter(r=>r.plans[i].status==='unplanned').map(r=>r.employee),conflicts:rows.filter(r=>r.plans[i].status==='conflict').map(r=>r.employee)}));
 return {workspaceLocation:store.workspaceLocation,holidayDates:daily.filter(day=>day.holidays.length>0),month:options.month,label:monthLabel(options.month),team:options.team||'Todas as equipes',dates,rows,daily,generatedAt:options.generatedAt??new Date(),includeDaily:options.includeDaily!==false,totals:{absent:rows.reduce((n,r)=>n+r.absent,0),working:rows.reduce((n,r)=>n+r.working,0),off:rows.reduce((n,r)=>n+r.off,0),unplanned:rows.reduce((n,r)=>n+r.unplanned,0),conflicts:rows.reduce((n,r)=>n+r.conflicts,0)}};
}
export type MonthlyReport = ReturnType<typeof buildMonthlyReport>;
