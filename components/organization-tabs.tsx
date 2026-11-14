'use client';

import type { KeyboardEvent } from 'react';

const tabs = [
  { id: 'company', label: 'Empresa e equipes' },
  { id: 'rules', label: 'Regras de jornada' },
  { id: 'instruments', label: 'Sindicatos e instrumentos' },
  { id: 'absences', label: 'Ausências' },
  { id: 'review', label: 'Revisão do mês' },
] as const;

export type OrganizationTab = typeof tabs[number]['id'];

type Props = {
  value: OrganizationTab;
  onChange: (value: OrganizationTab) => void;
};

export default function OrganizationTabs({ value, onChange }: Props) {
  function navigate(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const destinations: Record<string, number> = {
      ArrowRight: (index + 1) % tabs.length,
      ArrowLeft: (index + tabs.length - 1) % tabs.length,
      Home: 0,
      End: tabs.length - 1,
    };
    const destination = destinations[event.key];
    if (destination === undefined) return;
    event.preventDefault();
    const tab = tabs[destination];
    onChange(tab.id);
    document.getElementById('organization-tab-' + tab.id)?.focus();
  }

  return <div className="organization-tabs" role="tablist" aria-label="Configurações da organização">
    {tabs.map((tab, index) => <button
      key={tab.id}
      type="button"
      role="tab"
      id={'organization-tab-' + tab.id}
      aria-controls={'organization-panel-' + tab.id}
      aria-selected={value === tab.id}
      tabIndex={value === tab.id ? 0 : -1}
      onClick={() => onChange(tab.id)}
      onKeyDown={event => navigate(event, index)}
    >{tab.label}</button>)}
  </div>;
}
