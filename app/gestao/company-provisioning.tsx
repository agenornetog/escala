'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

export function CompanyProvisioning({ companies }: { companies: { id: string; name: string }[] }) {
  const router = useRouter();
  const [companyId, setCompanyId] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/platform/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await response.json();
      setMessage(response.ok ? 'Administrador vinculado à empresa.' : result.error);
      if (response.ok) {
        form.reset();
        setCompanyId('');
        router.refresh();
      }
    } catch {
      setMessage('Não foi possível conectar. Tente novamente.');
    } finally {
      setBusy(false);
    }
  }

  return <form onSubmit={submit} className="mt-6 grid max-w-lg gap-4 rounded-xl border bg-white p-5">
    <label className="grid gap-1">Empresa
      <select name="companyId" value={companyId} onChange={event => setCompanyId(event.target.value)} className="rounded border p-2">
        <option value="">Criar nova empresa</option>
        {companies.map(company => <option value={company.id} key={company.id}>{company.name}</option>)}
      </select>
    </label>
    {!companyId && <label className="grid gap-1">Nome da empresa<input name="name" required maxLength={150} className="rounded border p-2" /></label>}
    <label className="grid gap-1">E-mail do administrador<input name="email" type="email" required maxLength={254} className="rounded border p-2" /></label>
    <label className="grid gap-1">Senha inicial
      <input name="password" type="password" autoComplete="new-password" minLength={12} maxLength={256} className="rounded border p-2" />
      <small>Preencha para criar uma conta. Para vincular uma conta confirmada, deixe em branco.</small>
    </label>
    <button className="btn primary" disabled={busy}>{busy ? 'Salvando…' : 'Salvar empresa e administrador'}</button>
    {message && <p role="status">{message}</p>}
  </form>;
}
