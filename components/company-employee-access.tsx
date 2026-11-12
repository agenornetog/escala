'use client';
import { useEffect, useState, type FormEvent } from 'react';
import Modal from '@/components/modal';
import { labelDate } from '@/lib/dates';
import type { Employee, Store } from '@/lib/types';
import type { EmployeeSwap } from '@/lib/employee-swaps';
import { swapStatus } from '@/components/employee-swap-requests';

type Account = { employee_id: string; email: string; allow_swaps: boolean; published_at: string | null };
type CompanyAccess = { accounts: Account[]; swaps: EmployeeSwap[] };

export async function employeeAccessAction(organization: string, payload?: object) {
  const response = await fetch('/api/empresa/' + organization + '/colaboradores', payload ? {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  } : { cache: 'no-store' });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result) throw new Error(result?.error ?? 'Não foi possível acessar os dados do colaborador.');
  return result;
}

function useCompanyAccess(organization: string, employee?: string) {
  const [data, setData] = useState<CompanyAccess | null>(null);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let active = true;
    employeeAccessAction(organization).then(result => {
      if (active) {
        setData(result);
        setError('');
      }
    }).catch(failure => {
      if (active) setError(failure.message);
    });
    return () => { active = false; };
  }, [organization, employee, refresh]);

  return { data, error, reload: () => setRefresh(value => value + 1) };
}

export function CompanyEmployeeAccess({ organization, employee, pending, close }: {
  organization: string; employee: Employee; pending: boolean; close: () => void;
}) {
  const { data, error, reload } = useCompanyAccess(organization, employee.id);
  const account = data?.accounts.find(item => item.employee_id === employee.id);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [failure, setFailure] = useState('');

  async function action(payload: object, success: (result: { invited?: boolean; passwordCreated?: boolean }) => string) {
    setBusy(true);
    setMessage('');
    setFailure('');
    try {
      const result = await employeeAccessAction(organization, payload);
      setMessage(success(result));
      reload();
    } catch (error) {
      setFailure(error instanceof Error ? error.message : 'Não foi possível concluir a operação.');
    } finally {
      setBusy(false);
    }
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const password = fields.get('password') ?? '';
    void action({ action: 'link', employee: employee.id, email: fields.get('email'), password, allowSwaps: fields.has('allowSwaps') },
      result => result.passwordCreated ? 'Acesso criado com senha provisória.'
        : result.invited ? 'Convite enviado ao colaborador.'
        : password ? 'Conta existente vinculada. A senha atual continua válida.' : 'Acesso do colaborador salvo.');
  }

  return <Modal title={'Acesso de ' + employee.name} close={close}>
    {(error || failure) && <p role="alert" className="form-errors">{error || failure}</p>}
    {message && <p role="status">{message}</p>}
    {data ? <>
      <form className="form-grid" key={account?.email ?? 'new'} onSubmit={save}>
        <label className="full">E-mail de acesso<input name="email" type="email" required maxLength={254} defaultValue={account?.email} readOnly={Boolean(account)} /></label>
        {!account && <label className="full">Senha provisória<input name="password" type="password" autoComplete="new-password" minLength={12} maxLength={256} /><small>Deixe em branco para usar convite ou vincular uma conta existente.</small></label>}
        <label className="individual-toggle full"><input type="checkbox" name="allowSwaps" defaultChecked={account?.allow_swaps} />Permitir solicitação de troca de turno</label>
        <div className="full"><button className="btn primary" disabled={busy || pending}>{account ? 'Salvar permissão' : 'Criar ou vincular acesso'}</button></div>
      </form>
      {account && <div className="form-footer">
        <button className="btn secondary" disabled={busy || pending} onClick={() => void action(
          { action: 'link', employee: employee.id, email: account.email, allowSwaps: account.allow_swaps, resend: true },
          () => 'Convite reenviado.',
        )}>Reenviar convite</button>
      </div>}
    </> : !error && <p role="status">Carregando acesso…</p>}
  </Modal>;
}

export function CompanySwapRequests({ organization, employees, revision, pending, onApproved }: {
  organization: string; employees: Employee[]; revision: number; pending: boolean;
  onApproved: (store: Store, revision: number) => void;
}) {
  const { data, error, reload } = useCompanyAccess(organization);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState('');

  async function decide(event: FormEvent<HTMLFormElement>, requestId: string) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const approve = (event.nativeEvent as SubmitEvent).submitter?.getAttribute('value') === 'approve';
    setBusy(true);
    setFailure('');
    try {
      const result = await employeeAccessAction(organization, {
        action: 'decide', requestId, revision, approve,
        replacement: approve ? fields.get('replacement') : null,
        decision: fields.get('decision'),
      });
      if (result.store) onApproved(result.store, result.revision);
      reload();
    } catch (error) {
      setFailure(error instanceof Error ? error.message : 'Não foi possível decidir a solicitação.');
    } finally {
      setBusy(false);
    }
  }

  return <section className="panel">
    <div className="panel-title"><h2>Pedidos dos colaboradores</h2><button className="btn secondary" onClick={reload} disabled={busy}>Atualizar</button></div>
    {(error || failure) && <p className="form-errors" role="alert">{error || failure}</p>}
    {data ? data.swaps.length ? data.swaps.map(request => <article className="panel" key={request.id}>
      <div className="panel-title">
        <div><strong>{employees.find(employee => employee.id === request.shift.employeeId)?.name ?? 'Colaborador removido'}</strong>
          <p>{labelDate(request.shift.date)} · {request.shift.start}–{request.shift.end}</p></div>
        <span className={'status ' + request.status}>{swapStatus[request.status]}</span>
      </div>
      <p>{request.reason}</p>
      {request.decision && <p>Decisão do gestor: {request.decision}</p>}
      {request.status === 'pending' && <form className="form-grid" onSubmit={event => void decide(event, request.id)}>
        <label>Cobertura<select name="replacement" defaultValue=""><option value="">Selecione um colaborador</option>{employees.filter(employee => employee.id !== request.shift.employeeId).map(employee =>
          <option key={employee.id} value={employee.id}>{employee.name}</option>)}</select></label>
        <label>Motivo da decisão<input name="decision" maxLength={500} placeholder="Obrigatório na recusa" /></label>
        <p className="full form-note">A aprovação atualiza a escala dos envolvidos.</p>
        <div className="form-footer full">
          <button className="btn secondary" value="reject" disabled={pending || busy}>Recusar</button>
          <button className="btn primary" value="approve" disabled={pending || busy}>Aprovar cobertura</button>
        </div>
      </form>}
    </article>) : <p>Nenhuma solicitação recebida.</p> : !error && <p role="status">Carregando solicitações…</p>}
  </section>;
}
