import assert from 'node:assert/strict';
import { test } from 'node:test';
import { managerSession } from '../lib/manager-auth';

test('manager session trusts the Auth identity and requires a current membership', async () => {
  const fetcher: typeof fetch = async (url, options) => {
    assert.equal(new Headers(options?.headers).get('Authorization'), 'Bearer token');
    assert.match(String(url), /\/auth\/v1\/user$/);
    return Response.json({ id: '00000000-0000-4000-8000-000000000001' });
  };
  const config = { url: 'https://test.supabase.co', key: 'publishable' };
  assert.equal(await managerSession('token', async () => [], config, fetcher), null);
  const companies = [{ id: 'company', name: 'Empresa', role: 'manager' as const }];
  assert.deepEqual(await managerSession('token', async actor => {
    assert.equal(actor, '00000000-0000-4000-8000-000000000001');
    return companies;
  }, config, fetcher), { companies });
  assert.equal(await managerSession('invalid', async () => {
    throw new Error('Must not query memberships');
  }, config, async () => new Response(null, { status: 401 })), null);
});

test('Vercel integration secret key authorizes membership lookup through apikey', async t => {
  const { authenticateManager } = await import('../lib/manager-auth');
  const env = {
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
    SUPABASE_SECRET_KEY: 'sb_secret_test',
    SUPABASE_SERVICE_ROLE_KEY: 'obsolete-legacy-value',
  };
  for (const [key, value] of Object.entries(env)) {
    const before = process.env[key];
    process.env[key] = value;
    t.after(() => { if (before === undefined) delete process.env[key]; else process.env[key] = before; });
  }
  const actor = '00000000-0000-4000-8000-000000000001';
  t.mock.method(globalThis, 'fetch', async (input: string, init: RequestInit) => {
    const url = new URL(input);
    const headers = new Headers(init.headers);
    if (url.pathname === '/auth/v1/token') {
      assert.equal(headers.get('apikey'), env.SUPABASE_PUBLISHABLE_KEY);
      return Response.json({ access_token: 'user-token', expires_in: 3600 });
    }
    if (url.pathname === '/auth/v1/user') {
      assert.equal(headers.get('Authorization'), 'Bearer user-token');
      return Response.json({ id: actor });
    }
    assert.equal(url.pathname, '/rest/v1/escala_memberships');
    assert.equal(url.searchParams.get('user_id'), 'eq.' + actor);
    if (headers.get('apikey') !== env.SUPABASE_SECRET_KEY || headers.has('Authorization')) {
      return new Response(null, { status: 401 });
    }
    return Response.json([{ role: 'admin', company: { id: 'company', name: 'Empresa' } }]);
  });

  assert.deepEqual(await authenticateManager('admin@example.com', 'password'), { token: 'user-token', maxAge: 3600 });
});
