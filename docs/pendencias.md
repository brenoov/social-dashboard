# Pendências do iamundi

Última revisão: **11/08/2026**

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

### A1 · Frota › ligar o aviso do "Checklist do carro" ⚠️ *o que trava mais coisa*
Em **Administração › Usuários**. O aviso nasce desligado: o robô roda todo dia às
7h30, não manda nada e ninguém sabe que não mandou.

**A prova de que ninguém usa** (medido em 11/08): a ferramenta está no ar desde
06/08 e existem **2 checklists gravados no total**, 1 assinado, o mais recente de
**07/08**. Ou seja: fizeram o teste e parou. Sem o aviso, ninguém lembra.

E é isso que segura o **B10** — sem checklist diário não nasce o registro de quem
estava com o carro, que é o que faltava pras multas e pro custo por km.

### A2 · Frota › 3 donos de carro não têm login
Medido em 11/08.

| Dono | Carro | Situação |
|---|---|---|
| Barbara Franco | Honda Fit | Sem login. Domínio é `@vesselbrasil.com.br`, diferente dos outros. |
| Marcus Vinicius | Fiat Punto | Sem login (tem telefone → WhatsApp alcança) |
| Thiago Siqueira | Ford Fiesta Sedan | Sem login (tem telefone → WhatsApp alcança) |

Sem login, push nenhum chega. Pra eles o quadro da aba **Gestão** é o único canal
— e por isso quem administra a Frota pode preencher o checklist por qualquer carro.

> ✅ **A Raissa saiu desta lista em 11/08.** Ela tem login, mas a ficha estava sem
> o elo `profile_id` — e o robô do aviso exigia justamente esse elo, enquanto a
> tela a reconhecia pelo e-mail. Duas respostas pra mesma pergunta. Corrigido no
> código (`_shared/quem-loga.js`, commit `a0178b6`): agora as duas pontas usam a
> mesma regra, com o e-mail como resgate. Ligar o elo na ficha dela continua sendo
> boa arrumação, mas **não é mais requisito** pra ela receber o aviso.

### A2b · Frota › 2 carros sem dono nenhum
`OLW4I46` Fiat Bravo Essence e `QQT9B68` Fiat Doblo. Sem dono fixo não há de quem
cobrar o checklist — esses dois nunca entram no quadro de cobrança nem no aviso.

### A3 · Frota › apontar Empresa e Local 🟢 *começou — 7 de 10 feitos*
Medido em 11/08: **7 dos 10 já têm empresa** (todos "RB Builders") e **6 têm
local**. Faltam:

| Placa | Carro | Falta |
|---|---|---|
| BDN3A67 | Volvo XC60 | empresa **e** local |
| FEF0C13 | Volvo XC90 | empresa **e** local |
| FQW7G77 | Porsche Cayenne PHEV | empresa **e** local |
| FFK9E60 | Fiat Bravo Blackmotion | só o local |

São justamente os três de maior valor que faltam — e dois deles (XC90 e Cayenne)
são os blindados que estão na oficina.

Preencher **na ficha, na mão** — decisão do dono: nada de migration mexendo em dado.

> ⚠️ **Cuidado com a palavra "Marca".** Na Frota, `marca` é o **fabricante**
> (VOLVO, BMW, FIAT) e **está preenchida nos 10**. A empresa do grupo (Vessel,
> RB Builders, RBV Company) é outro campo, e é esse que está vazio. Isso já
> confundiu uma vez.

### A4 · Segurança › ligar MFA e a proteção de senha vazada 🔴 *risco nº 1*
No painel do Supabase:
- **Authentication › Password security** → ligar "Leaked password protection" +
  tamanho mínimo ≥ 10.
- **Authentication › MFA** → ligar TOTP e os admins se cadastrarem.

Por que é o risco nº 1: as três frentes grandes já foram fechadas (repo privado,
token da Meta fora do navegador, guarda de admin). O que sobra de porta aberta é
login de admin com senha fraca ou phishada.

### A5 · Segurança › rotacionar os segredos
Circularam em transcrição de sessão: **token do System User da Meta**,
**client_secret** do app da Meta e o **token do Bling**.

### A6 · Central de Conteúdo › decidir se liga os 2 crons
As duas Edge Functions estão no ar mas **dormentes** de propósito — as migrations
`06-cron-hora-h.sql` e `09-cron-espelho.sql` nunca foram aplicadas.
- `conteudo-hora-h`: **dispara push em 6 aparelhos reais.** Decisão do dono.
- `conteudo-espelho`: inofensiva (só lê a Meta). Pode ligar quando quiser.

### A7 · Meta › pedir o App Review 🟡 *"pra outra hora" (dono, 11/08)*
Falta **uma só permissão: `instagram_content_publish`.** As outras 7 que o sistema
usa já funcionam. O pacote está pronto (texto de justificativa, roteiro do vídeo,
pré-requisitos) em `docs/app-review-meta.md`.

**Não pedir `pages_manage_posts`** junto — nenhum código publica em Página do
Facebook, e permissão sem uso visível no vídeo reprova; uma reprovada derruba o
pedido inteiro.

Sem isso, a Central de Conteúdo **avisa** na hora H em vez de publicar. A
publicação já está escrita e desligada (`ESCOPOS_DE_PUBLICACAO_LIBERADOS = false`).

### A8 · Gestor de Tráfego › apontar uma campanha cobaia
O **Duplicar** e o **Editar público** estão na main desde 28/07 e **nunca rodaram
contra conta Meta real**. Confirmar duplicação cria campanha de verdade, e editar
público muda quem vê anúncio que está rodando.

Precisa o dono indicar uma campanha **pausada ou de gasto baixo** pra servir de
cobaia — escolher qual é decisão de negócio, não técnica.

### A9 · Relatórios › liberar as 2 permissões ⏸️ *adiado pelo dono (11/08)*
`patrimonio.relatorios` e `frota.relatorios`, no Config de Admin. Nasceram
desmarcadas de propósito.

Adiado porque **o dono é superadmin e já enxerga a aba**. Quando for liberar pra
mais alguém, é aqui. E se alguém disser "a aba não aparece pra mim", é isto —
antes de suspeitar de defeito.

---

## Parte B — Precisa programar

### B1 · 15 pastas ainda sem o guarda de import 🔴 *já derrubou tela 4 vezes*
Chamar uma função da pasta vizinha e **esquecer de importar não quebra o build** —
o Vite supõe que é global do navegador. O erro só nasce quando alguém clica.

Já aconteceu: Gestão de Tráfego (29/07, duas vezes no mesmo dia), Admin (05/08),
Patrimônio (10/08 — as abas Planilha e Resumo abriam **em branco**).

O guarda é um `imports.test.mjs` na pasta. **Existe em 5**: `admin`,
`gestao-trafego`, `patrimonio`, `frota` e `compartilhado/relatorios`. **As outras
~15 de `src/ferramentas/` não têm.** Copiar de
`src/ferramentas/patrimonio/imports.test.mjs`, que já trata os dois falsos
positivos conhecidos.

Regra: pasta nova nasce com o guarda; ao mexer numa sem guarda, criar **antes** e
ver o que ele acusa.

### B2 · Relatórios › nunca foram vistos na tela real
O que foi verificado: 2359 testes, build, e os 8 relatórios rodando com os
catálogos reais num staging temporário **com banco de mentira**.
**Não** foram vistos dentro do app logado, com os 350 bens e os 10 carros reais.
Subiu assim porque o dono mandou subir sabendo. Volta fácil (`git revert` ou
Instant Rollback da Vercel).

### B1c · Banco de Arquivos › a permissão não controla o que promete 🔴
Achado em 11/08/2026 lendo `src/ferramentas/banco/tela-de-banco.vue` para escrever
a explicação da permissão. **Dois furos, e o segundo é de segurança:**

1. **Enviar arquivo não confere `criar`.** `onMounted` (~L156) chama
   `setupBancoUpload()` sem checar nada além de ter acesso à ferramenta. Quem tem
   só **"Só ver"** consegue subir arquivo.
2. **Excluir é gateado por `estado.role === 'admin'`** (~L92), que é outro campo,
   não a permissão granular. Consequência: dar **"Tudo"** no Banco para alguém
   **não** dá o poder de apagar, e quem é admin apaga mesmo sem "Tudo".

Ou seja, a escada de permissões desta ferramenta não manda em nada. É por isso
que ela ficou sem frase explicativa: não dá para escrever a verdade sobre níveis
que não valem.

### B1d · `sales.metas` está concedida a 12 pessoas e não faz nada
Nenhuma tela chama `hasPermission('sales.metas', ...)`. A escrita real em
`bling_metas` acontece em `tela-de-admin.vue` (~L2239) sem consultar essa chave.
A permissão existe no catálogo, aparece no editor, 12 pessoas a têm — e ela não
governa nada.

Decidir: ou a tela de Metas passa a respeitá-la, ou a chave sai do catálogo. Hoje
ela dá a impressão de controlar um acesso que está aberto por outro caminho.

### B1e · `exportar` prometido e não implementado em 3 ferramentas
`sales.gestao`, `sales.analise` e `meta.campanha` declaram a ação `exportar` no
catálogo, e não há nenhum código de download/CSV/PDF nessas telas. O editor de
permissões oferece o degrau **"Ver e baixar"**, que na prática é igual a "Só ver".

Foram as três que ficaram sem frase explicativa na Config de Usuários, porque
qualquer frase seria mentira.

### B2b · Patrimônio › 36 bens com a ficha incompleta
Medido em 11/08, dos 350 bens: **2 sem empresa** (os dois "Macbook Neo", nº 284 e
285 — também sem local e sem cômodo), **8 sem local** (os 5 REDMI 15C, o Samsung
A127M e os 2 Macbook) e **26 sem cômodo**. Categoria está em 100%.

Não é defeito da ferramenta: é ficha que nasceu sem o campo. Importa porque os
relatórios recortam por empresa e local — bem sem esses campos some do recorte e
só aparece em "Tudo".

### B3 · Frota › os caminhos de erro do checklist nunca foram vistos numa tela
Hodômetro pra trás, passar o carro pra outro, gravação falhando no meio. Têm
teste, mas ninguém abriu a tela e provocou.

### B4 · Estúdio da Fábrica › conferir a subida multi-loja
O bug era intermitente ("gerei e subiu só do Tivoli, faltou Dom Pedro"). O dono
acha que foi corrigido, mas **não há commit de correção nem teste cobrindo** — o
laço `for (const {slug,publico,orcamento} of alvosLoja)` em `subir-estudio.mjs`
(~linha 298) está igual. Ele pediu explicitamente pra manter o item vivo.

**Como conferir:** na próxima subida multi-loja, ver se **todas** as lojas
subiram, não só a primeira. Se falhar, o conserto barato é teste do laço + um log
por loja subida.

### B5 · Fábrica Hero-IA › trocar a composição pelo relight da foto real 💰
O motor `coletor/hero-ia/hero-ia.mjs` hoje compõe `[cena de fundo, recorte da
bolsa]` — e é isso que **embanana o texto da plaquinha**.

O que funciona (validado no laboratório e aprovado pelo dono em 23/07, **não
implementado**): passar a **foto real inteira** da bolsa, sem máscara, e pedir ao
gpt-image-2 pra gerar a cena em volta preservando a bolsa e a placa. Sai legível.

Junto vem **gerar N opções por look** pra curadoria (a geração é estocástica).
⚠️ **Money-path:** gpt-image-2 é pago, e N opções × muitos SKUs multiplica o
custo. Planejar com o teto `HERO_IA_MAX` em mente.

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

### B11 · Vendas › falta só olhar o telão 🟢 *quase fechado*
As três etapas estão no ar: a data da nota é coletada de hora em hora, e o
telão, a Análise de Vendas, a notificação das 22h/07h, os Relatórios Comerciais
e o briefing do Gestor **contam todos por ela**. A regra tem uma cópia só, em
`supabase/functions/_shared/data-da-venda.js`.

✅ **A notificação foi conferida ao vivo pelo dono em 11/08.** O push disparado
à mão mostrou R$ 1.829,74 — o MESMO valor do telão para o dia — e comparou com
ontem já corrigido (−25%; pela data do pedido teria dito −19%). Era esse o risco
que a Etapa 3 existia para eliminar: push e tela discordando do mesmo dia.

**O que falta é só um olhar:** ninguém abriu o telão logado depois da mudança.
Não dá Playwright neste projeto. Se algo parecer errado, o retorno é o Instant
Rollback da Vercel. Referência do que esperar: 04/08 sai de R$ 8.071,19 para
R$ 299,70; 05/08 sai de R$ 224,95 para R$ 7.996,44.

### B10 · Frota › F3 (multas) e F5 (custo por km) seguem travadas
As duas dependem de saber **quem estava com o carro no dia**. Em 05/08 `frota_uso`
tinha zero linhas; em 11/08 tem **10** — mas são as *posses* (o dono fixo de cada
carro), não o uso do dia a dia. O que alimenta o dia a dia é o checklist, e ele
tem **2 registros** (ver A1).

Ou seja: **ligar o aviso do A1 é o que destrava estas duas.**

O que está em jogo: das 26 multas (R$ 4.653,76), **5 são "não identificação do
condutor", R$ 1.301,60** — dinheiro perdido puramente por não saber quem dirigia.

---

## Parte C — Ideias guardadas (ninguém pediu ainda)

### C1 · Gestor de Tráfego › vigia de saldo com alerta antecipado
É o item **A** da fila B→C→A combinada com o dono (B = duplicar, feito; C = criar
campanha, feito).

Existe o push de saldo das 08h, mas o vigia antecipado não. ⚠️ Lembrar do que já
foi medido: **`balance` da Meta NÃO é saldo, é a fatura em aberto.** O saldo real
só existe como texto em `funding_source_details.display_string`, e o parse devolve
**null = "não sei"** — nunca zero.

Caso real que motivou: **Vessel com R$ 0,00 de saldo gastando R$ 460/dia** (29/07).

### C2 · Gestor de Tráfego › subir campanha por upload de criativo
Ideia do dono (12/07): subir campanha no Gestor com o criativo vindo de **upload**
(1 arquivo ou em massa), não gerado como no Estúdio. Requisito-chave é
**normalizar o formato sozinho** (PNG→JPG, achatar transparência, redimensionar
pros ratios de Feed 1:1 e Story 9:16).

Reaproveitar, não reconstruir: `fabrica_objetivos`, `criarCampanhaNova` e
`coletor/lib/meta-subir.mjs` já fazem a subida.

### C3 · Relatórios › as três sobras
- **5º relatório da Frota:** histórico completo de trocas por item, com período. O
  de Revisões é retrato de propósito — com filtro de data, o item **nunca** trocado
  sumiria justamente do relatório de vencidos.
- **Km sem ponto de milhar:** sai `47000` ao lado de um texto que escreve
  `2.000 km`. Formatar todo `tipo: 'numero'` colocaria ponto no "Nº" do Patrimônio,
  o que fica pior — precisaria de um tipo de coluna `km`.
- **Recorte pelo 3º nível (Ambiente).** `arvore-de-locais.js` já suporta.

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
