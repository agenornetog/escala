# Organização Implementation Plan

> For agentic workers: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reunir as configurações da empresa na página Organização com as cinco abas aprovadas.
**Architecture:** Dashboard controla a aba ativa e reaproveita o formulário de regras. LaborReview recebe a seção selecionada e mantém seus formulários montados para preservar edições durante a navegação. Sidebar apresenta uma opção Organização.
**Tech Stack:** Next.js 16, React 19, TypeScript e CSS existentes.
**Spec:** docs/superpowers/specs/2026-11-14-organizacao-design.md

## Global Constraints

- Cinco abas com os nomes aprovados, iniciando em Empresa e equipes.
- Manter validação e persistência atuais.
- Publicar no GitHub após verificar.

## Review Focus

- Troca de aba preserva campos ainda em edição.
- Atalhos de regras e revisão selecionam a aba correta.
- Teclado permite percorrer as abas.
- Tela de 390px permite acessar todas as abas sem ampliar a página.
- Salvamento de regras e configuração continua validando o planejamento.

## Task 1 — Navegação e seções

**Files:** components/sidebar.tsx, components/dashboard.tsx, components/labor-review.tsx, components/organization-tabs.tsx, app/globals.css, tests/browser/organization.spec.ts, tests/browser/labor.spec.ts, tests/browser/workflows.spec.ts.

- [x] Criar e executar teste de navegação Organização, abas e atalhos, esperando falha antes da implementação.
- [x] Unificar menu e título, implementar abas acessíveis e distribuir formulários pelas seções.
- [x] Atualizar testes existentes para navegar pelas novas abas.
- [x] Executar npm test, npm run typecheck, npm run build e testes de navegador afetados.
- [x] Revisar diff e publicar um commit com todos os arquivos relacionados.

Verificação realizada: 109 testes de unidade/integração e 18 testes de navegador passaram. TypeScript e build passaram. Revisão independente concluída, com ajuste da orientação para o cadastro de instrumentos.


Conferência final após os ajustes de texto e disposição: build aprovado e 2 testes específicos de Organização aprovados.
