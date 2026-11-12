import type { Store } from '@/lib/types';

export const DEFAULT_TEAMS = ['Campo', 'Suporte', 'Atendimento'] as const;
export const ALL_TEAMS = 'Todas as equipes';
export const TEAM_NAME_LIMIT = 60;
const MAX_TEAMS = 200;
const key = (name: string) => name.toLocaleLowerCase('pt-BR');

export function planningTeams(store: Pick<Store, 'teams'>) {
  return [...new Set([...DEFAULT_TEAMS, ...(store.teams ?? [])])];
}

export function teamStyle(team: string) {
  return DEFAULT_TEAMS.find(name => name === team)?.toLowerCase() ?? '';
}

export function normalizeTeamName(value: unknown) {
  if (typeof value !== 'string' || /[\p{Cc}\p{Cf}]/u.test(value)) throw new Error('Informe um nome válido para a equipe.');
  const name = value.normalize('NFC').trim().replace(/\s+/gu, ' ');
  if (!name || name.length > TEAM_NAME_LIMIT || key(name) === key(ALL_TEAMS)) {
    throw new Error('Informe um nome de equipe válido de até 60 caracteres.');
  }
  return name;
}

export function parseTeams(value: unknown) {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length > MAX_TEAMS) throw new Error('Limite de equipes atingido.');
  const teams = value.map(normalizeTeamName);
  const names = planningTeams({teams});
  if (names.length > MAX_TEAMS || new Set(teams).size !== teams.length || new Set(names.map(key)).size !== names.length) {
    throw new Error('Já existe uma equipe com esse nome ou o limite de equipes foi atingido.');
  }
  return names;
}
