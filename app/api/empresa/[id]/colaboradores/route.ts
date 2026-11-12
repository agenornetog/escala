import { cookies } from 'next/headers';
import { sameOrigin } from '@/lib/auth';
import { employeeRpc, employeeSwapHistory } from '@/lib/company-employee';
import { coveragePlan, type EmployeeSwap } from '@/lib/employee-swaps';
import { MANAGER_COOKIE, managerBackend, verifiedManagerId, UUID } from '@/lib/manager-auth';
import { parsePlanning } from '@/lib/planning-validation';
import type { Store } from '@/lib/types';
import { validate } from '@/lib/validation';

type Context = { params: Promise<{ id: string }> };
const headers = { 'Cache-Control': 'private, no-store' };
const json = (value: object, status = 200) => Response.json(value, { status, headers });
const fail = (error: string, status: number) => json({ error }, status);

async function planning(id: string, actor: string) {
  return employeeRpc('escala_read_planning', { p_organization: id, p_actor: actor });
}

async function rpcError(response: Response) {
  const data = await response.json().catch(() => ({}));
  if (data.code === '40001') return fail('O planejamento ou o pedido mudou. Atualize o painel e tente novamente.', 409);
  if (data.code === '23505') return fail('Este e-mail já está vinculado ou o colaborador já tem outra conta.', 409);
  if (data.code === '42501') return fail('Você não tem acesso a esta empresa.', 403);
  return fail('Não foi possível concluir a operação. Tente novamente.', 503);
}

async function authorize(context: Context) {
  const { id } = await context.params;
  if (!UUID.test(id)) return fail('Empresa inválida.', 400);
  const actor = await verifiedManagerId((await cookies()).get(MANAGER_COOKIE)?.value);
  if (!actor) return fail('Entre novamente para continuar.', 401);
  const response = await planning(id, actor);
  if (!response.ok) return rpcError(response);
  const { revision, store }: { revision: number; store: Store | null } = await response.json();
  return { id, actor, revision, store };
}

export async function GET(_request: Request, context: Context) {
  try {
    const access = await authorize(context);
    if (access instanceof Response) return access;
    const { id, store } = access;
    const response = await managerBackend('/rest/v1/escala_employee_accounts?organization_id=eq.' + id + '&select=employee_id,email,allow_swaps,published_at');
    if (!response.ok) return rpcError(response);
    const accounts = (await response.json()).filter((row: { employee_id: string }) =>
      store?.employees.some(employee => employee.id === row.employee_id));
    return json({ accounts, swaps: await employeeSwapHistory(id) });
  } catch {
    return fail('Não foi possível carregar os acessos e as solicitações.', 503);
  }
}

export async function POST(request: Request, context: Context) {
  if (!sameOrigin(request)) return fail('Solicitação não permitida.', 403);
  const raw = await request.text();
  if (raw.length > 4096) return fail('Dados inválidos.', 400);
  const input = await Promise.resolve().then(() => JSON.parse(raw)).catch(() => null);
  if (!input || typeof input !== 'object') return fail('Dados inválidos.', 400);
  try {
    const access = await authorize(context);
    if (access instanceof Response) return access;
    const { id, actor, revision, store } = access;
    const scope = { p_organization: id, p_actor: actor };
    if (!store) return fail('Salve o cadastro da empresa antes de continuar.', 409);

    if (input.action === 'link') {
      const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
      const password = input.password ?? '';
      if (typeof password !== 'string' || (password && (password.length < 12 || password.length > 256))) {
        return fail('A senha provisória precisa ter de 12 a 256 caracteres.', 400);
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254
        || typeof input.allowSwaps !== 'boolean' || !store.employees.some(employee => employee.id === input.employee)) {
        return fail('Confira o colaborador e o e-mail informado.', 400);
      }
      const payload = { ...scope, p_employee: input.employee, p_email: email, p_allow_swaps: input.allowSwaps };
      let linked = await employeeRpc('escala_employee_account_link', payload);
      if (!linked.ok) return rpcError(linked);
      const existing = await linked.json() as { confirmed: boolean } | null;
      if (password && !existing) {
        const created = await managerBackend('/auth/v1/admin/users', {
          method: 'POST', body: JSON.stringify({ email, password, email_confirm: true }),
        });
        if (!created.ok) return fail('Não foi possível criar a conta com essa senha. Confira os requisitos e tente novamente.', 400);
        linked = await employeeRpc('escala_employee_account_link', payload);
        if (!linked.ok) return rpcError(linked);
        if (!(await linked.json())) return fail('A conta foi criada. Tente vincular novamente pelo acesso do colaborador.', 503);
        return json({ passwordCreated: true });
      }
      if (password && existing) return json({ passwordCreated: false });
      if (existing && (existing.confirmed || input.resend !== true)) {
        if (input.resend === true) return fail('Este e-mail já foi confirmado. O colaborador pode entrar com a conta existente.', 409);
        return json({ invited: false });
      }
      const callback = 'https://escala-bice.vercel.app/ativar-acesso';
      const invite = await managerBackend('/auth/v1/invite?redirect_to=' + encodeURIComponent(callback), {
        method: 'POST', body: JSON.stringify({ email }),
      });
      // A concurrent invite or a retry after a response loss may already have created the Auth user.
      linked = await employeeRpc('escala_employee_account_link', payload);
      if (!linked.ok) return rpcError(linked);
      const account = await linked.json() as { confirmed: boolean } | null;
      if (!account || (!invite.ok && !account.confirmed)) return fail('O cadastro foi salvo, mas o convite não foi enviado. Tente novamente pelo acesso do colaborador.', 502);
      return json({ invited: invite.ok });
    }

    if (input.revision !== revision) return fail('O planejamento mudou. Atualize o painel antes de continuar.', 409);
    if (input.action === 'decide' && typeof input.requestId === 'string' && UUID.test(input.requestId)) {
      const decision = typeof input.decision === 'string' ? input.decision.trim() : '';
      if (typeof input.approve !== 'boolean') return fail('Informe a decisão sobre a solicitação.', 400);
      const approve = input.approve;
      if (approve && (typeof input.replacement !== 'string' || !input.replacement)) return fail('Selecione quem fará a cobertura.', 400);
      if (decision.length > 500 || (!approve && !decision)) return fail('Informe o motivo da recusa.', 400);
      const response = await managerBackend('/rest/v1/escala_employee_swap_requests?organization_id=eq.' + id + '&id=eq.' + input.requestId + '&select=id,shift,status');
      if (!response.ok) return rpcError(response);
      const [swap]: EmployeeSwap[] = await response.json();
      if (!swap || swap.status !== 'pending') return fail('Esta solicitação já foi decidida ou não está disponível.', 409);
      let next: Store | null = null;
      if (approve) {
        try {
          next = parsePlanning(coveragePlan(store, swap.shift, input.replacement));
          const issues = validate(next.shifts, next.employees, next.rules, next.dayOffs, next);
          const errors = issues.filter(issue => issue.severity === 'error');
          if (errors.length) return fail(errors.slice(0, 4).map(issue => issue.message).join(' '), 422);
        } catch (error) {
          return fail(error instanceof Error ? error.message : 'A cobertura é inválida.', 422);
        }
      }
      const result = await employeeRpc('escala_employee_swap_decide', {
        ...scope, p_request: swap.id, p_decision: decision || null, p_revision: revision,
        p_store: next, p_schedules: {},
      });
      if (!result.ok) return rpcError(result);
      return json({ revision: approve ? await result.json() : revision, store: next });
    }
    return fail('Operação inválida.', 400);
  } catch {
    return fail('Não foi possível concluir a operação. Tente novamente.', 503);
  }
}
