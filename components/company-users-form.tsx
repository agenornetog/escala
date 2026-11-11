'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

export type CompanyUser = { id: string; email: string; role: 'admin' | 'manager'; self: boolean };

export function UsersForm({ organization, users }: { organization: string; users: CompanyUser[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [remove, setRemove] = useState<CompanyUser | null>(null);

  async function submit(data: object, success: string) {
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/empresa/' + organization + '/usuarios', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setMessage(success);
      router.refresh();
      return true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível salvar o acesso.');
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (await submit(Object.fromEntries(new FormData(form)), 'Acesso atualizado.')) form.reset();
  }

  return <>
    <form onSubmit={save} className="mt-5 grid max-w-lg gap-3 rounded-xl border bg-white p-5">
      <label className="grid">E-mail<input className="rounded border p-2" name="email" type="email" required maxLength={254} /></label>
      <label className="grid">Papel<select className="rounded border p-2" name="role"><option value="manager">Gestor</option><option value="admin">Administrador</option></select></label>
      <label className="grid">Senha inicial<input className="rounded border p-2" name="password" type="password" autoComplete="new-password" minLength={12} maxLength={256} />
        <small>Preencha para criar uma conta. Para vincular ou alterar o papel de uma conta existente, deixe em branco.</small>
      </label>
      <button className="btn primary" disabled={busy}>Salvar acesso</button>
    </form>
    {message && <p className="mt-3" role="status">{message}</p>}
    <ul className="mt-6 divide-y">
      {users.map(user => <li key={user.id} className="flex flex-wrap items-center gap-3 py-3">
        <span>{user.email} · {user.role === 'admin' ? 'Administrador' : 'Gestor'}{user.self ? ' (você)' : ''}</span>
        {!user.self && <button className="btn secondary" disabled={busy} onClick={() => setRemove(user)}>Remover acesso</button>}
      </li>)}
    </ul>
    {remove && <section className="mt-3 rounded border p-4">
      <p>Remover o acesso de {remove.email} a esta empresa?</p>
      <div className="mt-3 flex gap-3">
        <button className="btn secondary" disabled={busy} onClick={() => setRemove(null)}>Cancelar</button>
        <button className="btn danger" disabled={busy} onClick={async () => {
          if (await submit({ remove: remove.id }, 'Acesso removido.')) setRemove(null);
        }}>Confirmar remoção</button>
      </div>
    </section>}
  </>;
}
