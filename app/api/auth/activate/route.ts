import { sameOrigin } from '@/lib/auth';
import { companyEmployeeSession } from '@/lib/company-employee';
import { setInvitedUserPassword } from '@/lib/manager-auth';

export async function POST(request: Request) {
  const headers = { 'Cache-Control': 'no-store' };
  const fail = (error: string, status: number) => Response.json({ error }, { status, headers });
  if (!sameOrigin(request)) return fail('Solicitação não permitida.', 403);
  const body = await request.text();
  if (body.length > 4096) return fail('Dados inválidos.', 400);
  const input = await Promise.resolve().then(() => JSON.parse(body)).catch(() => null);
  if (!input || typeof input.token !== 'string' || !input.token || input.token.length > 3500
    || typeof input.password !== 'string' || input.password.length < 12 || input.password.length > 256) {
    return fail('Use uma senha de pelo menos 12 caracteres.', 400);
  }
  try {
    if (!(await companyEmployeeSession(input.token))) return fail('Convite inválido ou expirado.', 401);
    const result = await setInvitedUserPassword(input.token, input.password);
    return result.ok ? Response.json({ ok: true }, { headers }) : fail('Não foi possível definir a senha. Confira o convite e tente novamente.', 400);
  } catch {
    return fail('Não foi possível ativar o acesso agora. Tente novamente.', 503);
  }
}
