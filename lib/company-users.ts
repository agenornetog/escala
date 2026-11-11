import { managerBackend } from './manager-auth';

export function companyUsers(organization: string, actor: string, change: { email?: string; role?: string; remove?: string } = {}) {
  return managerBackend('/rest/v1/rpc/escala_company_users', {
    method: 'POST',
    body: JSON.stringify({
      p_organization: organization,
      p_actor: actor,
      p_email: change.email ?? null,
      p_role: change.role ?? null,
      p_remove: change.remove ?? null,
    }),
  });
}
