'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';

export default function ActivateEmployee() {
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const readInvite = useRef(false);

  useEffect(() => {
    if (readInvite.current) return;
    readInvite.current = true;
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    setToken(fragment.get('type') === 'invite' ? fragment.get('access_token') ?? '' : '');
    if (window.location.hash) window.history.replaceState(null, '', window.location.pathname);
  }, []);

  async function activate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = form.get('password');
    if (password !== form.get('confirmation')) {
      setError('As senhas precisam ser iguais.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/auth/activate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      if (!response.ok) throw new Error((await response.json()).error);
      window.location.replace('/login');
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Não foi possível ativar o acesso.');
      setBusy(false);
    }
  }

  return <main className="employee-portal">
    <section className="panel">
      <h1>Ativar acesso ao Escalô</h1>
      {token === null ? <p role="status">Verificando convite…</p> : token ? (
        <form className="login-form" onSubmit={activate}>
          <label>Nova senha<input type="password" name="password" autoComplete="new-password" required minLength={12} maxLength={256} /></label>
          <label>Confirme a senha<input type="password" name="confirmation" autoComplete="new-password" required minLength={12} maxLength={256} /></label>
          {error && <p className="form-errors" role="alert">{error}</p>}
          <button className="btn primary login-submit" disabled={busy}>Definir senha</button>
        </form>
      ) : <p role="alert">O convite está ausente ou expirou. Peça um novo convite ao gestor.</p>}
      <a className="text-btn" href="/login">Voltar ao login</a>
    </section>
  </main>;
}
