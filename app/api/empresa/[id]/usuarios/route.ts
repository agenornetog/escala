import { cookies } from 'next/headers';
import { sameOrigin } from '@/lib/auth';
import { MANAGER_COOKIE, managerBackend, verifiedManagerId, UUID } from '@/lib/manager-auth';
import { companyUsers } from '@/lib/company-users';

function failure(error: string, status: number) {
  return Response.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!sameOrigin(request) || !UUID.test(id)) return failure('Solicitação não permitida.', 403);
  try {
    const actor = await verifiedManagerId((await cookies()).get(MANAGER_COOKIE)?.value);
    if (!actor) return failure('Entre novamente para continuar.', 401);
    const access = await companyUsers(id, actor);
    if (!access.ok) return failure('Somente administradores podem gerenciar esta equipe.', access.status === 403 ? 403 : 503);

    const raw = await request.text();
    if (raw.length > 2048) return failure('Dados inválidos.', 400);
    let data;
    try { data = JSON.parse(raw); } catch { return failure('Dados inválidos.', 400); }
    if (!data || typeof data !== 'object') return failure('Dados inválidos.', 400);
    const { remove, email, role, password } = data;
    if (remove !== undefined) {
      if (typeof remove !== 'string' || !UUID.test(remove) || remove === actor) return failure('Não é possível remover este acesso.', 400);
      const result = await companyUsers(id, actor, { remove });
      return result.ok ? Response.json({ ok: true }) : failure('Não foi possível remover o acesso.', result.status === 403 ? 403 : 503);
    }

    const normalized = typeof email === 'string' ? email.trim().toLowerCase() : '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) || normalized.length > 254
      || !['admin', 'manager'].includes(role) || typeof password !== 'string'
      || (password && (password.length < 12 || password.length > 256))) {
      return failure('Confira o e-mail, o papel e a senha inicial.', 400);
    }
    if (password) {
      const created = await managerBackend('/auth/v1/admin/users', {
        method: 'POST', body: JSON.stringify({ email: normalized, password, email_confirm: true }),
      });
      if (!created.ok) return failure('Não foi possível criar a conta. Para vincular um e-mail já cadastrado, deixe a senha em branco.', 400);
    }

    const result = await companyUsers(id, actor, { email: normalized, role });
    return result.ok ? Response.json({ ok: true }) : failure('Não foi possível vincular o acesso. Confira se a conta existe e está confirmada.', result.status === 403 ? 403 : 400);
  } catch {
    return failure('Não foi possível concluir. Se a conta já foi criada, tente vincular com a senha em branco.', 503);
  }
}
