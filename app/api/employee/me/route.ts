import { NextResponse } from 'next/server';
import { cookieFromRequest } from '@/lib/auth';
import { currentEmployee, EmployeeStorageError } from '@/lib/employee-storage';
import { scheduleForMonth } from '@/lib/employee-schedule';
import { today } from '@/lib/dates';
import { companyEmployeeView } from '@/lib/company-employee';
import { MANAGER_COOKIE } from '@/lib/manager-auth';
export async function GET(request:Request){
 const headers={'Cache-Control':'private, no-store'};
 try{
  const search = new URL(request.url).searchParams;
  const month=search.get('month')??today().slice(0,7);
  const managerToken = cookieFromRequest(request, MANAGER_COOKIE);
  const company = managerToken ? await companyEmployeeView(managerToken, search.get('organization') ?? undefined) : null;
  if (company) {
   const { schedule, ...view } = company;
   return NextResponse.json({...scheduleForMonth(schedule,month), ...view},{headers});
  }
  const current=await currentEmployee(cookieFromRequest(request));
  if(!current)return NextResponse.json({error:'Sua sessão expirou ou o acesso foi desativado. Entre novamente.'},{status:401,headers});
  return NextResponse.json({...scheduleForMonth(current.schedule,month),publishedAt:current.publishedAt},{headers});
 }catch(error){return NextResponse.json({error:error instanceof EmployeeStorageError?error.message:'Selecione um mês válido.'},{status:error instanceof EmployeeStorageError?error.status:400,headers});}
}
