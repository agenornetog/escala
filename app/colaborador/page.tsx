import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE } from '@/lib/auth';
import { currentEmployee, EmployeeStorageError } from '@/lib/employee-storage';
import { scheduleForMonth } from '@/lib/employee-schedule';
import { today } from '@/lib/dates';
import EmployeePortal from '@/components/employee-portal';
export const dynamic='force-dynamic';
export const metadata={title:'Minha jornada · Escalô'};
export default async function EmployeePage(){
 let current;
 try{current=await currentEmployee((await cookies()).get(SESSION_COOKIE)?.value);}catch(error){
  if(!(error instanceof EmployeeStorageError))throw error;
  return <main className="employee-portal"><h1>Não foi possível carregar sua jornada.</h1><p>O serviço está temporariamente indisponível. Tente recarregar a página em alguns instantes.</p><a className="btn secondary" href="/login">Voltar ao login</a></main>;
 }
 if(!current)redirect('/login');
 const month=today().slice(0,7);
 return <EmployeePortal initial={{...scheduleForMonth(current.schedule,month),publishedAt:current.publishedAt}} initialMonth={month}/>;
}
