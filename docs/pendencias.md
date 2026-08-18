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

## O que o dono decidiu em 18/08 (para não virar dúvida de novo)

Numa triagem item a item, ele **encerrou** dez itens da Parte A. Fica aqui o
motivo, porque "sumiu da lista" sem explicação é o que faz alguém reabrir o
assunto daqui a um mês:

| Item | Por que saiu |
|---|---|
| A2b · carro sem dono | **É de propósito.** O `OLW4I46` não tem dono fixo por decisão. |
| A2c · seguro vazio nos 10 | **É de propósito.** Não vão preencher valor de seguro. |
| A3 · empresa e local | **FEITO em 18/08.** Os 10 carros têm empresa e local — zero vazios. |
| A12 · Status do Claude | **É de propósito.** O `breno@` não vai receber a permissão. |
| A13 · anúncios parados | Encerrado a pedido dele. |
| A1, A4, A5, A6, A7 | Mandou apagar. Eram os que já estavam fora de recomendação. |

**Risco aceito em 18/08 — o token da purga da Fábrica.** Ele apareceu na tela
numa sessão de trabalho. O dono escolheu **tirá-lo do texto puro sem trocá-lo**,
porque trocar exige colar o valor novo em `FABRICA_PURGA_SECRET` no painel do
Supabase, e só ele tem esse privilégio. O token continua conhecido. Se um dia
quiser fechar: gerar um hex de 64, atualizar a linha `fabrica-purga` em
`segredos_de_cron` e colar o mesmo valor no painel — nessa ordem.

⚠️ **A2c e A12 tinham número medido contra eles** (10 de 10 carros sem seguro; a
permissão faltando de fato). Não saíram por estarem resolvidos — saíram porque o
dono decidiu que é assim que fica. Se um dia alguém estranhar o custo do carro sair
por baixo, ou você não enxergar o Status do Claude, **é isto, e é intencional.**

---

## Parte A — Só o dono resolve (clique, sem código)

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

---

## Parte B — Precisa programar

### B20 · Bling › o `bling-proxy` falha em 2,2% das chamadas 🟡 *medido em 18/08, no lugar do B7*
Este item **substitui o B7**, que dizia que a causa do erro `546
WORKER_RESOURCE_LIMIT` ainda era hipótese. Medido em 18/08, a hipótese
**envelheceu**: o 546 não aparece em **~8.000 disparos** desde 31/07, nem em 24h
do registro da Supabase. E a suspeita de que "a função roda ~120s" está errada —
o `coletar-dados` roda em **21,4s de média**, com **0 erros** em 29 chamadas.

**O que falha de verdade, hoje**, nas últimas 24h de registro:

| Função | Chamadas | Não-200 | Taxa |
|---|---|---|---|
| **bling-proxy** | 721 | **16** | **2,2%** |
| todas as outras (13) | 626 | 0 | 0% |

Os 16 são: **8 tempos esgotados** (504, batendo em ~30s), **5 recusas por excesso**
(429, o Bling limitando) e **3 não encontrado** (404).

**Por que isso importa mais do que parece:** este projeto já teve falha virando
número — 500 virando R$ 0,00 por 17 horas. O caminho compartilhado
(`src/compartilhado/chamada-do-bling.js`) **já foi endurecido** e hoje levanta o
erro em vez de devolver lista vazia; as telas de dinheiro estão cobertas.

✅ **A parte que era nossa foi consertada em 18/08.** As duas chamadas da Gestão
Comercial engoliam a falha, e o mecanismo era pior do que "um catch mal escrito":
`functions.invoke` **não joga erro**, devolve `{ data: null, error }`, então o
`|| []` transformava queda do Bling em lista vazia. A `gcAbrirItem` **já tinha** o
`try/catch` certo, escrevendo "Não consegui consultar o Bling agora" — e ele nunca
disparava. O usuário lia **"Item não encontrado no Bling"**: uma queda anunciada
como "esse produto não existe", com a mensagem certa escrita e inalcançável.

A regra de leitura virou `resposta-do-bling.js`, com 7 testes, fora do `.vue`
(onde não teria como quebrar teste nenhum). Vazio continua sendo vazio — o item
pode não existir mesmo; o que mudou é que **falha agora sobe**.

**O que sobra, e não é nosso:** o Bling estourando 30s em ~1% das chamadas. Dá
para tentar de novo com recuo, não para consertar daqui. Enquanto ninguém pedir,
fica só medido.

### B8 · Status do Claude › trazer os gastos da API da OpenAI
Pedido do dono em 27/07, marcado como "pra depois". Hoje o extrato só mostra a
Anthropic. A OpenAI entra pela Fábrica (gpt-image-2 do Hero-IA) e está invisível
no painel. Ao fazer: manter a **fonte única de preço** e a linguagem literal.

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

### C2 · Gestor de Tráfego › subir campanha por upload 🟡 *metade já está de pé — conferido em 18/08*
Ideia do dono (12/07). **Conferido no código em 18/08, e a premissa mudou: o
upload de UM arquivo já existe e funciona.**

**O que já está no ar** (`_gtNovoEnviarImagem`, na tela da Gestão de Tráfego):
escolher um arquivo → Storage do projeto → Meta → hash. Aceita PNG, JPEG, MP4 e
MOV. Vídeo segue outro caminho de propósito (quem baixa é a Meta, pelo `file_url`,
porque dezenas de MB estourariam o limite da função). Confere o tamanho **antes**
de subir (`imagemServe`), porque descobrir que a Meta recusa depois do upload é o
pior momento. Provado em `validar-envio-de-imagem.mjs` (4/4).

**O que falta, e é o que sobra do C2:**
1. **Em massa.** O seletor não tem `multiple` — é um arquivo por vez.
2. **Normalizar o formato sozinho.** Hoje `imagemServe` só **recusa** o que não
   serve. O pedido era converter: PNG→JPG, achatar transparência e redimensionar
   para Feed 1:1 e Story 9:16. Nada disso existe.

Reaproveitar, não reconstruir: `fabrica_objetivos`, `criarCampanhaNova` e
`coletor/lib/meta-subir.mjs` já fazem a subida.

## Como manter esta lista

- Item que fecha **sai** daqui (a história fica no commit e nos planos de
  `docs/superpowers/`). Não deixar item morto ocupando espaço.
- Item que o dono **adia** fica, com a data e o motivo — como o A7 e o A9.
- Item novo entra com **o porquê**, não só o quê. "Falta X" sem o motivo vira
  item que ninguém entende em duas semanas.
- Ao encostar num assunto, reler o item aqui **antes** — vários guardam um
  cuidado que já custou caro (o "Marca" do A3, o `pages_manage_posts` do A7, o
  `balance` do C1).
