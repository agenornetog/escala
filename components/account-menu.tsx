'use client';

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { Camera } from 'lucide-react';
import Modal from './modal';
import { PasswordForm } from './employee-password';
import type { AccountProfile } from '@/lib/account';

const photoLimit = 2 * 1024 * 1024;

async function preparePhoto(file: File) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > photoLimit) throw new Error('Selecione uma foto JPEG, PNG ou WebP de até 2 MB.');
  const bitmap = await createImageBitmap(file).catch(() => { throw new Error('Não foi possível abrir essa imagem. Selecione outra foto.'); });
  try {
    const canvas = document.createElement('canvas');
    const side = Math.min(bitmap.width, bitmap.height);
    canvas.width = canvas.height = Math.min(512, side);
    const context = canvas.getContext('2d');
    if (!context || !side) throw new Error('Não foi possível preparar a foto.');
    context.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Não foi possível preparar a foto.')), 'image/webp', 0.88));
  } finally { bitmap.close(); }
}

type Props = { organizationId?: string; fallbackName?: string; fallbackRole?: string; collapsed?: boolean; openAccess?: boolean; onOpen?: () => void };

export default function AccountMenu({ organizationId, fallbackName = 'Minha conta', fallbackRole = 'Usuário', collapsed = false, openAccess = false, onOpen }: Props) {
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [open, setOpen] = useState(false);
  const [reload, setReload] = useState(0);
  const [loading, setLoading] = useState(!openAccess);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [imageFailed, setImageFailed] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (openAccess) return;
    const controller = new AbortController();
    setLoading(true); setError('');
    const query = organizationId ? '?organization=' + encodeURIComponent(organizationId) : '';
    void fetch('/api/account' + query, { cache: 'no-store', signal: controller.signal })
      .then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.error); setProfile(data); })
      .catch(error => { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : 'Não foi possível carregar sua conta.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [openAccess, organizationId, reload]);
  useEffect(() => setImageFailed(false), [profile?.avatarUrl]);

  const name = openAccess ? 'Visitante' : profile?.name ?? fallbackName;
  const role = openAccess ? 'Acesso temporário' : profile?.role ?? fallbackRole;
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toLocaleUpperCase('pt-BR');
  const avatar = <span className="avatar account-avatar">{profile?.avatarUrl && !imageFailed
    ? <img src={profile.avatarUrl} alt="" onError={() => setImageFailed(true)} /> : initials}</span>;

  async function update(path: string, init: RequestInit, message: string) {
    setBusy(true); setError(''); setSuccess('');
    try {
      const response = await fetch('/api/account' + path, init);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setProfile(current => ({ ...result, role: current?.role ?? result.role }));
      setSuccess(message);
    } catch (error) { setError(error instanceof Error ? error.message : 'Não foi possível salvar. Tente novamente.'); }
    finally { setBusy(false); }
  }

  async function saveName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await update('', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: new FormData(event.currentTarget).get('name') }) }, 'Nome atualizado.');
  }

  async function uploadPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    setBusy(true); setError(''); setSuccess('');
    try {
      const photo = await preparePhoto(file);
      await update('/avatar', { method: 'POST', headers: { 'Content-Type': photo.type }, body: photo }, 'Foto atualizada.');
    } catch (error) { setError(error instanceof Error ? error.message : 'Não foi possível enviar sua foto.'); }
    finally { setBusy(false); }
  }

  const identity = <>{avatar}<span className="sidebar-label"><strong>{name}</strong><small>{role}</small></span></>;
  if (openAccess) return <div className="sidebar-profile">{identity}</div>;

  return <>
    <button type="button" className="sidebar-profile" aria-label="Minha conta" title={collapsed ? name : 'Minha conta'} onClick={() => { onOpen?.(); setSuccess(''); setOpen(true); }}>{identity}</button>
    {open && createPortal(<Modal title="Minha conta" close={() => { if (!busy) setOpen(false); }} className="account-modal">
      {loading ? <p role="status">Carregando sua conta…</p> : <>
        <div className="account-photo-row">
          <span className="account-photo-preview">{avatar}</span>
          <div><strong>{name}</strong><p className="muted">{role}</p>
            {profile?.editable && <div className="account-photo-actions">
              <button type="button" className="btn secondary" disabled={busy} onClick={() => fileInput.current?.click()}><Camera size={16} />{profile.avatarUrl ? 'Alterar foto' : 'Adicionar foto'}</button>
              {profile.avatarUrl && <button type="button" className="text-btn" disabled={busy} onClick={() => update('/avatar', { method: 'DELETE' }, 'Foto removida.')}>Remover foto</button>}
              <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" aria-label="Escolher foto" hidden onChange={uploadPhoto} />
            </div>}
          </div>
        </div>
        {profile && <form className="form-grid account-details" onSubmit={saveName}>
          <label className="full">Nome<input key={profile.name} name="name" required maxLength={120} defaultValue={profile.name} readOnly={!profile.editable} disabled={busy} autoComplete="name" /></label>
          <label className="full">E-mail<input type="email" value={profile.email} readOnly autoComplete="email" /></label>
          {profile.editable && <div className="form-footer full"><button className="btn primary" disabled={busy}>{busy ? 'Salvando…' : 'Salvar perfil'}</button></div>}
        </form>}
        {profile?.editable && <section className="account-security"><h3>Alterar senha</h3><PasswordForm onSaved={() => setSuccess('Senha atualizada.')} /></section>}
        {profile && !profile.editable && <p className="form-note">Entre com sua conta da empresa para editar nome, foto e senha.</p>}
      </>}
      {error && <p className="form-errors" role="alert">{error}</p>}
      {!profile && error && <button type="button" className="btn secondary" onClick={() => setReload(value => value + 1)}>Tentar novamente</button>}
      {success && <p className="account-success" role="status">{success}</p>}
    </Modal>, document.body)}
  </>;
}
