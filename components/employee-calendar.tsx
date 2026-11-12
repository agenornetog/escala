import { labelDate, weekday } from '@/lib/dates';
import type { DayPlan } from '@/lib/monthly-report';
import type { Holiday } from '@/lib/types';

const weekdays = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
const statuses = {
  working: 'Trabalho', off: 'Folga', absent: 'Ausência',
  conflict: 'Em revisão', unplanned: 'Sem planejamento',
};

export default function EmployeeCalendar({ days, currentDate, busy }: {
  days: { date: string; plan: DayPlan; holidays: Holiday[] }[];
  currentDate: string;
  busy: boolean;
}) {
  const offset = days.length ? (weekday(days[0].date) + 6) % 7 : 0;
  return <div className="employee-calendar" role="region" aria-label="Agenda mensal da minha jornada" aria-busy={busy}>
    <div className="employee-calendar-grid" aria-hidden="true">
      {weekdays.map(day => <span key={day}>{day}</span>)}
    </div>
    <ol className="employee-calendar-grid">
      {days.map(({ date, plan, holidays }, index) => <li
        key={date} className={plan.status}
        style={index === 0 ? { gridColumnStart: offset + 1 } : undefined}
        aria-current={date === currentDate ? 'date' : undefined}>
        <time dateTime={date} aria-label={labelDate(date, { day: 'numeric', month: 'long', weekday: 'long' })}>
          {Number(date.slice(-2))}
        </time>
        <span className={plan.status === 'unplanned' ? 'employee-calendar-unplanned' : undefined}>{statuses[plan.status]}</span>
        {plan.lines.map((line, index) => <small key={plan.shifts[index].id}>{line.replace('-', '–')}</small>)}
        {holidays.length > 0 && <small className="employee-calendar-holiday">{holidays.map(holiday => holiday.name).join(' · ')}</small>}
      </li>)}
    </ol>
  </div>;
}
