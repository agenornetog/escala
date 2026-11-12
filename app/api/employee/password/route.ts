import { cookieFromRequest, sameOrigin } from '@/lib/auth';
import { companyEmployeeSession } from '@/lib/company-employee';
import { MANAGER_COOKIE, updateAuthPassword } from '@/lib/manager-auth';

export async function POST(request: Request) {
  const headers = { 'Cache-Control': 'no-store' };
  const fail = (error: string, status: number) => Response.json({ error }, { status, headers });
  if (!sameOrigin(request)) return fail('Solicitação não permitida.', 403);
  const raw = await request.text();
  if (raw.length > 4096) return fail('Dados inválidos.', 400);
  const input = await Promise.resolve().then(() => JSON.parse(raw)).catch(() => null);
  const currentPassword = input?.currentPassword;
  const password = input?.password;
  if (typeof currentPassword !== 'string' || !currentPassword || currentPassword.length > 256
    || typeof password !== 'string' || password.length < 12 || password.length > 256 || password === currentPassword) {
    return fail('Informe a senha atual e escolha uma senha diferente, com pelo menos 12 caracteres.', 400);
  }
  const token = cookieFromRequest(request, MANAGER_COOKIE);
  try {
    if (!token || !(await companyEmployeeSession(token))) return fail('Entre novamente para alterar a senha.', 401);
    const result = await updateAuthPassword(token, password, currentPassword);
    if (result.ok) return Response.json({ ok: true }, { headers });
    if (result.status === 429) return fail('Muitas tentativas. Aguarde alguns minutos e tente novamente.', 429);
    if (result.status >= 500) return fail('O serviço de autenticação está indisponível.', 503);
    return fail('Confira a senha atual e os requisitos da nova senha.', 400);
  } catch {
    return fail('Não foi possível alterar a senha agora. Tente novamente.', 503);
  }
}
