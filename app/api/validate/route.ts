import { NextResponse } from 'next/server';
import { loginRequired } from '@/lib/access';
import { cookieFromRequest, authenticated } from '@/lib/auth';
import { isEmployeeToken } from '@/lib/employee-session';
import { assessLabor } from '@/lib/labor-assessment';
import { normalizeLabor, normalizeAbsences } from '@/lib/labor-rules';
import { normalizeHoliday, normalizeLocation } from '@/lib/holidays';
import { normalizeWorkSchedule } from '@/lib/work-schedule';
import { validate } from '@/lib/validation';
import { ruleLimitKeys, ruleRanges, validRuleValue } from '@/lib/rule-profile';
import type { DayOff, Employee, Rules, Shift } from '@/lib/types';
function validDate(value: unknown): value is string { return typeof value==='string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(value+'T12:00Z').toISOString().slice(0,10)===value; }
export async function POST(request: Request) {
 if(isEmployeeToken(cookieFromRequest(request)))return NextResponse.json({error:'Acesso de colaborador é somente leitura.'},{status:403,headers:{'Cache-Control':'no-store'}});
 if (loginRequired() && !authenticated(request)) return NextResponse.json({error: 'Sua sessão expirou. Entre novamente.'}, {status:401, headers:{'Cache-Control':'no-store'}});
 try {
  const data=await request.json();
  if (!data || !Array.isArray(data.shifts) || !Array.isArray(data.employees) || data.shifts.length>10000 || data.employees.length>1000 || !data.rules) throw new Error('invalid');
  const employees=data.employees as Employee[], shifts=data.shifts as Shift[], rules=data.rules as Rules;
  if (employees.some(e=>typeof e.id!=='string'||!Number.isInteger(e.sundayEvery)||e.sundayEvery<2||e.sundayEvery>3) || new Set(employees.map(e=>e.id)).size!==employees.length) throw new Error('invalid');
  const ids=new Set(employees.map(e=>e.id));
  if(shifts.some(s=>typeof s.id!=='string'||!ids.has(s.employeeId)||!validDate(s.date)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(s.start)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(s.end)||!Number.isInteger(s.breakMinutes)||s.breakMinutes<0||s.breakMinutes>120) || new Set(shifts.map(s=>s.id)).size!==shifts.length) throw new Error('invalid');
  if(ruleLimitKeys.some(key=>!validRuleValue(key,rules[key])))throw new Error('invalid');
  if(rules.agreementReference!==undefined&&(typeof rules.agreementReference!=='string'||rules.agreementReference.length>500))throw new Error('invalid');
  for(const employee of employees){
    if(employee.laborInstrumentId!==undefined&&(typeof employee.laborInstrumentId!=='string'||employee.laborInstrumentId.length>120))throw new Error('invalid');
    if(employee.laborCategory!==undefined&&(typeof employee.laborCategory!=='string'||employee.laborCategory.length>150))throw new Error('invalid');
    if(employee.sundayReference!==undefined&&(typeof employee.sundayReference!=='string'||employee.sundayReference.length>500))throw new Error('invalid');
    if(employee.laborCondition!==undefined&&!['general','special'].includes(employee.laborCondition))throw new Error('invalid');
    if(employee.workSchedule!==undefined)normalizeWorkSchedule(employee.workSchedule);
    if(!['5x2','6x1'].includes(employee.regime))throw new Error('invalid');
    if(employee.agreementReference!==undefined&&(typeof employee.agreementReference!=='string'||employee.agreementReference.length>500))throw new Error('invalid');
    if(employee.ruleOverrides!==undefined){
      if(!employee.ruleOverrides||typeof employee.ruleOverrides!=='object'||Array.isArray(employee.ruleOverrides))throw new Error('invalid');
      for(const [key,value] of Object.entries(employee.ruleOverrides)){
        if(!ruleLimitKeys.includes(key as keyof typeof ruleRanges)||key==='coverage')throw new Error('invalid');
        if(!validRuleValue(key as keyof typeof ruleRanges,value))throw new Error('invalid');
      }
    }
  }
  const dayOffs=(data.dayOffs??[]) as DayOff[];
  if(!Array.isArray(dayOffs)||dayOffs.length>100000||dayOffs.some(off=>typeof off.id!=='string'||!ids.has(off.employeeId)||!validDate(off.date))||new Set(dayOffs.map(off=>off.id)).size!==dayOffs.length||new Set(dayOffs.map(off=>`${off.employeeId}/${off.date}`)).size!==dayOffs.length)throw new Error('invalid');
  const labor=normalizeLabor(data.labor),workspaceLocation=normalizeLocation(data.workspaceLocation);
  const absences=normalizeAbsences(data.absences,ids);
  if(data.holidays!==undefined&&(!Array.isArray(data.holidays)||data.holidays.length>2000))throw new Error('invalid');
  const holidays=(data.holidays??[]).map(normalizeHoliday);
  if(employees.some(e=>e.laborInstrumentId&&!labor?.instruments.some(i=>i.id===e.laborInstrumentId)))throw new Error('invalid');
  const issues=validate(shifts,employees,rules,dayOffs,{labor,absences,holidays,workspaceLocation});
  const assessment=data.reviewMonth===undefined?undefined:assessLabor({version:1,employees,shifts,rules,swaps:[],dayOffs,labor,absences,holidays,workspaceLocation},data.reviewMonth);
  return NextResponse.json({assessment,valid:!issues.some(i=>i.severity==='error'),issues,compliance:{certified:false,scope:'configured-planning-rules',pending:['CCT e enquadramento individual','Histórico completo e DSR','Adicionais e hora noturna','Limites semanais em turnos que atravessam a semana']}});
 } catch { return NextResponse.json({error:'Dados de escala inválidos. Confira os campos e tente novamente.'},{status:400}); }
}
