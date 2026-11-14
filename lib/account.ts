import { authenticated, cookieFromRequest, sameOrigin } from './auth';
import { currentEmployee } from './employee-storage';
import { isEmployeeToken } from './employee-session';
import { MANAGER_COOKIE, managerSession, verifiedAuthUser, type AuthUser } from './manager-auth';

export type AccountProfile = { name: string; email: string; role: string; avatarUrl: string | null; editable: boolean };
export const AVATAR_BUCKET = 'escala-account-avatars';
export const AVATAR_LIMIT = 2 * 1024 * 1024;
export const accountHeaders = { 'Cache-Control': 'no-store' };

export class AccountError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export function accountFailure(error: unknown) {
  return Response.json({ error: error instanceof AccountError ? error.message : 'Não foi possível acessar sua conta. Tente novamente.' },
    { status: error instanceof AccountError ? error.status : 503, headers: accountHeaders });
}

export function requireAccountOrigin(request: Request) {
  if (!sameOrigin(request)) throw new AccountError('Solicitação não permitida.', 403);
}

export async function accountIdentity(request: Request) {
  const token = cookieFromRequest(request, MANAGER_COOKIE);
  const user = await verifiedAuthUser(token);
  if (!token || !user) throw new AccountError('Entre novamente para acessar sua conta.', 401);
  return { token, user };
}

export function ownAvatar(user: AuthUser) {
  const path = user.user_metadata?.avatar_path;
  return typeof path === 'string' && new RegExp('^' + user.id + '/[a-f0-9-]{36}\\.(png|jpg|webp)$').test(path) ? path : null;
}

export function accountProfile(user: AuthUser, role = 'Usuário'): AccountProfile {
  const metadata = user.user_metadata ?? {};
  const name = [metadata.full_name, metadata.name].find(value => typeof value === 'string' && value.trim());
  const path = ownAvatar(user);
  return { name: typeof name === 'string' ? name.trim().slice(0, 120) : user.email ?? 'Minha conta', email: user.email ?? '', role,
    avatarUrl: path ? '/api/account/avatar?v=' + encodeURIComponent(path) : null, editable: true };
}

export async function readAccount(request: Request): Promise<AccountProfile> {
  if (!cookieFromRequest(request, MANAGER_COOKIE)) {
    if (authenticated(request)) return { name: process.env.ESCALA_ADMIN_EMAIL?.trim() ?? 'Administrador', email: process.env.ESCALA_ADMIN_EMAIL?.trim() ?? '', role: 'Administrador local', avatarUrl: null, editable: false };
    if (isEmployeeToken(cookieFromRequest(request))) {
      const employee = await currentEmployee(cookieFromRequest(request));
      if (employee) return { name: employee.schedule.employee.name, email: '', role: 'Colaborador', avatarUrl: null, editable: false };
    }
  }
  const { user, token } = await accountIdentity(request);
  const session = await managerSession(token);
  const organization = new URL(request.url).searchParams.get('organization');
  const membership = organization ? session?.companies.find(company => company.id === organization) : undefined;
  const role = membership ? membership.role === 'admin' ? 'Administrador' : 'Gestor'
    : session?.platformAdmin ? 'Administrador da plataforma'
    : session?.companies.some(company => company.role === 'admin') ? 'Administrador'
    : session ? 'Gestor' : 'Colaborador';
  return accountProfile(user, role);
}

export async function boundedBody(request: Pick<Request, 'headers' | 'body'>, limit: number) {
  if (Number(request.headers.get('content-length')) > limit) throw new AccountError('Arquivo ou dados acima do tamanho permitido.', 413);
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > limit) {
        await reader.cancel();
        throw new AccountError('Arquivo ou dados acima do tamanho permitido.', 413);
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks, length);
}

export async function accountInput(request: Request) {
  try { return JSON.parse(new TextDecoder().decode(await boundedBody(request, 4096))); }
  catch (error) {
    if (error instanceof AccountError) throw error;
    throw new AccountError('Confira os dados informados.');
  }
}

export function avatarFormat(bytes: Uint8Array, contentType: string | null) {
  const mime = contentType?.split(';')[0].trim().toLowerCase();
  if (mime === 'image/png' && bytes.length >= 16 && Buffer.from(bytes.subarray(0, 8)).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return { extension: 'png', mime };
  if (mime === 'image/jpeg' && bytes.length >= 4 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return { extension: 'jpg', mime };
  if (mime === 'image/webp' && bytes.length >= 16 && Buffer.from(bytes.subarray(0, 4)).toString() === 'RIFF' && Buffer.from(bytes.subarray(8, 12)).toString() === 'WEBP') return { extension: 'webp', mime };
  throw new AccountError('Selecione uma foto JPEG, PNG ou WebP válida, de até 2 MB.');
}
