export function dateKey(date: Date) { return date.toISOString().slice(0, 10); }
export function addDays(date: string, days: number) { const d = new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + days); return dateKey(d); }
export function monday(date: string) { const day = new Date(`${date}T12:00:00Z`).getUTCDay(); return addDays(date, -(day === 0 ? 6 : day - 1)); }
export function today() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year:'numeric',month:'2-digit',day:'2-digit' }).format(new Date()); }
export function labelDate(date: string, options: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short' }) { return new Date(`${date}T12:00:00Z`).toLocaleDateString('pt-BR', { ...options, timeZone: 'UTC' }); }
