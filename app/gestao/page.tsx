import { CompanyProvisioning } from './company-provisioning';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { MANAGER_COOKIE, managerBackend, managerDestination, managerSession, ManagerAuthUnavailable } from '@/lib/manager-auth';

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

  if (session.platformAdmin) {
    const response = await managerBackend('/rest/v1/escala_organizations?select=id,name&order=name');
    if (!response.ok) throw new ManagerAuthUnavailable();
    const companies = await response.json();
    return <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-semibold">Administração do Escalô</h1>
      <p className="mt-2">Cadastre empresas e seus responsáveis.</p>
      <CompanyProvisioning companies={companies} />
    </main>;
  }

  const destination = managerDestination(session);
  if (destination !== '/gestao') redirect(destination);
  return <main className="mx-auto max-w-3xl p-6">
    <h1 className="text-2xl font-semibold">Suas empresas</h1>
    <ul className="mt-4 space-y-2">
      {session.companies.map(company => <li key={company.id}>
        <a href={'/empresa/' + company.id}>{company.name}</a> <span>({company.role === 'admin' ? 'Administrador' : 'Gestor'})</span>
      </li>)}
    </ul>
  </main>;
}
