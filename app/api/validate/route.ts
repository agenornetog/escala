import { MANAGER_COOKIE, managerSession } from '@/lib/manager-auth';
import { NextResponse } from 'next/server';
import { loginRequired } from '@/lib/access';
import { cookieFromRequest, authenticated } from '@/lib/auth';
import { isEmployeeToken } from '@/lib/employee-session';
import { assessLabor } from '@/lib/labor-assessment';
import { validate } from '@/lib/validation';
import { validatePlanningFields } from '@/lib/planning-validation';
export async function POST(request: Request) {
 if(isEmployeeToken(cookieFromRequest(request)))return NextResponse.json({error:'Acesso de colaborador é somente leitura.'},{status:403,headers:{'Cache-Control':'no-store'}});
 if (loginRequired() && !authenticated(request)) {
  const token = request.headers.get('cookie')?.split(';').map(value => value.trim())
    .find(value => value.startsWith(MANAGER_COOKIE + '='))?.slice(MANAGER_COOKIE.length + 1);
  if (!await managerSession(token).catch(() => null)) {
   return NextResponse.json({error: 'Sua sessão expirou. Entre novamente.'}, {status:401, headers:{'Cache-Control':'no-store'}});
  }
 }
 try {
  const data=await request.json();
  const { employees, shifts, rules, dayOffs, labor, absences, holidays, workspaceLocation } = validatePlanningFields(data);
  const issues=validate(shifts,employees,rules,dayOffs,{labor,absences,holidays,workspaceLocation});
  const assessment=data.reviewMonth===undefined?undefined:assessLabor({version:1,employees,shifts,rules,swaps:[],dayOffs,labor,absences,holidays,workspaceLocation},data.reviewMonth);
  return NextResponse.json({assessment,valid:!issues.some(i=>i.severity==='error'),issues,compliance:{certified:false,scope:'configured-planning-rules',pending:['CCT e enquadramento individual','Histórico completo e DSR','Adicionais e hora noturna','Limites semanais em turnos que atravessam a semana']}});
 } catch { return NextResponse.json({error:'Dados de escala inválidos. Confira os campos e tente novamente.'},{status:400}); }
}
