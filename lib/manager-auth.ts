export const MANAGER_COOKIE = 'escala_manager';
const UUID = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;

type AuthConfig = { url: string; key: string };
export type Company = { id: string; name: string; role: 'admin' | 'manager' };

function configuration(): AuthConfig | null {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  return url && /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url) && key ? { url, key } : null;
}

export function managerAuthConfigured() {
  return Boolean(configuration() && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export class ManagerAuthUnavailable extends Error {}

async function supabaseRequest(fetcher: typeof fetch, url: string, init: RequestInit) {
  try {
    const response = await fetcher(url, { ...init, cache: 'no-store', signal: AbortSignal.timeout(10000) });
    if (response.ok || response.status === 400 || response.status === 401 || response.status === 403) return response;
  } catch {
    // Network errors and timeouts use the same public error.
  }
  throw new ManagerAuthUnavailable();
}

async function memberships(actor: string): Promise<Company[]> {
  const config = configuration();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!config || !key) throw new ManagerAuthUnavailable();
  const query = new URLSearchParams({
    user_id: 'eq.' + actor,
    select: 'role,company:escala_organizations!inner(id,name)',
  });
  const response = await supabaseRequest(fetch, config.url + '/rest/v1/escala_memberships?' + query, {
    headers: { apikey: key, Authorization: 'Bearer ' + key },
  });
  if (!response.ok) throw new ManagerAuthUnavailable();
  const rows: { role: Company['role']; company: { id: string; name: string } }[] = await response.json();
  return rows.map(({ role, company }) => ({ ...company, role }));
}

export async function managerSession(
  token: string | undefined,
  listCompanies = memberships,
  config = configuration(),
  fetcher = fetch,
) {
  if (!config || !token || token.length > 3500) return null;
  const response = await supabaseRequest(fetcher, config.url + '/auth/v1/user', {
    headers: { apikey: config.key, Authorization: 'Bearer ' + token },
  });
  if (!response.ok) return null;
  const { id } = await response.json();
  if (typeof id !== 'string' || !UUID.test(id)) return null;
  const companies = await listCompanies(id);
  return companies.length ? { companies } : null;
}

export async function authenticateManager(email: string, password: string) {
  const config = configuration();
  if (!config || !managerAuthConfigured()) return null;
  const response = await supabaseRequest(fetch, config.url + '/auth/v1/token?grant_type=password', {
    method: 'POST',
    headers: { apikey: config.key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
  });
  if (!response.ok) return null;
  const { access_token, expires_in } = await response.json();
  if (typeof access_token !== 'string' || !Number.isSafeInteger(expires_in) || expires_in < 1) return null;
  return await managerSession(access_token) ? { token: access_token, maxAge: expires_in } : null;
}
