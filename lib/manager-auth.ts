export const MANAGER_COOKIE = 'escala_manager';
export const UUID = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;

type AuthConfig = { url: string; key: string };
export type Company = { id: string; name: string; role: 'admin' | 'manager' };

function configuration(): AuthConfig | null {
  const url = (process.env.SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim())?.replace(/\/$/, '');
  const key = process.env.SUPABASE_PUBLISHABLE_KEY?.trim()
    || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim()
    || process.env.SUPABASE_ANON_KEY?.trim()
    || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  return url && /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url) && key ? { url, key } : null;
}

function membershipHeaders(): Record<string, string> | null {
  const secret = process.env.SUPABASE_SECRET_KEY?.trim();
  if (secret) return { apikey: secret };
  const legacy = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  return legacy ? { apikey: legacy, Authorization: 'Bearer ' + legacy } : null;
}

export function managerAuthConfigured() {
  return Boolean(configuration() && membershipHeaders());
}

export class ManagerAuthUnavailable extends Error {}

async function supabaseRequest(fetcher: typeof fetch, url: string, init: RequestInit, preserveErrors = false) {
  try {
    const response = await fetcher(url, { ...init, cache: 'no-store', signal: AbortSignal.timeout(10000) });
    if (preserveErrors || response.ok || response.status === 400 || response.status === 401 || response.status === 403) return response;
  } catch {
    // Network errors and timeouts use the same public error.
  }
  throw new ManagerAuthUnavailable();
}

export async function managerBackend(path: string, init: RequestInit = {}) {
  const config = configuration();
  const headers = membershipHeaders();
  if (!config || !headers) throw new ManagerAuthUnavailable();
  return supabaseRequest(fetch, config.url + path, {
    ...init,
    headers: { ...headers, 'Content-Type': 'application/json' },
  }, true);
}

async function platformAccess(actor: string) {
  const response = await managerBackend('/rest/v1/escala_platform_admins?select=user_id&user_id=eq.' + actor);
  if (!response.ok) throw new ManagerAuthUnavailable();
  return (await response.json()).length > 0;
}

export async function verifiedManagerId(token: string | undefined, config = configuration(), fetcher = fetch) {
  if (!config || !token || token.length > 3500) return null;
  const response = await supabaseRequest(fetcher, config.url + '/auth/v1/user', {
    headers: { apikey: config.key, Authorization: 'Bearer ' + token },
  });
  if (!response.ok) return null;
  const { id } = await response.json();
  return typeof id === 'string' && UUID.test(id) ? id as string : null;
}

export async function platformActor(token: string | undefined) {
  const id = await verifiedManagerId(token);
  return id && await platformAccess(id) ? id : null;
}

async function memberships(actor: string): Promise<Company[]> {
  const config = configuration();
  const headers = membershipHeaders();
  if (!config || !headers) throw new ManagerAuthUnavailable();
  const query = new URLSearchParams({
    user_id: 'eq.' + actor,
    active: 'eq.true',
    select: 'role,company:escala_organizations!inner(id,name)',
  });
  const response = await supabaseRequest(fetch, config.url + '/rest/v1/escala_memberships?' + query, {
    headers,
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
  checkPlatform = listCompanies === memberships ? platformAccess : async () => false,
) {
  const id = await verifiedManagerId(token, config, fetcher);
  if (!id) return null;
  const [companies, platformAdmin] = await Promise.all([listCompanies(id), checkPlatform(id)]);
  return platformAdmin ? { companies, platformAdmin } : companies.length ? { companies } : null;
}

export function managerDestination(session: { companies: Company[]; platformAdmin?: boolean }) {
  return !session.platformAdmin && session.companies.length === 1
    ? '/empresa/' + session.companies[0].id
    : '/gestao';
}

export async function authenticateManager(email: string, password: string, employeeAccess?: (token: string) => Promise<boolean>) {
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
  const session = await managerSession(access_token);
  if (session) return { token: access_token, maxAge: expires_in, redirectTo: managerDestination(session) };
  return await employeeAccess?.(access_token)
    ? { token: access_token, maxAge: expires_in, redirectTo: '/colaborador' }
    : null;
}

export async function setInvitedUserPassword(token: string, password: string) {
  const config = configuration();
  if (!config) throw new ManagerAuthUnavailable();
  return supabaseRequest(fetch, config.url + '/auth/v1/user', {
    method: 'PUT',
    headers: { apikey: config.key, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  }, true);
}
