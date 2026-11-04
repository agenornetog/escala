import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { authConfigured, SESSION_COOKIE, verifySession } from '@/lib/auth';
import { loginRequired } from '@/lib/access';
import Login from '@/components/login';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Entrar · Escala' };
export default async function LoginPage() {
  if (!loginRequired()) redirect('/');
  if (verifySession((await cookies()).get(SESSION_COOKIE)?.value)) redirect('/');
  return <Login configured={authConfigured()} />;
}
