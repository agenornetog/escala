import assert from 'node:assert/strict';
import { test } from 'node:test';
import { scheduleForMonth, type EmployeeSchedule } from '../lib/employee-schedule';

test('weekly summary uses the personal target and counts a full week across a month boundary', () => {
  const base = { employeeId: 'camila', start: '08:00', end: '17:00', breakMinutes: 60 };
  const schedule: EmployeeSchedule = {
    employee: { id: 'camila', name: 'Camila', role: 'Atendente', regime: '5x2', weeklyTargetMinutes: 36 * 60 },
    shifts: ['2026-11-30','2026-12-01','2026-12-02'].map(date => ({ ...base, id: date, date })),
    dayOffs: [], holidays: [],
  };
  const view = scheduleForMonth(schedule, '2026-12');
  assert.equal(view.shifts.length, 2);
  assert.deepEqual(view.weeks[0], { start: '2026-11-30', end: '2026-12-06', scheduledMinutes: 24 * 60 });
  assert.equal(view.employee.weeklyTargetMinutes, 36 * 60);
});
