# Escala

MVP de planejamento de escalas para equipes de campo, suporte e atendimento. Next.js App Router, React, TypeScript, Tailwind CSS e ícones Lucide. Interface em português, responsiva, sem fontes ou serviços externos obrigatórios.

## Executar

Requer Node.js 22 ou 24 e npm. Use o checkout existente em `/workspace/escala`; tarefas de nuvem já são isoladas e não precisam de worktree.

```bash
cd /workspace/escala
npm ci
npm run dev
```

O servidor usa a porta 3000. Dados fictícios são criados na primeira abertura, com datas relativas à semana atual em Brasília. A pedido do usuário, há acesso público temporário até 08/11/2026 às 15:40:22 (Brasília), sem precisar configurar credenciais. O prazo é fixo no servidor. Depois dele, o login volta a ser obrigatório. Para antecipar a proteção e configurar o administrador localmente, execute `npm run auth:setup`; o comando cria `.env.local`, ignorado pelo Git, e ativa `ESCALA_REQUIRE_LOGIN=true`. Com a proteção ativa e sem credenciais válidas, painel/API permanecem bloqueados.

```bash
npm test
npm run typecheck
npm run build
npm run test:e2e
npm start
```

## O que funciona

- Escala semanal e mês civil completo (28, 29, 30 ou 31 dias), navegação entre períodos e filtro de equipe.
- Cadastro de colaboradores, criação, edição e exclusão de turnos.
- Geração mensal com prévia, regras gerais/individuais, cobertura e preservação dos lançamentos existentes.
- Validação compartilhada entre navegador e `POST /api/validate`; alterações na escala passam pela API antes de persistir.
- Bloqueio de sobreposição, intervalo interjornada, limites diário/semanal, intervalos intrajornada, dias consecutivos, descanso combinado entre turnos conhecidos e revezamento de domingos por colaborador. Aviso próximo ao limite semanal.
- Configuração dos parâmetros e revalidação de todos os turnos ao alterar regras.
- Meta de pessoas escaladas por dia, painel de indicadores, exportação CSV e cópia para a próxima semana vazia.
- Solicitação e aprovação/recusa de trocas com validação do planejamento resultante.
- Persistência em localStorage, mantida ao recarregar o mesmo navegador.

## Limites do MVP

O planejamento do gestor continua **local ao navegador**, com login de administrador único. O acesso individual opcional dos colaboradores usa publicação de cópias individuais em um banco Supabase compartilhado, conforme a seção de configuração abaixo. Sem essa configuração, nenhum acesso de colaborador é criado. Não use dados pessoais reais em um dispositivo compartilhado. A API de validação não persiste o planejamento; o cliente envia a escala inteira para validar. Apenas a publicação individual usa o banco compartilhado. Quando ativado, o login protege as rotas, mas não criptografa nem remove o localStorage no logout. Os dados locais continuam no dispositivo. A área do colaborador não lê esse localStorage: recebe apenas sua própria jornada pelo servidor. O painel de gestão ainda não tem persistência compartilhada nem múltiplos gestores/empresas.

Os perfis 5x2 e 6x1 limitam a sequência a cinco ou seis períodos de trabalho sem descanso semanal completo, respectivamente. Não são geradores nem prova de cumprimento de todas as folgas do regime, particularmente das duas folgas do 5x2. Os bloqueios usam os parâmetros configurados, sem interpretação automática da legislação ou CCT. A validação só conhece os turnos fornecidos; não certifica DSR em períodos incompletos. O descanso semanal combinado é verificado entre períodos conhecidos ao atingir o máximo de períodos sem descanso completo; histórico incompleto continua sendo uma limitação explícita. Intervalos de refeições são descontados em minutos; não há posição exata da pausa. Horas de turnos que atravessam meia-noite são atribuídas à data de entrada para totais diário e semanal. Um turno noturno conta como um período na sequência, enquanto todos os dias alcançados entram na análise dos domingos. Horários usam o fuso fixo UTC−03:00, adequado a Brasília nas datas atuais, sem histórico de horário de verão.

Não cobre 12x36, cálculo de adicionais/compensações em feriados, banco de horas, adicionais, hora noturna reduzida, horas extras autorizadas, múltiplos vínculos ou integração de ponto. Valores sugeridos devem ser revisados pelo responsável trabalhista conforme categoria e CCT. A cobertura é uma contagem diária de pessoas, sem checagem por faixa horária ou cargo. O modo mensal mostra do primeiro ao último dia do mês civil. WhatsApp e notificações externas não estão conectados.

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

Quando a proteção está ativa ou a janela pública expirou, `/login` é a entrada do sistema e a raiz/API de validação exigem uma sessão válida. Durante a janela pública autorizada, a raiz continua aberta para demonstração; `/login` permanece disponível para autenticar administradores e colaboradores. O usuário configura o próprio e-mail e senha; não existe senha padrão nem cadastro público.

Execute `npm run auth:setup` em terminal interativo. O comando solicita o e-mail, uma senha de 12 a 256 caracteres (sem eco no terminal) e sua confirmação. Gera hash scrypt com salt e um segredo aleatório, preserva outras variáveis de `.env.local` e pede confirmação antes de substituir um acesso existente. A senha original não é salva. Reinicie o servidor após configurar.

As variáveis privadas de servidor são:

- `ESCALA_ADMIN_EMAIL`: e-mail autorizado.
- `ESCALA_ADMIN_PASSWORD_HASH`: hash no formato `scrypt$salt$hash` gerado pelo setup.
- `ESCALA_SESSION_SECRET`: segredo aleatório com pelo menos 32 caracteres.

Para hospedagem, registre esses valores nas configurações privadas do serviço e faça novo deploy. Em arquivos `.env`, o Next.js expande `$`; o setup já grava os sinais como `\$`. No painel da hospedagem use o hash original com `$`, sem barras de escape ou aspas. Nunca use prefixo `NEXT_PUBLIC_`, versione `.env.local` ou envie credenciais pelo chat.

Sessão assinada de oito horas em cookie HttpOnly, SameSite=Lax e Secure em domínios públicos; HTTP é permitido apenas em loopback para desenvolvimento/testes. Login e logout verificam a origem da requisição. Há limite de 20 tentativas por conta a cada 15 minutos por instância do servidor, com quantidade de contas em memória limitada. Para colaboradores há também uma limitação por conta compartilhada e atômica no PostgreSQL. O limite adicional do administrador ainda é local por instância.

O logout remove o cookie deste navegador. Sessões são sem estado: uma cópia de um token permanece válida até expirar ou até trocar a senha/e-mail/segredo. A troca de qualquer configuração invalida as sessões anteriores. Para colaboradores, cada requisição autenticada também verifica o cadastro no banco: desativação, troca de e-mail ou de senha invalidam sessões anteriores. Não há recuperação por e-mail ou MFA; para a operação multiempresa, a evolução indicada continua sendo Supabase Auth e persistência com RLS.

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

A pedido do usuário, o painel e a API de validação ficam acessíveis sem login até **08/11/2026 às 15:40:22, horário de Brasília** (`2026-11-08T18:40:22.000Z`). A janela original de 04/11/2026 foi renovada a pedido do usuário em 06/11/2026 às 15:40:22 (Brasília), por mais 48 horas. O novo prazo é fixo e não é renovado por novos deploys ou acessos.

O prazo fixo em `lib/access.ts` é conferido no proxy, na página principal e na API. Ao vencer, todas essas rotas voltam a exigir autenticação, mesmo que `ESCALA_REQUIRE_LOGIN=false` permaneça configurado. Valores desconhecidos do sinalizador também exigem login. Não existe um sinalizador que prolongue essa janela indefinidamente.

Para fechar o acesso **antes** do prazo, configure `ESCALA_REQUIRE_LOGIN=true` no servidor, com as credenciais privadas do administrador, e faça novo deploy. `npm run auth:setup` também ativa esse sinalizador no ambiente local. A ausência do sinalizador mantém a janela autorizada, mas não ignora seu vencimento.

A interface indica acesso temporário e o prazo, identifica o visitante e oculta a opção de sair de uma sessão que não existe. A validação das regras de jornada continua obrigatória. O armazenamento permanece local a cada navegador; não foi conectado um banco compartilhado nem foram criadas credenciais padrão.

Os testes de navegador usam três servidores isolados: 3105 com login configurado, 3106 com proteção ativa sem credenciais e 3107 com abertura temporária. O teste público de navegador só executa enquanto a janela real está vigente; a expiração no instante exato e a impossibilidade de prolongar pelo sinalizador são verificadas nos testes de proxy/API com relógio controlado.

## PDF mensal e folgas confirmadas

Em **Escalas → PDF mensal**, selecione o mês, a equipe e, se quiser, um colaborador. **Baixar PDF mensal** gera o arquivo no navegador, usando os dados salvos nesse navegador. O quadro de todos os dias é A3 paisagem; a opção de listagem diária acrescenta páginas A4 paisagem com nomes, turnos, folgas e pendências. Desmarque a listagem diária para gerar somente o quadro mensal. Não é necessária uma conta em serviço de PDF ou uma janela de impressão.

O relatório usa **horários** para presença prevista, **F** para folga confirmada e **?** para dia sem planejamento. Não conclui que alguém está disponível para convocação só porque não há turno. Mostra continuação dos turnos noturnos, inclusive quando o turno começou no mês anterior; término exatamente à meia-noite não ocupa o dia seguinte. Conflitos importados entre turno e folga são sinalizados, não ocultados.

Para confirmar uma folga, clique em um dia sem turno e use **Marcar folga nesta data**. Para desfazer, use **Remover folga confirmada**. Salvar um novo turno substitui a folga da data selecionada; a API continua bloqueando conflito com uma folga do dia seguinte em turnos noturnos. A cópia semanal inclui folgas e não sobrescreve uma semana que já tenha planejamento.

Dados antigos sem registros de folga continuam válidos, mas os vazios passam a ser identificados como **sem planejamento**. Não há migração que invente folgas. A equipe fictícia de primeira abertura já contém folgas explícitas apenas na semana de demonstração. A ausência de trabalho em outras semanas não cria folgas automaticamente.

A exportação não calcula horas de disponibilidade extra, banco de horas ou remuneração e não certifica conformidade com a CLT. O PDF registra a data de emissão em Brasília e o período/filtro escolhido. Fontes Figtree são incorporadas e carregadas localmente de `public/fonts`, sem Google Fonts. Os arquivos TTF são conversões sem alteração de desenho das fontes Latin 400 e 600 do pacote `@fontsource/figtree` 5.3.0; a licença OFL está em `public/fonts/OFL.txt`. Esses arquivos já estão no repositório, portanto não há etapa de conversão no build.

## Cadastro de feriados

Acesse **Workspace → Feriados → Novo feriado**. Informe nome, data e abrangência:

- **Nacional:** aplica-se a toda a operação.
- **Estadual:** exige uma UF e se aplica quando ela coincide com a UF do workspace.
- **Municipal:** exige UF e município; ambos precisam coincidir com a localidade do workspace.

A página permite editar, excluir, buscar e filtrar por ano e abrangência. É possível registrar referência legal e observações. A opção anual repete o mesmo dia e mês nos anos consultados; datas móveis devem ser cadastradas por ano. Um feriado anual de 29/02 aparece somente em anos bissextos. Não são inferidas vigências legais nem importados calendários externos.

Em **Localidade do workspace**, selecione a UF e, se necessário, o município. Sem localidade, a escala e o PDF consideram somente nacionais; com UF sem município, incluem também estaduais. A lista de cadastros continua mostrando outras localidades, identificadas como fora da localidade atual. Comparações de município ignoram maiúsculas, acentos e espaços duplicados, mas exigem o nome completo; não há consulta de códigos IBGE.

Datas aplicáveis recebem um marcador na escala e um asterisco no PDF mensal. O PDF inclui uma listagem dos feriados considerados, com abrangência, localidade e referência. A sinalização não cria folga, não bloqueia turnos automaticamente e não calcula adicionais ou compensações. Essas decisões dependem do enquadramento e da norma aplicável.

O cadastro e a localidade são salvos no mesmo localStorage do workspace, sem conexão a um banco compartilhado. Dados antigos sem `holidays` ou `workspaceLocation` continuam compatíveis. O armazenamento e a autenticação mantêm os limites já descritos neste README.


## Acesso individual do colaborador (integração opcional)

Na seção **Colaboradores**, o botão **Acesso** abre o cadastro de e-mail, senha e permissão de consulta. A conta do administrador é obrigatória para criar, publicar ou desativar acessos, inclusive durante a demonstração pública. A instalação ainda precisa de um projeto Supabase: as variáveis não estão configuradas neste repositório e nenhum banco de produção foi criado ou alterado por esta entrega.

### Ativar na Vercel

1. Crie um projeto no [Supabase](https://supabase.com/dashboard). No SQL Editor, revise e execute [supabase/employee-access.sql](supabase/employee-access.sql) **uma vez**. Este SQL é independente da proposta `supabase/schema.sql`; não precisa aplicar a proposta para ativar esta funcionalidade.
2. Em **Vercel → Project → Settings → Environment Variables**, configure, no ambiente utilizado:

   | Variável privada | Valor |
   | --- | --- |
   | `SUPABASE_URL` | URL HTTPS do projeto, como `https://SEU-PROJETO.supabase.co` |
   | `SUPABASE_SERVICE_ROLE_KEY` | Chave **service_role** do projeto, disponível nas configurações de API do Supabase |
   | `ESCALA_WORKSPACE_ID` | Identificador estável desta instalação, como `escala-minha-empresa-prod` (letras, números, hífen ou sublinhado; até 100 caracteres) |
   | `ESCALA_SESSION_SECRET` | Segredo aleatório de pelo menos 32 caracteres, já usado no login do administrador |
   | `ESCALA_ADMIN_EMAIL` | E-mail real do gestor, diferente dos e-mails dos colaboradores |
   | `ESCALA_ADMIN_PASSWORD` | Senha privada do gestor, de 12 a 256 caracteres; alternativamente use `ESCALA_ADMIN_PASSWORD_HASH`, conforme a seção de login |
   | `ESCALA_REQUIRE_LOGIN` | `true`, para encerrar a demonstração aberta antes de compartilhar o sistema com pessoas reais |

3. Faça um novo deploy para carregar as variáveis. Abra `/login` e entre com a conta do gestor. A área **Colaboradores → Acesso** mostra uma mensagem de configuração pendente enquanto o banco não estiver configurado; não inventa uma conta de teste.
4. Abra **Acesso** no cartão do colaborador, defina e-mail e senha de pelo menos 12 caracteres e clique em **Salvar acesso e publicar jornada**. Compartilhe diretamente com a pessoa o endereço `https://SEU-SITE/login`, o e-mail e a senha. O sistema não envia e-mails ou WhatsApp.
5. O colaborador entra pela mesma tela de login e é direcionado a `/colaborador`, onde consulta apenas seus dias, horários, intervalos, folgas confirmadas e feriados aplicáveis. Pode navegar pelos meses e atualizar a consulta. Dias sem planejamento continuam distintos de folga.

Nunca use prefixo `NEXT_PUBLIC_` nestas variáveis nem versione as chaves. Use projetos ou identificadores de workspace diferentes para produção e preview/testes; não altere o identificador em produção depois de criar as contas. O projeto Supabase deve permitir o acesso HTTPS do servidor Vercel.

### Publicação, alterações e desativação

- O painel do gestor continua salvando o planejamento neste navegador. **Editar um turno não atualiza automaticamente a consulta do colaborador.** Depois das alterações, volte a **Colaboradores → Acesso → Salvar acesso e publicar jornada**. A publicação substitui a cópia individual completa, incluindo a retirada de turnos ou folgas removidos. O portal informa a data da última publicação.
- Deixe a nova senha em branco para manter a atual. Informe outra senha para redefinir e invalidar sessões anteriores. Não há recuperação automática de senha por e-mail.
- Desmarque **Permitir acesso à jornada** e salve para desativar o acesso e invalidar as sessões. Reativar exige nova entrada. A publicação sem mudança de credenciais mantém as sessões ativas.
- Nenhuma senha fica no localStorage nem volta nas respostas. O banco guarda apenas hash scrypt com sal aleatório. Os tokens do colaborador são assinados, duram oito horas, usam cookie HttpOnly e não são aceitos como sessão de administrador. A identidade vem do token; IDs enviados na URL não selecionam outro colaborador.
- O servidor retorna uma lista explícita de campos da própria pessoa, turnos e folgas, filtrada pelo mês solicitado (incluindo continuação noturna do mês anterior). Não envia a equipe, regras internas, trocas, credenciais ou jornadas de colegas. A API da jornada é somente leitura; APIs de gestão exigem sessão do gestor e proteção de origem para escrita.
- As tabelas e RPCs desta integração têm acesso negado aos papéis `anon` e `authenticated`. RLS fica habilitada sem políticas de acesso direto; somente o servidor usa `service_role`, sempre limitado ao `ESCALA_WORKSPACE_ID`. Não reutilize esta chave em aplicações cliente. A tabela de tentativas usa chaves derivadas do e-mail e janela atômica de 15 minutos.
- A autenticação não apaga o planejamento previamente salvo no navegador por um gestor. Use perfis de navegador separados em dispositivos compartilhados. Esta integração atende uma instalação/gestor, sem transformar o restante do MVP em um SaaS multiempresa.

### Verificação da integração

`npm test` inclui testes reais do SQL em PostgreSQL embarcado (PGlite), permissões, publicação, isolamento por identidade, hash, revogação, limite compartilhado e falhas de configuração. `npm run build && npm run test:e2e` inclui um quarto servidor isolado na porta 3108, cujo transporte REST Supabase é substituído **somente no processo de teste** por esse banco em memória. Os testes verificam o fluxo do gestor e do colaborador em contextos de navegador separados. Não usam chaves ou banco de produção e não substituem a conferência final após configurar o projeto Supabase real.

## Gerador automático de escala mensal

Em **Escalas → Gerar escala**, escolha o mês, o horário de entrada, a meta diária, os dias de operação e as pessoas participantes. Os valores iniciais vêm da meta de cobertura da empresa e dos perfis atuais. A lista mostra os limites efetivos de cada colaborador, incluindo os ajustes individuais.

- **Distribuir jornadas da equipe** busca cobrir a demanda e distribuir os demais turnos conforme preferências alternadas de trabalho/descanso dos regimes 5x2 e 6x1. **Preencher cobertura mínima** acrescenta somente as pessoas necessárias para a meta diária, considerando os turnos já existentes da seleção. Cobertura significa pessoas com algum trabalho no dia, sem dimensionamento por faixa horária ou cargo.
- A duração remunerada sugerida é o menor valor entre o limite diário e o limite semanal dividido por cinco ou seis dias, arredondado para baixo em minutos. Por exemplo: 8h/dia e 44h/semana em 5x2 geram turnos de 8h; 6h/dia e 30h/semana geram turnos de 6h; 6x1 com limite semanal de 44h gera turnos de 7h20. O intervalo é somado à presença: acima de 6h usa o intervalo do perfil; entre 4h e 6h, 15 minutos; até 4h, sem intervalo obrigatório neste modelo.
- As configurações de acordo/CCT, limite semanal, intervalo interjornada, descanso semanal combinado, sequência máxima e revezamento de domingos são conferidas pelo mesmo motor usado nas alterações manuais. A geração também limita a cinco ou seis **datas com trabalho por janela móvel de sete dias**, como restrição adicional conservadora do regime. Os limites são máximos: não garante preencher a carga contratual integral.
- **Nenhum turno ou folga já cadastrado é removido ou substituído**, inclusive em feriados ou dias de operação desmarcados. Colaboradores fora da seleção, solicitações de troca e outros meses são preservados. Dias sem trabalho da seleção recebem propostas explícitas de folga; continuações de turno noturno não recebem folga conflitante.
- A opção de feriados vem marcada. Ela impede novos turnos nos feriados cadastrados aplicáveis à UF/município do workspace, sem interpretar automaticamente a legislação/CCT nem alterar turnos já lançados. Desmarque se a operação precisar funcionar nessas datas e revise a autorização e os adicionais aplicáveis fora deste MVP.
- O algoritmo consulta até 35 dias antes/depois do mês para testar candidatos, abrangendo semanas parciais, turnos noturnos existentes e revezamento de domingos na virada. A verificação inicial e final usa **todos os lançamentos cadastrados**; conflitos existentes bloqueiam a geração. Histórico não cadastrado não pode ser considerado.

Clique em **Gerar prévia** para consultar novos turnos/folgas, totais por pessoa, cobertura de cada data e alertas do validador. A geração ocorre em um Web Worker local e não grava dados enquanto você revisa. Modificar qualquer parâmetro invalida a prévia anterior. É possível cancelar a execução ou descartar o resultado.

Se faltar cobertura, a prévia mostra quantas alocações de pessoa/dia faltam e as restrições encontradas. **Aplicar escala do mês** só fica disponível após reconhecer explicitamente que está aplicando uma sugestão parcial. Regras de jornada não são flexibilizadas para cobrir a demanda. A busca reserva primeiro a cobertura de todo o mês e só depois acrescenta turnos, preservando as reservas futuras. É heurística, determinística e limitada a tentativas alternadas; um déficit não prova inviabilidade matemática nem representa uma solução ótima.

Ao aplicar, o painel verifica se os dados mudaram desde a geração e envia o planejamento completo para `POST /api/validate`. Só grava se o servidor aceitar, e abre o mês gerado na escala. A persistência continua local ao navegador. Para compartilhar o resultado no portal individual, use depois **Colaboradores → Acesso → Salvar acesso e publicar jornada**; não há publicação automática.

Nesta versão o gerador atende workspaces com até 100 colaboradores e 10.000 turnos/folgas, somente os regimes 5x2/6x1 do cadastro. Novos turnos usam uma entrada comum e devem terminar no mesmo dia ou exatamente à meia-noite; entradas que excedam esse limite são recusadas. Turnos noturnos existentes são preservados e avaliados, com as limitações de hora noturna e atribuição semanal já descritas. Não substitui a revisão operacional/trabalhista nem certifica conformidade integral com a CLT/CCT.

`tests/schedule-generator.test.ts` cobre perfis gerais e individuais, intervalos, folgas, domingos, histórico anterior/posterior, preservação, dias de operação, feriados, cobertura parcial, anos bissextos, IDs e conclusão idempotente. `tests/browser/generator.spec.ts` verifica prévia sem alteração de dados, uso dos limites individuais, aceite de cobertura parcial, invalidação após edição, descarte, rejeição pelo servidor, persistência e layout móvel.

## Horário habitual por colaborador

Em **Colaboradores → Editar jornada → Horário habitual de trabalho**, marque **Usar horário de trabalho individual**. Esse cadastro é independente da opção de limites individuais: é possível manter os limites da empresa e definir uma entrada própria.

- **Somente entrada:** informe, por exemplo, `11:30`. O gerador e os novos turnos dessa pessoa manterão essa entrada e calcularão saída e intervalo pelos seus limites efetivos. Com 6h/dia e 30h/semana em 5x2, o resultado é `11:30–17:45`, com 15 minutos de intervalo.
- **Entrada, saída e intervalo fixos:** marque **Definir saída e intervalo fixos**, como `09:00–18:00` com 60 minutos de intervalo. A geração mantém os três valores, sem encurtar o turno para completar mais dias. Os limites semanais, descansos e domingos continuam sendo conferidos. Um horário fixo de 8h em 6x1 pode deixar o sexto dia sem turno se ele exceder 44h semanais; a prévia mostrará as pendências.
- O horário aparece no cartão do colaborador e na prévia da geração. A **Entrada dos turnos** escolhida no gerador vale apenas para pessoas sem horário individual. No cadastro manual de um novo turno, trocar o colaborador carrega o padrão da pessoa selecionada; os horários podem ser ajustados para aquela data.
- O padrão não remarca turnos existentes nem exige que todo turno manual coincida com ele. Editar um turno existente mantém os horários efetivamente lançados. Desmarcar a opção remove a preferência e mantém os demais dados. Cadastros antigos, sem `workSchedule`, continuam compatíveis.
- Horários inválidos, duração acima do limite individual e intervalo insuficiente são recusados no validador do navegador e da API, mesmo que ainda não exista nenhum turno. O horário habitual também é verificado ao alterar regras gerais ou individuais. A configuração não afasta a revisão do instrumento aplicável.
- É possível cadastrar horário noturno que termina no dia seguinte para preencher turnos manuais. O gerador mensal continua limitado a novos turnos que terminam no mesmo dia ou exatamente à meia-noite; não altera silenciosamente uma preferência noturna e informa quando ela ainda não é suportada na geração.

A preferência fica nos dados locais do gestor. O portal do colaborador e o PDF continuam mostrando os **horários reais dos turnos planejados**, sem substituí-los pelo padrão. Para disponibilizar uma escala alterada ao colaborador, publique novamente a jornada no fluxo de acesso já descrito. Não é necessário executar SQL novo para esta funcionalidade.

## Configuração da empresa, sindicato e revisão trabalhista

A área **Revisão trabalhista** reúne a configuração da atividade, categoria, UF/município, instrumentos CCT/ACT, vínculos individuais e períodos de ausência. O catálogo de sindicatos é formado pelos instrumentos cadastrados pela própria empresa; não é um catálogo oficial nem determina o enquadramento a partir do CNPJ/cargo.

1. Cadastre a atividade, categoria e localidade em **Configuração da empresa**.
2. Use **Cadastrar instrumento** para informar sindicato/entidades signatárias, referência/registro, categoria, território e vigência reais da CCT/ACT. Cadastre cada versão como um instrumento separado. A URL da fonte deve usar HTTPS, sem credenciais.
3. Transcreva os limites suportados e registre as cláusulas que os fundamentam. Informe a identificação do responsável e a data da conferência quando ela efetivamente tiver ocorrido. Preencher esses campos é uma declaração do administrador; o sistema não leu o documento nem certifica sua validade.
4. Escolha **Sindicato e instrumento padrão** na empresa. Para categorias diferenciadas, use **Revisar** no enquadramento do colaborador para indicar outro instrumento e categoria. Confirme o perfil geral ou marque a necessidade de tratamento especial. Defina a frequência e registre o fundamento do revezamento de domingos (o mesmo parâmetro disponível em Editar jornada); regras por sexo, idade ou categoria não são deduzidas automaticamente.
5. Consulte **Revisão do mês**. A matriz distingue regras verificadas, bloqueios encontrados e conferências pendentes. A exportação JSON registra uma fotografia técnica do planejamento, sem afirmar aprovação jurídica ou auditoria imutável.

Os limites coletivos parametrizados **tornam o perfil mais restritivo**, respeitando os limites gerais e individuais já existentes. Não habilitam exceções para ampliar jornada ou reduzir descansos automaticamente. O validador local, a API e o gerador verificam duração diária/semanal, interjornada, intervalo, sequência/descanso e domingos informados no instrumento. Os lançamentos dentro da vigência são avaliados com as restrições coletivas; a revisão informa vigência insuficiente e divergência de categoria/território. Não há interpretação automática de ultratividade, substituição de instrumentos, conflitos CCT/ACT, categorias diferenciadas ou regras não representadas no modelo. Cadastro ou alteração de parâmetros que conflite com turnos já lançados é recusado: ajuste o planejamento antes de ativar a restrição.

A regra **Trabalho em feriados → Vedado neste perfil** bloqueia trabalho nos feriados cadastrados aplicáveis à localidade, inclusive continuação noturna. Informar autorização exige referência de cláusula e **não** calcula remuneração ou compensação. A completude do calendário manual e a autorização legal/setorial permanecem pendentes de conferência.

### Férias, afastamentos e licenças

**Cadastrar ausência** registra apenas colaborador, tipo, início e fim inclusivos. Não informe diagnósticos, documentos médicos ou detalhes de saúde. São recusados períodos inválidos, sobrepostos ou de pessoas inexistentes. O período impede turnos manuais, aprovação de troca e novos turnos do gerador, incluindo trabalho que comece no dia anterior e avance sobre a ausência. Remova ou reagende turnos conflitantes antes de cadastrar o período.

O gerador preserva a ausência e não a transforma em folga. A escala mostra Férias/Afastamento/Licença; o PDF usa **A**, separada de **F** e **?**, e a listagem diária identifica o tipo. Na publicação individual, somente as ausências da própria pessoa são incluídas no snapshot; metadados de sindicato, condições individuais e documentos não são enviados ao colaborador. Snapshots antigos sem ausências continuam compatíveis e precisam ser republicados para refletir novos períodos.

Esse bloqueio não verifica aquisição/fracionamento de férias, início em relação a feriados/DSR ou todas as hipóteses de afastamento/licença. Não converta o registro em prova de concessão regular sem conferência.

### Limites da revisão e ativação

Não há selo de conformidade integral nem aprovação automática. A revisão mantém pendentes o enquadramento incompleto, instrumentos não conferidos, calendário manual, histórico sem classificação, posição da pausa, regras noturnas, divisão de horas entre semanas, compensações, regimes/condições especiais e demais cláusulas não implementadas quando aplicáveis. O gerador impede automação para pessoas marcadas como condição especial até que exista um perfil apropriado. O painel diferencia a ausência de conflitos de jornada da revisão trabalhista do mês.

Enquanto o planejamento permanecer local, a API valida o contexto enviado pelo gestor; a configuração normativa ainda não é uma fonte persistida e imutável no servidor. As configurações permanecem no localStorage; não foi criado banco de produção nem se concluiu a migração multiempresa. Campos opcionais `labor`/`absences` e o vínculo individual preservam dados antigos da versão 1. A API valida esses campos e aceita `reviewMonth` para devolver a avaliação mensal calculada no servidor com os mesmos dados. A consulta ao texto consolidado oficial em 06/11/2026 foi recusada pelo proxy HTTP 403; as referências normativas continuam sujeitas à confirmação nas fontes oficiais e no instrumento efetivo. Veja também `docs/auditoria-clt.md`.
