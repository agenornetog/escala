import { randomUUID } from 'node:crypto';
import { accountFailure, accountHeaders, accountIdentity, accountProfile, AccountError, AVATAR_BUCKET, AVATAR_LIMIT, avatarFormat, boundedBody, ownAvatar, requireAccountOrigin } from '@/lib/account';
import { userAuthRequest } from '@/lib/manager-auth';

export const runtime = 'nodejs';

async function removeObject(token: string, path: string) {
  // Cleanup is best-effort after the profile points to its replacement.
  await userAuthRequest(token, '/storage/v1/object/' + AVATAR_BUCKET, {
    method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prefixes: [path] }),
  }).catch(() => null);
}

export async function GET(request: Request) {
  try {
    const { token, user } = await accountIdentity(request);
    const path = ownAvatar(user);
    if (!path) throw new AccountError('Foto não encontrada.', 404);
    const response = await userAuthRequest(token, '/storage/v1/object/authenticated/' + AVATAR_BUCKET + '/' + path);
    if (!response.ok) throw new AccountError('Foto não encontrada.', response.status === 404 ? 404 : 503);
    const bytes = await boundedBody(response, AVATAR_LIMIT);
    const format = avatarFormat(bytes, response.headers.get('content-type'));
    return new Response(bytes, { headers: { ...accountHeaders, 'Content-Type': format.mime, 'X-Content-Type-Options': 'nosniff' } });
  } catch (error) { return accountFailure(error); }
}

export async function POST(request: Request) {
  try {
    requireAccountOrigin(request);
    const { token, user } = await accountIdentity(request);
    const bytes = await boundedBody(request, AVATAR_LIMIT);
    const format = avatarFormat(bytes, request.headers.get('content-type'));
    const path = user.id + '/' + randomUUID() + '.' + format.extension;
    const upload = await userAuthRequest(token, '/storage/v1/object/' + AVATAR_BUCKET + '/' + path, { method: 'POST', headers: { 'Content-Type': format.mime }, body: bytes });
    if (!upload.ok) throw new AccountError('Não foi possível enviar sua foto. Tente novamente.', upload.status === 413 ? 413 : 503);
    // A timeout may follow a successful Auth write. Keep the new object on ambiguous failures.
    const saved = await userAuthRequest(token, '/auth/v1/user', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: { avatar_path: path } }) });
    if (!saved.ok) {
      await removeObject(token, path);
      throw new AccountError('Não foi possível salvar sua foto. Tente novamente.', 503);
    }
    const previous = ownAvatar(user);
    if (previous) await removeObject(token, previous);
    return Response.json(accountProfile({ ...user, user_metadata: { ...user.user_metadata, avatar_path: path } }), { headers: accountHeaders });
  } catch (error) { return accountFailure(error); }
}

export async function DELETE(request: Request) {
  try {
    requireAccountOrigin(request);
    const { token, user } = await accountIdentity(request);
    const saved = await userAuthRequest(token, '/auth/v1/user', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: { avatar_path: null } }) });
    if (!saved.ok) throw new AccountError('Não foi possível remover sua foto. Tente novamente.', 503);
    const path = ownAvatar(user);
    if (path) await removeObject(token, path);
    return Response.json(accountProfile({ ...user, user_metadata: { ...user.user_metadata, avatar_path: null } }), { headers: accountHeaders });
  } catch (error) { return accountFailure(error); }
}
