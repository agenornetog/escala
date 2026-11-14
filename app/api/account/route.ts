import { accountFailure, accountHeaders, accountIdentity, accountInput, accountProfile, AccountError, readAccount, requireAccountOrigin } from '@/lib/account';
import { userAuthRequest } from '@/lib/manager-auth';

export async function GET(request: Request) {
  try { return Response.json(await readAccount(request), { headers: accountHeaders }); }
  catch (error) { return accountFailure(error); }
}

export async function PATCH(request: Request) {
  try {
    requireAccountOrigin(request);
    const { token, user } = await accountIdentity(request);
    const input = await accountInput(request);
    const name = typeof input?.name === 'string' ? input.name.trim().replace(/\s+/g, ' ') : '';
    if (!name || name.length > 120 || /[\u0000-\u001f\u007f]/.test(name)) throw new AccountError('Informe um nome de até 120 caracteres.');
    const response = await userAuthRequest(token, '/auth/v1/user', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: { full_name: name } }) });
    if (!response.ok) throw new AccountError('Não foi possível salvar seu nome. Tente novamente.', response.status === 401 ? 401 : 503);
    return Response.json(accountProfile({ ...user, user_metadata: { ...user.user_metadata, full_name: name } }), { headers: accountHeaders });
  } catch (error) { return accountFailure(error); }
}
