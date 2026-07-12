# Estúdio (Fábrica de Anúncios) — SP-1: Polimento & navegação

**Data:** 2026-07-12
**Status:** aprovado no brainstorm, aguardando revisão do spec
**Relação:** primeiro de 6 sub-projetos da evolução do Estúdio rumo a uma "fábrica de anúncios de verdade" (decomposição aprovada: SP-1 polimento · SP-2 home+não-travar · SP-3 objetivo no passo 1 · SP-4 construtor de campanhas · SP-5 gestão de templates · SP-6 tutorial). Evolui a feature no ar (`/fabrica-estudio`).

## Objetivo

Tirar as "pontas soltas" mais irritantes da tela, com valor imediato e risco baixo. **Tudo front (Vue 3 + `.fest` CSS), sem backend/schema/Edge.** Quatro melhorias.

## 1. Marca-neutra no chrome

Hoje o cabeçalho crava "La Vessel" (herança do mockup): `src/ferramentas/meta-ads/tela-de-fabrica-estudio.vue:37` e `:90` mostram `Estúdio de Criativos · La Vessel`.

- Trocar por: **título "Fábrica de Anúncios"** (já é o título na linha 36) + **subtítulo "Estúdio de Criativos"** (sem marca) no topbar (`:37`); e o rodapé (`:90`) vira só `Estúdio de Criativos`.
- Confirmar por grep que não sobra nenhum "La Vessel" literal no chrome do módulo meta-ads (o card do menu já é neutro: `tela-de-menu-meta-ads.vue:55` = "Estúdio de Criativos").
- **Fora de escopo:** as legendas dos anúncios (já são data-driven via `fabrica_marcas.caption_template`) e o futuro seletor de marca (SP futuro). Aqui é só o chrome.

## 2. Botão "voltar pra Central"

Hoje só dá pra sair pelo botão voltar do navegador. Adicionar um botão discreto no topbar do estúdio que roteia pro hub ("Central").

- A Central é a rota **`inicio`** (`/`, `tela-de-inicio.vue`). O padrão do app é `function voltar(){ router.push({ name: 'inicio' }) }` (ex.: `tela-de-banco.vue:44`, `tela-de-menu-redes.vue:58`). Usar exatamente esse.
- Estilo `.fest`, no topbar (perto do relógio/título), com rótulo/ícone claro ("← Central"). Acessível (foco visível).

## 3. Marcar / desmarcar todos

Um controle **"Marcar todos / Desmarcar todos"** acima das duas listas de curadoria, aplicando só aos itens **visíveis** (respeita filtros/busca ativos).

- **`painel-gerar.vue`** (lista de produtos candidatos, estado `marcados` por sku): um botão/link que seta `marcados[sku]` de todos os candidatos atualmente listados para true (marcar todos) ou remove/false (desmarcar todos). Toggle inteligente: se todos já marcados → desmarca; senão → marca.
- **`painel-curar.vue`** (grid de criativos, `escolhido` persistido no banco): o "todos" faz **um update em lote** — `sbClient.from('fabrica_criativos').update({ escolhido: <valor> }).in('id', idsVisiveis)` — em vez de N updates individuais. Update otimista no estado local; em erro, reverter e avisar. Não tocar em criativos com `purgado_em` (não são exibidos/curáveis).
- Contador visível ("N de M marcados") ajuda a orientar.

## 4. Ver criativos completos + lightbox (Curar)

Hoje os cards do grid do Curar cortam a imagem (thumbnail). Duas mudanças em `painel-curar.vue` (+ CSS `.fest`):

- **(a) Card mostra a imagem inteira:** o `<img>` do card passa a caber inteiro (sem corte) respeitando a proporção real do criativo (Feed 1:1 e Story 9:16 aparecem completos — usar `object-fit: contain` ou dimensionar o card pela proporção). Continua sendo um grid pra curar rápido.
- **(b) Lightbox ao clicar:** clicar num card abre um overlay `.fest` com o criativo em tamanho grande + o toggle marcar/desmarcar ali dentro (mesma ação do card). Fechar com clique no fundo ou tecla ESC. Respeitar `prefers-reduced-motion`. O criativo com `purgado_em` mostra o placeholder (não abre lightbox de imagem inexistente).
- Implementar o lightbox como um pequeno componente próprio `src/ferramentas/meta-ads/visor-criativo.vue` (recebe o criativo + estado escolhido, emite toggle/close) OU inline no painel-curar — o que ficar mais limpo; se virar mais que ~40 linhas, extrair o componente.

## 5. Tema claro no Estúdio (adicionado durante a execução)

O app tem um toggle global de tema (`data-theme="dark"|"light"` no `<html>`, `moldura-do-aplicativo.vue`), mas o `.fest` do Estúdio é cravado no escuro — o botão de tema não afeta a tela. Fix: um override dos tokens `.fest` (mesmos nomes, valores claros) sob `:root[data-theme="light"] .fest`, mais desligar o glow de fundo no claro. Só `estudio.css`; os componentes adaptam via `var(--...)`. Paleta clara: fundo cool light, painéis brancos, texto escuro, âmbar/ciano/go/hold/abort ajustados pra contraste sobre claro.

## Arquivos

- Modify: `src/ferramentas/meta-ads/tela-de-fabrica-estudio.vue` (chrome + botão Central), `src/ferramentas/meta-ads/painel-gerar.vue` (marcar todos), `src/ferramentas/meta-ads/painel-curar.vue` (marcar todos + card inteiro + lightbox), `src/ferramentas/meta-ads/estudio.css` (grid/card/lightbox/botão).
- Create (se necessário): `src/ferramentas/meta-ads/visor-criativo.vue` (lightbox).
- Sem backend, sem migration, sem Edge.

## Testes

- `npm run build` limpo após cada mudança.
- Smoke manual (o repo não tem harness de front): chrome sem "La Vessel"; botão Central roteia pro hub; marcar/desmarcar todos alterna os dois grids (e persiste no Curar via update em lote); card do Curar mostra a imagem inteira e o clique abre/fecha o lightbox com toggle.

## Fora de escopo (próximos SPs)

- SP-2: home/panorama, "campanhas em criação", persistência, geração em background.
- SP-3: objetivo (conversão/branding/engajamento) no passo 1.
- SP-4: construtor de campanhas (por loja, objetivo, WhatsApp, públicos, avulso/remessa, vídeo).
- SP-5: gestão de looks/templates (+ Canva). SP-6: tutorial interativo.

## Referências

- Tela: `src/ferramentas/meta-ads/tela-de-fabrica-estudio.vue` (topbar `:36-37`, rodapé `:90`), `painel-gerar.vue` (estado `marcados`), `painel-curar.vue` (grid + `escolhido` + `purgado_em`), `estudio.css` (`.fest`).
- Rotas: `src/mapa-de-enderecos.js`. Padrão de navegação: `tela-de-menu-meta-ads.vue`.
