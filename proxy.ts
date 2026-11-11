import { NextResponse, type NextRequest } from 'next/server';
import { loginRequired } from '@/lib/access';
import { SESSION_COOKIE, verifySession } from '@/lib/auth';
import { isEmployeeToken } from '@/lib/employee-session';
export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const token=request.cookies.get(SESSION_COOKIE)?.value;
  if(path==='/colaborador'||path==='/api/employee/me'||path.startsWith('/fonts/'))return NextResponse.next();
  if (path === '/login' || path === '/gestao' || path === '/api/platform/companies' || path === '/api/auth/login' || path === '/api/auth/logout') return NextResponse.next();
  if(isEmployeeToken(token)){
    if(path.startsWith('/api/'))return NextResponse.json({error:'O acesso do colaborador permite apenas consultar a própria jornada.'},{status:403,headers:{'Cache-Control':'no-store'}});
    return NextResponse.redirect(new URL('/colaborador',request.url));
  }
  if (!loginRequired()) return NextResponse.next();
  if (verifySession(request.cookies.get(SESSION_COOKIE)?.value)) return NextResponse.next();
  if (path.startsWith('/api/')) return NextResponse.json({ error: 'Sua sessão expirou. Entre novamente.' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  return NextResponse.redirect(new URL('/login', request.url));
}
export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
