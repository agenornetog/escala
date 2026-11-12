'use client';
import { useState, type FormEvent } from 'react';
import { ArrowRight, CalendarDays, Eye, EyeOff, LoaderCircle, LockKeyhole, ShieldCheck } from 'lucide-react';

const weekdays = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
const weeklyShifts = [
  ['08:00–17:00', '08:00–17:00', '08:00–17:00', 'Folga', '08:00–17:00', '08:00–12:00', 'Folga'],
  ['Folga', '10:00–19:00', '10:00–19:00', '10:00–19:00', '10:00–19:00', 'Folga', '09:00–13:00'],
  ['09:00–18:00', '09:00–18:00', 'Folga', '09:00–18:00', '09:00–18:00', '09:00–13:00', 'Folga'],
];
export default function Login({ configured, demoAccess=false }: { configured: boolean; demoAccess?:boolean }) {
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: data.get('email'), password: data.get('password') }) });
      const result = await response.json();
      if (!response.ok) { setError(result.error || 'Não foi possível entrar. Tente novamente.'); setBusy(false); return; }
      window.location.replace(result.redirectTo === '/colaborador' || result.redirectTo === '/gestao' || (typeof result.redirectTo === 'string' && /^\/empresa\/[a-f0-9-]{36}$/i.test(result.redirectTo)) ? result.redirectTo : '/');
    } catch { setError('Não foi possível conectar. Confira sua conexão e tente novamente.'); setBusy(false); }
  }
  return <div className="login-shell">
    <main className="login-main">
      <div className="login-hero">
        <div className="login-preview" aria-hidden="true">
          <div className="login-preview-title"><CalendarDays size={22} />Escala semanal</div>
          <div className="login-mini-days">
            {weekdays.map((day, column) => (
              <div className="login-mini-day" key={day}>
                <span>{day}</span>
                {weeklyShifts.map((week, row) => (
                  <div className={week[column] === 'Folga' ? 'login-mini-shift mini-off' : 'login-mini-shift'} key={row}>
                    {week[column]}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
        <a className="brand login-brand" href="/login" aria-label="escalô — início">
          <span className="brand-mark" aria-hidden="true" />escalô
        </a>
      </div>
      <div className="login-content">
      <section className="login-card" aria-labelledby="login-title"><div className="login-lock"><LockKeyhole size={22} /></div><h1 id="login-title">Bom ter você por aqui.</h1><p>Entre para planejar a equipe ou consultar sua jornada.</p>
        {!configured && <div className="login-unavailable" role="status">O acesso desta instalação ainda não foi configurado. O administrador precisa concluir a liberação do login.</div>}
        <form onSubmit={submit} className="login-form">
          <label htmlFor="login-email">E-mail<input id="login-email" type="email" name="email" placeholder="voce@empresa.com.br" autoComplete="username" required maxLength={254} disabled={busy} /></label>
          <label htmlFor="login-password">Senha<div className="password-input"><input id="login-password" type={visible ? 'text' : 'password'} name="password" placeholder="Sua senha" autoComplete="current-password" required maxLength={256} disabled={busy} /><button type="button" className="icon-btn" aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'} aria-pressed={visible} onClick={() => setVisible(!visible)}>{visible ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></label>
          {error && <div className="form-errors" role="alert">{error}</div>}
          <button className="btn primary login-submit" disabled={busy}>{busy ? <><LoaderCircle size={17} className="spin" />Entrando…</> : <>Entrar na minha conta<ArrowRight size={17} /></>}</button>
        </form>{demoAccess&&<p className="login-help"><a href="/">Continuar na demonstração</a></p>}<div className="login-card-footer"><ShieldCheck size={15} />Uma sessão segura para planejar melhor.</div>
      </section>
      </div>
    </main>
  </div>;
}
