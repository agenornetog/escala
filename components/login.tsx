'use client';
import { useState, type FormEvent } from 'react';
import { ArrowRight, CalendarDays, Check, Eye, EyeOff, LoaderCircle, LockKeyhole, ShieldCheck } from 'lucide-react';
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
    <header className="login-header"><a className="brand" href="/login" aria-label="Escala — início"><span className="brand-mark" aria-hidden="true" />escala<span className="brand-dot">.</span></a><span className="login-header-note">Pessoas. Tempo. Equilíbrio.</span></header>
    <main className="login-main">
      <section className="login-intro" aria-labelledby="login-intro-title">
        <span className="eyebrow">Um bom dia começa com uma boa escala</span>
        <h1 id="login-intro-title">Cada pessoa.<br />{' '}No tempo certo.</h1>
        <p>Mais clareza para planejar. Mais tranquilidade para sua equipe. Seu próximo turno começa aqui.</p>
        <div className="login-preview" aria-hidden="true"><div className="login-preview-title"><CalendarDays size={18} /><span>Uma semana em equilíbrio</span><span className="pill">Planejada</span></div><div className="login-mini-days">{['Seg', 'Ter', 'Qua', 'Qui', 'Sex'].map((day, i) => <div key={day}><span>{day}</span><div className={`login-mini-shift ${i === 3 ? 'mini-off' : ''}`}>{i === 3 ? 'Folga' : <><span>08:00</span><span>17:00</span></>}</div></div>)}</div><div className="login-preview-footer"><Check size={14} />Tempo para trabalhar. Tempo para descansar.</div></div>
        <div className="login-trust"><span><ShieldCheck size={16} />Planejamento com cuidado</span><span><LockKeyhole size={16} />Acesso restrito</span></div>
      </section>
      <section className="login-card" aria-labelledby="login-title"><div className="login-lock"><LockKeyhole size={22} /></div><h2 id="login-title">Bom ter você por aqui.</h2><p>Entre para planejar a equipe ou consultar sua jornada.</p>
        {!configured && <div className="login-unavailable" role="status">O acesso desta instalação ainda não foi configurado. O administrador precisa concluir a liberação do login.</div>}
        <form onSubmit={submit} className="login-form">
          <label htmlFor="login-email">E-mail<input id="login-email" type="email" name="email" placeholder="voce@empresa.com.br" autoComplete="username" required maxLength={254} disabled={busy} /></label>
          <label htmlFor="login-password">Senha<div className="password-input"><input id="login-password" type={visible ? 'text' : 'password'} name="password" placeholder="Sua senha" autoComplete="current-password" required maxLength={256} disabled={busy} /><button type="button" className="icon-btn" aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'} aria-pressed={visible} onClick={() => setVisible(!visible)}>{visible ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></label>
          {error && <div className="form-errors" role="alert">{error}</div>}
          <button className="btn primary login-submit" disabled={busy}>{busy ? <><LoaderCircle size={17} className="spin" />Entrando…</> : <>Entrar na minha conta<ArrowRight size={17} /></>}</button>
        </form>{demoAccess&&<p className="login-help"><a href="/">Continuar na demonstração</a></p>}<p className="login-help">Precisa de acesso ou esqueceu sua senha?<br />Fale com o administrador da sua operação.</p><div className="login-card-footer"><ShieldCheck size={15} />Uma sessão segura para planejar melhor.</div>
      </section>
    </main><footer className="login-footer"><span>Feito para pessoas. Pensado para sua operação.</span><span>Escala · Gestão de equipes</span></footer>
  </div>;
}
