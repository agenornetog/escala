# Escala

MVP de planejamento de escalas para equipes de campo, suporte e atendimento. Next.js App Router, React, TypeScript, Tailwind CSS e ícones Lucide. Interface em português, responsiva, sem fontes ou serviços externos obrigatórios.

## Executar

Requer Node.js 22 ou 24 e npm. Use o checkout existente em `/workspace/escala`; tarefas de nuvem já são isoladas e não precisam de worktree.

```bash
cd /workspace/escala
npm ci
npm run dev
```

O servidor usa a porta 3000. Dados fictícios são criados na primeira abertura, com datas relativas à semana atual em Brasília. A pedido do usuário, há acesso público temporário até 06/11/2026 às 15:02:47 (Brasília), sem precisar configurar credenciais. O prazo é fixo no servidor. Depois dele, o login volta a ser obrigatório. Para antecipar a proteção e configurar o administrador localmente, execute `npm run auth:setup`; o comando cria `.env.local`, ignorado pelo Git, e ativa `ESCALA_REQUIRE_LOGIN=true`. Com a proteção ativa e sem credenciais válidas, painel/API permanecem bloqueados.

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

O armazenamento é **local ao navegador**, com login de administrador único, sem compartilhamento ou banco conectado. Não use dados pessoais reais em um dispositivo compartilhado. A API é um validador sem persistência; o cliente envia o planejamento inteiro. Quando ativado, o login protege as rotas, mas não criptografa nem remove o localStorage no logout. Os dados locais continuam no dispositivo e não há isolamento entre contas. Não constitui uma solução multiusuário.

Os perfis 5x2 e 6x1 limitam a sequência a cinco ou seis períodos de trabalho sem descanso semanal completo, respectivamente. Não são geradores nem prova de cumprimento de todas as folgas do regime, particularmente das duas folgas do 5x2. Os bloqueios usam os parâmetros configurados, sem interpretação automática da legislação ou CCT. A validação só conhece os turnos fornecidos; não certifica DSR em períodos incompletos. O descanso semanal combinado é verificado entre períodos conhecidos ao atingir o máximo de períodos sem descanso completo; histórico incompleto continua sendo uma limitação explícita. Intervalos de refeições são descontados em minutos; não há posição exata da pausa. Horas de turnos que atravessam meia-noite são atribuídas à data de entrada para totais diário e semanal. Um turno noturno conta como um período na sequência, enquanto todos os dias alcançados entram na análise dos domingos. Horários usam o fuso fixo UTC−03:00, adequado a Brasília nas datas atuais, sem histórico de horário de verão.

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

A interface segue a referência visual Pastel enviada pelo usuário: fundo Paper Stone, tipografia Figtree local, um acento cobalto, superfícies planas e navegação lateral recolhível. Consulte [as decisões de adaptação](docs/design.md) e [a referência original](docs/design-reference.md).

## Login de administrador

Quando a proteção está ativa ou a janela pública expirou, `/login` é a entrada do sistema e a raiz/API de validação exigem uma sessão válida. Durante a janela pública autorizada, `/login` redireciona diretamente ao painel. O usuário configura o próprio e-mail e senha; não existe senha padrão nem cadastro público.

Execute `npm run auth:setup` em terminal interativo. O comando solicita o e-mail, uma senha de 12 a 256 caracteres (sem eco no terminal) e sua confirmação. Gera hash scrypt com salt e um segredo aleatório, preserva outras variáveis de `.env.local` e pede confirmação antes de substituir um acesso existente. A senha original não é salva. Reinicie o servidor após configurar.

As variáveis privadas de servidor são:

- `ESCALA_ADMIN_EMAIL`: e-mail autorizado.
- `ESCALA_ADMIN_PASSWORD_HASH`: hash no formato `scrypt$salt$hash` gerado pelo setup.
- `ESCALA_SESSION_SECRET`: segredo aleatório com pelo menos 32 caracteres.

Para hospedagem, registre esses valores nas configurações privadas do serviço e faça novo deploy. Em arquivos `.env`, o Next.js expande `$`; o setup já grava os sinais como `\$`. No painel da hospedagem use o hash original com `$`, sem barras de escape ou aspas. Nunca use prefixo `NEXT_PUBLIC_`, versione `.env.local` ou envie credenciais pelo chat.

Sessão assinada de oito horas em cookie HttpOnly, SameSite=Lax e Secure em domínios públicos; HTTP é permitido apenas em loopback para desenvolvimento/testes. Login e logout verificam a origem da requisição. Há limite de 20 tentativas por 15 minutos por instância do servidor. A limitação não é distribuída: implantações com múltiplas instâncias devem usar um provedor de autenticação/limiter compartilhado antes de ampliar o acesso.

O logout remove o cookie deste navegador. Sessões são sem estado: uma cópia de um token permanece válida até expirar ou até trocar a senha/e-mail/segredo. A troca de qualquer configuração invalida as sessões anteriores. Não há recuperação por e-mail, MFA, perfis por colaborador ou revogação individual; para a operação multiempresa, a evolução indicada continua sendo Supabase Auth e persistência com RLS.

Os testes usam exclusivamente uma identidade fictícia declarada em `tests/auth-fixture.ts`, injetada apenas no servidor autenticado isolado do Playwright (porta 3105). Um segundo servidor na porta 3106 valida a instalação ainda sem credenciais. Esses valores não são padrões da aplicação e não devem ser usados em produção.

### Liberação rápida na Vercel

Em **Project → Settings → Environment Variables**, no projeto que atende `escala-bice.vercel.app`, defina para o ambiente **Production**:

1. `ESCALA_ADMIN_EMAIL`: o e-mail que você usará para entrar.
2. `ESCALA_ADMIN_PASSWORD`: uma senha privada de 12 a 256 caracteres escolhida por você. É uma alternativa ao hash para facilitar a configuração na hospedagem; não preencha `ESCALA_ADMIN_PASSWORD_HASH` com texto de exemplo. Se já houver um hash, ele tem prioridade.
3. `ESCALA_SESSION_SECRET`: um segredo aleatório com pelo menos 32 caracteres. Pode ser gerado localmente com `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`.

Salve e faça **Redeploy** em **Deployments**. Variáveis novas não alteram um deploy já em execução. O acesso só será validado na hospedagem depois dessa configuração; preencher o formulário, por si só, não cria uma conta. Nunca habilite as credenciais fictícias dos testes em um site público.

Os campos de e-mail e senha permanecem editáveis mesmo sem configuração; o servidor mantém o bloqueio e explica que a instalação ainda precisa ser liberada. A alternativa com senha direta fica exclusivamente no ambiente privado do servidor, sem expor a senha no HTML, no JavaScript do navegador ou no Git.

## Jornada individual e auditoria trabalhista

Em **Colaboradores → Editar jornada**, marque **Usar jornada individual para este colaborador** e defina limites de horas, descansos, dias consecutivos e intervalo. Sem a marcação, valem os padrões gerais. As regras são verificadas na API antes de salvar; reduzir um limite abaixo do planejamento existente mostra conflitos, em vez de aprovar silenciosamente.

Os perfis comuns aceitam até 10h/dia e 44h/semana. Jornada acima de 8h/dia ou redução do intervalo padrão exige referência do acordo aplicável. Essa referência não valida sua legalidade. 12x36, banco de horas, jornada noturna remunerada, feriados e condições especiais ainda precisam de implementação própria.

A revisão técnica e suas fontes pendentes estão em [Auditoria CLT](docs/auditoria-clt.md). A API distingue aprovação pelas regras cadastradas de certificação jurídica (`compliance.certified: false`). Não declare conformidade integral com a CLT com base neste MVP.

## Menu lateral

No computador, use o botão ao lado da marca para recolher ou expandir o menu. Os ícones continuam acessíveis quando recolhido; o nome de cada opção aparece ao passar o mouse e permanece disponível para tecnologias assistivas. A preferência é salva somente neste navegador e não altera os dados da escala. No celular, use o botão de menu para abrir o painel lateral; selecione uma página, toque na área externa ou pressione Esc para fechá-lo.

## Acesso público temporário autorizado

A pedido do usuário, o painel e a API de validação ficam acessíveis sem login até **06/11/2026 às 15:02:47, horário de Brasília** (`2026-11-06T18:02:47.000Z`). A janela foi definida em 04/11/2026, com duração de 48 horas; não é renovada por novos deploys ou acessos.

O prazo fixo em `lib/access.ts` é conferido no proxy, na página principal e na API. Ao vencer, todas essas rotas voltam a exigir autenticação, mesmo que `ESCALA_REQUIRE_LOGIN=false` permaneça configurado. Valores desconhecidos do sinalizador também exigem login. Não existe um sinalizador que prolongue essa janela indefinidamente.

Para fechar o acesso **antes** do prazo, configure `ESCALA_REQUIRE_LOGIN=true` no servidor, com as credenciais privadas do administrador, e faça novo deploy. `npm run auth:setup` também ativa esse sinalizador no ambiente local. A ausência do sinalizador mantém a janela autorizada, mas não ignora seu vencimento.

A interface indica acesso temporário e o prazo, identifica o visitante e oculta a opção de sair de uma sessão que não existe. A validação das regras de jornada continua obrigatória. O armazenamento permanece local a cada navegador; não foi conectado um banco compartilhado nem foram criadas credenciais padrão.

Os testes de navegador usam três servidores isolados: 3105 com login configurado, 3106 com proteção ativa sem credenciais e 3107 com abertura temporária. O teste público de navegador só executa enquanto a janela real está vigente; a expiração no instante exato e a impossibilidade de prolongar pelo sinalizador são verificadas nos testes de proxy/API com relógio controlado.
