import type { Holiday, HolidayScope, WorkspaceLocation } from './types';
export const BRAZIL_STATES=[['AC','Acre'],['AL','Alagoas'],['AM','Amazonas'],['AP','Amapá'],['BA','Bahia'],['CE','Ceará'],['DF','Distrito Federal'],['ES','Espírito Santo'],['GO','Goiás'],['MA','Maranhão'],['MG','Minas Gerais'],['MS','Mato Grosso do Sul'],['MT','Mato Grosso'],['PA','Pará'],['PB','Paraíba'],['PE','Pernambuco'],['PI','Piauí'],['PR','Paraná'],['RJ','Rio de Janeiro'],['RN','Rio Grande do Norte'],['RO','Rondônia'],['RR','Roraima'],['RS','Rio Grande do Sul'],['SC','Santa Catarina'],['SE','Sergipe'],['SP','São Paulo'],['TO','Tocantins']] as const;
export const scopeLabels:Record<HolidayScope,string>={nacional:'Nacional',estadual:'Estadual',municipal:'Municipal'};
function text(value:unknown){return typeof value==='string'?value.trim().replace(/\s+/g,' '):'';}
export function normalizePlace(value:string){return text(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR');}
export function validHolidayDate(value:unknown):value is string{
 if(typeof value!=='string'||!/^\d{4}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/.test(value)||Number(value.slice(0,4))<1900||Number(value.slice(0,4))>2200)return false;
 const timestamp=Date.parse(value+'T12:00:00Z');return Number.isFinite(timestamp)&&new Date(timestamp).toISOString().slice(0,10)===value;
}
function validState(state:string){return BRAZIL_STATES.some(([uf])=>uf===state);}
export function normalizeLocation(input:unknown):WorkspaceLocation|undefined{
 if(input===undefined||input===null)return undefined;
 if(typeof input!=='object'||Array.isArray(input))throw new Error('Localidade inválida.');
 const raw=input as Record<string,unknown>,state=text(raw.state).toUpperCase(),city=text(raw.city);
 if(!state&&!city)return undefined;
 if(!validState(state))throw new Error('Selecione uma UF válida para a localidade.');
 if(city.length>120)throw new Error('O município deve ter até 120 caracteres.');
 return {state,...(city?{city}:{})};
}
export function normalizeHoliday(input:unknown):Holiday{
 if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Dados do feriado inválidos.');
 const raw=input as Record<string,unknown>,id=text(raw.id),name=text(raw.name),scope=raw.scope as HolidayScope;
 if(!id||id.length>100)throw new Error('Identificação do feriado inválida.');
 if(!name||name.length>100)throw new Error('Informe um nome com até 100 caracteres.');
 if(!validHolidayDate(raw.date))throw new Error('Informe uma data válida entre 1900 e 2200.');
 if(!Object.hasOwn(scopeLabels,scope))throw new Error('Selecione a abrangência do feriado.');
 if(raw.annual!==undefined&&typeof raw.annual!=='boolean')throw new Error('Recorrência inválida.');
 const state=text(raw.state).toUpperCase(),city=text(raw.city),reference=text(raw.reference),notes=text(raw.notes);
 if(scope!=='nacional'&&!validState(state))throw new Error('Selecione a UF do feriado.');
 if(scope==='municipal'&&(!city||city.length>120))throw new Error('Informe o município com até 120 caracteres.');
 if(reference.length>500||notes.length>500)throw new Error('Referência e observações devem ter até 500 caracteres.');
 return {id,name,date:raw.date,scope,annual:raw.annual===true,...(scope!=='nacional'?{state}:{}),...(scope==='municipal'?{city}:{}),...(reference?{reference}:{}),...(notes?{notes}:{})};
}
export function duplicateHoliday(candidate:Holiday,existing:Holiday[]){
 return existing.find(item=>item.id!==candidate.id&&normalizePlace(item.name)===normalizePlace(candidate.name)&&item.scope===candidate.scope&&(item.state??'')===(candidate.state??'')&&normalizePlace(item.city??'')===normalizePlace(candidate.city??'')&&(item.annual||candidate.annual?item.date.slice(5)===candidate.date.slice(5):item.date===candidate.date));
}
export function holidayOccurrence(holiday:Holiday,year:number){
 if(!Number.isInteger(year)||year<1900||year>2200)return undefined;
 const date=holiday.annual?`${year}-${holiday.date.slice(5)}`:holiday.date;
 return date.startsWith(`${year}-`)&&validHolidayDate(date)?date:undefined;
}
export function holidayApplies(holiday:Holiday,location?:WorkspaceLocation){
 if(holiday.scope==='nacional')return true;
 if(!location||holiday.state!==location.state)return false;
 return holiday.scope==='estadual'||Boolean(location.city&&normalizePlace(holiday.city??'')===normalizePlace(location.city));
}
export function holidaysOnDate(holidays:Holiday[],date:string,location?:WorkspaceLocation){
 const order={nacional:0,estadual:1,municipal:2};
 return holidays.filter(holiday=>holidayOccurrence(holiday,Number(date.slice(0,4)))===date&&holidayApplies(holiday,location)).sort((a,b)=>order[a.scope]-order[b.scope]||a.name.localeCompare(b.name,'pt-BR'));
}
export function holidayLocality(holiday:Holiday){return holiday.scope==='nacional'?'Brasil':holiday.scope==='estadual'?holiday.state!: `${holiday.city}/${holiday.state}`;}
