// Test-only transport: the production Supabase REST requests execute real SQL
// in an isolated, in-memory PostgreSQL (PGlite). No credentials or hosted DB.
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
export async function employeeDatabaseFixture(){
 const db=new PGlite();
 await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
 await db.exec(await readFile(new URL('../../supabase/employee-access.sql',import.meta.url),'utf8'));
 async function transport(url,init={}){
  const value=url instanceof Request?url.url:String(url);
  const parsed=new URL(value);
  if(parsed.hostname!=='employee-fixture.supabase.co')throw new Error('Unexpected test destination');
  const headers=new Headers(init.headers);
  if(!headers.get('apikey')||headers.get('Authorization')!==`Bearer ${headers.get('apikey')}`)return new Response(null,{status:401});
  const params=parsed.searchParams,method=init.method??'GET',path=parsed.pathname;
  try{
   let result;
   if(path.endsWith('/rpc/escala_employee_login_allowed')){
    const b=JSON.parse(init.body);result=await db.query('select public.escala_employee_login_allowed($1,$2) as value',[b.p_workspace,b.p_key]);
    return Response.json(result.rows[0].value);
   }
   if(path.endsWith('/rpc/escala_save_employee_access')){
    const b=JSON.parse(init.body);await db.query('select public.escala_save_employee_access($1,$2,$3,$4,$5,$6)',[b.p_workspace,b.p_employee,b.p_email,b.p_password_hash,b.p_enabled,JSON.stringify(b.p_schedule)]);
    return new Response(null,{status:204});
   }
   if(method==='GET'&&path.endsWith('/escala_employee_access')){
    const columns=params.get('select');if(!/^[a-z_,]+$/.test(columns))throw new Error('Invalid columns');
    const column=params.has('employee_id')?'employee_id':'email';
    result=await db.query(`select ${columns} from public.escala_employee_access where workspace_id=$1 and ${column}=$2 limit 1`,[params.get('workspace_id').slice(3),params.get(column).slice(3)]);
    return Response.json(result.rows);
   }
   throw new Error('Unhandled test query');
  }catch(error){return Response.json({message:error.message},{status:error.code==='23505'?409:400});}
 }
 return {db,transport};
}
