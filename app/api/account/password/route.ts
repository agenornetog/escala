import { NextResponse } from 'next/server';
import { accountFailure, accountHeaders, accountIdentity, accountInput, AccountError, requireAccountOrigin } from '@/lib/account';
import { sessionCookieOptions } from '@/lib/auth';
import { MANAGER_COOKIE, updateAuthPassword, userAuthRequest } from '@/lib/manager-auth';

export async function POST(request: Request) {
  try {
    requireAccountOrigin(request);
    const { token, user } = await accountIdentity(request);
    const input = await accountInput(request);
    const current = input?.currentPassword, password = input?.password;
    if (!user.email || typeof current !== 'string' || !current || current.length > 256 || typeof password !== 'string' || password.length < 12 || password.length > 256 || password === current) {
      throw new AccountError('Informe a senha atual e escolha uma senha diferente, com pelo menos 12 caracteres.');
    }
    const verified = await userAuthRequest(token, '/auth/v1/token?grant_type=password', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: user.email, password: current }),
    });
    if (!verified.ok) throw new AccountError(verified.status === 429 ? 'Muitas tentativas. Aguarde alguns minutos.' : 'Confira a senha atual.', verified.status === 429 ? 429 : verified.status >= 500 ? 503 : 400);
    const session = await verified.json();
    if (typeof session.access_token !== 'string' || !Number.isSafeInteger(session.expires_in) || session.expires_in < 1) throw new AccountError('Não foi possível confirmar sua sessão.', 503);
    const updated = await updateAuthPassword(session.access_token, password, current);
    if (!updated.ok) throw new AccountError(updated.status === 429 ? 'Muitas tentativas. Aguarde alguns minutos.' : 'Confira os requisitos da nova senha e tente novamente.', updated.status === 429 ? 429 : updated.status >= 500 ? 503 : 400);
    const response = NextResponse.json({ ok: true }, { headers: accountHeaders });
    const options = sessionCookieOptions(request);
    response.cookies.set(MANAGER_COOKIE, session.access_token, { ...options, maxAge: Math.min(options.maxAge, session.expires_in) });
    return response;
  } catch (error) { return accountFailure(error); }
}
