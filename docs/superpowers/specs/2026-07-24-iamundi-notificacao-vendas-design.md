# Notificação Diária de Vendas — iamundi

**Data:** 2026-07-24
**Status:** Design aprovado (brainstorm) → próximo: plano de implementação
**Pedido por:** Breno

## Objetivo

Enviar, todo fim de dia às **22h (horário de Brasília)**, uma **notificação push** no
celular com o resultado de vendas do dia, **consolidada num único push** com o total
geral + a quebra por canal de venda. Cada métrica traz a variação percentual vs o dia
anterior.

Métricas por canal e no total:
- **Quanto vendeu** (R$)
- **Quantas vendas** (nº de pedidos)
- **Quantos itens**
- Cada uma com o **% de variação vs o dia anterior**

## Decisões (aprovadas no brainstorm)

1. **Audiência:** opt-in aberto — qualquer usuário logado que ativar o 🔔 recebe
   (sem gating por permissão). Mesmo padrão do projeto Acólitos.
2. **Formato:** **1 push consolidado**. Título/linha 1 = total do dia (R$ + %); corpo =
   vendas/itens do total + quebra por canal. Tocar abre a Gestão à Vista.
3. **Modal de opt-in:** **insistente, só "Ativar agora"** — aparece ao abrir a Central
   toda vez que o usuário logado ainda não tiver inscrição; não bloqueia navegação;
   some ao ativar ou quando o navegador nega. Pula se `denied` / não-suportado /
   iOS fora da Tela de Início.
4. **Gatilho:** **pg_cron no Supabase** dispara a Edge Function às 22h BRT (01:00 UTC).
   Escolhido pela pontualidade — GitHub Actions (padrão atual do projeto) atrasa 2–3h
   nas horas cheias, documentado no próprio repo.
5. **Bling fora do ar às 22h:** **enviar mesmo assim, com aviso "dados parciais"** no
   corpo, em vez de suprimir a notificação.

## Arquitetura

```
[Front Vue] --inscreve--> tabela push_subs (Supabase)
     │  🔔 modal insistente + botão ativar (VAPID public embutida)
     ▼
[Service Worker novo /sw-push.js] handlers push + notificationclick
                                          ▲ web push
[pg_cron 22h BRT] --chama--> [Edge: enviar-push-vendas]
                                   │ 1. busca hoje+ontem no bling-proxy (pedidos/vendas, sit=9)
                                   │ 2. agrega por loja → bling_lojas (R$/vendas/itens + % vs ontem)
                                   │ 3. monta 1 payload consolidado
                                   │ 4. web-push pra todas as push_subs (poda 410/404)
```

### Contexto do projeto que molda o desenho

- **Não existe service worker** hoje na iamundi (só `manifest.webmanifest`). Web Push
  exige um SW → parte do trabalho é criar essa base do zero.
- **Gotcha de cache de PWA** (visto no erickIA): SW que cacheia `index.html` serve
  versão velha. → o `sw-push.js` é **mínimo e não cacheia nada**, só trata push.
- A Gestão à Vista **lê vendas ao vivo do Bling** via `bling-proxy`
  (`pedidos/vendas` com `dataInicial/dataFinal` e `idsSituacoes[]=9`), agrupando por
  `loja_id` → `bling_lojas`. **Não há tabela `pedidos`.** → o enviador replica essa
  agregação no servidor (Deno/Edge), buscando hoje + ontem no Bling.
- Backend do projeto = Supabase Edge Functions + GitHub Actions + coletor `.mjs`.
  (Não há pasta `/api` no Vercel — diferente do Acólitos, cujo enviador era `/api`.)

## Componentes

### 1. Service Worker `public/sw-push.js` (novo)
- Handlers `push` (mostra a notificação a partir do payload JSON) e `notificationclick`
  (foca/abre a aba na Gestão à Vista).
- **Sem cache** de nenhum recurso. Registrado no boot do app Vue.

### 2. Migration `push_subs`
- Colunas: `id`, `endpoint` (unique), `p256dh`, `auth`, `user_id`, `created_at`.
- RLS: dono gerencia a própria inscrição (insert/delete por `auth.uid()`); o envio
  usa **service role** (lê todas).

### 3. Front (Vue)
- Helper de inscrição: `urlBase64ToUint8Array`, `registerServiceWorker`,
  `subscribe`/`unsubscribe`, `upsert` da sub no Supabase.
- **VAPID pública** embutida no front; privada só nos secrets.
- **Botão 🔔** num canto fixo (ativar/desativar + status).
- **Modal insistente** ao abrir a Central: mostra se o usuário logado não tem sub e o
  navegador não negou; só o botão "Ativar agora".

### 4. Edge Function `enviar-push-vendas`
- Auth: espelha o padrão das Edges existentes; gate por service key.
- Passos: (1) busca `pedidos/vendas` de **hoje** e **ontem** via `bling-proxy`
  (`idsSituacoes[]=9`); (2) agrega por `loja_id`; (3) monta payload consolidado;
  (4) envia com `web-push` a todas as subs, **podando 410/404**.
- **Bling parcial/erro:** ainda envia, marcando "dados parciais" no corpo.
- Lógica de agregação vive num **módulo puro testável** (`vendas-do-dia.js`),
  no mesmo espírito de `estoque-gv.js`.

### 5. pg_cron
- Job às **01:00 UTC (22:00 BRT)** chamando a Edge via `net.http_post` com o
  service key nos headers.

## Fluxo do cálculo (22h)

- **"Hoje"** = 00:00→agora (BRT); **"ontem"** = dia anterior completo (BRT). Duas
  consultas ao Bling por range de data, `idsSituacoes[]=9`.
- Agrega por `loja_id`: `R$` (soma `total`), `vendas` (contagem de pedidos),
  `itens` (soma de itens).
- `% = (hoje − ontem) / ontem`. Se **ontem = 0** → exibe "novo"/"—" em vez de +∞.
- **Todos os canais** de `bling_lojas` aparecem; canal sem venda = **R$ 0,00**
  (igual à GV).

### Exemplo de payload/exibição

```
🔔 Vendas de hoje · R$ 7.200 (+9%)
32 vendas (+4%) · 76 itens (+2%)
──────────────
Tivoli      R$ 4.200 (+12%)
Dom Pedro   R$ 2.100 (−8%)
Shopee      R$ 900 (+30%)
```

## Erros e bordas

- **Bling fora do ar / timeout às 22h:** envia com aviso "dados parciais" no corpo
  e registra a falha nos logs da Edge.
- **Sub expirada (410/404):** podada da tabela durante o envio.
- **ontem = 0:** sem +∞; mostra "novo"/"—".
- **iOS:** push só funciona com o app na Tela de Início (16.4+) + permissão; o botão
  detecta e orienta.
- **Duplicidade de envio:** o pg_cron roda 1x/dia; a Edge é idempotente por execução
  (não relê estado entre dias).

## Testes

- **`vendas-do-dia.js`** (módulo puro): agregação por canal, cálculo de %,
  `ontem = 0`, canal sem venda, "dados parciais". Padrão de `estoque-gv.js`.
- **Smoke:** Edge sem auth → 401.
- **Modal/opt-in:** validação visual em harness standalone no scratchpad
  (não há Playwright logado na iamundi — o navegador de teste loga no erickIA).

## Deploy

- Branch `feat/notificacao-vendas` → PR em **brenoov/social-dashboard** (conta gh
  **brenoov**).
- Conferir deploy pelos **checks do commit** (MCP Vercel dá 403 neste projeto).
- Secrets **VAPID** (`VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`/`VAPID_SUBJECT`) nos
  secrets do Supabase (Edge). VAPID pública também embutida no front.
- Migration `push_subs` + agendamento pg_cron via MCP Supabase.

## Fora de escopo (YAGNI)

- Notificações separadas por canal (1 push por loja) — descartado a favor do consolidado.
- Gating por permissão / seleção de destinatários — opt-in é aberto.
- Notificações intra-dia ou configuráveis de horário — só o disparo fixo das 22h.
- Som customizado no push em background (navegadores removeram) — usa o som do sistema.
