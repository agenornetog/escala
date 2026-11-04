'use client';

import { useEffect, useRef } from 'react';
import {
  ArrowLeftRight, Bell, CalendarDays, ChevronDown, CircleHelp,
  LayoutDashboard, LogOut, Menu, PanelLeftClose, PanelLeftOpen,
  ShieldCheck, Users, Flag, X,
} from 'lucide-react';

const navigation = [
  { name: 'Visão geral', icon: LayoutDashboard },
  { name: 'Escalas', icon: CalendarDays },
  { name: 'Colaboradores', icon: Users },
  { name: 'Feriados', icon: Flag },
  { name: 'Trocas de turno', icon: ArrowLeftRight },
  { name: 'Regras e limites', icon: ShieldCheck },
];

type Props = {
  page: string;
  openAccess?: boolean;
  collapsed: boolean;
  mobileOpen: boolean;
  pendingCount: number;
  notificationCount: number;
  onNavigate: (page: string) => void;
  onToggle: () => void;
  onMobileOpen: () => void;
  onMobileClose: () => void;
  onHelp: () => void;
  onNotifications: () => void;
  onLogout: () => void;
};

export default function Sidebar({
  page, openAccess=false, collapsed, mobileOpen, pendingCount, notificationCount,
  onNavigate, onToggle, onMobileOpen, onMobileClose, onHelp,
  onNotifications, onLogout,
}: Props) {
  const panel = useRef<HTMLElement>(null);
  const opener = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!mobileOpen) return;
    const media = window.matchMedia('(max-width: 720px)');
    if (!media.matches) { onMobileClose(); return; }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const root = panel.current;
    const focusClose=()=>{if(!root?.contains(document.activeElement))root?.querySelector<HTMLButtonElement>('.sidebar-close')?.focus({preventScroll:true});};
    const focusFrame=requestAnimationFrame(focusClose);
    const onTransitionEnd=(event:TransitionEvent)=>{if(event.target===root)focusClose();};
    root?.addEventListener('transitionend',onTransitionEnd);
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onMobileClose(); }
      if (event.key !== 'Tab' || !root) return;
      const buttons = [...root.querySelectorAll<HTMLElement>('button:not(:disabled), a[href]')]
        .filter(element => element.getClientRects().length > 0);
      const first = buttons[0], last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault(); last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first?.focus();
      }
    };
    const handleResize = () => { if (!media.matches) onMobileClose(); };
    document.addEventListener('keydown', handleKey);
    media.addEventListener('change', handleResize);
    return () => {
      cancelAnimationFrame(focusFrame);
      root?.removeEventListener('transitionend',onTransitionEnd);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKey);
      media.removeEventListener('change', handleResize);
      opener.current?.focus();
    };
  }, [mobileOpen, onMobileClose]);

  function navigate(name: string) { onNavigate(name); onMobileClose(); }
  function help() { onMobileClose(); onHelp(); }
  function notifications() { onMobileClose(); onNotifications(); }

  return <>
    <header className="mobile-toolbar" inert={mobileOpen}>
      <button ref={opener} className="icon-btn" aria-label="Abrir menu" aria-expanded={mobileOpen} aria-controls="app-sidebar" onClick={onMobileOpen}><Menu size={22} /></button>
      <span className="mobile-page-title">{page}</span>
      <button className="notification-btn icon-btn" aria-label="Abrir notificações" onClick={onNotifications}><Bell size={19} />{notificationCount > 0 && <i />}</button>
    </header>
    <aside ref={panel} id="app-sidebar" className={`app-sidebar ${mobileOpen ? 'mobile-open' : ''}`} role={mobileOpen ? 'dialog' : undefined} aria-modal={mobileOpen ? true : undefined} aria-label="Menu de navegação">
      <div className="sidebar-brand-row">
        <a href="#" className="brand" aria-label="Escala — início" title={collapsed ? 'Escala — início' : undefined} onClick={event => { event.preventDefault(); navigate('Escalas'); }}><span className="brand-mark" aria-hidden="true" /><span className="sidebar-brand-name">escala<span className="brand-dot">.</span></span></a>
        <button className="icon-btn sidebar-toggle" onClick={onToggle} aria-label={collapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'} title={collapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'} aria-expanded={!collapsed} aria-controls="main-navigation">{collapsed ? <PanelLeftOpen size={19} /> : <PanelLeftClose size={19} />}</button>
        <button className="icon-btn sidebar-close" aria-label="Fechar menu" onClick={onMobileClose}><X size={21} /></button>
      </div>
      <button className="sidebar-workspace" aria-label="Sobre TCM Operações" title={collapsed ? 'TCM Operações' : undefined} onClick={help}><span className="workspace-avatar">T</span><span className="sidebar-label"><strong>TCM Operações</strong><small>Seu espaço de planejamento</small></span><ChevronDown size={14} className="sidebar-workspace-arrow" /></button>
      <span className="sidebar-caption">Workspace</span>
      <nav id="main-navigation" aria-label="Navegação principal">
        {navigation.map(item => <button key={item.name} className={`nav-link ${page === item.name ? 'active' : ''}`} aria-label={item.name} aria-current={page === item.name ? 'page' : undefined} title={collapsed ? item.name : undefined} onClick={() => navigate(item.name)}><item.icon size={19} /><span className="sidebar-label">{item.name}</span>{item.name === 'Trocas de turno' && pendingCount > 0 && <b className="nav-count">{pendingCount}</b>}</button>)}
      </nav>
      <div className="sidebar-footer">
        <button className="sidebar-action" aria-label="Abrir notificações" title={collapsed ? 'Notificações' : undefined} onClick={notifications}><Bell size={18} /><span className="sidebar-label">Notificações</span>{notificationCount > 0 && <span className="sidebar-indicator" aria-hidden="true" />}</button>
        <button className="sidebar-action" aria-label="Central de ajuda" title={collapsed ? 'Central de ajuda' : undefined} onClick={help}><CircleHelp size={18} /><span className="sidebar-label">Central de ajuda</span></button>
        <div className="sidebar-account"><button className="sidebar-profile" aria-label="Sobre o ambiente" title={collapsed ? (openAccess?'Acesso temporário':'Administrador local') : undefined} onClick={help}><span className="avatar account-avatar">{openAccess?'V':'AG'}</span><span className="sidebar-label"><strong>{openAccess?'Visitante':'Administrador'}</strong><small>{openAccess?'Acesso temporário':'Acesso local'}</small></span></button>{!openAccess&&<button className="icon-btn sidebar-logout" aria-label="Sair da conta" title="Sair da conta" onClick={onLogout}><LogOut size={18} /></button>}</div>
      </div>
    </aside>
    {mobileOpen && <button className="menu-scrim" tabIndex={-1} aria-label="Fechar navegação" onClick={onMobileClose} />}
  </>;
}
