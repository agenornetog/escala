'use client';
import { useCallback, useEffect, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, Flag, RefreshCw } from 'lucide-react';
import { addMonths, labelDate, monthDays, monthLabel, today } from '@/lib/dates';
import { dayPlan } from '@/lib/monthly-report';
import { holidaysOnDate } from '@/lib/holidays';
import type { EmployeeSchedule } from '@/lib/employee-schedule';
import Sidebar from '@/components/sidebar';
import EmployeePassword from '@/components/employee-password';
import EmployeeSwapRequests from '@/components/employee-swap-requests';
import type { EmployeeSwap } from '@/lib/employee-swaps';
type View=EmployeeSchedule&{publishedAt:string|null;organization?:string;companies?:{id:string;name:string}[];allowSwaps?:boolean;swaps?:EmployeeSwap[]};
export default function EmployeePortal({initial,initialMonth}:{initial:View;initialMonth:string}){
 const [month,setMonth]=useState(initialMonth),[data,setData]=useState(initial),[loadedMonth,setLoadedMonth]=useState(initialMonth),[refresh,setRefresh]=useState(0),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [section,setSection]=useState('Escalas');
 const [mobile,setMobile]=useState(false);
 const [collapsed,setCollapsed]=useState(false);
 const closeMobile=useCallback(()=>setMobile(false),[]);
 const showSwaps=Boolean(data.organization&&(data.allowSwaps||data.swaps?.length));
 const page=showSwaps?section:'Escalas';
 useEffect(()=>{try{setCollapsed(localStorage.getItem('escala.sidebar.collapsed.v1')==='true');}catch{/* A preferência é opcional. */}},[]);
 function toggleSidebar(){
  const next=!collapsed;
  setCollapsed(next);
  try{localStorage.setItem('escala.sidebar.collapsed.v1',String(next));}catch{/* O menu continua funcionando. */}
 }
 useEffect(()=>{
  const controller=new AbortController();
  const query=new URLSearchParams({month});
  if(initial.organization)query.set('organization',initial.organization);
  let loading=false;
  async function load(background=false){
   if(loading||controller.signal.aborted)return;
   loading=true;
   if(!background){setBusy(true);setError('');}
   try{
    const response=await fetch('/api/employee/me?'+query,{cache:'no-store',signal:controller.signal});
    if(response.status===401){window.location.replace('/login');return;}
    const result=await response.json();
    if(!response.ok)throw new Error(result.error);
    if(!controller.signal.aborted){setData(result);setLoadedMonth(month);setError('');}
   }catch(error){
    if(!background&&!controller.signal.aborted)setError(error instanceof Error?error.message:'Não foi possível carregar a jornada.');
   }finally{
    loading=false;
    if(!background&&!controller.signal.aborted)setBusy(false);
   }
  }
  function refreshVisible(){if(document.visibilityState==='visible')void load(true);}
  void load();
  if(!initial.organization)return()=>controller.abort();
  const timer=window.setInterval(refreshVisible,10000);
  document.addEventListener('visibilitychange',refreshVisible);
  return()=>{
   controller.abort();
   window.clearInterval(timer);
   document.removeEventListener('visibilitychange',refreshVisible);
  };
 },[month,refresh,initial.organization]);
 async function logout(){setError('');try{const response=await fetch('/api/auth/logout',{method:'POST'});if(!response.ok)throw new Error();window.location.replace('/login');}catch{setError('Não foi possível sair. Tente novamente.');}}
 const days=monthDays(month),plans=loadedMonth===month?days.map(date=>({date,plan:dayPlan(data.employee.id,date,data.shifts,data.dayOffs,data.absences??[]),holidays:holidaysOnDate(data.holidays,date,data.workspaceLocation)})):[];
 return <div className={`app-shell ${collapsed?'sidebar-collapsed':''}`}>
  <Sidebar page={page} companyName={data.companies?.find(company=>company.id===data.organization)?.name}
   employee={{name:data.employee.name,allowSwaps:showSwaps}} collapsed={collapsed} mobileOpen={mobile}
   pendingCount={data.swaps?.filter(request=>request.status==='pending').length??0} notificationCount={0}
   onNavigate={setSection} onToggle={toggleSidebar} onMobileOpen={()=>setMobile(true)} onMobileClose={closeMobile} onLogout={logout}/>
  <div className="main-area" inert={mobile}>
   <main>
    <div className="page-heading">
     <div className="heading-row">
      <div><h1>{page==='Escalas'?'Minha jornada.':'Trocas de turno'}</h1><p>{data.employee.name} · {data.employee.role} · {data.employee.regime}</p></div>
      <div className="heading-actions">
       {data.organization&&<EmployeePassword/>}
       {(data.companies?.length??0)>1&&<label>Empresa<select value={data.organization} onChange={event=>window.location.assign('/colaborador?empresa='+encodeURIComponent(event.target.value))}>{data.companies?.map(company=><option key={company.id} value={company.id}>{company.name}</option>)}</select></label>}
      </div>
     </div>
    </div>
    {error&&<div className="form-errors" role="alert">{error}</div>}
    {page==='Escalas'?<>
    <div className="notice"><Clock3 size={20}/><span>{data.organization?'Sua escala é atualizada automaticamente. Dias sem planejamento não são folgas confirmadas.':data.publishedAt?'Você está consultando o planejamento publicado pelo gestor. Dias sem planejamento não são folgas confirmadas.':'Aguarde o gestor publicar sua escala.'}</span></div><section className="panel employee-month"><div className="panel-title"><div><h2><CalendarDays size={20}/>{monthLabel(month)}</h2><p className="muted">Horários de Brasília · Consulta individual</p></div><div className="employee-month-actions"><button className="icon-btn border-btn" aria-label="Mês anterior" disabled={month==='1900-01'} onClick={()=>setMonth(addMonths(month,-1))}><ChevronLeft size={18}/></button><button className="btn secondary" onClick={()=>setMonth(today().slice(0,7))}>Mês atual</button><button className="icon-btn border-btn" aria-label="Próximo mês" disabled={month==='2200-12'} onClick={()=>setMonth(addMonths(month,1))}><ChevronRight size={18}/></button><button className="btn secondary" disabled={busy} onClick={()=>setRefresh(value=>value+1)}><RefreshCw size={16} className={busy?'spin':''}/>Atualizar</button></div></div>{busy&&<p role="status">Carregando planejamento…</p>}<div className="employee-totals"><span><strong>{plans.filter(d=>d.plan.shifts.length>0).length}</strong> dias com turno</span><span><strong>{plans.filter(d=>d.plan.status==='off').length}</strong> folgas confirmadas</span><span><strong>{plans.filter(d=>d.plan.status==='unplanned').length}</strong> sem planejamento</span><span><strong>{plans.filter(d=>d.plan.status==='absent').length}</strong> ausências cadastradas</span></div><ol className="employee-day-list" aria-label="Dias da minha jornada" aria-busy={busy}>{plans.map(({date,plan,holidays})=><li key={date} className={`employee-day ${plan.status} ${date===today()?'current-day':''}`}><div className="employee-day-date"><strong>{labelDate(date,{day:'2-digit',month:'2-digit'})}</strong><span>{labelDate(date,{weekday:'long'})}{date===today()?' · Hoje':''}</span></div><div className="employee-day-work"><span className="pill">{plan.status==='working'?'Escalado para trabalho':plan.status==='off'?'Folga confirmada':plan.status==='absent'?(plan.absence?.kind==='ferias'?'Férias':plan.absence?.kind==='licenca'?'Licença':'Afastamento'):plan.status==='conflict'?'Planejamento em revisão':'Sem planejamento'}</span>{plan.lines.map((line,i)=><p key={plan.shifts[i].id}><strong>{line}</strong><small> · Intervalo do turno: {plan.shifts[i].breakMinutes} min</small></p>)}{plan.status==='conflict'&&<p>Turno coincide com folga ou ausência. Confirme com seu gestor.</p>}{holidays.length>0&&<p className="employee-holiday"><Flag size={14}/>{holidays.map(h=>h.name).join(' · ')}</p>}</div></li>)}</ol>{!data.organization&&data.publishedAt&&<p className="form-note">Publicado em {new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short',timeZone:'America/Sao_Paulo'}).format(new Date(data.publishedAt))} (Brasília). Para alterações na escala, fale com seu gestor.</p>}</section></>:data.organization&&<EmployeeSwapRequests organization={data.organization} allowed={Boolean(data.allowSwaps)} shifts={loadedMonth===month?data.shifts:[]} requests={data.swaps??[]} refresh={()=>setRefresh(value=>value+1)}/>}
   </main>
  </div>
 </div>;
}
