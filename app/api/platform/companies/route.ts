import { cookies } from 'next/headers';
import { sameOrigin } from '@/lib/auth';
import { MANAGER_COOKIE, managerBackend, platformActor, UUID } from '@/lib/manager-auth';

const headers = { 'Cache-Control': 'no-store' };
function error(message: string, status: number) {
  return Response.json({ error: message }, { status, headers });
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return error('Solicitação não permitida.', 403);
  try {
    const actor = await platformActor((await cookies()).get(MANAGER_COOKIE)?.value);
    if (!actor) return error('Acesso restrito ao administrador da plataforma.', 403);

    const body = await request.text();
    if (body.length > 2048) return error('Dados inválidos.', 400);
    const { companyId, name, email, password } = JSON.parse(body);
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    if (normalizedEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
      || (companyId ? typeof companyId !== 'string' || !UUID.test(companyId) : typeof name !== 'string' || !name.trim() || name.length > 150)
      || (password && (typeof password !== 'string' || password.length < 12 || password.length > 256))) {
      return error('Confira os dados e use pelo menos 12 caracteres para uma conta nova.', 400);
    }

    if (password) {
      const created = await managerBackend('/auth/v1/admin/users', {
        method: 'POST',
        body: JSON.stringify({ email: normalizedEmail, password, email_confirm: true }),
      });
      if (!created.ok) return error('Não foi possível criar a conta. Se o e-mail já estiver cadastrado, deixe a senha em branco para vincular a conta existente.', 400);
    }

    const result = await managerBackend('/rest/v1/rpc/escala_provision_company', {
      method: 'POST',
      body: JSON.stringify({
        p_actor: actor, p_email: normalizedEmail,
        p_name: companyId ? null : name.trim(), p_organization: companyId || null,
      }),
    });
    if (!result.ok) return error('Não foi possível vincular a conta. Confira se o e-mail está confirmado e a empresa existe.', 400);
    return Response.json({ organizationId: await result.json() }, { headers });
  } catch {
    return error('Não foi possível concluir o cadastro. Se uma conta nova já foi criada, tente vinculá-la com a senha em branco.', 503);
  }
}
