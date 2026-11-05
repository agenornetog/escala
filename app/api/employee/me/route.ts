import { NextResponse } from 'next/server';
import { cookieFromRequest } from '@/lib/auth';
import { currentEmployee, EmployeeStorageError } from '@/lib/employee-storage';
import { scheduleForMonth } from '@/lib/employee-schedule';
import { today } from '@/lib/dates';
export async function GET(request:Request){
 const headers={'Cache-Control':'private, no-store'};
 try{
  const current=await currentEmployee(cookieFromRequest(request));
  if(!current)return NextResponse.json({error:'Sua sessão expirou ou o acesso foi desativado. Entre novamente.'},{status:401,headers});
  const month=new URL(request.url).searchParams.get('month')??today().slice(0,7);
  return NextResponse.json({...scheduleForMonth(current.schedule,month),publishedAt:current.publishedAt},{headers});
 }catch(error){return NextResponse.json({error:error instanceof EmployeeStorageError?error.message:'Selecione um mês válido.'},{status:error instanceof EmployeeStorageError?error.status:400,headers});}
}
