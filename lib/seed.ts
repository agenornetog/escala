import { addDays, monday, today } from './dates';
import { defaultRules } from './validation';
import type { Employee, Shift, Store } from './types';
export function createSeed(): Store {
 const employees: Employee[] = [
 {id:'e1',name:'Ana Costa',role:'Técnica de campo',team:'Campo',regime:'5x2',color:'purple',sundayEvery:2},
 {id:'e2',name:'Bruno Almeida',role:'Técnico de campo',team:'Campo',regime:'5x2',color:'blue',sundayEvery:3},
 {id:'e3',name:'Camila Santos',role:'Analista de suporte',team:'Suporte',regime:'5x2',color:'rose',sundayEvery:2},
 {id:'e4',name:'Diego Oliveira',role:'Analista de suporte',team:'Suporte',regime:'5x2',color:'orange',sundayEvery:3},
 {id:'e5',name:'Elisa Martins',role:'Atendente',team:'Atendimento',regime:'6x1',color:'teal',sundayEvery:2},
 {id:'e6',name:'Felipe Souza',role:'Técnico de campo',team:'Campo',regime:'6x1',color:'green',sundayEvery:3},
 {id:'e7',name:'Gabriela Lima',role:'Atendente',team:'Atendimento',regime:'5x2',color:'pink',sundayEvery:2},
 {id:'e8',name:'Henrique Alves',role:'Analista de suporte',team:'Suporte',regime:'5x2',color:'indigo',sundayEvery:3}];
 const base=monday(today()); const shifts: Shift[]=[];
 employees.forEach((e,ei)=> { for(let d=0;d<7;d++) {
  const days = e.regime==='6x1' ? [0,1,2,3,4,5] : ei%3===1 ? [1,2,3,4,5] : [0,1,2,3,4];
  if(days.includes(d)) { const short=e.regime==='6x1'; const late=ei===2||ei===3; shifts.push({id:`s-${ei}-${d}`,employeeId:e.id,date:addDays(base,d),start:late?'12:00':'08:00',end:short?(d===5?'12:00':'17:00'):late?'21:00':'17:00',breakMinutes:short&&d===5?0:60}); }
 }});
 return {version:1,employees,shifts,rules:{...defaultRules},swaps:[]};
}
