'use client';

import { useState, type FormEvent } from 'react';
import { Plus, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Modal from './modal';

export type CompanyUser = { id: string; email: string; role: 'admin' | 'manager'; active: boolean; self: boolean };

export function UsersForm({ organization, users }: { organization: string; users: CompanyUser[] | null }) {
  const router = useRouter();
  const [dialog, setDialog] = useState<{ user?: CompanyUser; status?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  function open(next: NonNullable<typeof dialog>) {
    setError('');
    setMessage('');
    setDialog(next);
  }

  async function submit(data: object, success: string) {
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/empresa/' + organization + '/usuarios', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
      });
      if (!response.ok) {
        const result = await response.json().catch(() => null);
        throw new Error(result?.error ?? 'Não foi possível salvar o acesso.');
      }
      setMessage(success);
      setDialog(null);
      router.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Não foi possível salvar o acesso.');
    } finally {
      setBusy(false);
    }
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submit(Object.fromEntries(new FormData(event.currentTarget)), 'Acesso atualizado.');
  }

  function close() {
    if (!busy) setDialog(null);
  }

  const target = dialog?.user;
  const statusChange = target && dialog?.status !== undefined;

  return <>
    <div className="page-heading">
      <div className="heading-row">
        <div><h1>Usuários</h1><p>Gerencie as permissões e os acessos à empresa.</p></div>
        <div className="heading-actions">
          <button className="btn primary" onClick={() => open({})}><Plus size={17} />Novo usuário</button>
        </div>
      </div>
    </div>
    <section className="panel">
      <div className="panel-title"><h2>Usuários da empresa {users && <span className="pill">{users.length}</span>}</h2></div>
      {message && <p className="notice" role="status">{message}</p>}
      {users === null && <p role="alert">Não foi possível carregar os usuários. Atualize a página para tentar novamente.</p>}
      {users?.length === 0 && <div className="empty-state"><Users size={26} /><h3>Nenhum usuário cadastrado</h3></div>}
      {users && <ul>
        {users.map(user => <li className="swap-row" key={user.id}>
          <div className="company-user-identity">
            <strong>{user.email}{user.self ? ' (você)' : ''}</strong>
            <p>{user.role === 'admin' ? 'Administrador' : 'Gestor'}</p>
          </div>
          <span className="pill">{user.active ? 'Ativo' : 'Desativado'}</span>
          {!user.self && <div className="company-user-actions">
            <button className="btn secondary" onClick={() => open({ user })}>Editar permissão</button>
            <button className="btn secondary" onClick={() => open({ user, status: !user.active })}>
              {user.active ? 'Desativar' : 'Reativar'}
            </button>
          </div>}
        </li>)}
      </ul>}
    </section>
    {dialog && (statusChange
      ? <Modal title={dialog.status ? 'Reativar usuário' : 'Desativar usuário'} close={close}>
          <p>{dialog.status ? 'Restaurar' : 'Suspender'} o acesso de {target.email} a esta empresa?</p>
          {error && <p className="form-errors" role="alert">{error}</p>}
          <div className="form-footer">
            <button className="btn secondary" onClick={close} disabled={busy}>Cancelar</button>
            <button className={dialog.status ? 'btn primary' : 'btn danger'} disabled={busy} onClick={() =>
              submit({ userId: target.id, active: dialog.status }, dialog.status ? 'Acesso reativado.' : 'Acesso desativado.')
            }>{dialog.status ? 'Reativar' : 'Desativar'}</button>
          </div>
        </Modal>
      : <Modal title={target ? 'Editar permissão' : 'Novo usuário'} close={close}>
          <form onSubmit={save}>
            <div className="form-grid">
              <label className="full">E-mail<input name="email" type="email" defaultValue={target?.email} readOnly={Boolean(target)} required maxLength={254} /></label>
              <label className="full">Permissão<select name="role" defaultValue={target?.role ?? 'manager'}>
                <option value="manager">Gestor</option><option value="admin">Administrador</option>
              </select></label>
              {target ? <input type="hidden" name="password" value="" /> : <label className="full">Senha inicial
                <input name="password" type="password" autoComplete="new-password" minLength={12} maxLength={256} />
                <small>Preencha para criar uma conta. Para vincular uma conta existente, deixe em branco.</small>
              </label>}
            </div>
            {error && <p className="form-errors" role="alert">{error}</p>}
            <div className="form-footer">
              <button type="button" className="btn secondary" onClick={close} disabled={busy}>Cancelar</button>
              <button className="btn primary" disabled={busy}>{busy ? 'Salvando…' : 'Salvar acesso'}</button>
            </div>
          </form>
        </Modal>)}
  </>;
}
