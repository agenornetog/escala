'use client';
import { useState, type FormEvent } from 'react';
import Modal from '@/components/modal';

export function PasswordForm({ onSaved }: { onSaved: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    const password = fields.get('password');
    if (password !== fields.get('confirmation')) { setError('As novas senhas precisam ser iguais.'); return; }
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/account/password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: fields.get('currentPassword'), password }),
      });
      if (!response.ok) throw new Error((await response.json()).error);
      form.reset(); onSaved();
    } catch (error) { setError(error instanceof Error ? error.message : 'Não foi possível alterar a senha.'); }
    finally { setBusy(false); }
  }

  return <form className="form-grid" onSubmit={save}>
    <label className="full">Senha atual<input name="currentPassword" type="password" autoComplete="current-password" required maxLength={256} /></label>
    <label className="full">Nova senha<input name="password" type="password" autoComplete="new-password" required minLength={12} maxLength={256} /></label>
    <label className="full">Confirme a nova senha<input name="confirmation" type="password" autoComplete="new-password" required minLength={12} maxLength={256} /></label>
    {error && <p className="form-errors full" role="alert">{error}</p>}
    <div className="form-footer full"><button className="btn primary" disabled={busy}>{busy ? 'Salvando senha…' : 'Salvar nova senha'}</button></div>
  </form>;
}

export default function EmployeePassword() {
  const [open, setOpen] = useState(false);
  const [updated, setUpdated] = useState(false);
  return <>
    <button className="btn secondary" onClick={() => { setUpdated(false); setOpen(true); }}>Alterar senha</button>
    {updated && <span role="status">Senha atualizada.</span>}
    {open && <Modal title="Alterar senha" close={() => setOpen(false)}>
      <PasswordForm onSaved={() => { setOpen(false); setUpdated(true); }} />
    </Modal>}
  </>;
}
