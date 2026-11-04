# Revisão técnica das regras de jornada

Data: 03/11/2026. Situação: **não certificado como conforme a toda a CLT**.

Esta revisão separa comportamento do software, parâmetros escolhidos pelo administrador e validação jurídica. Uma escala sem bloqueios significa somente que passou pelas regras implementadas com os dados fornecidos. Não significa conformidade integral, aprovação de CCT ou inexistência de passivo.

## Fontes e limitação da consulta

Documento indicado pelo usuário: [CLT e normas correlatas — Senado](https://www2.senado.leg.br/bdsf/bitstream/handle/id/535468/clt_e_normas_correlatas_1ed.pdf).

Fonte para conferir a redação consolidada: [Decreto-Lei nº 5.452/1943 — Presidência da República](https://www.planalto.gov.br/ccivil_03/decreto-lei/del5452.htm).

A rede do ambiente recusou a consulta ao PDF com erro de proxy HTTP 403. O PDF não foi lido nesta revisão, e sua data de atualização não foi confirmada. A redação consolidada vigente também não foi consultada. As referências a artigos abaixo são indicativas para uma revisão posterior com as fontes abertas; não são trechos verificados nem certificação jurídica. Foram registrados no rascunho do ambiente os domínios necessários para a consulta, sem afirmar que a liberação já foi aplicada.

Não foi fornecida uma CCT específica. O usuário solicitou configuração de jornada por colaborador; isso foi implementado sem presumir a categoria, o enquadramento ou o instrumento aplicável.

## Matriz de cobertura

| Tema | Referência a conferir | Implementação e limites |
| --- | --- | --- |
| Limite diário | CLT, arts. 58 e 59 | Padrão 8h de trabalho, descontada a pausa; limite individual configurável. Acima de 8h exige referência de acordo. O modelo geral limita a 10h e não implementa 12x36. Referência preenchida não prova a validade da exceção nem calcula extras. |
| Limite semanal | CF, art. 7º, XIII; CLT e instrumento aplicável | Padrão 44h, com possibilidade de limite individual menor. Acima de 44h não é suportado neste perfil. Turnos que atravessam a semana geram alerta porque as horas ainda são somadas na semana da entrada. Não há média plurissemanal ou banco de horas. |
| Intervalo interjornada | CLT, art. 66 | Bloqueia intervalo inferior a 11h entre períodos; pode exigir mais por perfil. Compara também com o término de turnos sobrepostos anteriormente, não apenas com o registro imediatamente anterior. |
| DSR e sequência de trabalho | CLT, art. 67; Lei nº 605/1949; jurisprudência a conferir | Perfil conservador de descanso combinado de 35h. Conta períodos de trabalho, não duplica um turno noturno ao atravessar meia-noite. A falta de descanso completo não zera a sequência só porque houve uma data civil sem entrada. Máximo de cinco períodos no perfil 5x2 e seis no 6x1. Não certifica as duas folgas do 5x2 nem o DSR de períodos com histórico incompleto. |
| Intrajornada | CLT, art. 71; negociação coletiva aplicável | Verifica duração da pausa: 15 min em jornada de mais de 4h até 6h; padrão 60 min acima de 6h. Redução a partir de 30 min exige referência do instrumento. Não modela posição da pausa, fruição real, fracionamento ou atividades com intervalos específicos. Mais de um turno na mesma data é bloqueado neste modelo em vez de validar fragmentos incompletos. |
| Domingos | CLT, arts. 67 e 386; legislação setorial, portarias e CCT | Revezamento individual configurado em duas ou três semanas. Trabalho alcançando o domingo por turno noturno entra na análise. Não há enquadramento automático por categoria, condição individual, autorização setorial ou jurisprudência. O valor do perfil precisa ser revisado. |
| Trabalho noturno | CLT, art. 73 e regras específicas | Gera alerta. Não calcula hora reduzida, adicional, prorrogação, bases de cálculo ou diferenças entre atividades urbanas/rurais e categorias. |
| Horas extras e compensação | CLT, art. 59 e correlatos | Somente limites e indicação de acordo. Não calcula adicionais, remuneração, saldo, prazo de compensação ou validade do banco de horas. |
| 12x36 e regimes especiais | CLT, art. 59-A e legislação específica | Não implementados. Aumentar um número de horas no perfil comum não habilita esses regimes. |
| Tempo parcial, menores, aprendizes e condições protegidas | CLT e normas específicas | Limites individuais menores podem ser preenchidos, mas não há motor completo de enquadramento e proteção por condição. |
| Feriados, férias e afastamentos | CLT, Lei nº 605/1949 e normas aplicáveis | Há cadastro manual de feriados nacionais, estaduais e municipais, com localidade do workspace e sinalização na escala/PDF. Permanecem pendentes calendário oficial automático, vigência das normas, autorização para trabalho em feriado, remuneração/compensação, férias e afastamentos. O cadastro não constitui validação normativa. |
| Sobreaviso, prontidão e tempo à disposição | CLT e enquadramento/jurisprudência específicos | Não modelados. Não converter automaticamente em turno comum. |
| Ponto e realizado | CLT, art. 74 e regulamentação pertinente | O produto planeja jornadas; não registra ponto homologado, intervalos efetivamente gozados, tolerâncias ou evidências do realizado. |
| Registro, remuneração e demais temas da CLT | CLT e legislação correlata | Contratação, registros, salários, benefícios, rescisões, saúde e segurança e obrigações administrativas estão fora do escopo deste MVP. |

## Correções técnicas efetuadas

1. Um turno noturno conta como um período de trabalho na sequência. O dia seguinte continua contando para o revezamento de domingos quando efetivamente há trabalho nele.
2. O descanso semanal é exigido antes de um novo período depois do máximo de períodos sem descanso completo. Uma folga adicional curta isolada não é automaticamente classificada como DSR irregular.
3. Regras individuais se sobrepõem aos padrões gerais somente para a pessoa selecionada. Alterações são verificadas contra todos os turnos existentes antes de salvar.
4. Perfis comuns não permitem reduzir interjornada abaixo de 11h, descanso combinado abaixo de 35h ou elevar o limite semanal acima de 44h. Regimes excepcionais exigem motor próprio.
5. Alterações acima de 8h/dia e redução do intervalo de 60 min exigem referência de acordo; essa exigência é de governança, não uma validação jurídica do texto indicado.
6. Histórico incompleto, trabalho noturno e cruzamento da semana passam a ter avisos explícitos. A resposta da API informa `compliance.certified: false`.

## Pendências para uma validação normativa

- Liberar acesso às fontes oficiais, confirmar atualização do PDF e conferir o texto vigente, suas alterações e normas setoriais.
- Identificar CCT/ACT, estabelecimentos, categoria e condições individuais aplicáveis. Vincular os perfis a instrumentos com vigência e responsável por revisão.
- Implementar início/fim de pausa e apuração temporal completa para turnos que atravessam datas/semanas e para a hora noturna.
- Modelar folgas explícitas, férias, afastamentos e feriados; definir e verificar a janela completa de histórico para o DSR.
- Implementar regimes especiais e testes específicos antes de habilitá-los.
- Integrar autenticação multiusuário, persistência transacional, auditoria de alterações e isolamento entre empresas antes de uso operacional compartilhado. O banco Supabase permanece como proposta não aplicada.
- Submeter as regras e os instrumentos ao responsável trabalhista antes de tratar resultados como aprovação da escala.

A conclusão desta revisão é que o sistema oferece verificações úteis de planejamento, mas **ainda não atende nem comprova todas as exigências da CLT**. Os pontos pendentes ficam explícitos para que uma tela sem alertas não seja interpretada como garantia jurídica.
