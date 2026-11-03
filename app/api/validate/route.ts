import { NextResponse } from 'next/server';
import { authenticated } from '@/lib/auth';
import { validate } from '@/lib/validation';
import type { Employee, Rules, Shift } from '@/lib/types';
function validDate(value: unknown): value is string { return typeof value==='string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(value+'T12:00Z').toISOString().slice(0,10)===value; }
export async function POST(request: Request) {
 if (!authenticated(request)) return NextResponse.json({error: 'Sua sessão expirou. Entre novamente.'}, {status:401, headers:{'Cache-Control':'no-store'}});
 try {
  const data=await request.json();
  if (!data || !Array.isArray(data.shifts) || !Array.isArray(data.employees) || data.shifts.length>10000 || data.employees.length>1000 || !data.rules) throw new Error('invalid');
  const employees=data.employees as Employee[], shifts=data.shifts as Shift[], rules=data.rules as Rules;
  if (employees.some(e=>typeof e.id!=='string'||!Number.isInteger(e.sundayEvery)||e.sundayEvery<2||e.sundayEvery>5) || new Set(employees.map(e=>e.id)).size!==employees.length) throw new Error('invalid');
  const ids=new Set(employees.map(e=>e.id));
  if(shifts.some(s=>typeof s.id!=='string'||!ids.has(s.employeeId)||!validDate(s.date)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(s.start)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(s.end)||!Number.isInteger(s.breakMinutes)||s.breakMinutes<0||s.breakMinutes>120) || new Set(shifts.map(s=>s.id)).size!==shifts.length) throw new Error('invalid');
  const ranges: Record<keyof Rules,[number,number]>={dailyHours:[1,12],weeklyHours:[1,60],intershiftHours:[11,48],weeklyRestHours:[35,72],maxConsecutiveDays:[1,6],longBreakMinutes:[30,120],coverage:[1,100]};
  if(Object.entries(ranges).some(([key,[min,max]])=>!Number.isFinite(rules[key as keyof Rules])||rules[key as keyof Rules]<min||rules[key as keyof Rules]>max)) throw new Error('invalid');
  const issues=validate(shifts,employees,rules);
  return NextResponse.json({valid:!issues.some(i=>i.severity==='error'),issues});
 } catch { return NextResponse.json({error:'Dados de escala inválidos. Confira os campos e tente novamente.'},{status:400}); }
}
