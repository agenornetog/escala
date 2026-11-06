import { addDays, monday } from './dates';
import { laborContextIssues } from './labor-rules';
import { workScheduleProblems } from './work-schedule';
import { profileFor, profileProblems } from './rule-profile';
import { interval, shiftTouchesDate } from './shift-time';
export { interval } from './shift-time';
import type { DayOff, Employee, Issue, LaborContext, Rules, Shift } from './types';
export const defaultRules: Rules = { dailyHours: 8, weeklyHours: 44, intershiftHours: 11, weeklyRestHours: 35, maxConsecutiveDays: 6, longBreakMinutes: 60, coverage: 4 };
export function validate(shifts: Shift[], employees: Employee[], rules: Rules, dayOffs: DayOff[]=[],context:LaborContext={}): Issue[] {
  const issues: Issue[] = [];
  const push = (code: string, severity: Issue['severity'], s: Shift, message: string) => issues.push({ code, severity, employeeId: s.employeeId, date: s.date, message });
  for (const employee of employees) {
    const profile=profileFor(employee,rules);
    const list = shifts.filter(s => s.employeeId === employee.id).sort((a,b) => interval(a).start - interval(b).start);
    const problems=[...profileProblems(profile),...workScheduleProblems(employee,rules)];
    for(const problem of problems) issues.push({code:'profile',severity:'error',employeeId:employee.id,date:list[0]?.date ?? '',message:problem});
    if(problems.length) continue;
    for(const off of dayOffs.filter(off=>off.employeeId===employee.id)){if(list.some(shift=>shiftTouchesDate(shift,off.date)))issues.push({code:'day-off',severity:'error',employeeId:employee.id,date:off.date,message:'Folga confirmada coincide com trabalho nesta data, inclusive continuação de turno noturno. Ajuste o turno ou remova a folga.'});}
    const daily = new Map<string, number>(); const weeks = new Map<string, number>();
    list.forEach((s, index) => {
      const current = interval(s);
      const span = (current.end-current.start)/3600000;
      if (current.hours <= 0 || s.breakMinutes < 0 || !Number.isFinite(current.hours)) push('invalid', 'error', s, 'O intervalo precisa ser menor que a duração do turno.');
      if (current.hours > 6 && s.breakMinutes < profile.longBreakMinutes) push('break', 'error', s, `Jornada acima de 6h exige intervalo de ${profile.longBreakMinutes} min neste perfil.`);
      if (current.hours > 4 && current.hours <= 6 && s.breakMinutes < 15) push('break', 'error', s, 'Jornada entre 4h e 6h exige intervalo de 15 min.');
      if (s.breakMinutes > 120 || span > 24) push('duration', 'error', s, 'Duração ou intervalo fora dos limites deste perfil de jornada.');
      daily.set(s.date, (daily.get(s.date) ?? 0) + current.hours);
      const week = monday(s.date); weeks.set(week, (weeks.get(week) ?? 0) + current.hours);
      if (index > 0) {
        // Compare against every earlier interval: a long overnight shift may contain a later shift.
        const previousEnd = Math.max(...list.slice(0,index).map(v => interval(v).end));
        const rest = (current.start - previousEnd)/3600000;
        if (rest < 0) push('overlap', 'error', s, 'Há sobreposição de turnos para este colaborador.');
        else if (rest < profile.intershiftHours) push('intershift', 'error', s, `Apenas ${rest.toFixed(1).replace('.',',')}h entre turnos. Mínimo: ${profile.intershiftHours}h.`);
      }
    });
    for (const [date,hours] of daily) if (hours > profile.dailyHours) push('daily', 'error', list.find(s=>s.date===date)!, `Jornada de ${hours.toFixed(1).replace('.',',')}h excede o limite diário de ${profile.dailyHours}h.`);
    for (const [week,hours] of weeks) {
      const s = list.find(s=>monday(s.date)===week)!;
      if (hours > profile.weeklyHours) push('weekly', 'error', s, `Semana com ${hours.toFixed(1).replace('.',',')}h. Limite do perfil: ${profile.weeklyHours}h.`);
      else if (hours >= profile.weeklyHours * .9) push('weekly-near', 'warning', s, `Semana próxima do limite: ${hours.toFixed(1).replace('.',',')} de ${profile.weeklyHours}h.`);
    }
    // A night shift is one work period. The following calendar day is counted
    // separately only for Sunday rotation, not as a seventh consecutive duty.
    const worked = new Set<string>();
    for (const s of list) { worked.add(s.date); if (s.end <= s.start && s.end !== '00:00') worked.add(addDays(s.date,1)); }
    const maximum=Math.min(profile.maxConsecutiveDays,employee.regime==='5x2'?5:6);
    let streak=0; let previousEnd:number|undefined; let previousDate='';
    for(const s of list){
      const current=interval(s);
      const rest=previousEnd===undefined?Infinity:(current.start-previousEnd)/3600000;
      if(rest>=profile.weeklyRestHours) streak=1;
      else if(s.date!==previousDate) streak++;
      if(streak>maximum){
        push('consecutive','error',s,`${streak} períodos de trabalho sem descanso semanal completo. Máximo do perfil ${employee.regime}: ${maximum}.`);
        if(rest>=profile.intershiftHours)push('weekly-rest','error',s,`Descanso semanal não completado antes do próximo período: ${rest.toFixed(1).replace('.',',')}h observadas; mínimo combinado de ${profile.weeklyRestHours}h no perfil.`);
      }
      previousEnd=Math.max(previousEnd??current.end,current.end);previousDate=s.date;
    }
    // Two fragments on one date need positioned meal breaks and a complete duty
    // span, which this model does not represent. Reject instead of underchecking.
    for(const [date] of daily){if(list.filter(s=>s.date===date).length>1)push('split-shift','error',list.find(s=>s.date===date)!, 'Mais de um turno na mesma data: use um único turno com intervalo. Jornadas fracionadas exigem um modelo específico.');}
    const first=list[0];
    if(first)push('history','warning',first,'A análise considera apenas os turnos cadastrados. Histórico anterior e folgas fora do período não foram certificados.');
    for(const s of list){
      const current=interval(s);const endDate=addDays(s.date,s.end<=s.start?1:0);
      if(monday(s.date)!==monday(endDate)&&s.end!=='00:00')push('cross-week','warning',s,'Turno atravessa a semana civil. A soma atual é atribuída à entrada; o limite semanal exige conferência antes da aprovação operacional.');
      if(s.start>='22:00'||s.start<'05:00'||s.end<=s.start||s.end>'22:00')push('night-pay','warning',s,'Turno alcança período noturno ou atravessa meia-noite. Hora noturna reduzida, adicional e prorrogação ainda não são calculados.');
      if(current.hours>8)push('compensation','warning',s,'Jornada acima de 8h depende da validade do acordo e da compensação aplicável; o sistema não controla banco de horas.');
    }
    const sundays = [...worked].filter(d=>new Date(`${d}T12:00Z`).getUTCDay()===0).sort();
    let consecutiveSundays=0; let last='';
    for (const date of sundays) {
      consecutiveSundays=last && addDays(last,7)===date ? consecutiveSundays+1 : 1; last=date;
      if (consecutiveSundays >= employee.sundayEvery) push('sunday','error',list.find(s=>s.date===date) ?? list.find(s=>addDays(s.date,1)===date)!,`Revezamento de domingos do perfil excedido: este perfil exige 1 domingo livre a cada ${employee.sundayEvery} semanas.`);
    }
  }
  return [...issues,...laborContextIssues(shifts,employees,rules,context)];
}
export function blockingIssues(shifts: Shift[], employees: Employee[], rules: Rules) { return validate(shifts,employees,rules).filter(i=>i.severity==='error'); }
