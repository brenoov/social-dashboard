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

**Correção de dado em 18/08 — o KM da Bravo Blackmotion.** A tela mostrava
**188.000 km**; o certo é **185.359** (o último checklist). A causa: uma ficha de
teste de 07/08, **não assinada**, com o hodômetro digitado acima do real — e a
regra da tela (`ultimoHodometro`) pega o **MAIOR** hodômetro de propósito, porque
"odômetro só anda pra frente". A própria ficha assinada de 17/08 registra o erro:
*"O teste foi feito com o km acima do correto."*

⚠️ **O gotcha, para a próxima vez:** `frota_checklist.hodometro` é **obrigatório**,
então não dá para esvaziar um número errado. As únicas saídas são **corrigir** ou
**apagar** a ficha. O dono escolheu apagar (18/08); a ficha não era assinada,
então não havia prova a destruir e a corrente de códigos não foi tocada — ela
continua ligando 14/08 → 17/08. Foram junto as 15 respostas dela. Cópia do que
foi apagado ficou fora do repositório, no scratchpad da sessão.

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

### B8 · Status do Claude › o gasto da OpenAI 🟡 *a mentira saiu em 18/08 — falta o valor*
Pedido do dono em 27/07. Medido em 18/08, e o item era **maior do que dizia**: a
tela não só omitia a OpenAI — ela **afirmava** que "tarefas que criam imagens não
usam a API paga, então custam R$ 0". A Fábrica gera criativo com **gpt-image-2**,
que é API paga da OpenAI.

**A raiz, e ela é da família que já custou caro aqui:** `ia_execucoes.usd` era
**NOT NULL com padrão 0**. "Não sei" era obrigado a virar "zero". E em JavaScript
`Number(null) === 0` é **true**, então bastava um `Number(e.usd) === 0` espalhado
pela tela para a mentira se recompor sozinha.

**Feito em 18/08:**
- A coluna aceita **nulo** = "ainda não se sabe". Zero passou a significar só o
  que significa: não custou mesmo
- As **26 execuções** da Fábrica (473 criativos) foram corrigidas de R$ 0 para
  "não sei", e ganharam o nome do motor. As outras tarefas da Fábrica (subir,
  excluir, preview) continuam zero — essas não chamam IA nenhuma
- `coletor/lib/custo-da-execucao.mjs` (7 testes): motor da Anthropic calcula;
  motor pago de fora, ou **motor novo que ninguém precificou**, devolve nulo
- `src/ferramentas/claude-status/custo-do-extrato.js` (8 testes): as três
  situações, e a segmentação por fornecedor
- A legenda da tela foi reescrita e agora diz a verdade, inclusive que **estava
  errada até 18/08**

**O que a tela mostra agora**, medido no banco: nos últimos 30 dias há
**US$ 24,79 conhecidos** e **23 execuções · 397 imagens sem custo conhecido**,
todas de `gpt-image-2`. Antes, essas 397 apareciam como R$ 0.

🔴 **O que falta: o VALOR.** O dono escolheu (18/08) trazer o gasto **real
cobrado**, como já é feito com a Anthropic, em vez de chutar um preço por imagem.
Isso pede duas coisas:
1. **Uma chave de administrador da OpenAI**, guardada em `segredos_de_cron` com o
   nome `openai_admin_key` — o mesmo lugar do `anthropic_admin_key`
2. **Uma Edge Function `custo-openai`**, espelhando a `custo-anthropic`
   (189 linhas), lendo a chave do cofre e chamando o relatório de custos

⚠️ **A função nova cai na MESMA fila de deploy do B14**: Edge Function não sobe
com `git push`, e a CLI deste Mac está na conta errada (`emsilva99`, do erickIA)
e leva 403. Por isso ela **não foi escrita ainda** — escrever mais código que não
sobe só aumenta a distância entre o repositório e o que está no ar, que é um
problema que este projeto já teve.

**Ordem certa:** resolver o acesso de deploy → subir o B14 → então escrever e
subir o `custo-openai` na mesma leva.

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
