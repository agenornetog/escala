import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE, verifySession } from '@/lib/auth';
import { loginRequired, OPEN_ACCESS_UNTIL } from '@/lib/access';
import Dashboard from '@/components/dashboard';
export const dynamic = 'force-dynamic';
export default async function Home() {
 const requiresLogin=loginRequired();
 if (requiresLogin && !verifySession((await cookies()).get(SESSION_COOKIE)?.value)) redirect('/login');
 return <Dashboard openAccessUntil={requiresLogin?undefined:OPEN_ACCESS_UNTIL} />;
}
