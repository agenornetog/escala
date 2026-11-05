// Server-only Supabase service-role adapter. Never import into a client component.
import { createHash, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { employeeSchedule, type EmployeeSchedule } from './employee-schedule';
import { readEmployeeSession } from './employee-session';
const scrypt=promisify(scryptCallback);
export class EmployeeStorageError extends Error {constructor(message='Não foi possível acessar os dados compartilhados. Tente novamente.',public status=503){super(message);}}
function configuration(){
 const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY,workspace=process.env.ESCALA_WORKSPACE_ID,secret=process.env.ESCALA_SESSION_SECRET;
 if(!url||!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url)||!key||!workspace||!/^[-\w]{1,100}$/.test(workspace)||!secret||secret.length<32)return null;
 return {url:url.replace(/\/$/,''),key,workspace};
}
export function employeeAccessConfigured(){return configuration()!==null;}
export type AccessRow={employee_id:string;email:string;enabled:boolean;session_version:string;schedule:EmployeeSchedule;updated_at:string;password_hash?:string};
export async function employeeDatabase(path:string,init:RequestInit={}){
 const config=configuration();if(!config)throw new EmployeeStorageError('Configure o banco compartilhado e o segredo de sessão para liberar o acesso dos colaboradores.');
 let response:Response;
 try{response=await fetch(`${config.url}/rest/v1/${path}`,{...init,cache:'no-store',signal:AbortSignal.timeout(10000),headers:{apikey:config.key,Authorization:`Bearer ${config.key}`,'Content-Type':'application/json',...init.headers}});}catch{throw new EmployeeStorageError();}
 if(!response.ok)throw new EmployeeStorageError(response.status===409?'Este e-mail já está vinculado a outro colaborador.':'Não foi possível acessar o banco. Confira a configuração e a instalação do SQL de acesso dos colaboradores.',response.status===409?409:503);
 return response.status===204?null:response.json();
}
export async function accessById(id:string):Promise<AccessRow|null>{
 const query=new URLSearchParams({workspace_id:`eq.${configuration()?.workspace}`,employee_id:`eq.${id}`,select:'employee_id,email,enabled,session_version,schedule,updated_at',limit:'1'});
 const rows=await employeeDatabase(`escala_employee_access?${query}`);return rows[0]??null;
}
export async function authenticateEmployee(email:string,password:string){
 if(!employeeAccessConfigured())return null;
 const normalized=email.trim().toLowerCase();
 const allowed=await employeeDatabase('rpc/escala_employee_login_allowed',{method:'POST',body:JSON.stringify({p_workspace:configuration()!.workspace,p_key:createHash('sha256').update(normalized).digest('hex')})});
 if(!allowed)throw new EmployeeStorageError('Muitas tentativas de acesso. Tente novamente em 15 minutos.',429);
 const query=new URLSearchParams({workspace_id:`eq.${configuration()!.workspace}`,email:`eq.${normalized}`,select:'employee_id,email,enabled,session_version,password_hash',limit:'1'});
 const [row]=await employeeDatabase(`escala_employee_access?${query}`) as AccessRow[];
 // A dummy scrypt check keeps missing accounts on the same expensive path.
 const hash=row?.password_hash??`scrypt$${'0'.repeat(32)}$${'0'.repeat(128)}`;
 if(!/^scrypt\$[a-f0-9]{32}\$[a-f0-9]{128}$/.test(hash))return null;
 const [,salt,expected]=hash.split('$'),actual=await scrypt(password,salt,64) as Buffer;
 return row?.enabled&&timingSafeEqual(actual,Buffer.from(expected,'hex'))?{id:row.employee_id,version:row.session_version}:null;
}
export async function currentEmployee(token:string|undefined){
 const identity=readEmployeeSession(token);if(!identity)return null;
 const row=await accessById(identity.id);
 if(!row||!row.enabled||row.session_version!==identity.version)return null;
 return {schedule:employeeSchedule(row.schedule,identity.id),publishedAt:row.updated_at};
}
export async function saveEmployeeAccess(input:{id:string;email:string;hash:string|null;enabled:boolean;schedule:EmployeeSchedule}){
 await employeeDatabase('rpc/escala_save_employee_access',{method:'POST',body:JSON.stringify({p_workspace:configuration()?.workspace,p_employee:input.id,p_email:input.email,p_password_hash:input.hash,p_enabled:input.enabled,p_schedule:input.schedule})});
 return accessById(input.id);
}
