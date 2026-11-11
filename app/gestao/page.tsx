import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { MANAGER_COOKIE, managerSession, ManagerAuthUnavailable } from '@/lib/manager-auth';

export default async function ManagementPage() {
  const token = (await cookies()).get(MANAGER_COOKIE)?.value;
  let session;
  try {
    session = await managerSession(token);
  } catch (error) {
    if (!(error instanceof ManagerAuthUnavailable)) throw error;
    return <main><h1>Empresas</h1><p>Não foi possível carregar suas empresas. Tente novamente em instantes.</p></main>;
  }
  if (!session) redirect('/login');

  return <main className="mx-auto max-w-3xl p-6">
    <h1 className="text-2xl font-semibold">Suas empresas</h1>
    <ul className="mt-4 space-y-2">
      {session.companies.map(company => <li key={company.id}>
        {company.name} <span>({company.role === 'admin' ? 'Administrador' : 'Gestor'})</span>
      </li>)}
    </ul>
  </main>;
}
