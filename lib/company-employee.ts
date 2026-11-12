import { managerBackend, verifiedManagerId } from './manager-auth';
import { employeeSchedule } from './employee-schedule';
import type { EmployeeSchedule } from './employee-schedule';
import type { EmployeeSwap } from './employee-swaps';

export type CompanyEmployee = {
  organization_id: string;
  employee_id: string;
  allow_swaps: boolean;
  schedule: EmployeeSchedule | null;
  published_at: string | null;
  company: { name: string };
  employee?: EmployeeSchedule['employee'];
};

export function employeeRpc(name: string, body: object) {
  return managerBackend('/rest/v1/rpc/' + name, { method: 'POST', body: JSON.stringify(body) });
}

export async function companyEmployeeAccounts(actor: string): Promise<CompanyEmployee[]> {
  const response = await employeeRpc('escala_employee_account_read', { p_user: actor });
  if (!response.ok) throw new Error('Não foi possível carregar os acessos do colaborador.');
  return response.json();
}

export async function companyEmployeeSession(token: string | undefined, organization?: string) {
  const actor = await verifiedManagerId(token);
  if (!actor) return null;
  const accounts = await companyEmployeeAccounts(actor);
  const account = organization ? accounts.find(item => item.organization_id === organization) : accounts[0];
  return account ? { actor, account, companies: accounts.map(item => ({ id: item.organization_id, name: item.company.name })) } : null;
}

export async function employeeSwapHistory(organization: string, employee?: string): Promise<EmployeeSwap[]> {
  const query = new URLSearchParams({
    organization_id: 'eq.' + organization,
    select: 'id,shift,reason,status,decision,created_at',
    order: 'created_at.desc,id.desc',
    limit: '100',
  });
  if (employee !== undefined) query.set('employee_id', 'eq.' + employee);
  const response = await managerBackend('/rest/v1/escala_employee_swap_requests?' + query);
  if (!response.ok) throw new Error('Não foi possível carregar as solicitações.');
  return response.json();
}

export async function companyEmployeeView(token: string | undefined, organization?: string) {
  const session = await companyEmployeeSession(token, organization);
  if (!session) return null;
  const { account, companies } = session;
  return {
    schedule: employeeSchedule(account.schedule ?? {
      employee: account.employee, shifts: [], dayOffs: [], holidays: [],
    }, account.employee_id),
    publishedAt: account.published_at,
    organization: account.organization_id,
    companies,
    allowSwaps: account.allow_swaps,
    swaps: await employeeSwapHistory(account.organization_id, account.employee_id),
  };
}
