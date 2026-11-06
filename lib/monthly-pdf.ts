import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { holidayLocality, scopeLabels } from './holidays';
import { labelDate, weekday, isWeekend } from './dates';
import type { DayPlan, MonthlyReport } from './monthly-report';
const PAPER:[number,number,number]=[245,245,244], CHALK:[number,number,number]=[230,227,226], INK:[number,number,number]=[17,17,17], LINE:[number,number,number]=[209,222,232], BLUE:[number,number,number]=[22,93,251];
const names=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
// Formatting is kept explicit: a continuation is present on the following day,
// while a shift ending exactly at midnight is absent from that following day.
function matrixText(plan:DayPlan,date:string){
 if(plan.status==='absent')return 'A';if(plan.status==='off')return 'F';if(plan.status==='unplanned')return '?';
 return (plan.status==='conflict'?'!\n':'')+plan.shifts.map(s=>s.date<date?`até\n${s.end}`:`${s.start}\n${s.end}${s.end<=s.start?'+1':''}`).join('\n');
}
export type PdfFonts={regular:string;bold:string};
export async function loadPdfFonts():Promise<PdfFonts>{
 const encode=(buffer:ArrayBuffer)=>{const bytes=new Uint8Array(buffer);let text='';for(let i=0;i<bytes.length;i+=32768)text+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(text);};
 const [regular,bold]=await Promise.all(['/fonts/figtree-regular.ttf','/fonts/figtree-semibold.ttf'].map(async url=>{const response=await fetch(url);if(!response.ok)throw new Error('Fonte PDF indisponível');const buffer=await response.arrayBuffer();const bytes=new Uint8Array(buffer);if(bytes[0]!==0||bytes[1]!==1||bytes[2]!==0||bytes[3]!==0)throw new Error('Formato da fonte inválido');return encode(buffer);}));
 return {regular,bold};
}
export function createMonthlyPdf(report:MonthlyReport,fonts?:PdfFonts){
 const doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a3',compress:true,putOnlyUsedFonts:true});
 if(fonts){doc.addFileToVFS('Figtree-Regular.ttf',fonts.regular);doc.addFont('Figtree-Regular.ttf','Figtree','normal');doc.addFileToVFS('Figtree-Semibold.ttf',fonts.bold);doc.addFont('Figtree-Semibold.ttf','Figtree','bold');}
 const font=fonts?'Figtree':'helvetica';
 doc.setProperties({title:`Escala mensal - ${report.label}`,author:'Escala',subject:'Turnos planejados, folgas confirmadas e dias sem planejamento'});doc.setLanguage('pt-BR');doc.setCreationDate(report.generatedAt);
 const margin=12;
 const issued=new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short',timeZone:'America/Sao_Paulo'}).format(report.generatedAt);
 function header(section:string,detailed=false,description='Escalados: presença prevista no turno. Sem planejamento não confirma disponibilidade para convocação.'){
  const width=doc.internal.pageSize.getWidth();
  doc.setFillColor(...BLUE);doc.circle(margin+1.5,12,1.5,'F');doc.setTextColor(...INK);doc.setFont(font,'bold');doc.setFontSize(17);doc.text('escala.',margin+6,14);
  doc.setFont(font,'normal');doc.setFontSize(8);doc.setTextColor(100);doc.text(`Emitido em ${issued} (Brasília)`,width-margin,13,{align:'right'});
  doc.setFontSize(detailed?18:23);doc.setTextColor(...INK);doc.text(`${section} - ${report.label}`,margin,28);
  doc.setFontSize(9);doc.setTextColor(100);doc.text(`${report.team}  |  ${report.rows.length} colaborador(es)  |  ${report.dates[0]} a ${report.dates.at(-1)}`,margin,36);
  if(detailed){doc.setFontSize(8);doc.text(description,margin,44);return;}
  doc.setFillColor(...PAPER);doc.roundedRect(margin,43,width-2*margin,16,2,2,'F');doc.setTextColor(...INK);doc.setFontSize(10);doc.text(`Totais por pessoa/dia: ${report.totals.working} em turno     Folgas confirmadas: ${report.totals.off}     Ausências: ${report.totals.absent}     Sem planejamento: ${report.totals.unplanned}`,margin+4,53);
  doc.setFontSize(8);doc.setTextColor(100);doc.text('Horários = turno planejado  |  F = folga confirmada  |  A = férias/afastamento/licença  |  ? = sem planejamento  |  +1 = término no dia seguinte  |  até = continuação do dia anterior',margin,66);
  doc.text('Escalado indica presença prevista. Dia sem turno não é automaticamente folga nem disponibilidade para convocação.',margin,72);
  doc.text('Planejamento futuro; não é registro de ponto nem certificado de conformidade trabalhista. ! = conflito entre turno e folga/ausência. * = feriado cadastrado aplicável à localidade.',margin,78);
 }
 const width=doc.internal.pageSize.getWidth(), fixed=72, dayWidth=(width-margin*2-fixed)/report.dates.length;
 const holidayDays=new Set(report.holidayDates.map(day=>day.date));
 const columns:Record<number,{cellWidth:number;fontSize?:number;halign?:'left'|'center'}>={0:{cellWidth:52,fontSize:8,halign:'left'},[report.dates.length+1]:{cellWidth:20,fontSize:7}};
 report.dates.forEach((_,i)=>columns[i+1]={cellWidth:dayWidth});
 autoTable(doc,{
  startY:85,margin:{top:85,left:margin,right:margin,bottom:14},theme:'grid',
  head:[['Colaborador / equipe',...report.dates.map(date=>`${date.slice(8)}${holidayDays.has(date)?'*':''}\n${names[weekday(date)]}`),'Dias\nT / F / A / ?']],
  body:report.rows.length?report.rows.map(row=>[`${row.employee.name}\n${row.employee.team} · ${row.employee.regime}`,...row.plans.map((plan,i)=>matrixText(plan,report.dates[i])),`${row.working} / ${row.off} / ${row.absent} / ${row.unplanned}`]):[['Nenhum colaborador neste filtro',...report.dates.map(()=>''),'']],
  foot:[['Cobertura diária\nT / F / A / ?',...report.daily.map(day=>`${day.scheduled.length}/${day.off.length}/${day.absent.length}/${day.unplanned.length}`),'']],showFoot:'lastPage',
  styles:{font,fontSize:6.6,cellPadding:{top:2,right:.7,bottom:2,left:.7},minCellHeight:12,halign:'center',valign:'middle',lineColor:LINE,lineWidth:.15,textColor:INK,overflow:'linebreak'},
  columnStyles:columns,headStyles:{fillColor:CHALK,textColor:INK,fontStyle:'bold',fontSize:7},footStyles:{fillColor:PAPER,textColor:INK,fontStyle:'normal',fontSize:6.5},rowPageBreak:'avoid',
  didParseCell(data){const index=data.column.index-1;if(index>=0&&index<report.dates.length&&isWeekend(report.dates[index]))data.cell.styles.fillColor=PAPER;if(data.section==='body'&&index>=0&&index<report.dates.length){const status=report.rows[data.row.index]?.plans[index].status;if(status==='off')data.cell.styles.fillColor=CHALK;if(status==='unplanned')data.cell.styles.textColor=[120,113,107];if(status==='conflict'){data.cell.styles.fillColor=CHALK;data.cell.styles.fontStyle='bold';}}},
  didDrawPage(){header('Escala mensal');}
 });
 if(report.includeDaily){
  doc.addPage('a4','landscape');
  autoTable(doc,{
   startY:51,margin:{top:51,left:margin,right:margin,bottom:14},theme:'grid',
   head:[['Dia','Escalados / presença prevista','Folga / ausência cadastrada','Sem planejamento']],
   body:report.daily.map(day=>[`${labelDate(day.date,{day:'2-digit',month:'2-digit'})}${day.holidays.length?'*':''}\n${names[weekday(day.date)]}`,day.scheduled.length?day.scheduled.map(({employee,plan})=>`${employee.name}: ${plan.lines.join('; ')}${plan.status==='conflict'?' [CONFLITO COM FOLGA/AUSÊNCIA]':''}`).join('\n'):'Nenhum turno cadastrado',[...day.off.map(e=>`${e.name} (folga)`),...day.absent.map(({employee,absence})=>`${employee.name} (${absence.kind==='ferias'?'férias':absence.kind==='licenca'?'licença':'afastamento'})`)].join(', ')||'-',day.unplanned.map(e=>e.name).join(', ')||'-']),
   styles:{font,fontSize:8,cellPadding:2,lineColor:LINE,lineWidth:.15,textColor:INK,valign:'top',overflow:'linebreak'},headStyles:{fillColor:CHALK,textColor:INK},columnStyles:{0:{cellWidth:17},1:{cellWidth:105},2:{cellWidth:69},3:{cellWidth:82}},rowPageBreak:'avoid',
   didDrawPage(){header('Detalhamento diário',true);}
  });
 }
 if(report.holidayDates.length){
  doc.addPage('a4','landscape');
  autoTable(doc,{
   startY:51,margin:{top:51,left:margin,right:margin,bottom:14},theme:'grid',
   head:[['Data','Feriado','Abrangência','Localidade','Referência']],
   body:report.holidayDates.flatMap(day=>day.holidays.map(holiday=>[labelDate(day.date,{day:'2-digit',month:'2-digit'}),holiday.name,scopeLabels[holiday.scope],holidayLocality(holiday),holiday.reference??'-'])),
   styles:{font,fontSize:9,cellPadding:2,lineColor:LINE,lineWidth:.15,textColor:INK,valign:'top',overflow:'linebreak'},headStyles:{fillColor:CHALK,textColor:INK},columnStyles:{0:{cellWidth:17},1:{cellWidth:82},2:{cellWidth:28},3:{cellWidth:66},4:{cellWidth:80}},rowPageBreak:'avoid',
   didDrawPage(){header('Feriados considerados',true,'Cadastro manual. A sinalização não cria folga automática nem calcula adicionais ou compensações.');}
  });
 }
 const pages=doc.getNumberOfPages();
 for(let page=1;page<=pages;page++){doc.setPage(page);const w=doc.internal.pageSize.getWidth(),h=doc.internal.pageSize.getHeight();doc.setDrawColor(...LINE);doc.line(margin,h-11,w-margin,h-11);doc.setFont(font,'normal');doc.setFontSize(8);doc.setTextColor(100);doc.text('Escala | Dados do planejamento no momento da exportação',margin,h-6);doc.text(`${page} / ${pages}`,w-margin,h-6,{align:'right'});}
 return doc;
}
export function monthlyPdfFilename(month:string){return `escala-mensal-${month}.pdf`;}
