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
