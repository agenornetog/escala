import { NextResponse } from 'next/server';
import { authConfigured, createSession, sameOrigin, sessionCookieOptions, SESSION_COOKIE, verifyCredentials } from '@/lib/auth';
import { authenticateEmployee, employeeAccessConfigured, EmployeeStorageError } from '@/lib/employee-storage';
import { createEmployeeSession } from '@/lib/employee-session';
import { authenticateManager, managerAuthConfigured, MANAGER_COOKIE, ManagerAuthUnavailable } from '@/lib/manager-auth';
import { allowLogin } from '@/lib/login-limit';
export const runtime = 'nodejs';
const headers = { 'Cache-Control': 'no-store' };
export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: 'Solicitação não permitida.' }, { status: 403, headers });
  if (!authConfigured()&&!employeeAccessConfigured()&&!managerAuthConfigured()) return NextResponse.json({ error: 'O acesso ainda não foi liberado. Entre em contato com o responsável pelo sistema.' }, { status: 503, headers });
  try {
    const body = await request.text();
    if (body.length > 2048) throw new Error('Invalid');
    const { email, password } = JSON.parse(body);
    if (typeof email !== 'string' || typeof password !== 'string' || email.length > 254 || !password || password.length > 256) throw new Error('Invalid');
    if (!allowLogin(email.trim().toLowerCase())) return NextResponse.json({error:'Muitas tentativas de acesso. Tente novamente em 15 minutos.'},{status:429,headers:{...headers,'Retry-After':'900'}});
    const admin=await verifyCredentials(email,password);
    const manager = admin ? null : await authenticateManager(email, password);
    if (manager) {
      const response = NextResponse.json({ ok: true, redirectTo: '/gestao' }, { headers });
      const options = sessionCookieOptions(request);
      response.cookies.set(MANAGER_COOKIE, manager.token, { ...options, maxAge: Math.min(options.maxAge, manager.maxAge) });
      response.cookies.set(SESSION_COOKIE, '', { ...options, maxAge: 0 });
      if (request.headers.get('cookie')?.includes(MANAGER_COOKIE + '=')) response.cookies.set(MANAGER_COOKIE, '', { ...sessionCookieOptions(request), maxAge: 0 });
    return response;
    }
    const employee=admin?null:await authenticateEmployee(email,password);
    if (!admin&&!employee) return NextResponse.json({ error: 'E-mail ou senha incorretos. Confira e tente novamente.' }, { status: 401, headers });
    const response = NextResponse.json(employee?{ok:true,redirectTo:'/colaborador'}:{ ok: true }, { headers });
    response.cookies.set(SESSION_COOKIE, employee?createEmployeeSession(employee):createSession(), sessionCookieOptions(request));
    if (request.headers.get('cookie')?.includes(MANAGER_COOKIE + '=')) response.cookies.set(MANAGER_COOKIE, '', { ...sessionCookieOptions(request), maxAge: 0 });
    return response;
  } catch(error) { if(error instanceof ManagerAuthUnavailable)return NextResponse.json({error:'O serviço de autenticação está indisponível. Tente novamente.'},{status:503,headers}); if(error instanceof EmployeeStorageError)return NextResponse.json({error:error.message},{status:error.status,headers}); return NextResponse.json({ error: 'Informe um e-mail e uma senha válidos.' }, { status: 400, headers }); }
}
