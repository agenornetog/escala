import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, verifySession } from '@/lib/auth';
export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (path === '/login' || path === '/api/auth/login' || path === '/api/auth/logout') return NextResponse.next();
  if (verifySession(request.cookies.get(SESSION_COOKIE)?.value)) return NextResponse.next();
  if (path.startsWith('/api/')) return NextResponse.json({ error: 'Sua sessão expirou. Entre novamente.' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  return NextResponse.redirect(new URL('/login', request.url));
}
export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
