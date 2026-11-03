# Escala

MVP de planejamento de escalas para equipes de campo, suporte e atendimento. Next.js App Router, React, TypeScript, Tailwind CSS e ícones Lucide. Interface em português, responsiva, sem fontes ou serviços externos obrigatórios.

## Executar

Requer Node.js 22 ou 24 e npm. Use o checkout existente em `/workspace/escala`; tarefas de nuvem já são isoladas e não precisam de worktree.

```bash
cd /workspace/escala
npm ci
npm run dev
```

O servidor usa a porta 3000. Dados fictícios são criados na primeira abertura, com datas relativas à semana atual em Brasília. Não é necessário `.env`.

```bash
npm test
npm run typecheck
npm run build
npm run test:e2e
npm start
```

## O que funciona

- Escala semanal e visualização de 28 dias, navegação entre períodos e filtro de equipe.
- Cadastro de colaboradores, criação, edição e exclusão de turnos.
- Validação compartilhada entre navegador e `POST /api/validate`; alterações na escala passam pela API antes de persistir.
- Bloqueio de sobreposição, intervalo interjornada, limites diário/semanal, intervalos intrajornada, dias consecutivos, descanso combinado entre turnos conhecidos e revezamento de domingos por colaborador. Aviso próximo ao limite semanal.
- Configuração dos parâmetros e revalidação de todos os turnos ao alterar regras.
- Meta de pessoas escaladas por dia, painel de indicadores, exportação CSV e cópia para a próxima semana vazia.
- Solicitação e aprovação/recusa de trocas com validação do planejamento resultante.
- Persistência em localStorage, mantida ao recarregar o mesmo navegador.

## Limites do MVP

O armazenamento é **local ao navegador**, sem autenticação, compartilhamento ou banco conectado. Não use dados pessoais reais em um dispositivo compartilhado. A API é um validador sem persistência; o cliente envia o planejamento inteiro. Não constitui uma barreira de segurança para um produto multiusuário.

O perfil 5x2/6x1 é uma identificação, não um gerador de escalas nem uma prova de cumprimento de todas as folgas desse regime. Os bloqueios usam os parâmetros configurados, sem interpretação automática da legislação ou CCT. A validação só conhece os turnos fornecidos; não certifica DSR em períodos incompletos. O descanso semanal combinado é verificado em folgas civis completas delimitadas por turnos conhecidos. Intervalos de refeições são descontados em minutos; não há posição exata da pausa. Horas de turnos que atravessam meia-noite são atribuídas à data de entrada para totais diário e semanal. Os dias alcançados pelo turno contam para a sequência de dias trabalhados. Horários usam o fuso fixo UTC−03:00, adequado a Brasília nas datas atuais, sem histórico de horário de verão.

Não cobre 12x36, feriados, banco de horas, adicionais, hora noturna reduzida, horas extras autorizadas, múltiplos vínculos ou integração de ponto. Valores sugeridos devem ser revisados pelo responsável trabalhista conforme categoria e CCT. A cobertura é uma contagem diária de pessoas, sem checagem por faixa horária ou cargo. O modo de 28 dias é uma janela iniciada na semana selecionada, não um mês civil. WhatsApp e notificações externas não estão conectados.

## Evolução para Supabase

`supabase/schema.sql` contém uma **proposta de esquema** multiempresa, memberships, regras, colaboradores, turnos e trocas, com RLS e chaves estrangeiras compostas para impedir referências entre empresas. Não foi aplicada nem validada em um projeto Supabase nesta entrega. Não há biblioteca cliente ou credenciais configuradas.

Antes de conectar produção:

1. Criar um projeto Supabase e revisar/aplicar o SQL em banco novo.
2. Conectar Supabase Auth, provisionar a empresa e o primeiro administrador por um processo confiável.
3. Implementar uma camada autenticada de persistência e uma RPC transacional para alterações de escala/trocas, com bloqueio por colaborador e revalidação no banco. O esquema mantém escrita direta de turnos e trocas desabilitada até essa implementação.
4. Implementar testes de isolamento, permissões, concorrência e histórico de auditoria. Provisionar credenciais em variáveis seguras; nunca expor service-role no frontend.
5. Integrar notificações externas apenas após aprovação de uma transação e com registro de entrega.

## Estrutura

- `components/dashboard.tsx`: interface e fluxos locais.
- `lib/validation.ts`: motor de regras; `tests/validation.test.ts`: casos de limite e contrato da API.
- `app/api/validate/route.ts`: validação do payload e das regras no servidor.
- `lib/seed.ts`: equipe fictícia e escala inicial sem conflitos bloqueantes.
- `supabase/schema.sql`: base futura de persistência, ainda não conectada.

Os testes de navegador usam Chromium em `/usr/bin/chromium` quando disponível. Em outra máquina, instale o navegador com `npx playwright install chromium` ou defina `PLAYWRIGHT_CHROMIUM_PATH`. O Playwright inicia a versão de produção automaticamente; execute o build antes. O servidor precisa poder abrir uma porta local. Neste executor, comandos de rede/processos podem exigir execução com permissão ampliada.

## Design

A interface segue a referência visual Pastel enviada pelo usuário: fundo Paper Stone, tipografia Figtree local, um acento cobalto, superfícies planas e navegação superior responsiva. Consulte [as decisões de adaptação](docs/design.md) e [a referência original](docs/design-reference.md).
