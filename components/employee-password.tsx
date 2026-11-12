'use client';
import { useState, type FormEvent } from 'react';
import Modal from '@/components/modal';

export default function EmployeePassword() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [updated, setUpdated] = useState(false);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const password = fields.get('password');
    if (password !== fields.get('confirmation')) {
      setError('As novas senhas precisam ser iguais.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/employee/password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: fields.get('currentPassword'), password }),
      });
      if (!response.ok) throw new Error((await response.json()).error);
      setOpen(false);
      setUpdated(true);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Não foi possível alterar a senha.');
    } finally {
      setBusy(false);
    }
  }

  return <>
    <button className="btn secondary" onClick={() => { setError(''); setUpdated(false); setOpen(true); }}>Alterar senha</button>
    {updated && <span role="status">Senha atualizada.</span>}
    {open && <Modal title="Alterar senha" close={() => { if (!busy) setOpen(false); }}>
      <form className="form-grid" onSubmit={save}>
        <label className="full">Senha atual<input name="currentPassword" type="password" autoComplete="current-password" required maxLength={256} /></label>
        <label className="full">Nova senha<input name="password" type="password" autoComplete="new-password" required minLength={12} maxLength={256} /></label>
        <label className="full">Confirme a nova senha<input name="confirmation" type="password" autoComplete="new-password" required minLength={12} maxLength={256} /></label>
        {error && <p className="form-errors full" role="alert">{error}</p>}
        <div className="form-footer full"><button className="btn primary" disabled={busy}>Salvar nova senha</button></div>
      </form>
    </Modal>}
  </>;
}
