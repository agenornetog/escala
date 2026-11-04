'use client';
import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
export default function Modal({title,subtitle,close,children,className=''}:{title:string;subtitle?:string;close:()=>void;children:React.ReactNode;className?:string}){
 const container=useRef<HTMLElement>(null),onClose=useRef(close);
 useEffect(()=>{onClose.current=close;},[close]);
 useEffect(()=>{
  const previous=document.activeElement as HTMLElement|null,overflow=document.body.style.overflow;
  document.body.style.overflow='hidden';
  const root=container.current;
  const focusable=()=>[...(root?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),a[href],[tabindex="0"]')??[])].filter(e=>e.getClientRects().length>0);
  focusable()[0]?.focus();
  function key(e:KeyboardEvent){if(e.key==='Escape'){e.preventDefault();onClose.current();}if(e.key==='Tab'){const elements=focusable(),first=elements[0],last=elements.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}}
  document.addEventListener('keydown',key);
  return()=>{document.removeEventListener('keydown',key);document.body.style.overflow=overflow;previous?.focus();};
 },[]);
 return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)close();}}><section ref={container} className={`modal ${className}`} role="dialog" aria-modal="true" aria-label={title}><div className="modal-heading"><div><h2>{title}</h2>{subtitle&&<p>{subtitle}</p>}</div><button className="icon-btn" onClick={close} aria-label="Fechar"><X size={20}/></button></div>{children}</section></div>;
}
