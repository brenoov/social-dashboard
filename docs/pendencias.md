# Pendências do iamundi

Última revisão: **18/08/2026**

O que é este arquivo: a lista viva do que está **em aberto** no projeto. Cada item
diz o que falta, **por que importa** e **onde** se resolve. É a memória escrita —
se não estiver aqui, some.

Como ler:
- **Parte A — Só o dono resolve.** É clique em painel/tela. Não tem código pra fazer.
- **Parte B — Precisa programar.** Alguém tem que mexer no código.
- **Parte C — Ideias guardadas.** Ninguém pediu ainda; está aqui pra não esquecer.

Cada item tem um código fixo (A1, B3...) pra dar pra citar em conversa.

---

## Parte A — Só o dono resolve (clique, sem código)

> **O selo 🔇 que aparece em alguns itens** quer dizer que o dono mandou parar de
> oferecê-los. Eles não somem: item adiado fica, com a data e o motivo. O que muda
> é que ninguém os empurra de novo.

### A1 · Frota › ligar o aviso do "Checklist do carro" ⚠️ *o que trava mais coisa*
> 🔇 **Fora de recomendação (pedido do dono).** Continua registrado, mas não
> entra em "por onde começar", em resumo de status nem em sugestão. Se ele
> perguntar direto por ele ou pela lista inteira, responder normal.

Em **Administração › Usuários**. O aviso nasce desligado: o robô roda todo dia às
7h30, não manda nada e ninguém sabe que não mandou.

**A prova de que ninguém usa** (medido em 11/08): a ferramenta está no ar desde
06/08 e existem **2 checklists gravados no total**, 1 assinado, o mais recente de
**07/08**. Ou seja: fizeram o teste e parou. Sem o aviso, ninguém lembra.

E é isso que segura o **B10** — sem checklist diário não nasce o registro de quem
estava com o carro, que é o que faltava pras multas e pro custo por km.

### A2 · Frota › 3 donos de carro não têm login 🟢 *o bloqueio saiu em 18/08*
Medido em 11/08, **remedido em 18/08**.

| Dono | Carro | Situação em 18/08 |
|---|---|---|
| Barbara Franco | Honda Fit | e-mail na ficha ✔ · **sem login** |
| Marcus Vinicius | Fiat Punto | e-mail na ficha ✔ (era o que faltava) · **sem login** |
| Thiago Siqueira | Ford Fiesta Sedan | e-mail na ficha ✔ (era o que faltava) · **sem login** |

**O que mudou:** os três agora têm e-mail na ficha. Era esse o bloqueio — o botão
**"Dar acesso a &lt;nome&gt;"**, no card do checklist de cada carro, só aparece para
quem tem e-mail. **Agora ele aparece para os três.**

Ele cria o login, sorteia uma senha inicial (sem letras que se confundem — nada de
O/0 nem l/1), obriga a trocar no primeiro acesso, e mostra um recado pronto pra
mandar no WhatsApp.

Sem login, push nenhum chega. Pra eles o quadro da aba **Gestão** é o único canal
— e por isso quem administra a Frota pode preencher o checklist por qualquer carro.

⚠️ **O que eu não consegui provar:** o caminho de ponta a ponta — clicar, a pessoa
entrar, ser obrigada a trocar a senha e chegar no checklist. Provar isso exigiria
criar um login de verdade e mexer numa conta real, e a regra aqui é não mexer.
Então o primeiro convite é também o teste. **Se algo falhar, é neste item.**

> ✅ **A Raissa saiu desta lista em 11/08.** Ela tem login, mas a ficha estava sem
> o elo `profile_id` — e o robô do aviso exigia justamente esse elo, enquanto a
> tela a reconhecia pelo e-mail. Duas respostas pra mesma pergunta. Corrigido no
> código (`_shared/quem-loga.js`, commit `a0178b6`): agora as duas pontas usam a
> mesma regra, com o e-mail como resgate. Ligar o elo na ficha dela continua sendo
> boa arrumação, mas **não é mais requisito** pra ela receber o aviso.

### A2b · Frota › 1 carro sem dono 🟢 *era 2, remedido em 18/08*
Sobrou o `OLW4I46` **Fiat Bravo Essence**. O `QQT9B68` Fiat Doblo ganhou dono.
Sem dono fixo não há de quem cobrar o checklist — ele nunca entra no quadro de
cobrança nem no aviso.

### A2c · Frota › o valor do seguro está vazio nos 10 carros ⚠️ *remedido em 18/08: não mudou*
Medido em 12/08 e **de novo em 18/08: continua 10 de 10 sem valor de seguro.** O `DCH1J89` BMW X1 também
está sem aluguel e sem FIPE — é o único; os outros 9 têm os dois.

Enquanto o seguro estiver vazio, qualquer conta de custo do carro sai por baixo:
falta uma das três parcelas fixas (aluguel, FIPE, seguro).

> ✅ **Susto que não era susto, conferido em 12/08.** Havia um defeito de leitura de
> dinheiro na ficha: ele jogava fora todo ponto, tratando como separador de milhar.
> Fui conferir os 10 carros esperando encontrar valores 100× maiores — **não tem
> nenhum errado.** O motivo: quem preenche digita no jeito brasileiro
> (`157.995,00`), e aí o ponto **é** milhar mesmo, então jogar fora estava certo por
> acidente. O defeito só morderia quem digitasse no jeito americano (`157995.00`).
> Já está corrigido de todo jeito. Nada a arrumar no banco.

### A3 · Frota › apontar Empresa e Local 🟢 *quase lá — 18/08*
Remedido em 18/08. Sobraram **dois buracos, em dois carros**:

| Placa | Carro | Falta |
|---|---|---|
| FEF0C13 | Volvo XC90 | só a **empresa** |
| FFK9E60 | Fiat Bravo Blackmotion | só o **local** |

Em 11/08 eram 3 carros sem empresa e 4 sem local. O XC60 e o Cayenne saíram.

Preencher **na ficha, na mão** — decisão do dono: nada de migration mexendo em dado.

> ⚠️ **Cuidado com a palavra "Marca".** Na Frota, `marca` é o **fabricante**
> (VOLVO, BMW, FIAT) e **está preenchida nos 10**. A empresa do grupo (Vessel,
> RB Builders, RBV Company) é outro campo, e é esse que está vazio. Isso já
> confundiu uma vez.

### A3c · Perfis de Acesso › o teste da primeira vez ⚠️ *antes do primeiro perfil de verdade*
A ferramenta está no ar e **nunca foi usada**. Antes de criar um perfil com gente dentro,
vale rodar o roteiro — ele prova que a trava funciona:

1. Criar uma conta **descartável** (não use conta de quem trabalha aí).
2. Criar um perfil de teste e pôr essa conta dentro.
3. Mexer no perfil e **conferir que a janela nomeia a conta** e diz o que ela ganha ou perde.
4. **Clicar em Cancelar** e conferir no banco que **nada mudou**. É este passo que prova a trava.
5. Só então aplicar, e conferir que o acesso mudou e que a exceção sobreviveu.
6. Desfazer tudo.

Precisa ser feito por `erick@` ou `gabriel.gertrudes@` (ver A3b).

### A4 · Segurança › ligar MFA e a proteção de senha vazada 🔴 *risco nº 1*
> 🔇 **Fora de recomendação (pedido do dono).** Continua registrado, mas não
> entra em "por onde começar", em resumo de status nem em sugestão. Se ele
> perguntar direto por ele ou pela lista inteira, responder normal.

No painel do Supabase:
- **Authentication › Password security** → ligar "Leaked password protection" +
  tamanho mínimo ≥ 10.
- **Authentication › MFA** → ligar TOTP e os admins se cadastrarem.

Por que é o risco nº 1: as três frentes grandes já foram fechadas (repo privado,
token da Meta fora do navegador, guarda de admin). O que sobra de porta aberta é
login de admin com senha fraca ou phishada.

### A5 · Segurança › rotacionar os segredos
> 🔇 **Fora de recomendação (pedido do dono).** Continua registrado, mas não
> entra em "por onde começar", em resumo de status nem em sugestão. Se ele
> perguntar direto por ele ou pela lista inteira, responder normal.

Circularam em transcrição de sessão: **token do System User da Meta**,
**client_secret** do app da Meta e o **token do Bling**.

**Piorou em 18/08.** Ao listar só os NOMES das chaves do `coletor/.env`, pedaços
de um token da Meta apareceram na tela — o arquivo tem linhas quebradas, e o
comando que mostrava os nomes mostrou junto os restos delas. Erro meu. Não muda o
que fazer, muda a pressa: **os tokens da Meta deste arquivo devem entrar na
rotação.** Nunca mais listar chave de `.env` sem cortar a linha.

### A6 · Central de Conteúdo › decidir se liga os 2 crons
> 🔇 **Fora de recomendação (pedido do dono).** Continua registrado, mas não
> entra em "por onde começar", em resumo de status nem em sugestão. Se ele
> perguntar direto por ele ou pela lista inteira, responder normal.

As duas Edge Functions estão no ar mas **dormentes** de propósito — as migrations
`06-cron-hora-h.sql` e `09-cron-espelho.sql` nunca foram aplicadas.
- `conteudo-hora-h`: **dispara push em 6 aparelhos reais.** Decisão do dono.
- `conteudo-espelho`: inofensiva (só lê a Meta). Pode ligar quando quiser.

### A7 · Meta › pedir o App Review 🟡 *"pra outra hora" (dono, 11/08)*
> 🔇 **Fora de recomendação (pedido do dono).** Continua registrado, mas não
> entra em "por onde começar", em resumo de status nem em sugestão. Se ele
> perguntar direto por ele ou pela lista inteira, responder normal.

Falta **uma só permissão: `instagram_content_publish`.** As outras 7 que o sistema
usa já funcionam. O pacote está pronto (texto de justificativa, roteiro do vídeo,
pré-requisitos) em `docs/app-review-meta.md`.

**Não pedir `pages_manage_posts`** junto — nenhum código publica em Página do
Facebook, e permissão sem uso visível no vídeo reprova; uma reprovada derruba o
pedido inteiro.

Sem isso, a Central de Conteúdo **avisa** na hora H em vez de publicar. A
publicação já está escrita e desligada (`ESCOPOS_DE_PUBLICACAO_LIBERADOS = false`).

### A12 · Status do Claude › o `breno@` não enxerga a ferramenta 🟢 *achado em 14/08*
Medido no banco em 14/08, conferindo outra coisa (o B12).

| Super-admin | Tem `claude.status` |
|---|---|
| erick@rbvcompany.com | sim |
| gabriel.gertrudes@rbvcompany.com | sim |
| **breno@rbvcompany.com** | **não** |

Por quê: a permissão foi concedida por uma migration de julho que varria **quem
era super-admin naquele dia**. O `breno@` virou super-admin depois, e a concessão
não voltou a rodar. É o padrão conhecido: **chave nova só chega a quem já
existia** — quem entra depois nasce sem ela.

Resolve em **Administração › Usuários**, marcando "ver" em Status do Claude para
o `breno@`. Não mexi: é permissão de pessoa de verdade, e a decisão é sua.

### A13 · Meta Ads › 47 anúncios parados, e agora dá pra ver 🔴 *remedido em 18/08*
O dono relatou que uma campanha foi barrada "por atividade suspeita". Medido no
Graph em 17/08, e a medição corrige a premissa em dois pontos:

- **Nenhuma conta está restringida.** As 7 contas de anúncio estão ATIVAS, com
  `disable_reason: 0`. Não houve bloqueio de conta.
- **Nenhum anúncio está recusado por política.** O que existe são **47 itens
  parados por motivo operacional** (eram 49 em 17/08) — e a Meta diz cada um com
  todas as letras. Contagem de 18/08, lida pelo robô-vigia do **B15**, que agora
  refaz essa leitura todo dia às 04h07 sem depender de ninguém abrir a tela.

| Quantos | O que a Meta diz | Onde resolve |
|---|---|---|
| **33 anúncios** | As Páginas não correspondem | A Página do anúncio é diferente da Página do post que ele promove. Escolher a mesma nos dois. |
| **5 conjuntos** | Público personalizado indisponível | Abrir o conjunto na Meta e tirar o público que sumiu — enquanto ele estiver lá, não reativa. |
| 3 anúncios | Vídeo abaixo do mínimo | Trocar por um com mais de 500px de largura (roda, mas não no Instagram). |
| 2 anúncios | Não está sendo veiculado | Público pequeno ou concorrência entre conjuntos. |
| 1 anúncio | Cartão de imagem sem link de CTA | Preencher o destino. |
| 1 anúncio | Mídia orgânica excluída | — |

Os **33 das Páginas** são a maior parte, e 32 deles nasceram numa rajada só:
**13/08, entre 13h15 e 13h18**, na conta `C2 - La Vessel`. Trinta e dois anúncios
inválidos em quatro minutos é o padrão que costuma ser lido como automação
abusiva — pode ser essa a origem do que chegou como "atividade suspeita".

⚠️ **Não foi a nossa Fábrica:** `fabrica_jobs` não tem rodada nenhuma depois de
**29/07**. Esses anúncios não saíram por ali.

**Resolve no Gerenciador de Anúncios**, não aqui — a Central mostra, e de
propósito não mexe. Ver o painel novo em **Gestão de Tráfego › Fila**.

> ✅ **E agora a Central guarda o motivo (17/08).** A Meta **apaga** o
> `issues_info` quando o anúncio é excluído ou o problema é resolvido — foi por
> isso que a campanha da semana de 11/08 não deixou rastro. A tabela
> `gt_problemas_meta` é a memória que a Meta não tem: guarda **o nome** da
> campanha e do anúncio junto com os ids (para a linha continuar legível depois
> que o objeto sumiu da Meta), `primeira_vez` / `ultima_vez` em vez de uma linha
> por leitura, e `resolvido_em` para saber que o conserto funcionou e quanto
> tempo ficou parado. Já tem **47 linhas** gravadas.
>
> ⚠️ **Ela só enche quando alguém abre a Gestão de Tráfego.** Um problema que
> nasce e morre entre duas visitas passa batido. Fechar isso é o **B15**.

---

## Parte B — Precisa programar

### B6 · Robôs › o cron `fabrica-purga-diaria` está com o token em texto puro
É o único cron com o segredo escrito dentro do `cron.job.command` — exatamente o
que a tabela `segredos_de_cron` existe pra evitar. Por isso ele não foi
instrumentado junto com os outros.

### B7 · Robôs › a causa do `546 WORKER_RESOURCE_LIMIT` ainda é hipótese
A suspeita é que a função roda ~120s, varre 7 contas e baixa fotos pra memória.
Não houve perda de dado (a coleta roda 4×/dia e regrava). Agora dá pra **medir a
frequência antes de mexer** — medir primeiro.

### B8 · Status do Claude › trazer os gastos da API da OpenAI
Pedido do dono em 27/07, marcado como "pra depois". Hoje o extrato só mostra a
Anthropic. A OpenAI entra pela Fábrica (gpt-image-2 do Hero-IA) e está invisível
no painel. Ao fazer: manter a **fonte única de preço** e a linguagem literal.

### B9 · Segurança › as escritas soltas que sobraram
`bling_pedido_vendedor`, `bling_vendedores` (cache com auto-cura) e
`campaign_filters` aceitam escrita de qualquer usuário logado (`authenticated
true`). Foi deixado de propósito porque a equipe é interna — só trava de vez
proxiando pelo Edge.

### B13 · Frota › quem decidiu a reserva nem sempre tem nome na tela

O histórico da aba Gestão mostra quem pediu, quem decidiu e quem encerrou cada
reserva. O nome sai de `acessos_pessoas.profile_id` — a ficha de colaborador
ligada à conta de login, que a tela já carrega. **Quem tem login e não tem ficha
de colaborador ligada aparece só como data, sem nome.**

Não é defeito de tela: é o mesmo elo que o A2 trata pelo outro lado (gente sem
login). Enquanto o elo não existir, a tela escreve a data e cala sobre o nome —
o que ela não faz é inventar um nome plausível.

**Como resolver:** ligar a ficha de colaborador ao login de cada pessoa em
Acessos. Sem código.

### B14 · Frota › o aceite de retirada não tem cópia em PDF no Zoho

Desde 13/08/2026 quem pega um carro conferido por **outra pessoa** assina o
*aceite de retirada* (ver o desenho em
`docs/superpowers/specs/2026-08-13-frota-gestao-reservas-design.md`). Ele fica
gravado em `frota_uso`, com o rabisco e o código da ficha do dia congelado.

**O que não existe: o PDF dele na pasta do Zoho.** Foi decisão consciente — o
dono aprovou "uma assinatura por viagem e nenhum PDF a mais", e a prova mora no
banco, não no papel. Fica anotado porque, no dia em que uma multa precisar do
papel do aceite, ele não vai estar na pasta.

**O que fazer, se for pedido:** a mesma receita do checklist —
`frota_uso_pdf` + a fila que a Edge Function `enviar-pdf-checklist` já sabe
processar. O gerador (`pdf-do-checklist.js`) já tem o papel timbrado pronto.

### B15 · Meta Ads › o vigia diário 🟢 *escrito e agendado em 18/08 — falta ver rodar sozinho*
A tabela `gt_problemas_meta` (ver **A13**) guarda o motivo que a Meta dá, mas até
18/08 **quem gravava era a tela**: só ficava registrado o que alguém via ao abrir
a Gestão de Tráfego. Problema que nascia e morria entre duas visitas não deixava
rastro — o caso que originou tudo isto.

**Feito em 18/08:** o robô `coletor/vigia-problemas-meta.mjs` faz a mesma leitura
e chama a mesma função. Roda no GitHub Actions às **04h07** de Brasília (e não
neste Mac: vigia que só roda com a máquina ligada falta justo no dia ruim). Custo
zero de IA.

A regra que mais importa, e que está testada: **conta cuja leitura falha é
PULADA, nunca mandada vazia.** É a lista vazia que fecha o que sumiu — um erro de
rede virando lista vazia daria por resolvido, todo dia, um problema que continua
aberto.

⚠️ **O portão da função precisou mudar, e o desenho inicial estava errado.** Eu
conferi que o `service_role` podia *executar* `gt_registrar_problemas` e não olhei
o corpo dela, que exige **usuário logado** com admin ou `meta.gestor`. A migration
`2026-08-18-vigia-de-problemas-pode-gravar.sql` faz a função aceitar também quem
chega com a chave de serviço. Isso **não abre porta nova**: quem tem essa chave já
escreve na tabela direto. Provado nos três casos antes de agendar — logado sem
permissão recusa, sem token recusa, chave de serviço entra.

**O que falta para riscar:** ver a rodada automática das 04h07 acontecer (a
primeira é 19/08). A rodada à mão de 18/08 confirmou os **mesmos 47 problemas**
que a tela já tinha registrado, com **0 fechados por engano**.

### B16 · Redes › backfill dos números novos de campanha 🟡 *pela metade — reagendado para 19/08*
As colunas conversas, cadastros, compras e visitas só passaram a ser gravadas em
17/08/2026. Sem preencher o passado, a comparação com o período anterior e o
gráfico diário desses quatro indicadores ficam vazios nos baldes Contatos, Site e
alcance e Vendas.

**Onde parou (medido no banco em 18/08):** a passada da madrugada rodou, fez
**593 alvos de 1.407**, gravou **5.076 linhas** em 45 min e **parou às ~08h13
depois de 5 erros seguidos de rede** — o robô desiste de propósito, para não
martelar a Meta. Sobram **814 alvos** e **5.372 linhas** sem os quatro números,
com um corte nítido: tudo o que é anterior a **12/06/2026** ficou.

| Recorte | Linhas sem número | Vai até |
|---|---|---|
| Dia (p0) | 508 | 17/07 |
| 1 dia | 549 | 17/07 |
| 7 dias | 784 | 17/07 |
| 14 dias | 1.004 | 27/07 |
| 30 dias | 1.612 | 17/07 |
| MÊS (p99) | 915 | 18/08 → **este era o B17, e foi resolvido** |

**O que mudou em 18/08:** o agendamento voltou, e desta vez de verdade — o de
ontem era um processo solto de sessão, que morreu com ela. Agora é
`~/Library/LaunchAgents/com.iamundi.backfill-numeros.plist`, 03h07, chamando
`coletor/retomar-backfill-madrugada.sh`, que faz **até 3 passadas** com 10 min de
pausa: uma oscilação de rede deixa de custar a noite inteira.

**Ele se apaga sozinho** quando o robô anunciar "0 pela frente" — apaga o arquivo
de retomada, deixa o marcador `coletor/.backfill-numeros-PRONTO` e tira o próprio
agendamento do launchd.

**Como conferir e riscar este item:** `tail -30 coletor/backfill-madrugada.log`
e, no banco, `select count(*) from campaign_insights where conversas is null` —
se sobrar só o que a Meta não devolve, acabou. Se o marcador `PRONTO` existir,
acabou também.

Para preencher um recorte específico à mão:
`node coletor/preencher-numeros-de-campanha.mjs --desde AAAA-MM-DD`.

⚠️ Se o Mac estiver **desligado** às 03h07, o launchd roda a tarefa quando ele
acordar — mas dormindo o dia inteiro ela não roda. É a razão de o vigia do B15
ter ido para o GitHub, e não para cá.

---

## Parte C — Ideias guardadas (ninguém pediu ainda)

### C2 · Gestor de Tráfego › subir campanha por upload de criativo
Ideia do dono (12/07): subir campanha no Gestor com o criativo vindo de **upload**
(1 arquivo ou em massa), não gerado como no Estúdio. Requisito-chave é
**normalizar o formato sozinho** (PNG→JPG, achatar transparência, redimensionar
pros ratios de Feed 1:1 e Story 9:16).

Reaproveitar, não reconstruir: `fabrica_objetivos`, `criarCampanhaNova` e
`coletor/lib/meta-subir.mjs` já fazem a subida.

---

## Como manter esta lista

- Item que fecha **sai** daqui (a história fica no commit e nos planos de
  `docs/superpowers/`). Não deixar item morto ocupando espaço.
- Item que o dono **adia** fica, com a data e o motivo — como o A7 e o A9.
- Item novo entra com **o porquê**, não só o quê. "Falta X" sem o motivo vira
  item que ninguém entende em duas semanas.
- Ao encostar num assunto, reler o item aqui **antes** — vários guardam um
  cuidado que já custou caro (o "Marca" do A3, o `pages_manage_posts` do A7, o
  `balance` do C1).
