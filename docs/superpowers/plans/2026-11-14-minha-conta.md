# Minha conta Implementation Plan

> For agentic workers: Use superpowers:executing-plans to implement task-by-task.

**Goal:** Identificação real e edição do próprio perfil com nome, foto e senha.
**Architecture:** Auth fornece a identidade e os metadados de apresentação. APIs autenticadas do Next usam o token do usuário para editar o próprio Auth e acessar um bucket privado. AccountMenu integra o modal ao Sidebar e ao painel de empresas.
**Tech Stack:** Next.js 16, React 19, TypeScript, Supabase Auth/Storage, Playwright e node:test.
**Spec:** docs/superpowers/specs/2026-11-14-minha-conta-design.md

## Global Constraints

- Somente a própria conta pode ser editada.
- Função e permissões vêm dos vínculos atuais.
- Fotos JPEG/PNG/WebP até 2 MB, com remoção e troca.
- Senha atual obrigatória e confirmação da nova senha.
- Reutilizar as sessões e o modal atuais, com suporte a teclado e celular.

## Review Focus

- Sessões ausentes, expiradas e origens externas falham com segurança.
- Fotos de outra pessoa e tipos de arquivo inválidos são recusados.
- Falha ao salvar metadados conserva a foto anterior.
- Senha atual errada impede atualização da senha.
- Contas existentes sem nome/foto e acessos locais continuam utilizáveis.

## Task 1 — APIs e Storage

**Files:** lib/account.ts, lib/manager-auth.ts, app/api/account/**, proxy.ts, supabase/migrations/*_escala_account_avatars.sql, tests/account.test.ts.
- [x] Criar e executar testes de identidade, nome, foto e senha antes da implementação.
- [x] Implementar APIs do próprio usuário, validação de imagem e políticas de Storage privado.
- [x] Testar isolamento e permissões, aplicar a migração no projeto Escalô e verificar advisors.

## Task 2 — Minha conta

**Files:** components/account-menu.tsx, components/sidebar.tsx, components/employee-password.tsx, app/gestao/page.tsx, app/globals.css, tests/browser/account.spec.ts.
- [x] Implementar identificação, modal de perfil e fotos, e troca de senha com feedback.
- [x] Verificar nome/foto persistidos, remoção, senha e navegação desktop/mobile.
- [x] Executar npm test, TypeScript, build e testes de navegador afetados.
- [x] Fazer revisão independente, corrigir achados e publicar a alteração no GitHub.

Verificação: 119 testes de unidade/integração aprovados, build e TypeScript aprovados. Revisão independente concluída com correção da função por empresa e recuperação do carregamento. Migração 20261114183930 aplicada no MCP Escalô; bucket privado e quatro políticas por usuário verificados.

Testes de navegador finais: 22 aprovados, incluindo nome/foto persistidos, remoção, senha, recuperação de erro, login, portal do colaborador e navegação móvel.
