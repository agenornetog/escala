import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { authConfigured, SESSION_COOKIE, verifySession } from '@/lib/auth';
import Login from '@/components/login';
export const metadata = { title: 'Entrar · Escala' };
export default async function LoginPage() {
  if (verifySession((await cookies()).get(SESSION_COOKIE)?.value)) redirect('/');
  return <Login configured={authConfigured()} />;
}
