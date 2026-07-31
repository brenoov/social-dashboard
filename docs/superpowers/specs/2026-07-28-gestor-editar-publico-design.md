# Gestão de Tráfego — Editar o público de um conjunto (design)

Data: 2026-07-28
Ferramenta: `src/ferramentas/gestao-trafego`
Status: aprovado, não implementado
Projeto: **C1** (primeiro pedaço do projeto C)

## Visão geral

Hoje, para mudar o público de um conjunto de anúncios que já está rodando, o
dono precisa sair do Gestor e abrir o Gerenciador da Meta. O Gestor nem
mostra qual é o público — ele só traz orçamento e status dos conjuntos.

Este projeto entrega um botão **👥 Público** em cada conjunto: mostra o que
está valendo hoje e permite mudar localização, idade, gênero, interesses,
públicos personalizados (incluídos e excluídos) e a chave do Advantage+.

## Objetivo / não-objetivo

**Objetivo**
- Ver o público de um conjunto de anúncios sem sair do Gestor.
- Editar, com aviso claro do que a mudança custa, e salvar direto no conjunto
  que está rodando.
- Aplicar de uma vez um público já montado no Estúdio (`fabrica_publicos`).
- Controlar o **Advantage+ como escolha explícita**, não como efeito colateral.

**Não-objetivo (decidido, não esquecido)**
- **Editar posicionamentos de veiculação** (onde o anúncio aparece: feed,
  story, reels). É o **C2**. Este projeto só precisa garantir que **não
  destrói** esse dado — ver "O perigo central".
- **Criar campanha ou conjunto novo** pelo Gestor. É o **C3**.
- **Copiar campanha para outra conta.** É o **C4**.
- **Trocar público na hora de duplicar.** É o **C5**, e depende deste.
- **Duplicar-e-editar-a-cópia como alternativa ao editar direto.** O dono
  escolheu editar direto com aviso (2026-07-28). Se a reclamação sobre
  reinício de aprendizado aparecer na prática, isso volta como enhancement.

## Decisão do dono: editar direto, avisando

Mudar o público de um conjunto ativo faz a Meta **reiniciar o aprendizado** —
a campanha volta à fase de teste e o custo costuma piorar por alguns dias.
Isso é comportamento da Meta, não do nosso código, e não tem como evitar
editando no lugar.

Foi oferecida a alternativa de sempre duplicar e editar a cópia (o duplicar
do projeto B tornou isso possível). **O dono escolheu editar direto, com
aviso claro antes de confirmar** — simples e direto, decidindo sabendo o
preço. O aviso é obrigatório, não opcional.

## O perigo central: o público é um pacote só

O `targeting` da Meta é **um objeto único** que carrega muito mais do que este
editor gerencia: onde o anúncio aparece (`publisher_platforms`,
`facebook_positions`, `instagram_positions`), em que aparelhos
(`device_platforms`), idiomas (`locales`), e o que mais a Meta acrescentar no
futuro.

**Se o código montar esse objeto apenas com os campos que edita e mandar de
volta, tudo que ele não conhece é apagado.**

Falha concreta: o dono entra para trocar uma cidade, salva, e sem nenhum
aviso o conjunto para de rodar no Instagram Stories. O anúncio segue ativo, o
dinheiro segue saindo, e nada na tela indica que algo mudou. Pior ainda por
ser exatamente o dado que o **C2** vai gerenciar depois.

**Regra:** `montarTargeting` **parte do objeto original e sobrescreve apenas
as chaves que o editor gerencia**. Tudo que ele não entende passa intacto. Há
um teste dedicado provando que um campo desconhecido sobrevive à ida e volta
— é o teste mais importante deste projeto.

É a mesma classe de erro que a revisão final do projeto B pegou: no duplicar,
copiar de menos em silêncio; aqui, apagar em silêncio.

## Arquitetura

```
src/ferramentas/gestao-trafego/
  publico-alvo.js        NOVO — módulo puro (sem tela, sem rede)
  publico-alvo.test.mjs  NOVO — testes do módulo
  tela-de-gestao-trafego.vue   botão + editor + ligação
```

Mesmo formato de `duplicar.js`, `ponderada.js`, `veredito.js`, `regua.js`,
`alvos.js` e `orcamento-hierarquia.js`: a lógica que erra feio fica pura e
testada; a tela só desenha.

**Por que não reaproveitar o editor do Estúdio** (`src/ferramentas/meta-ads/painel-subir.vue`,
que já tem busca de cidade com raio, exclusões, idade, gênero, interesses e
presets): duas razões, ambas verificadas no código.
1. O Estúdio é um componente Vue com template; o Gestor monta a tela na mão,
   em JavaScript imperativo. São jeitos diferentes de construir — encaixar um
   no outro mistura paradigmas dentro do mesmo arquivo.
2. Extrair um componente compartilhado exigiria mexer no Estúdio, que está em
   produção e é onde os anúncios são criados. Quebrá-lo para entregar uma
   melhoria de outra tela é um risco desproporcional — e é justo o tipo de
   mudança ampla que colide com a outra frente de trabalho.

O valor compartilhável está na **lógica** (traduzir o público, Advantage+,
exclusões), e essa fica no módulo puro. O desenho da tela é o barato de
refazer.

Nota: `coletor/lib/publico.mjs` (`montarTargeting`) **não serve aqui** — o
front nunca importa nada de `coletor/` (verificado), aquilo roda em Node, e
resolve um problema diferente: montar público novo a partir de um preset +
loja, não ler-modificar-devolver um público existente.

### `publico-alvo.js` expõe quatro funções

- **`lerPublico(targeting)`** → forma simples de trabalhar:
  `{ cidades:[{key,nome,raio,unidade}], excluidas:[{key,nome,tipo}], idadeMin,
  idadeMax, generos:[], interesses:[{id,name}], incluir:[{id,name}],
  excluir:[{id,name}], advantagePlus:boolean }`.
  Público ausente ou vazio devolve a forma padrão, nunca erro.
- **`montarTargeting(publico, original)`** → o caminho de volta. **Parte de
  `original`** e sobrescreve só as chaves gerenciadas.
- **`resumoDasMudancas(antes, depois)`** → lista em português do que mudou:
  "Cidades: +Campinas, −Americana", "Idade: 18–65 → 25–45".
- **`avisosDe(antes, depois, { ativo })`** → os avisos que precedem o salvar.

## Fluxo do usuário

1. Botão **👥 Público** em cada conjunto de anúncios, ao lado do ⧉ Duplicar.
   Mesma permissão: `hasPermission('meta.gestor','editar')`.
2. Ao clicar, a tela busca o público daquele conjunto **sob demanda**
   (`GET /{adset_id}?fields=targeting`). O Gestor não traz esse dado hoje, e
   buscar de todos os conjuntos em toda carga deixaria a tela lenta.
3. Editor abre preenchido com o que está valendo: cidades e raios, exclusões,
   idade, gênero, interesses, públicos personalizados (incluídos e excluídos),
   e o Advantage+ como chave.
4. **Aplicar um público salvo do Estúdio** (opcional): uma lista dos públicos
   de `fabrica_publicos` (a mesma tabela que o Estúdio usa, leitura liberada
   para autenticados). Escolher um **preenche o editor inteiro** com aquele
   público — não salva sozinho. O dono ainda vê o resumo do que mudou e
   confirma, igual a qualquer edição manual. Escolher um preset é uma forma
   rápida de preencher, nunca um atalho que pula a confirmação.
5. Ao salvar: janela mostrando **o que mudou** e **os avisos**, e só então a
   confirmação.
6. Confirmado: uma única chamada `POST /{adset_id}` com o `targeting` inteiro.
7. Recarrega a lista via `loadGtData()`, como as outras ações.

## Os avisos, antes de salvar

| Quando | O que a tela diz |
|---|---|
| Conjunto **ativo** | "Este conjunto está rodando. Mudar o público **reinicia o aprendizado da Meta** — o custo pode piorar por alguns dias até estabilizar." |
| **Desligou** o Advantage+ | "O Advantage+ será desligado. A partir daí idade, gênero e interesses passam a valer como limite de verdade." |
| **Ligou** o Advantage+ **tendo restrições manuais** | "Com o Advantage+ ligado, a Meta **recusa** idade, gênero e interesses definidos à mão. Para ligar o Advantage+ é preciso limpar essas restrições." |
| Raio abaixo do mínimo | "Ajustei o raio de Campinas de 5 km para 17 km — a Meta não aceita menos." |

**Advantage+ e restrições manuais não convivem** — e isto não é suposição:
`coletor/lib/publico.mjs` registra, validado ao vivo em 2026-07-12, que a Meta
**rejeita** segmentação manual de idade/gênero/interesses com o Advantage+
ligado (código 1870227). Por isso aquele módulo desliga o Advantage+
(`targeting_automation.advantage_audience = 0`) sempre que o usuário define um
público à mão.

Consequência para o editor: a chave do Advantage+ e os campos de idade, gênero
e interesses são **mutuamente exclusivos**. Ligar o Advantage+ com restrições
preenchidas não pode ser oferecido como se fosse funcionar — a tela avisa e
exige que o dono escolha um dos dois. Deixar o dono salvar e tomar um erro da
Meta seria transferir para ele um conflito que a ferramenta já conhece.

Com o conjunto **pausado**, o aviso de aprendizado **não aparece** — não há
aprendizado a perder, e aviso que aparece sempre é aviso que ninguém lê.

O ajuste de raio mínimo (17 km / 10 milhas) é a mesma regra que
`coletor/lib/publico.mjs` já aprendeu ao vivo em 2026-07-12 (código 1487110).
Aqui ele é **relatado**, não aplicado em silêncio.

## Quando a Meta recusa

Reaproveitando o tradutor de erros que a tela já tem:

- **1870227** → "A Meta recusou porque o Advantage+ está ligado neste
  conjunto. Desligue o Advantage+ aqui no editor para que idade, gênero e
  interesses valham."
- **1487110** → raio abaixo do mínimo (já prevenido pelo ajuste, fica a rede).
- **Sem `ads_management`** → mesmo texto que a tela já usa.
- **Limite de chamadas** → espera e tenta de novo, reusando o `comEspera` de
  `duplicar.js`.

**Nada é salvo pela metade:** é uma chamada só, com o pacote inteiro. Ou vai
tudo, ou não vai nada. Diferente do duplicar, aqui não existe "parou no meio".

## A consulta nova: públicos personalizados

Para incluir/excluir públicos personalizados e semelhantes, é preciso a lista
da conta (`GET /act_X/customaudiences`) — dado que o Gestor não busca hoje.
Buscado **uma vez por conta**, na primeira abertura do editor, e reaproveitado.

**Se essa busca falhar, o editor continua funcionando:** os demais campos
ficam normais e a área de públicos personalizados diz "não consegui carregar
seus públicos salvos". Uma lista opcional que não carrega não pode derrubar a
edição de cidade e idade.

## Testes (`publico-alvo.test.mjs`, rodam com `npm test`)

Todos no módulo puro. Nenhum toca na Meta.

1. **Um campo desconhecido sobrevive à ida e volta.** O teste mais importante
   do lote: é o que garante que editar a cidade não apaga o Instagram Stories.
   Inclui explicitamente `publisher_platforms` e `instagram_positions`, que
   são o território do C2.
2. `montarTargeting` sobrescreve **apenas** as chaves gerenciadas.
3. Advantage+ ligado e desligado escrevem `targeting_automation` certo nos
   dois sentidos.
3b. Advantage+ ligado **com** restrições manuais preenchidas produz o aviso de
   conflito — a função não deixa a combinação passar calada.
3c. Aplicar um público salvo preenche todos os campos do editor, e o resultado
   é indistinguível de ter digitado aquilo à mão (mesmo `montarTargeting`,
   mesmo resumo, mesma confirmação).
4. Raio abaixo do mínimo é ajustado **e o ajuste é relatado**, não silencioso.
5. Públicos personalizados: incluir e excluir não se misturam.
6. `resumoDasMudancas` produz frase legível para cada tipo de campo.
7. Aviso de aprendizado só aparece com o conjunto ativo.
8. Público vazio, ausente ou malformado não quebra.

## Segurança

Mesma regra do duplicar: `hasPermission('meta.gestor','editar')`, o critério
mais rígido que a ferramenta usa. Sem a permissão, o botão não é desenhado.

Confirmação obrigatória antes de qualquer escrita, mostrando o que mudou e os
avisos. **Não estender `_gtConfirm`** — é o portão sim/não compartilhado por
todas as ações da tela, marcado no código como preservado verbatim; a janela
do público é função própria, como a do duplicar.

Texto vindo da Meta (nome de cidade, de interesse, de público, mensagem de
erro) passa por `_gtEsc` antes de ir para `innerHTML` — a tela monta o DOM com
`innerHTML`, então nome não escapado é caminho de injeção.

## Riscos / pontos a verificar

- **Destruir chaves não gerenciadas do `targeting`** — o risco número um deste
  projeto. Mitigado por partir do original + teste dedicado. Verificar isso
  primeiro em qualquer revisão.
- **Campos que a Meta talvez não deixe editar depois de criado.** É plausível
  que alguns atributos de targeting sejam imutáveis pós-criação dependendo do
  objetivo da campanha. **Isto NÃO foi pesquisado nesta sessão** — está aqui
  como suspeita, não como fato verificado. Pesquisar na documentação antes de
  implementar; e, de todo modo, tratar a recusa da Meta como caminho normal
  (mensagem clara para o dono), não como bug.
- **Colisão com a outra frente de trabalho:** ela trabalha em `ponderada.js`,
  `veredito.js`, `alvos.js`, `painel-regua.js` e na aba "A régua". Este projeto
  só encosta no `.vue` para o botão e o editor. Antes de subir: buscar a
  `main`, juntar, rodar `npm run test:ci` e `npm run build`.
- **Dependência do projeto B:** este projeto reusa `comEspera` de
  `duplicar.js`, que ainda **não foi subido** (12 commits locais). Os dois
  sobem juntos ou o C1 sobe depois do B.

## Projetos irmãos

- **C2** — editar posicionamentos de veiculação. Herda o módulo puro deste
  projeto: o `targeting` é o mesmo objeto, e a regra de preservar chaves não
  gerenciadas já estará valendo.
- **C3** — criar campanha do zero no Gestor. O maior; pede sessão própria e
  provavelmente nova decomposição.
- **C4** — copiar campanha para outra conta (recriar + re-subir imagens).
  Depende do C3.
- **C5** — trocar criativo/público ao duplicar. Depende deste e do B.
- **A** — vigia de saldo com alerta antecipado. Independente de tudo isso.
