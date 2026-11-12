import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE } from '@/lib/auth';
import { currentEmployee } from '@/lib/employee-storage';
import { scheduleForMonth } from '@/lib/employee-schedule';
import { today } from '@/lib/dates';
import EmployeePortal from '@/components/employee-portal';
import { companyEmployeeView } from '@/lib/company-employee';
import { MANAGER_COOKIE } from '@/lib/manager-auth';
export const dynamic='force-dynamic';
export const metadata={title:'Minha jornada · Escalô'};
export default async function EmployeePage({ searchParams }: { searchParams: Promise<{ empresa?: string }> }){
 let current;
 const jar = await cookies();
 const organization = (await searchParams).empresa;
 const month=today().slice(0,7);
 try{
  const company = await companyEmployeeView(jar.get(MANAGER_COOKIE)?.value, organization);
  if (company) {
   const { schedule, ...view } = company;
   return <EmployeePortal key={company.organization} initial={{...scheduleForMonth(schedule,month), ...view}} initialMonth={month}/>;
  }
  current=await currentEmployee(jar.get(SESSION_COOKIE)?.value);
 }catch{
  return <main className="employee-portal"><h1>Não foi possível carregar sua jornada.</h1><p>O serviço está temporariamente indisponível. Tente recarregar a página em alguns instantes.</p><a className="btn secondary" href="/login">Voltar ao login</a></main>;
 }
 if(!current)redirect('/login');
 return <EmployeePortal initial={{...scheduleForMonth(current.schedule,month),publishedAt:current.publishedAt}} initialMonth={month}/>;
}
