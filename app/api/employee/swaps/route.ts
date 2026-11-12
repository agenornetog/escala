import { cookies } from 'next/headers';
import { sameOrigin } from '@/lib/auth';
import { companyEmployeeSession, employeeRpc } from '@/lib/company-employee';
import { MANAGER_COOKIE, UUID } from '@/lib/manager-auth';

export async function POST(request: Request) {
  const headers = { 'Cache-Control': 'private, no-store' };
  const fail = (error: string, status: number) => Response.json({ error }, { status, headers });
  if (!sameOrigin(request)) return fail('Solicitação não permitida.', 403);
  const raw = await request.text();
  if (raw.length > 4096) return fail('Dados inválidos.', 400);
  const input = await Promise.resolve().then(() => JSON.parse(raw)).catch(() => null);
  const reason = typeof input?.reason === 'string' ? input.reason.trim() : '';
  if (typeof input?.organization !== 'string' || !UUID.test(input.organization) || typeof input.shift !== 'string'
    || !input.shift || input.shift.length > 120 || !reason || reason.length > 500) return fail('Selecione o turno e informe o motivo.', 400);
  try {
    const current = await companyEmployeeSession((await cookies()).get(MANAGER_COOKIE)?.value, input.organization);
    if (!current?.account.allow_swaps) return fail('A troca de turno não está habilitada para este acesso.', 403);
    const response = await employeeRpc('escala_employee_swap_submit', {
      p_organization: input.organization, p_user: current.actor, p_shift: input.shift, p_reason: reason,
    });
    if (response.ok) return Response.json({ id: await response.json() }, { status: 201, headers });
    const { code } = await response.json();
    if (code === '23505') return fail('Já existe um pedido pendente para este turno.', 409);
    if (code === '42501') return fail('Este turno não está disponível para solicitação.', 403);
    throw new Error('Submit failed');
  } catch {
    return fail('Não foi possível enviar a solicitação. Tente novamente.', 503);
  }
}
