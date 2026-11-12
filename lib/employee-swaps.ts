import { today } from './dates';
import type { Shift, Store } from './types';

export type EmployeeSwap = {
  id: string;
  shift: Shift;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  decision: string | null;
  created_at: string;
};

export function coveragePlan(store: Store, requested: Shift, replacement: string): Store {
  const current = store.shifts.find(shift => shift.id === requested.id);
  if (!current || current.employeeId !== requested.employeeId || current.date !== requested.date
    || current.start !== requested.start || current.end !== requested.end
    || current.breakMinutes !== requested.breakMinutes || current.date < today()) {
    throw new Error('O turno solicitado mudou ou já passou. Recuse o pedido e oriente o colaborador a solicitar novamente.');
  }
  if (replacement === current.employeeId || !store.employees.some(employee => employee.id === replacement)) {
    throw new Error('Selecione outro colaborador da empresa para a cobertura.');
  }
  return {
    ...store,
    shifts: store.shifts.map(shift => shift.id === current.id ? { ...shift, employeeId: replacement } : shift),
  };
}
