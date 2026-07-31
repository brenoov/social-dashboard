# Sugestão de interesses para montar público (design)

Data: 2026-07-29
Ferramentas: `coletor/` (robô), `src/ferramentas/gestao-trafego` e
`src/ferramentas/meta-ads` (as duas telas que consomem)
Status: aprovado, não implementado

## Visão geral

Montar um público hoje exige adivinhar interesses: você digita um palpite na
busca da Meta e escolhe entre o que aparece. Não há sugestão, não há noção de
quantas pessoas cada interesse alcança, e quem está começando do zero não tem
por onde começar.

Este projeto entrega uma **faixa de sugestões prontas** acima da busca de
interesses, nas duas telas onde se monta público — o editor do Gestor (projeto
C1) e a Fábrica de Anúncios. As sugestões vêm de um robô semanal que usa IA
para propor e a **própria Meta para validar**.

## Decisões do dono (2026-07-29)

1. **IA primeiro, sugestão da Meta depois.** Foi oferecido começar pela
   sugestão nativa da Meta (`adinterestsuggestion`), que é muito menor. O dono
   escolheu a IA porque a sugestão da Meta **exige um interesse já escolhido
   como semente**, e o problema real é justamente começar do zero.
2. **Robô pré-calcula, não IA sob clique.** Foi oferecida uma função de
   servidor chamando a IA a cada clique. O dono escolheu o robô semanal: a
   sugestão já está na tela quando abre, o custo é fixo em vez de crescer com
   o uso, e não se abre a porta de "IA sob clique" — que hoje não existe neste
   produto.
3. **A IA recebe só o que o projeto já sabe:** marca, lojas, cidades e o
   objetivo da campanha. **Sem campo de texto livre.**

## O que "reutilizar na Fábrica" significa aqui

**O que é compartilhado é o DADO, não a tela.** Um robô gera, uma tabela
guarda, e cada tela lê do seu jeito.

Isso foi escolhido de propósito. A Fábrica (`src/ferramentas/meta-ads/painel-subir.vue`)
está em produção e é onde os anúncios são criados; extrair um componente
comum exigiria reformá-la para entregar um recurso que também serve outra
tela. Aqui ela só ganha uma faixa de leitura. A parte cara — gerar e validar —
acontece **uma vez**, para as duas.

## Objetivo / não-objetivo

**Objetivo**
- Faixa de sugestões de interesse acima da busca, nas duas telas.
- Cada sugestão traz **nome, código real da Meta e tamanho estimado de público**.
- Um clique adiciona o interesse ao público em montagem.
- Custo fixo e visível.

**Não-objetivo (decidido, não esquecido)**
- **Sugestão nativa da Meta** (`adinterestsuggestion`, "mostrar parecidos" a
  partir dos já escolhidos). Projeto seguinte; complementa este, não substitui.
- **IA respondendo a um clique.** Porta que se decidiu não abrir agora.
- **Uma função genérica "perguntar à IA"** reutilizável por qualquer tela.
  Rejeitada: superfície genérica é a mais difícil de limitar, e não há segundo
  caso de uso real.
- **Sugestão por cidade do conjunto.** A sugestão é por marca × objetivo.
- **Editar as sugestões à mão.** Se a sugestão está ruim, quem muda é o robô.

## Viabilidade verificada

- `fabrica_marcas` guarda `account_id` (o mesmo `accountId` do `meta-proxy`) e
  `ad_account`. Da conta escolhida no Gestor **dá para chegar na marca**.
- `fabrica_lojas.marca_id` liga as lojas à marca, com `geo_cities`.
- O Gestor **já busca o objetivo da campanha** (`objective`, em `campFields`,
  `tela-de-gestao-trafego.vue:772`).
- A Fábrica já conhece loja e objetivo (fluxo do Estúdio).
- A Meta oferece `GET /search?type=adinterestvalid` com `interest_list`
  (nomes) ou `interest_fbid_list` (códigos), devolvendo `valid`, `id` e
  `audience_size` por termo.

**Ressalva:** hoje só existe **uma marca cadastrada** (La Vessel). Conta que
não bata com marca nenhuma precisa de caminho de saída — a faixa não aparece,
e a tela segue normal.

## Arquitetura

```
coletor/sugerir-interesses.mjs        NOVO — o robô semanal
coletor/lib/interesses.mjs            NOVO — parte pura (monta pedido, filtra retorno)
coletor/lib/interesses.test.mjs       NOVO — testes
db/migrations/2026-07-29-interesses-sugeridos.sql   NOVO — a tabela
src/ferramentas/gestao-trafego/tela-de-gestao-trafego.vue   faixa no editor (C1)
src/ferramentas/meta-ads/painel-subir.vue                   faixa na Fábrica
```

O robô segue o padrão dos irmãos que já existem (`budget-ia.mjs`,
`gestor-comercial.mjs`): Node em `coletor/`, disparado por GitHub Actions,
usando `structured()` de `coletor/lib-llm.mjs` e `registrarExecucao()` de
`coletor/registrar-execucao.mjs`.

## O robô, passo a passo

Roda **uma vez por semana**.

1. Lê marcas ativas (`fabrica_marcas`) e as lojas de cada uma (nome, cidades).
2. Para cada **marca × objetivo**, pede ao modelo uma lista de interesses
   candidatos (nomes). Hoje: **6 gerações por semana**.

   **As chaves de objetivo são as que já existem**, não uma lista nova:
   `engajamento`, `reconhecimento`, `trafego`, `mensagens`, `leads`, `vendas`
   — exatamente as de `src/ferramentas/gestao-trafego/alvos.js` (`ALVOS`).
   Inventar uma sétima nomenclatura garantiria divergência com a régua.
3. **Valida cada nome na Meta** (`adinterestvalid`). O que a Meta não
   reconhece é **descartado**.
4. Dos válidos, guarda `id` e `audience_size`.
5. Grava em `interesses_sugeridos` e anota a rodada em `ia_execucoes`.

**O passo 3 é o que sustenta a coisa.** Sem ele, a tela mostraria sugestões
bonitas que dariam erro na hora de usar — o pior tipo de ajuda, porque parece
funcionar até o momento em que importa.

**Modelo: Sonnet.** É montagem de lista, não análise profunda. O Opus que os
robôs de budget e comercial usam seria caro sem ganho.

**Risco conhecido, não resolvido de antemão:** os nomes de interesse na Meta
são sensíveis a maiúscula/minúscula e ao idioma. A IA pode escrever "Moda
feminina" onde a Meta tem "Moda Feminina". A validação descarta, e o robô
**registra quantos sobreviveram de quantos foram propostos**. Se a taxa de
aproveitamento vier baixa, o número aparece no log e o pedido é ajustado.
Não há como acertar isso de primeira sem medir.

## A tabela

`interesses_sugeridos` — uma linha por marca × objetivo:

| coluna | o que guarda |
|---|---|
| `marca_id` | referência a `fabrica_marcas` |
| `objetivo` | chave do balde (vendas, trafego, mensagens, leads, engajamento, reconhecimento) |
| `itens` | jsonb: `[{ id, nome, audience_size }]` já validados |
| `propostos` / `validos` | quantos a IA propôs e quantos a Meta reconheceu (para medir a taxa) |
| `modelo`, `gerado_em` | qual modelo e quando |

RLS no mesmo formato de `fabrica_publicos`: **leitura para autenticados,
escrita só service-role**. Ninguém edita essa tabela pela tela — se a sugestão
está ruim, quem muda é o robô.

## Como aparece nas telas

Faixa logo **acima da busca de interesses**, nas duas:

```
Sugestões para Vendas · La Vessel
[Bolsas 2,3 mi] [Moda feminina 8,1 mi] [Couro 940 mil] [Compras online 12 mi]
gerado em 25/07
```

- Cada etiqueta é clicável e entra na lista com um toque.
- O que já foi escolhido **some da faixa**, para não virar poluição.
- **O tamanho do público aparece** — hoje a escolha é às cegas: "Couro" e
  "Moda feminina" parecem equivalentes até se descobrir que um tem 940 mil
  pessoas e o outro 8 milhões.
- **A data de geração aparece**, para o dono saber se está vendo coisa velha.

**Sem sugestão, a faixa não aparece.** Marca nova, ou robô que ainda não
rodou, não vira caixa vazia pedindo desculpa: a busca continua funcionando
como sempre.

### Qual balde usar — o erro que este projeto já cometeu duas vezes

No Gestor, **não basta ler o `objective` da campanha e traduzir**. Campanha de
WhatsApp chega da Meta como `OUTCOME_ENGAGEMENT`, mas o que ela vende é
**conversa**, não curtida. A tela já sabe disso: `GT_OBJETIVO_BALDE` faz a
tradução base e o restante do código corrige o caso da mensagem olhando as
ações de conversa — foi assim que se corrigiu a régua, e o LEIA-ME da
ferramenta registra o episódio.

A faixa de sugestões **precisa usar a mesma decisão de balde que o resto da
tela**, não uma tradução própria. Uma campanha de WhatsApp recebendo
sugestões de engajamento seria a terceira vez que este produto comete o mesmo
erro de classificação.

Na Fábrica não há essa ambiguidade: o objetivo é escolhido no fluxo do
Estúdio, não inferido da Meta.

São duas implementações pequenas, porque as telas são construídas de jeitos
diferentes (o Gestor monta DOM em JavaScript; a Fábrica usa template Vue).
O dado e a inteligência, esses são os mesmos.

## Custo

Poucos centavos por semana: 6 gerações pequenas com Sonnet. Ordem de grandeza
menor que os robôs de budget e comercial, que usam Opus sobre campanhas
inteiras.

**Como é fixo por semana e não por clique, não cresce com o uso.** Abrir o
editor cem vezes por dia não muda nada.

O robô anota cada rodada em `ia_execucoes`, então o valor real aparece no
painel **Status do Claude**, em reais, com nome e data — o dono não precisa
acreditar em estimativa.

**Gotcha do custo:** o preço oficial mora em `coletor/registrar-execucao.mjs`
(`PRECO` + `calcularUsd`). O `lib-llm.mjs` tem uma tabela **antiga** que o
próprio código marca como "NÃO usar para custo". Usar a errada faz o painel
mostrar número falso.

## Segurança

- **Nenhum texto digitado por usuário entra no que vai para o modelo.** O
  pedido é montado só com dado do cadastro (marca, lojas, cidades, objetivo).
  Isso fecha a porta de injeção de instrução na IA — e é testado.
- A tabela é **somente leitura** pela tela; escrita só service-role.
- A faixa é leitura pura: não exige permissão nova. Adicionar um interesse é
  edição, e no Gestor isso já está atrás de `hasPermission('meta.gestor','editar')`.
- O robô roda com as chaves do ambiente do coletor, como os irmãos. Nenhuma
  chave nova no front — o repositório é público.

## Testes (`coletor/lib/interesses.test.mjs`)

Na parte pura, sem tocar na Meta nem na IA:

1. **O pedido é montado só com dado do cadastro.** Nenhum texto de usuário
   entra. É o teste que garante que ninguém injeta instrução na IA.
2. Interesse que a Meta não reconhece é **descartado**, não passa adiante.
3. Dos válidos, `id` e `audience_size` são preservados.
4. Interesse repetido entra uma vez só.
5. Validação que zera tudo não quebra, e a rodada é **registrada como tal** em
   vez de gravar lista vazia em silêncio.
6. Objetivo desconhecido não gera pedido.
7. Marca sem loja cadastrada não quebra o robô.
8. As chaves de objetivo do robô são **exatamente** as de `ALVOS` em
   `alvos.js` — nem a mais, nem a menos. É o teste que impede a nomenclatura
   de divergir da régua com o tempo.

## Riscos / pontos a verificar

- **Taxa de aproveitamento da validação.** É a incerteza principal. Medir na
  primeira rodada real antes de considerar o projeto pronto.
- **Uma marca só cadastrada.** O caminho "conta sem marca correspondente"
  precisa existir desde o começo, não como remendo.
- **Dependência do C1:** a faixa no Gestor vive dentro do editor de público,
  que ainda não foi implementado. A faixa na Fábrica **não** depende disso e
  pode ir antes.
- **Colisão com a outra frente de trabalho:** ela trabalha em `ponderada.js`,
  `veredito.js`, `alvos.js`, `painel-regua.js` e na aba "A régua". Este
  projeto encosta em `coletor/`, numa migration nova e em duas telas — pouca
  sobreposição. Antes de subir: buscar a `main`, juntar, rodar
  `npm run test:ci` e `npm run build`.

## Projetos irmãos

- **Sugestão nativa da Meta** (`adinterestsuggestion`): botão "mostrar
  parecidos" a partir dos interesses já escolhidos. Pequeno, sem IA, sem
  infraestrutura nova. Complementa este — um resolve começar do zero, o outro
  resolve expandir.
- **C1** — editar público no Gestor (spec e plano prontos). Hospeda a faixa.
- **C2/C3/C4/C5 e A** — ver `2026-07-28-gestor-duplicar-design.md`.
