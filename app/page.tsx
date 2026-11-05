import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE, verifySession } from '@/lib/auth';
import { loginRequired, OPEN_ACCESS_UNTIL } from '@/lib/access';
import { isEmployeeToken } from '@/lib/employee-session';
import Dashboard from '@/components/dashboard';
export const dynamic = 'force-dynamic';
export default async function Home() {
 if(isEmployeeToken((await cookies()).get(SESSION_COOKIE)?.value))redirect('/colaborador');
 const requiresLogin=loginRequired(),admin=verifySession((await cookies()).get(SESSION_COOKIE)?.value);
 if (requiresLogin && !admin) redirect('/login');
 return <Dashboard openAccessUntil={requiresLogin||admin?undefined:OPEN_ACCESS_UNTIL} />;
}
