import { addDays, monthDays, today } from './dates';
import { normalizePlace } from './holidays';
import { instrumentFor } from './labor-rules';
import { validate } from './validation';
import { shiftTouchesDate } from './shift-time';
import type { Store } from './types';
export type LaborCheck={id:string;title:string;status:'pass'|'blocked'|'pending';details:string};
export function assessLabor(store:Store,month:string){
 const dates=monthDays(month),first=dates[0],last=dates.at(-1)!,checks:LaborCheck[]=[];
 const add=(id:string,title:string,status:LaborCheck['status'],details:string)=>checks.push({id,title,status,details});
 const relevant=store.shifts.filter(s=>s.date>=addDays(first,-35)&&s.date<=addDays(last,7));
 const issues=validate(relevant,store.employees,store.rules,store.dayOffs??[],store);
 const errors=issues.filter(i=>i.severity==='error'&&(!i.date||i.date>=addDays(first,-6)&&i.date<=addDays(last,1)));
 add('rules','Limites, intervalos e descansos configurados',errors.length?'blocked':'pass',errors.length?`${errors.length} bloqueio(s): ${errors.slice(0,4).map(i=>`${store.employees.find(e=>e.id===i.employeeId)?.name??i.employeeId}: ${i.message}`).join(' ')}`:'Nenhum bloqueio nas regras implementadas para os lançamentos conhecidos.');
 add('company','Enquadramento da empresa',store.labor?.activity&&store.labor.category&&store.workspaceLocation?.state&&store.workspaceLocation.city?'pass':'pending',store.labor?.activity&&store.labor.category&&store.workspaceLocation?.state&&store.workspaceLocation.city?`${store.labor.activity} · ${store.labor.category} · ${store.workspaceLocation.city}/${store.workspaceLocation.state}. Enquadramento declarado pela empresa; não determinado automaticamente pelo sistema.`:'Informe atividade, categoria, UF e município. A escolha do sindicato é declarada pela empresa; o sistema não determina o enquadramento sindical automaticamente.');
 if(!store.employees.length)add('employees','Colaboradores','pending','Cadastre a equipe para avaliar a escala.');
 for(const employee of store.employees){
  const instrument=instrumentFor(employee,store),prefix=`${employee.name}: `;
  if(!instrument){add(`instrument-${employee.id}`,prefix+'CCT/ACT','pending','Selecione o instrumento aplicável, por colaborador ou pelo padrão da empresa. Texto livre nas regras gerais não substitui esse vínculo.');continue;}
  const category=employee.laborCategory?.trim()||store.labor?.category||'',location=store.workspaceLocation;
  if(instrument.startsOn>first||instrument.endsOn<last)add(`instrument-${employee.id}`,prefix+'vigência','blocked',`O instrumento ${instrument.reference} não cobre todo o mês (${instrument.startsOn} a ${instrument.endsOn}). Cadastre a versão vigente; não altere datas apenas para liberar a revisão.`);
  else if(location&&instrument.state!==location.state||instrument.city&&normalizePlace(instrument.city)!==normalizePlace(location?.city??'')||category&&normalizePlace(category)!==normalizePlace(instrument.category))add(`instrument-${employee.id}`,prefix+'abrangência','blocked','Categoria ou localidade difere do instrumento selecionado. Confira sindicato, abrangência territorial e eventuais categorias diferenciadas.');
  else if(!location?.state||!location.city||!category)add(`instrument-${employee.id}`,prefix+'abrangência','pending','Falta categoria ou localidade para conferir a abrangência declarada.');
  else if(!instrument.reviewedBy||!instrument.reviewedOn||instrument.reviewedOn>today()||!instrument.sourceUrl||!instrument.clauseReference)add(`instrument-${employee.id}`,prefix+'conferência da CCT/ACT','pending','Registre fonte, cláusulas, responsável e data da conferência. O sistema não interpreta o documento automaticamente.');
  else add(`instrument-${employee.id}`,prefix+'vínculo e vigência','pass',`${instrument.unionName} · ${instrument.reference}. Conferência declarada por ${instrument.reviewedBy} em ${instrument.reviewedOn}; não é certificação jurídica.`);
  const count=Object.keys(instrument.limits??{}).length;
  if(count<6||!instrument.sundayEvery||instrument.holidayWork==='pending')add(`clauses-${employee.id}`,prefix+'parametrização coletiva','pending','Complete os seis limites suportados, o revezamento de domingos e a regra de feriados conforme as cláusulas conferidas. Regras setoriais não representadas continuam dependentes de análise.');
  if(!employee.laborCondition)add(`condition-${employee.id}`,prefix+'condições individuais','pending','Confirme se o perfil CLT geral é aplicável ou se há condição/regime especial que exige tratamento próprio.');
  else if(employee.laborCondition==='special')add(`condition-${employee.id}`,prefix+'condição especial','pending','Perfil especial não automatizado. Menores, aprendizes, tempo parcial, 12x36 e atividades com legislação própria exigem regras específicas.');
  if(!employee.sundayReference?.trim())add(`sunday-${employee.id}`,prefix+'fundamento dos domingos','pending','Registre o fundamento do revezamento individual. A regra quinzenal do art. 386 e as regras setoriais não são inferidas pelo sistema.');
 }
 let missing=0;
 for(const employee of store.employees)for(const date of Array.from({length:dates.length+21},(_,i)=>addDays(first,i-21))){const known=store.shifts.some(s=>s.employeeId===employee.id&&shiftTouchesDate(s,date))||(store.dayOffs??[]).some(o=>o.employeeId===employee.id&&o.date===date)||(store.absences??[]).some(a=>a.employeeId===employee.id&&a.startsOn<=date&&a.endsOn>=date);if(!known)missing++;}
 add('history','Histórico e planejamento completos',missing?'pending':'pass',missing?`${missing} data(s) por colaborador sem classificação no mês e nos 21 dias anteriores. Ausência de turno não confirma folga ou DSR.`:'Todas as datas do recorte estão classificadas como trabalho, folga ou ausência cadastrada. A análise é do planejamento, não do ponto realizado.');
 const monthly=store.shifts.filter(s=>dates.some(date=>shiftTouchesDate(s,date)));
 if(monthly.some(s=>s.breakMinutes>0))add('break-position','Posição e regras específicas da pausa','pending','A duração da pausa é validada, mas início/fim e pausas específicas da categoria ainda não são modelados.');
 if(issues.some(i=>i.code==='night-pay'&&i.date>=first&&i.date<=last))add('night','Trabalho noturno','pending','Hora noturna reduzida, adicionais, prorrogação e diferenças entre atividades não são calculados. Exigem enquadramento e implementação próprios.');
 if(issues.some(i=>i.code==='cross-week'&&i.date>=addDays(first,-1)&&i.date<=last))add('week-split','Turnos que atravessam a semana','pending','A apuração atual atribui horas à data de entrada. O desmembramento entre semanas e da pausa precisa de conferência.');
 if(issues.some(i=>i.code==='compensation'&&i.date>=first&&i.date<=last))add('overtime','Horas extras e compensação','pending','Referência de acordo preenchida não comprova validade, saldo ou prazo de compensação. Não há apuração de banco de horas ou adicionais.');
 add('calendar','Calendário e trabalho em feriados','pending','Confirme a completude dos feriados nacionais, estaduais e municipais. Autorizações, cláusulas de pagamento e compensação dependem de conferência; o calendário é manual.');
 if((store.absences??[]).some(a=>a.kind==='ferias'&&a.startsOn<=last&&a.endsOn>=first))add('vacation','Concessão de férias','pending','O bloqueio de turnos está ativo. Período aquisitivo, fracionamento, início em relação a feriados/DSR e demais condições de concessão não são certificados.');
 add('scope','Demais cláusulas e obrigações','pending','Cláusulas não parametrizadas, autorizações setoriais, remuneração, condições protegidas e obrigações fora do planejamento exigem revisão profissional. Não há aprovação automática de toda a CLT/CCT.');
 const blocked=checks.filter(c=>c.status==='blocked').length,pending=checks.filter(c=>c.status==='pending').length;
 return {month,certified:false as const,version:'labor-planning-review-1',checks,blocked,pending,label:blocked?'Bloqueios encontrados':pending?'Conferências pendentes':'Sem bloqueios nas verificações disponíveis',status:blocked?'blocked' as const:'pending' as const};
}
