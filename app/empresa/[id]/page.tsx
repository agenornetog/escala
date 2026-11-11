import { companyUsers } from '@/lib/company-users';
import type { CompanyUser } from '@/components/company-users-form';
import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import Dashboard from '@/components/dashboard';
import { MANAGER_COOKIE, managerBackend, managerSession, verifiedManagerId, UUID } from '@/lib/manager-auth';
import type { Store } from '@/lib/types';
import { defaultRules } from '@/lib/validation';

export default async function CompanyPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ secao?: string | string[] }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const token = (await cookies()).get(MANAGER_COOKIE)?.value;
  const actor = await verifiedManagerId(token);
  if (!actor) redirect('/login');
  const session = await managerSession(token);
  const company = session?.companies.find(company => company.id === id);
  if (!company) notFound();
  const response = await managerBackend('/rest/v1/rpc/escala_read_planning', {
    method: 'POST', body: JSON.stringify({ p_organization: id, p_actor: actor }),
  });
  if (!response.ok) return <main role="alert">Não foi possível abrir o planejamento da empresa.</main>;
  const { revision, store }: { revision: number; store: Store | null } = await response.json();
  const canManageUsers = company.role === 'admin';
  const usersResponse = canManageUsers ? await companyUsers(id, actor).catch(() => null) : null;
  const users: CompanyUser[] | null = usersResponse?.ok ? await usersResponse.json() : null;
  const initialPage = canManageUsers && (await searchParams).secao === 'usuarios' ? 'Usuários' : 'Escalas';
  return <Dashboard key={id} initialPage={initialPage} company={{ id, name: company.name, canManageUsers, users, revision,
    store: store ?? { version: 1, employees: [], shifts: [], swaps: [], rules: defaultRules } }} />;
}
