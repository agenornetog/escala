import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';

const actor = '00000000-0000-4000-8000-000000000001';
const other = '00000000-0000-4000-8000-000000000002';
const png = Uint8Array.from([137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82]);

function setup(t: TestContext, metadata: Record<string, unknown> = {}) {
  for (const [key, value] of Object.entries({ SUPABASE_URL: 'https://account-fixture.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'publishable-fixture', SUPABASE_SECRET_KEY: 'private-fixture' })) {
    const previous = process.env[key]; process.env[key] = value;
    t.after(() => { if (previous === undefined) delete process.env[key]; else process.env[key] = previous; });
  }
  const state = { metadata, calls: [] as { path: string; method: string; body: unknown; token: string | null }[], failMetadata: false, passwordValid: true, companies: [{ role: 'manager', company: { id: other, name: 'Empresa' } }] };
  t.mock.method(globalThis, 'fetch', async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = new URL(String(input));
    const headers = new Headers(init.headers);
    const method = init.method ?? 'GET';
    const body = typeof init.body === 'string' ? JSON.parse(init.body) : init.body;
    state.calls.push({ path: url.pathname, method, body, token: headers.get('authorization') });
    if (url.pathname.startsWith('/auth/') || url.pathname.startsWith('/storage/')) assert.equal(headers.get('apikey'), 'publishable-fixture');
    if (url.pathname === '/auth/v1/user') {
      if (headers.get('authorization') !== 'Bearer own-token' && headers.get('authorization') !== 'Bearer fresh-token') return new Response(null, { status: 401 });
      if (method === 'PUT') {
        if (state.failMetadata) return new Response(null, { status: 500 });
        if (body.data) Object.assign(state.metadata, body.data);
      }
      return Response.json({ id: actor, email: 'pessoa@example.test', user_metadata: state.metadata });
    }
    if (url.pathname === '/auth/v1/token') return state.passwordValid ? Response.json({ access_token: 'fresh-token', expires_in: 3600 }) : new Response(null, { status: 400 });
    if (url.pathname === '/rest/v1/escala_platform_admins') return Response.json([]);
    if (url.pathname === '/rest/v1/escala_memberships') return Response.json(state.companies);
    if (url.pathname.startsWith('/storage/v1/object/')) return method === 'GET' ? new Response(png, { headers: { 'content-type': 'image/png' } }) : Response.json({ Key: 'uploaded' });
    throw new Error('Unexpected backend request: ' + url.pathname);
  });
  return state;
}

function request(path: string, method = 'GET', body?: unknown, token = 'own-token') {
  const headers: Record<string, string> = { origin: 'http://localhost:3000', cookie: 'escala_manager=' + token };
  if (body) headers['content-type'] = 'application/json';
  return new Request('http://localhost:3000/api/account' + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
}

test('account reads verified identity and derives role from memberships, with email fallback for older profiles', async t => {
  const state = setup(t, { full_name: 'Nome da pessoa', role: 'admin' });
  const { GET } = await import('../app/api/account/route');
  let response = await GET(request(''));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { name: 'Nome da pessoa', email: 'pessoa@example.test', role: 'Gestor', avatarUrl: null, editable: true });
  delete state.metadata.full_name;
  response = await GET(request(''));
  assert.equal((await response.json()).name, 'pessoa@example.test');
  assert.equal((await GET(request('', 'GET', undefined, 'invalid'))).status, 401);
});

test('profile writes change only the current user name and reject invalid names and external origins', async t => {
  const state = setup(t);
  const { PATCH } = await import('../app/api/account/route');
  const response = await PATCH(request('', 'PATCH', { name: '  Maria  Silva  ', id: other, role: 'admin' }));
  assert.equal(response.status, 200);
  assert.deepEqual(state.calls.find(call => call.method === 'PUT')?.body, { data: { full_name: 'Maria Silva' } });
  assert.equal((await PATCH(request('', 'PATCH', { name: '' }))).status, 400);
  const external = new Request('http://localhost:3000/api/account', { method: 'PATCH', headers: { origin: 'https://other.test' }, body: '{}' });
  assert.equal((await PATCH(external)).status, 403);
});

test('avatar upload validates image bytes, stores in own private folder and removes the replaced photo', async t => {
  const previous = actor + '/00000000-0000-4000-8000-000000000003.png';
  const state = setup(t, { avatar_path: previous });
  const { POST } = await import('../app/api/account/avatar/route');
  const upload = (body: Uint8Array, type = 'image/png') => new Request('http://localhost:3000/api/account/avatar', { method: 'POST', headers: { origin: 'http://localhost:3000', cookie: 'escala_manager=own-token', 'content-type': type }, body: new Uint8Array(body).buffer });
  assert.equal((await POST(upload(png))).status, 200);
  assert.match(String(state.metadata.avatar_path), new RegExp('^' + actor + '/[a-f0-9-]+\\.png$'));
  const stored = state.calls.find(call => call.path.startsWith('/storage/') && call.method === 'POST');
  assert.equal(stored?.token, 'Bearer own-token');
  assert.match(stored!.path, new RegExp('/' + actor + '/'));
  assert.ok(state.calls.some(call => call.method === 'DELETE' && JSON.stringify(call.body).includes(previous)));
  assert.equal((await POST(upload(new TextEncoder().encode('<svg/>'), 'image/svg+xml'))).status, 400);
  assert.equal((await POST(upload(new Uint8Array(2 * 1024 * 1024 + 1)))).status, 413);
});

test('failed avatar metadata update preserves old profile and cleans up the new object', async t => {
  const oldPath = actor + '/00000000-0000-4000-8000-000000000003.png';
  const state = setup(t, { avatar_path: oldPath }); state.failMetadata = true;
  const { POST } = await import('../app/api/account/avatar/route');
  const response = await POST(new Request('http://localhost:3000/api/account/avatar', { method: 'POST', headers: { origin: 'http://localhost:3000', cookie: 'escala_manager=own-token', 'content-type': 'image/png' }, body: png }));
  assert.equal(response.status, 503);
  assert.equal(state.metadata.avatar_path, oldPath);
  const deletion = state.calls.find(call => call.method === 'DELETE');
  assert.ok(deletion);
  assert.ok(!JSON.stringify(deletion.body).includes(oldPath));
});

test('avatar reads ignore supplied paths and never request another users photo', async t => {
  const state = setup(t, { avatar_path: other + '/00000000-0000-4000-8000-000000000003.png' });
  const { GET } = await import('../app/api/account/avatar/route');
  assert.equal((await GET(request('/avatar?path=' + other))).status, 404);
  assert.ok(!state.calls.some(call => call.path.startsWith('/storage/')));
  state.metadata.avatar_path = actor + '/00000000-0000-4000-8000-000000000003.png';
  const response = await GET(request('/avatar?path=' + other));
  assert.equal(response.status, 200);
  assert.match(response.headers.get('cache-control')!, /no-store/);
  assert.ok(state.calls.at(-1)!.path.includes(actor));
});

test('avatar removal clears the profile before deleting its own image', async t => {
  const state = setup(t, { avatar_path: actor + '/00000000-0000-4000-8000-000000000003.png' });
  const { DELETE } = await import('../app/api/account/avatar/route');
  assert.equal((await DELETE(request('/avatar', 'DELETE'))).status, 200);
  assert.equal(state.metadata.avatar_path, null);
  assert.ok(state.calls.findIndex(call => call.method === 'PUT') < state.calls.findIndex(call => call.method === 'DELETE'));
});

test('password change verifies current password and updates the authenticated users session', async t => {
  const state = setup(t); state.passwordValid = false;
  const { POST } = await import('../app/api/account/password/route');
  const input = { currentPassword: 'old-password-2026', password: 'new-password-2026' };
  assert.equal((await POST(request('/password', 'POST', input))).status, 400);
  assert.ok(!state.calls.some(call => call.method === 'PUT'));
  state.passwordValid = true;
  const response = await POST(request('/password', 'POST', input));
  assert.equal(response.status, 200);
  assert.match(response.headers.get('set-cookie')!, /escala_manager=fresh-token/);
  const update = state.calls.find(call => call.method === 'PUT');
  assert.equal(update?.token, 'Bearer fresh-token');
  assert.deepEqual(update?.body, { password: input.password, current_password: input.currentPassword });
  assert.equal((await POST(request('/password', 'POST', { ...input, password: input.currentPassword }))).status, 400);
});


test('displayed role follows the active company instead of another admin membership', async t => {
  const state=setup(t);
  state.companies.push({role:'admin',company:{id:'00000000-0000-4000-8000-000000000003',name:'Outra empresa'}});
  const { GET }=await import('../app/api/account/route');
  const response=await GET(request('?organization='+other));
  assert.equal((await response.json()).role,'Gestor');
});

test('anonymous and external-origin requests cannot mutate profiles, avatars or passwords', async t => {
  const state = setup(t);
  const account = await import('../app/api/account/route');
  const avatar = await import('../app/api/account/avatar/route');
  const password = await import('../app/api/account/password/route');
  assert.equal((await account.GET(new Request('http://localhost:3000/api/account'))).status, 401);
  for (const [path, method, handler] of [
    ['', 'PATCH', account.PATCH], ['/avatar', 'POST', avatar.POST], ['/avatar', 'DELETE', avatar.DELETE], ['/password', 'POST', password.POST],
  ] as const) {
    const external = new Request('http://localhost:3000/api/account' + path, { method, headers: { origin: 'https://other.test', cookie: 'escala_manager=own-token' } });
    assert.equal((await handler(external)).status, 403);
    const anonymous = new Request('http://localhost:3000/api/account' + path, { method, headers: { origin: 'http://localhost:3000' } });
    assert.equal((await handler(anonymous)).status, 401);
  }
  assert.equal(state.calls.length, 0);
});
