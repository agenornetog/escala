import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { SESSION_SECONDS } from './auth';
export type EmployeeIdentity={id:string;version:string};
function secret(){const value=process.env.ESCALA_SESSION_SECRET;return value&&value.length>=32?value:null;}
export function createEmployeeSession(identity:EmployeeIdentity,now=Date.now()){
 const key=secret();if(!key)throw new Error('Configure o segredo das sessões.');
 const iat=Math.floor(now/1000);
 const payload=Buffer.from(JSON.stringify({role:'employee',...identity,iat,exp:iat+SESSION_SECONDS,nonce:randomBytes(16).toString('hex')})).toString('base64url');
 return `employee.${payload}.${createHmac('sha256',key).update('employee.'+payload).digest('base64url')}`;
}
export function isEmployeeToken(token:string|undefined){return Boolean(token?.startsWith('employee.'));}
export function readEmployeeSession(token:string|undefined,now=Date.now()):EmployeeIdentity|null{
 const key=secret();if(!key||!token||token.length>2048)return null;
 try{
  const [type,payload,signature,...extra]=token.split('.');
  if(type!=='employee'||extra.length||!payload||!signature||!/^[-\w]+$/.test(payload)||!/^[-\w]{43}$/.test(signature))return null;
  const expected=createHmac('sha256',key).update(type+'.'+payload).digest(),actual=Buffer.from(signature,'base64url');
  if(actual.length!==expected.length||!timingSafeEqual(actual,expected))return null;
  const data=JSON.parse(Buffer.from(payload,'base64url').toString()),current=Math.floor(now/1000);
  if(data.role!=='employee'||typeof data.id!=='string'||!data.id||data.id.length>120||typeof data.version!=='string'||!data.version||!Number.isInteger(data.iat)||data.iat>current||data.exp!==data.iat+SESSION_SECONDS||data.exp<=current)return null;
  return {id:data.id,version:data.version};
 }catch{return null;}
}
