import { NextResponse } from 'next/server';
import { authConfigured, createSession, sameOrigin, sessionCookieOptions, SESSION_COOKIE, verifyCredentials } from '@/lib/auth';
import { allowLogin } from '@/lib/login-limit';
export const runtime = 'nodejs';
const headers = { 'Cache-Control': 'no-store' };
export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: 'Solicitação não permitida.' }, { status: 403, headers });
  if (!authConfigured()) return NextResponse.json({ error: 'O acesso ainda não foi liberado. Entre em contato com o responsável pelo sistema.' }, { status: 503, headers });
  if (!allowLogin()) return NextResponse.json({ error: 'Muitas tentativas de acesso. Tente novamente em 15 minutos.' }, { status: 429, headers: { ...headers, 'Retry-After': '900' } });
  try {
    const body = await request.text();
    if (body.length > 2048) throw new Error('Invalid');
    const { email, password } = JSON.parse(body);
    if (typeof email !== 'string' || typeof password !== 'string' || email.length > 254 || !password || password.length > 256) throw new Error('Invalid');
    if (!await verifyCredentials(email, password)) return NextResponse.json({ error: 'E-mail ou senha incorretos. Confira e tente novamente.' }, { status: 401, headers });
    const response = NextResponse.json({ ok: true }, { headers });
    response.cookies.set(SESSION_COOKIE, createSession(), sessionCookieOptions(request));
    return response;
  } catch { return NextResponse.json({ error: 'Informe um e-mail e uma senha válidos.' }, { status: 400, headers }); }
}
