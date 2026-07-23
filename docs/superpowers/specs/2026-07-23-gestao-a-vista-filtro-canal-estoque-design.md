# Gestão à Vista — filtro por canal + seção de estoque

**Data:** 2026-07-23
**Tela:** `src/ferramentas/gestao-a-vista/tela-de-gestao-a-vista.vue`
**Tipo:** feature (2 adições à tela existente, sem quebrar o que há)

## Objetivo

Duas features na Gestão à Vista:
1. **Filtro por canal de venda** — ver um canal por vez (ou todos), em vez de todos de uma vez.
2. **Seção de estoque por canal** — colapsável, no FIM da página (não atrapalha o resto), em colunas
   por canal, detalhada (SKU + nome + status + quantidade), com **busca, filtro de status, ordenação
   e limite (10/20/50/100/todos)**. Segue o filtro de canal.

Mockup aprovado: artefato `gestao-a-vista-filtro-estoque` (visual fiel ao telão real).

## Decisões travadas (do brainstorm + mockup)

- **Filtro = chips** numa barra logo abaixo do topbar: `[Todos] [Shopping Tivoli] [Shopping Dom Pedro]
  [Atacado Nuvem Shop] …` (um por canal presente). Ao selecionar um canal, TUDO filtra: velocímetro
  "Vendas Geral" (vira o agregado do canal), velocímetros pequenos "Venda por canal", os dois rankings
  e a seção de estoque. "Todos" = comportamento atual.
- **Estoque colapsável** (fechado por padrão), posicionado **depois do board e ANTES do rodapé**
  (o rodapé/ticker continua sendo o último elemento da página).
- **Colunas por canal**, só pros canais que têm depósito (estoque). Cada linha: SKU + nome + pill de
  status (OK/Baixo/Crítico) + quantidade. Controles no topo da seção: busca (SKU/nome), status
  (Todos / Baixo+crítico / Só crítico), ordenar (Estoque ↑ crítico-primeiro / Estoque ↓ / SKU / Nome),
  mostrar (10/20/50/100/Todos). Contador "mostrando X de Y".
- **Status por quantidade** (limiar a confirmar com o dono; default do mockup: ≤3 crítico, ≤8 baixo,
  resto OK). Idealmente por SKU (ponto de reposição), mas v1 pode usar limiar global.
- **Rodapé fica como está** — já cicla Últimos pedidos / Itens mais vendidos / Citações
  (`_gvTickerSlides` + `_GV_QUOTES`). Fora de escopo.

## Fonte do dado de estoque (a peça de backend)

Hoje **não existe** tabela de estoque que a tela leia. O estoque vem do Bling via
`coletor/lib/bling-comercial.mjs` → `blingSaldoFoco(token, prodMap)` que devolve saldo por
**depósito foco** por produto. Depósitos (DEP_FOCO):
- Shopping Tivoli (Santa Bárbara) — `14888726315`
- Shopping Dom Pedro — `14888617206`
- **Estoque Pulmão** (= "Atacado Nuvem Shop (Estoque Pulmão)") — `14888248253` — é o **backstock central**.

**Decisão do dono (2026-07-23):** o **Pulmão SEMPRE aparece** na seção de estoque (é o estoque central
que abastece todos os canais). Ao filtrar uma loja específica (ex.: Tivoli), a seção mostra **aquela
loja + o Pulmão**. Em "Todos", mostra as 3 (Tivoli, Dom Pedro, Pulmão). Usar o **nome REAL do depósito**
(como vier do Bling/`bling_lojas`; o Pulmão pode aparecer como "Estoque Pulmão" — confirmar o rótulo real
na coleta, não inventar).

**✅ BACKEND JÁ EXISTE — feature é SÓ DE FRONT.** A tabela **`gc_estoque_item`** (migration 012,
`deposito_id bigint, sku text, produto text, categoria text, saldo int, atualizado_em`, PK
(deposito_id, sku), RLS SELECT `authenticated`) **já é coletada** pelo coletor
`coletor/relatorios-comerciais.mjs` (cron diário) e já é lida pela tela de Relatórios Comerciais.
Dados frescos verificados (2026-07-23): Pulmão `14888248253` = 672 SKUs/652.686 un;
Tivoli `14888726315` = 443/2.464; Dom Pedro `14888617206` = 366/688 (coleta de 21–22/07).

Então **NÃO precisa migration nem mexer no coletor**: o front lê `gc_estoque_item` (como já lê
`bling_lojas`/`bling_metas` via `sbClient.from`) e monta as colunas.
- **Mapa depósito → canal:** o filtro é por canal de venda (`loja.id` dos pedidos), o estoque é por
  `deposito_id`. Montar um mapa fixo dos 3 depósitos (DEP_FOCO: 14888726315→Tivoli, 14888617206→Dom
  Pedro, 14888248253→Estoque Pulmão) com o **nome real**. Casar o canal selecionado ao seu depósito
  (por nome/loja); canal sem depósito → mostra só o Pulmão.

## UI (na `tela-de-gestao-a-vista.vue`)

A tela é um monólito portado (VERBATIM, render imperativo via innerHTML). As adições seguem o mesmo
estilo pra não destoar:
- **Barra de filtro** (nova) entre `.gv-topbar` e `.gv-board`: chips (classes novas `gv-canalfiltro-*`
  pra não colidir com globais — ver [[project_iamundi_colisao_css_global]]). Estado `gvCanalSel`
  (default 'todos'). Ao mudar, re-filtra os `pedidos` por `loja.id` antes de recomputar o board
  (reusar o pipeline de cálculo que já existe, passando os pedidos filtrados) e re-render.
- **Seção de estoque** (nova) depois do `.gv-board` e antes do `.gv-ticker`: `<div class="gv-estoque">`
  colapsável (fechada por padrão), com os controles + `gv-stock-grid` (colunas por canal). Render
  imperativo lendo `bling_estoque`. Segue `gvCanalSel`.
- **Layout do telão:** a tela é `height:100vh` sem scroll. Com a seção fechada = barra fina no fim
  (acima do ticker). Aberta = a página passa a rolar (o telão cresce); ticker continua sendo o último
  elemento. Ajustar o container pra permitir esse scroll quando a seção abre (sem quebrar o modo telão
  fechado). No mobile (≤1024px) a tela já é scrollável.

## Fora de escopo (YAGNI, salvo pedido)

- Valor em R$ do estoque, alerta de ruptura automático, exportar CSV — deixar pra depois.
- Mexer no rodapé (já existe e funciona).
- Ponto de reposição por SKU (v1 usa limiar global de status; evoluível).

## Testes

- Front: lógica pura extraível (filtro por canal, sort/filter/limit do estoque, mapa depósito→canal)
  em módulo testável (`node:test`), como já se fez na Fábrica.
- SEM teste de coletor (não muda o coletor — `gc_estoque_item` já é coletada).
- Validação visual no telão (repro/Playwright): filtro re-filtra tudo; estoque abre/fecha no fim;
  busca/status/ordenar/mostrar combinam; Pulmão sempre visível; responsivo.

## Ligações

- Tela/velocímetros: [[project_topbar_pattern]] · coletor/estoque: [[project_iamundi_coletor]] ·
  Bling: bling-comercial.mjs (blingSaldoFoco/DEP_FOCO) · colisão CSS: [[project_iamundi_colisao_css_global]]
