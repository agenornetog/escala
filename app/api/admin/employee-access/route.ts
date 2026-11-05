import { NextResponse } from 'next/server';
import { authenticated, hashPassword, sameOrigin } from '@/lib/auth';
import { employeeSchedule } from '@/lib/employee-schedule';
import { accessById, employeeAccessConfigured, EmployeeStorageError, saveEmployeeAccess } from '@/lib/employee-storage';
const headers={'Cache-Control':'no-store'};
function fail(error:unknown){return NextResponse.json({error:error instanceof EmployeeStorageError?error.message:'Confira os dados do acesso e tente novamente.'},{status:error instanceof EmployeeStorageError?error.status:400,headers});}
export async function GET(request:Request){
 if(!authenticated(request))return NextResponse.json({error:'Entre com a conta do administrador para gerenciar acessos.'},{status:401,headers});
 if(!employeeAccessConfigured())return NextResponse.json({configured:false},{headers});
 try{
  const id=new URL(request.url).searchParams.get('employeeId');if(!id||id.length>120)throw new Error();
  const row=await accessById(id);
  return NextResponse.json({configured:true,access:row?{email:row.email,enabled:row.enabled,publishedAt:row.updated_at}:null},{headers});
 }catch(error){return fail(error);}
}
export async function PUT(request:Request){
 if(!authenticated(request))return NextResponse.json({error:'Entre com a conta do administrador para gerenciar acessos.'},{status:401,headers});
 if(!sameOrigin(request))return NextResponse.json({error:'Solicitação não permitida.'},{status:403,headers});
 try{
  const text=await request.text();if(text.length>2_000_000)throw new Error();
  const body=JSON.parse(text),id=body.employeeId,email=typeof body.email==='string'?body.email.trim().toLowerCase():'';
  if(typeof id!=='string'||!id||id.length>120||!/^\S+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||email===process.env.ESCALA_ADMIN_EMAIL?.trim().toLowerCase()||typeof body.enabled!=='boolean'||typeof body.password!=='string'||body.password.length>256||body.password.length>0&&body.password.length<12)throw new Error();
  const schedule=employeeSchedule(body.schedule,id),existing=await accessById(id);
  if(!existing&&!body.password) return NextResponse.json({error:'Defina uma senha de pelo menos 12 caracteres para o primeiro acesso.'},{status:400,headers});
  const row=await saveEmployeeAccess({id,email,hash:body.password?await hashPassword(body.password):null,enabled:body.enabled,schedule});
  return NextResponse.json({ok:true,access:{email:row!.email,enabled:row!.enabled,publishedAt:row!.updated_at}},{headers});
 }catch(error){return fail(error);}
}
