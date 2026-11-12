import { useState } from 'react';
import { labelDate, monday, today } from '@/lib/dates';
import type { EmployeeWeek } from '@/lib/employee-schedule';

function formatMinutes(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}h ${remainder}min` : `${hours}h`;
}

export default function EmployeeWeeklySummary({ weeks, targetMinutes }: {
  weeks: EmployeeWeek[];
  targetMinutes?: number;
}) {
  const [selected, setSelected] = useState(() => {
    const currentWeek = monday(today());
    return weeks.some(week => week.start === currentWeek) ? currentWeek : weeks[0]?.start;
  });
  const week = weeks.find(item => item.start === selected) ?? weeks[0];
  if (!week) return null;
  const difference = targetMinutes === undefined ? undefined : targetMinutes - week.scheduledMinutes;

  return <section className="panel employee-month" aria-label="Resumo da semana">
    <div className="panel-title">
      <h2>Resumo da semana</h2>
      <label className="select-wrap">
        <select aria-label="Semana do resumo" value={week.start} onChange={event => setSelected(event.target.value)}>
          {weeks.map(item => <option key={item.start} value={item.start}>
            {labelDate(item.start, { day: '2-digit', month: '2-digit' })} a {labelDate(item.end, { day: '2-digit', month: '2-digit' })}
          </option>)}
        </select>
      </label>
    </div>
    <div className="employee-totals">
      <span><strong>{targetMinutes === undefined ? '—' : formatMinutes(targetMinutes)}</strong> carga prevista</span>
      <span><strong>{formatMinutes(week.scheduledMinutes)}</strong> horas escaladas</span>
      {difference !== undefined && <span><strong>{formatMinutes(Math.abs(difference))}</strong> {difference < 0 ? 'acima da carga prevista' : 'a planejar'}</span>}
    </div>
    <p className="form-note">{targetMinutes === undefined
      ? 'A carga prevista ainda não foi informada no cadastro.'
      : 'As horas escaladas descontam os intervalos. Turnos noturnos contam na semana em que começam.'}</p>
  </section>;
}
