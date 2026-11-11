import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { MANAGER_COOKIE, managerSession, verifiedManagerId, UUID } from '@/lib/manager-auth';
import { companyUsers } from '@/lib/company-users';
import { UsersForm } from './users-form';

export default async function UsersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const token = (await cookies()).get(MANAGER_COOKIE)?.value;
  const actor = await verifiedManagerId(token);
  if (!actor) redirect('/login');
  const company = (await managerSession(token))?.companies.find(company => company.id === id && company.role === 'admin');
  if (!company) notFound();
  const response = await companyUsers(id, actor);
  return <main className="mx-auto max-w-3xl p-6">
    <a href={'/empresa/' + id}>Voltar ao planejamento</a>
    <h1 className="mt-4 text-2xl font-semibold">Usuários de {company.name}</h1>
    {response.ok ? <UsersForm organization={id} users={await response.json()} /> : <p role="alert">Não foi possível carregar os usuários.</p>}
  </main>;
}
