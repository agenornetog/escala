import type { Shift } from './types';
export function interval(s: Shift) {
  const start = Date.parse(`${s.date}T${s.start}:00-03:00`);
  let end = Date.parse(`${s.date}T${s.end}:00-03:00`);
  if (end <= start) end += 86400000;
  return { start, end, hours: (end - start) / 3600000 - s.breakMinutes / 60 };
}
export function shiftTouchesDate(shift:Shift,date:string){
 const dayStart=Date.parse(`${date}T00:00:00-03:00`),time=interval(shift);
 return time.start<dayStart+86400000&&time.end>dayStart;
}
