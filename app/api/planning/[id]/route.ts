import { cookies } from 'next/headers';
import { sameOrigin } from '@/lib/auth';
import { MANAGER_COOKIE, managerBackend, verifiedManagerId, UUID } from '@/lib/manager-auth';
import { parsePlanning } from '@/lib/planning-validation';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!sameOrigin(request) || !UUID.test(id)) return new Response(null, { status: 403 });
  try {
    const actor = await verifiedManagerId((await cookies()).get(MANAGER_COOKIE)?.value);
    if (!actor) return new Response(null, { status: 401 });
    let revision: number;
    let store;
    try {
      const raw = await request.text();
      if (raw.length > 2_000_000) return new Response(null, { status: 413 });
      const input = JSON.parse(raw);
      revision = input.revision;
      if (!Number.isSafeInteger(revision) || revision < 0) throw new Error();
      store = parsePlanning(input.store);
    } catch {
      return Response.json({ error: 'Dados de planejamento inválidos.' }, { status: 400 });
    }
    const response = await managerBackend('/rest/v1/rpc/escala_write_planning', {
      method: 'POST',
      body: JSON.stringify({ p_organization: id, p_actor: actor, p_revision: revision, p_store: store }),
    });
    if (response.ok) return Response.json({ revision: await response.json() });
    const { code } = await response.json();
    if (code === '40001') return Response.json({ error: 'Outra sessão salvou uma revisão mais recente. Reabra o painel antes de editar novamente.' }, { status: 409 });
    if (code === '42501') return new Response(null, { status: 403 });
    return Response.json({ error: 'O banco rejeitou os dados do planejamento.' }, { status: 400 });
  } catch {
    return Response.json({ error: 'Não foi possível salvar o planejamento. Tente novamente.' }, { status: 503 });
  }
}
