# Estúdio (Fábrica de Anúncios) — SP-5: Gestão de templates/looks + Canva

**Data:** 2026-07-12
**Status:** aprovado no brainstorm, aguardando revisão do spec
**Relação:** quinto dos 6 sub-projetos do Estúdio (SP-1..SP-4 no ar). Evolui a feature em `/fabrica-estudio`; concretiza o placeholder "Looks & Templates (em breve)" da Home (SP-2).

## Objetivo

Hoje os looks (templates de criativo) são **funções de render HTML em código** (`coletor/templates-criativos/templates.mjs`: 13 looks — 11 de oferta + 2 de branding — cada um com `nome/arquetipo/objetivos`, renderizados por puppeteer nos 2 formatos 1080×1350 e 1080×1920). Não há UI pra vê-los nem geri-los, e não dá pra adicionar looks novos sem editar código. O SP-5 dá: (Fase A) uma **galeria com preview + curadoria** (ligar/desligar, ordenar, renomear, editar objetivos) dos looks atuais; (Fase B) **conectar o Canva** como fonte de novos looks — brand templates com **autofill por produto** e **import de design pronto**.

## Decisões travadas no brainstorm

- **Escopo:** curadoria dos looks existentes **+ Canva**, no mesmo SP (não é editor visual dos looks — isso exigiria reescrever a arquitetura de render, fora de escopo).
- **Canva — os dois modelos:** brand template com **autofill** (vira um "look" automatizado por produto) **E** import de **design pronto** (asset avulso).
- **Acesso Canva:** o Breno **registra um app OAuth do Canva Connect**; a geração roda no GitHub Actions (headless), onde o MCP do Canva não existe — então o autofill/export sai pela **API do Canva Connect** via uma Edge `canva-proxy` (padrão meta-proxy/bling-proxy).
- **Faseamento A→B:** Fase A (curadoria+preview) é self-contained e vai ao ar antes; Fase B (Canva) entra quando o OAuth estiver pronto.
- **Looks viram dados curáveis, render fica em código:** tabela `fabrica_looks` unifica code-looks (metadata) e canva-looks (novos). O registry em `templates.mjs` segue sendo a fonte do *render* dos code-looks.

## Modelo de dados — `fabrica_looks` (unifica código + Canva)

Migration `024_fabrica_looks.sql`. Colunas:
- `chave text primary key` — p/ code-looks = a chave do registry (`produto-heroi`…); p/ canva-looks = slug gerado.
- `nome text`, `arquetipo text` (produto/promo/branding), `objetivos text[]` (editável), `ativo boolean default true`, `ordem int default 0`
- `preview_url text` — PNG de amostra (galeria)
- `tipo text` — `codigo` | `canva`
- Canva: `canva_formato_map jsonb` (`{ '1080x1350': <brand_template_id>, '1080x1920': <brand_template_id> }` — Feed/Story podem ser templates diferentes), `campo_map jsonb` (`{ nome:'<campo>', preco_de:'<campo>', preco_por:'<campo>', oferta:'<campo>', foto:'<campo>' }` — dado do produto → nome do campo do brand template)
- `criado_por uuid`, `created_at timestamptz default now()`
- RLS: leitura `authenticated`; escrita só service-role (via Edge `fabrica-looks`).

**Sync do código:** um seed/rotina popula `fabrica_looks` com os 13 code-looks (a partir do registry: chave/nome/arquetipo/objetivos, `tipo='codigo'`, `ativo=true`). Idempotente (`on conflict (chave) do update` só de nome/arquetipo/objetivos default se ainda não curados — ou `do nothing` + uma rotina de sync que insere os que faltam sem sobrescrever curadoria). Decisão: **insere os que faltam, não sobrescreve `ativo`/`ordem`/`objetivos` já editados** (a curadoria do usuário vence).

## O gerador lê `fabrica_looks`

`gerar-criativos.run()` passa a montar a lista de looks a partir de `fabrica_looks` **ativos** (em vez de só `Object.keys(TEMPLATES)`), cruzando com o filtro de objetivo (SP-3, `objetivosDoTemplate`/`looksDoObjetivo`) e a ordem. Para cada look:
- `tipo='codigo'` → `TEMPLATES[chave].render(dados, formato)` + puppeteer (como hoje).
- `tipo='canva'` → autofill+export via `canva-proxy` (Fase B): monta os dados do produto no `campo_map`, chama o Canva, baixa o PNG.
Downstream idêntico (upload pro bucket `fabrica-criativos` + linha em `fabrica_criativos`; curar/subir/ativar não mudam). Um code-look sem entrada na tabela (ex.: recém-adicionado em código antes do sync) continua funcionando via fallback pro registry, mas o caminho canônico é a tabela.

## Fase A — galeria + preview + curadoria

- **Rota `/fabrica-estudio/looks`** (gate `meta.fabrica`), nova tela `tela-de-fabrica-looks.vue`, estética `.fest`. O card "Looks & Templates" da Home (SP-2) passa a linkar pra cá (deixa de ser placeholder).
- **Galeria:** um card por look de `fabrica_looks` (order by `ordem`): `preview_url` (imagem), nome, arquétipo, chips de objetivo, toggle **ativo**, botões subir/descer (ordem), renomear, e editor dos **objetivos** (quais objetivos o look serve).
- **Preview:** um job novo `tipo:'preview'` (`fabrica_jobs`, disparado por `fabrica-trigger`, roda no Actions) renderiza **cada** look com **dados de amostra fixos** (foto de bolsa embutida + De R$X / Por R$Y / 50%) nos 2 formatos → sobe pro Storage (`fabrica-criativos/_previews/<chave>-<formato>.png`) → grava `fabrica_looks.preview_url`. Botão "Gerar previews" na tela. (Canva-looks: preview = export de amostra do template — Fase B.)
- **Edições** (ativo/ordem/nome/objetivos) salvam via Edge **`fabrica-looks`** (`{acao:'salvar'|'ordenar', ...}`), gate `meta.fabrica`; leitura direta por RLS.

## Fase B — Canva

- **`canva-proxy` (Edge):** guarda o token do Canva Connect (OAuth; refresh token → access token), gate `meta.fabrica`. Expõe as operações necessárias: **listar brand templates**, **get dataset** (campos de um template), **create design from brand template** com autofill (dados + assets), **export** (PNG) + poll do export, **upload asset** (foto do produto). Segue o padrão do meta-proxy (token no Edge, front/coletor chamam via `{op, params}`).
- **Adicionar look Canva (autofill):** na tela de Looks, "Novo look do Canva" → lista brand templates (canva-proxy) → escolhe um → busca os campos (dataset) → o usuário **mapeia** dado do produto → campo do Canva (`campo_map`) e associa o brand template a cada **formato** (`canva_formato_map`) → salva como `fabrica_looks` (`tipo='canva'`, objetivos escolhidos). Preview = export de amostra.
- **Gerar com look Canva:** no `gerar-criativos`, para `tipo='canva'`: por produto/formato, sobe a foto como asset (canva-proxy upload) → create-design-from-brand-template com o `campo_map` preenchido → export PNG → baixa → sobe pro `fabrica-criativos` → linha em `fabrica_criativos` (mesmo downstream).
- **Importar design pronto (avulso):** ação à parte na tela da campanha/Curar — puxar o export de um **design específico** do Canva (por id/link) OU **upload de PNG** → normaliza formato (png→jpg/resize pros ratios aceitos) → entra como criativo avulso da rodada (`fabrica_criativos`), sem virar look reutilizável. Reusa a ideia de normalização do backlog do Gestor.

## Segurança / cuidados

- Tudo continua **PAUSED**; SP-5 é geração/curadoria, não ativa nada.
- `fabrica_looks` leitura authenticated, escrita via Edge gated (`meta.fabrica`).
- Token do Canva só no `canva-proxy` (Edge), nunca no front; refresh server-side. Nada de segredo no repo.
- Curadoria não apaga code-looks do código — desativar só marca `ativo=false` (o render segue existindo). "Excluir" um look = desativar (code) ou remover a linha (canva).
- Preview usa dados de amostra fixos (sem tocar em produto real).

## Testes

- **node:test puros:** sync/merge registry↔`fabrica_looks` (insere faltantes, não sobrescreve curadoria); `looksAtivosParaObjetivo(fabricaLooks, objetivo)` (cruza ativo+objetivo+ordem); `montarAutofillCanva(campo_map, produto)` (dado→campo); dispatch código vs canva no gerador.
- **Edge:** `fabrica-looks` (gate; salvar/ordenar); `canva-proxy` (gate; ops) por deploy+smoke.
- **Front:** `vite build` + smoke (galeria, toggle/ordem/rename, gerar previews; Fase B: adicionar look Canva + mapear campos).
- **Ao vivo (checkpoint):** previews renderizam (Fase A); autofill+export do Canva produz 1 PNG de teste (Fase B) — reusar o padrão dos validadores do SP-3/SP-4.

## Checkpoints do mundo real

- **Fase A:** migration 024 (`fabrica_looks`) + sync dos 13 code-looks + deploy Edge `fabrica-looks` (MCP) + rodar o job de previews + merge/push.
- **Fase B:** **o Breno registra o app Canva Connect** (client id/secret + OAuth, escopos de brand template/design/asset/export) + guarda os secrets → deploy `canva-proxy` (MCP) → validar autofill+export ao vivo → merge/push.

## Fora de escopo (próximos)

- **Editor visual dos looks pela UI** (render data-driven) — não agora.
- **Toggle de look por marca** — global por ora; per-marca é futuro (a fundação multi-marca do SP-2/SP-4 permite depois).
- **Upload de criativos no Gestor de Tráfego** ([[project_iamundi_gt_subir_campanhas]]) — feature própria.
- **SP-6 tutorial interativo.**

## Referências

- `coletor/templates-criativos/templates.mjs` (registry TEMPLATES + `objetivosDoTemplate`), `coletor/gerar-criativos.mjs` (`run()` passa a ler `fabrica_looks`), `coletor/lib/objetivos.mjs` (filtro por objetivo, SP-3), `coletor/lib/render-criativo.mjs` (puppeteer).
- `supabase/functions/fabrica-trigger` (novo `tipo:'preview'`), nova `fabrica-looks`, nova `canva-proxy`. Padrão de Edge/token: `meta-proxy`, `bling-proxy`.
- Front: `src/ferramentas/meta-ads/tela-de-fabrica-home.vue` (card Looks vira link), nova `tela-de-fabrica-looks.vue`, `estudio.css`. Rotas: `src/mapa-de-enderecos.js`.
- Tabelas: `fabrica_looks` (migration 024), `fabrica_criativos`/`fabrica_jobs`/`fabrica_campanhas` (existentes). Canva via MCP na doc/sessão interativa; no runner via `canva-proxy`.
