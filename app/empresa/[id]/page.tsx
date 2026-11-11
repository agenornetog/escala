import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import Dashboard from '@/components/dashboard';
import { MANAGER_COOKIE, managerBackend, managerSession, verifiedManagerId, UUID } from '@/lib/manager-auth';
import type { Store } from '@/lib/types';
import { defaultRules } from '@/lib/validation';

export default async function CompanyPage({ params }: { params: Promise<{ id: string }> }) {
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
  return <Dashboard key={id} company={{ id, name: company.name, revision,
    store: store ?? { version: 1, employees: [], shifts: [], swaps: [], rules: defaultRules } }} />;
}
