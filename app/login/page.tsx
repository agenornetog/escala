import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { authConfigured, SESSION_COOKIE, verifySession } from '@/lib/auth';
import { employeeAccessConfigured, currentEmployee } from '@/lib/employee-storage';
import { isEmployeeToken } from '@/lib/employee-session';
import { loginRequired } from '@/lib/access';
import { managerAuthConfigured } from '@/lib/manager-auth';
import Login from '@/components/login';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Entrar · Escala' };
export default async function LoginPage() {
  const token=(await cookies()).get(SESSION_COOKIE)?.value;
  let employee=false;
  if(isEmployeeToken(token)){try{employee=Boolean(await currentEmployee(token));}catch{/* Login stays available while the shared database is down. */}}
  if(employee)redirect('/colaborador');
  if (verifySession((await cookies()).get(SESSION_COOKIE)?.value)) redirect('/');
  return <Login configured={authConfigured()||employeeAccessConfigured()||managerAuthConfigured()} demoAccess={!loginRequired()} />;
}
