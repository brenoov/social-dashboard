# Estúdio (Fábrica de Anúncios) — SP-6: Tutorial interativo

**Data:** 2026-07-13
**Status:** aprovado no brainstorm, aguardando revisão do spec
**Relação:** sexto e último dos 6 sub-projetos do Estúdio (SP-1..SP-5 Fase A no ar). Puro front, evolui a feature em `/fabrica-estudio`.

## Objetivo

A Fábrica de Anúncios virou uma ferramenta rica (Home/panorama, wizard Gerar→Curar→Subir→Conferir, seletor de objetivo, localização+público, galeria de looks) e falta orientar quem chega. O SP-6 adiciona um **tutorial interativo** leve, em três mecanismos que compartilham o mesmo conteúdo: um **checklist "Primeiros passos"** na Home (o mapa do fluxo), um **tour guiado (coach-marks)** na Home (a visão geral), e **tooltips "?"** por tela (ajuda profunda no lugar). É a cereja — YAGNI, sem virar subsistema.

## Decisões travadas no brainstorm

- **Três mecanismos, um conteúdo:** checklist + coach-marks + tooltips "?" — todos consomem um módulo único `tutorial-fabrica.js` (sem duplicar texto).
- **Coach-marks são single-screen (só a Home):** destacam as regiões da Home; NÃO navegam entre rotas (evita a fragilidade de coach-mark cross-route). A ajuda por tela vem dos tooltips "?".
- **Gatilho do tour:** auto-abre na **1ª visita** (grava `visto` no localStorage), nunca mais sozinho; um botão **"Rever tour"** na Home reabre sob demanda.
- **Persistência = localStorage versionado** (`fabrica_tour_v1`, `fabrica_checklist_v1`) — versionar permite reexibir se a ferramenta mudar muito. Por-navegador (cross-device fica pra um dia, via coluna em `profiles`).
- **Puro front:** sem backend, migration, Edge. Estética `.fest`. Gate `hasPermission('module:meta:fabrica')` (a feature já é gateada).

## Componentes

- **`src/ferramentas/meta-ads/tutorial-fabrica.js`** — o conteúdo: 
  - `CHECKLIST` = `[{ id, titulo, texto, rota }]` (5 itens; `rota` = nome da rota vue-router pra o botão "ir").
  - `COACH` = `[{ selector, titulo, texto }]` (~5 passos da Home; `selector` = seletor CSS/`data-tour` do elemento a destacar).
  - `AJUDA` = `{ <chaveTela>: { titulo, itens: [{ termo, texto }] } }` (texto dos "?" por tela: gerar/curar/subir/conferir/looks).
- **`src/ferramentas/meta-ads/tour-coachmark.vue`** — overlay caseiro. Props: `passos` (lista `{selector,titulo,texto}`), `modelValue` (aberto). Para o passo atual: acha o elemento por `selector`, mede com `getBoundingClientRect`, desenha um recorte/realce em volta + um balão `.fest` com título/texto e botões **Anterior/Próximo/Pular**. Fecha no fim ou no Pular. Se o `selector` não achar o elemento, pula aquele passo (resiliente). Respeita `prefers-reduced-motion`. Reposiciona no `resize`/`scroll`.
- **`src/ferramentas/meta-ads/ajuda-tooltip.vue`** — o "?" reutilizável. Prop `chave` (uma chave de `AJUDA`); renderiza um ícone "?" que, ao clicar, abre um balão `.fest` com o `titulo` + a lista de `{termo,texto}` daquela tela. Fecha com clique fora/ESC.
- **Checklist** — um card **na `tela-de-fabrica-home.vue`** que renderiza `CHECKLIST`: cada item com título + frase + botão "ir" (`router.push({name: item.rota})`). Marca ✓ por item (localStorage `fabrica_checklist_v1`, setado ao clicar "ir"); onde é barato, deriva de dado real (ex.: item "Publique" marca ✓ se `publicadas.length > 0` — a Home já carrega isso no SP-2). Card dismissável ("ocultar"); um link "mostrar primeiros passos" reabre.

## Onde cada peça vive

- **Home (`tela-de-fabrica-home.vue`):** o card **Primeiros passos** (checklist) + o botão **"Rever tour"** no topbar + a montagem do `<tour-coachmark>` (auto-abre 1x). Os elementos da Home ganham atributos `data-tour="..."` pros seletores do COACH baterem de forma estável (não depender de classes).
- **Tooltips "?":** um `<ajuda-tooltip chave="gerar"/>` no cabeçalho de `painel-gerar.vue`; idem `curar`/`subir`/`conferir` nos respectivos painéis e `looks` em `tela-de-fabrica-looks.vue`.

## Conteúdo (resumo — o texto final vai no módulo)

- **CHECKLIST (5):** 1) Crie uma campanha (Gerar: loja/objetivo/produtos/desconto) → rota `fabrica-nova`; 2) Cure os criativos (marque os melhores) → o wizard (`fabrica-campanha`); 3) Publique pausado (Subir: destino + localização/público; sobe PAUSED) → wizard; 4) Confira e ative (revise, ative com confirmação de gasto) → wizard; 5) Gerencie os looks (ligue/desligue templates, gere previews) → rota `fabrica-looks`.
- **COACH (~5, Home):** botão Nova campanha → cartões de números → seção Em criação → Publicadas recentes → card Looks & Templates. Cada um: 1 frase do que é + o que fazer.
- **AJUDA "?" por tela:** gerar (objetivo/fonte/desconto/curadoria de produtos), curar (marcar/lightbox), subir (destino nova vs existente, localização+público, "tudo sobe pausado"), conferir (ativar tudo + aviso de gasto real), looks (ativo/ordem/gerar previews).

## Segurança / cuidados

- Nada toca dado sensível nem o Meta; é UI/orientação. Nenhuma ação ativa campanha.
- Não bloquear o uso: o tour é dispensável a qualquer momento (Pular/ESC/clique fora); o checklist é ocultável; os "?" são sob demanda.
- Resiliência: coach-mark que não acha o alvo pula o passo (a UI pode mudar). Reposiciona em resize/scroll.
- Acessibilidade: foco visível nos botões do tour, `prefers-reduced-motion`, ESC fecha.

## Testes

- **Puro front** (sem backend). `npm run build` limpo.
- **Helper puro testável** (se extraído): `proximoPassoPendente(feito, checklist)` → o 1º item não-concluído (node:test simples). O resto (overlay/tooltip/localStorage) é UI → smoke manual.
- **Smoke:** tour auto-abre 1x (e não reabre após visto); "Rever tour" reabre; coach-marks destacam os elementos certos e pulam alvo ausente; checklist marca ✓ ao ir / deriva do dado; "?" abre/fecha em cada tela; dispensar/reabrir funciona; responsivo (mobile não estoura).

## Fora de escopo

- Coach-marks cross-route (só Home). Vídeo/GIF. "Visto" cross-device (localStorage por navegador; futuro = coluna em `profiles`). Analytics do tour. i18n. Tour por papel/perfil.

## Referências

- `src/ferramentas/meta-ads/tela-de-fabrica-home.vue` (checklist + botão Rever tour + `<tour-coachmark>` + `data-tour`), `painel-gerar/curar/subir/conferir.vue` + `tela-de-fabrica-looks.vue` (`<ajuda-tooltip>`), `estudio.css` (`.fest` — estilos do overlay/balão/checklist). Novos: `tutorial-fabrica.js`, `tour-coachmark.vue`, `ajuda-tooltip.vue`.
- Padrão de persistência: localStorage (o app já usa pra prefs de UI — ver `tela-de-menu-meta-ads.vue`, LEIA-ME.txt).
