'use client';
import { useState, type FormEvent } from 'react';
import { labelDate, today } from '@/lib/dates';
import type { Shift } from '@/lib/types';
import type { EmployeeSwap } from '@/lib/employee-swaps';

export const swapStatus = { pending: 'Pendente', approved: 'Aprovada', rejected: 'Recusada' };

export default function EmployeeSwapRequests({ organization, allowed, shifts, requests, refresh }: {
  organization: string;
  allowed: boolean;
  shifts: Shift[];
  requests: EmployeeSwap[];
  refresh: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const available = shifts.filter(shift => shift.date >= today()
    && !requests.some(request => request.status === 'pending' && request.shift.id === shift.id));

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/employee/swaps', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organization, shift: fields.get('shift'), reason: fields.get('reason') }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      form.reset();
      setMessage('Pedido enviado. Seu turno continua valendo até a aprovação.');
      refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível enviar o pedido.');
    } finally {
      setBusy(false);
    }
  }

  if (!allowed && !requests.length) return null;
  return <section className="panel employee-month">
    <h2>Troca de turno</h2>
    {allowed && (available.length ? <form className="form-grid" onSubmit={send}>
      <label>Turno<select name="shift" required defaultValue=""><option value="" disabled>Selecione</option>{available.map(shift =>
        <option key={shift.id} value={shift.id}>{labelDate(shift.date)} · {shift.start}–{shift.end}</option>)}</select></label>
      <label>Motivo<textarea name="reason" required maxLength={500} /></label>
      <div className="full"><button className="btn primary" disabled={busy}>Solicitar troca</button></div>
    </form> : <p>Nenhum turno disponível para solicitar neste mês.</p>)}
    {message && <p role="status">{message}</p>}
    {requests.map(request => <article className="swap-row" key={request.id}>
      <div><strong>{labelDate(request.shift.date)} · {request.shift.start}–{request.shift.end}</strong><p>{request.reason}</p>
        {request.decision && <p>Decisão do gestor: {request.decision}</p>}</div>
      <span className={'status ' + request.status}>{swapStatus[request.status]}</span>
    </article>)}
  </section>;
}
