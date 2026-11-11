import { NextResponse } from 'next/server';
import { MANAGER_COOKIE } from '@/lib/manager-auth';
import { sameOrigin, sessionCookieOptions, SESSION_COOKIE } from '@/lib/auth';
export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: 'Solicitação não permitida.' }, { status: 403 });
  const response = NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  response.cookies.set(SESSION_COOKIE, '', { ...sessionCookieOptions(request), maxAge: 0 });
  if (request.headers.get('cookie')?.includes(MANAGER_COOKIE + '=')) response.cookies.set(MANAGER_COOKIE, '', { ...sessionCookieOptions(request), maxAge: 0 });
  return response;
}
