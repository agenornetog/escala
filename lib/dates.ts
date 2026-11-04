export function dateKey(date: Date) { return date.toISOString().slice(0, 10); }
export function addDays(date: string, days: number) { const d = new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + days); return dateKey(d); }
export function monday(date: string) { const day = new Date(`${date}T12:00:00Z`).getUTCDay(); return addDays(date, -(day === 0 ? 6 : day - 1)); }
export function today() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year:'numeric',month:'2-digit',day:'2-digit' }).format(new Date()); }
export function labelDate(date: string, options: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short' }) { return new Date(`${date}T12:00:00Z`).toLocaleDateString('pt-BR', { ...options, timeZone: 'UTC' }); }

export function monthDays(month: string) {
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)||Number(month.slice(0,4))<1900||Number(month.slice(0,4))>2200)throw new Error('Selecione um mês válido.');
 const first=`${month}-01`;
 const next=new Date(`${first}T12:00:00Z`);next.setUTCMonth(next.getUTCMonth()+1);
 const length=Math.round((next.getTime()-Date.parse(`${first}T12:00:00Z`))/86400000);
 return Array.from({length},(_,i)=>addDays(first,i));
}
export function addMonths(month:string,amount:number){monthDays(month);const date=new Date(`${month}-01T12:00:00Z`);date.setUTCMonth(date.getUTCMonth()+amount);return dateKey(date).slice(0,7);}
export function monthLabel(month:string){monthDays(month);return labelDate(`${month}-01`,{month:'long',year:'numeric'});}
export function weekday(date:string){return new Date(`${date}T12:00:00Z`).getUTCDay();}
export function isWeekend(date:string){return [0,6].includes(weekday(date));}
