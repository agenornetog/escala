export type Employee = { id: string; name: string; role: string; team: 'Campo' | 'Suporte' | 'Atendimento'; regime: '5x2' | '6x1'; color: string; sundayEvery: number; ruleOverrides?: Partial<Omit<RuleLimits, 'coverage'>>; agreementReference?: string };
export type Shift = { id: string; employeeId: string; date: string; start: string; end: string; breakMinutes: number };
export type DayOff = { id: string; employeeId: string; date: string };
export type RuleLimits = { dailyHours: number; weeklyHours: number; intershiftHours: number; weeklyRestHours: number; maxConsecutiveDays: number; longBreakMinutes: number; coverage: number };
export type Rules = RuleLimits & { agreementReference?: string };
export type Issue = { code: string; severity: 'error' | 'warning'; employeeId: string; date: string; message: string };
export type Swap = { id: string; fromShiftId: string; toShiftId: string; status: 'pending' | 'approved' | 'rejected'; createdAt: string };
export type Store = { version: 1; employees: Employee[]; shifts: Shift[]; rules: Rules; swaps: Swap[]; dayOffs?: DayOff[] };
