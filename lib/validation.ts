import { addDays, monday } from './dates';
import type { Employee, Issue, Rules, Shift } from './types';
export const defaultRules: Rules = { dailyHours: 8, weeklyHours: 44, intershiftHours: 11, weeklyRestHours: 35, maxConsecutiveDays: 6, longBreakMinutes: 60, coverage: 4 };
export function interval(s: Shift) {
  const start = Date.parse(`${s.date}T${s.start}:00-03:00`);
  let end = Date.parse(`${s.date}T${s.end}:00-03:00`);
  if (end <= start) end += 86400000;
  return { start, end, hours: (end - start) / 3600000 - s.breakMinutes / 60 };
}
export function validate(shifts: Shift[], employees: Employee[], rules: Rules): Issue[] {
  const issues: Issue[] = [];
  const push = (code: string, severity: Issue['severity'], s: Shift, message: string) => issues.push({ code, severity, employeeId: s.employeeId, date: s.date, message });
  for (const employee of employees) {
    const list = shifts.filter(s => s.employeeId === employee.id).sort((a,b) => interval(a).start - interval(b).start);
    const daily = new Map<string, number>(); const weeks = new Map<string, number>();
    list.forEach((s, index) => {
      const current = interval(s);
      const span = (current.end-current.start)/3600000;
      if (current.hours <= 0 || s.breakMinutes < 0 || !Number.isFinite(current.hours)) push('invalid', 'error', s, 'O intervalo precisa ser menor que a duração do turno.');
      if (current.hours > 6 && s.breakMinutes < rules.longBreakMinutes) push('break', 'error', s, `Jornada acima de 6h exige intervalo de ${rules.longBreakMinutes} min neste perfil.`);
      if (current.hours > 4 && current.hours <= 6 && s.breakMinutes < 15) push('break', 'error', s, 'Jornada entre 4h e 6h exige intervalo de 15 min.');
      if (s.breakMinutes > 120 || span > 24) push('duration', 'error', s, 'Duração ou intervalo fora dos limites deste perfil de jornada.');
      daily.set(s.date, (daily.get(s.date) ?? 0) + current.hours);
      const week = monday(s.date); weeks.set(week, (weeks.get(week) ?? 0) + current.hours);
      if (index > 0) {
        // Compare against every earlier interval: a long overnight shift may contain a later shift.
        const previousEnd = Math.max(...list.slice(0,index).map(v => interval(v).end));
        const rest = (current.start - previousEnd)/3600000;
        if (rest < 0) push('overlap', 'error', s, 'Há sobreposição de turnos para este colaborador.');
        else if (rest < rules.intershiftHours) push('intershift', 'error', s, `Apenas ${rest.toFixed(1).replace('.',',')}h entre turnos. Mínimo: ${rules.intershiftHours}h.`);
      }
    });
    for (const [date,hours] of daily) if (hours > rules.dailyHours) push('daily', 'error', list.find(s=>s.date===date)!, `Jornada de ${hours.toFixed(1).replace('.',',')}h excede o limite diário de ${rules.dailyHours}h.`);
    for (const [week,hours] of weeks) {
      const s = list.find(s=>monday(s.date)===week)!;
      if (hours > rules.weeklyHours) push('weekly', 'error', s, `Semana com ${hours.toFixed(1).replace('.',',')}h. Limite do perfil: ${rules.weeklyHours}h.`);
      else if (hours >= rules.weeklyHours * .9) push('weekly-near', 'warning', s, `Semana próxima do limite: ${hours.toFixed(1).replace('.',',')} de ${rules.weeklyHours}h.`);
    }
    // Include every civil day touched by an overnight shift.
    const worked = new Set<string>();
    for (const s of list) { worked.add(s.date); if (s.end <= s.start && s.end !== '00:00') worked.add(addDays(s.date,1)); }
    let streak=0; let previous='';
    for (const date of [...worked].sort()) {
      streak = previous && addDays(previous,1)===date ? streak+1 : 1; previous=date;
      if (streak > rules.maxConsecutiveDays) {
        const s = list.find(s=>s.date===date) ?? list.find(s=>addDays(s.date,1)===date)!;
        push('consecutive', 'error', s, `${streak} dias consecutivos de trabalho. Máximo: ${rules.maxConsecutiveDays}.`);
      }
    }
    // A civil day off between shifts must provide the configured combined weekly rest.
    list.forEach((s,i) => {
      if (!i) return;
      const prev=list[i-1], a=interval(prev), b=interval(s);
      const endDate = prev.end <= prev.start && prev.end !== '00:00' ? addDays(prev.date,1) : prev.date;
      if (s.date > addDays(endDate,1) && (b.start-a.end)/3600000 < rules.weeklyRestHours) push('weekly-rest','error',s,`Folga com menos de ${rules.weeklyRestHours}h consecutivas entre jornadas.`);
    });
    const sundays = [...worked].filter(d=>new Date(`${d}T12:00Z`).getUTCDay()===0).sort();
    let consecutiveSundays=0; let last='';
    for (const date of sundays) {
      consecutiveSundays=last && addDays(last,7)===date ? consecutiveSundays+1 : 1; last=date;
      if (consecutiveSundays >= employee.sundayEvery) push('sunday','error',list.find(s=>s.date===date) ?? list.find(s=>addDays(s.date,1)===date)!,`Revezamento de domingos excedido: este perfil exige 1 domingo livre a cada ${employee.sundayEvery} semanas.`);
    }
  }
  return issues;
}
export function blockingIssues(shifts: Shift[], employees: Employee[], rules: Rules) { return validate(shifts,employees,rules).filter(i=>i.severity==='error'); }
