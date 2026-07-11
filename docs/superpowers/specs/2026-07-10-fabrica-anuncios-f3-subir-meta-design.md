# Fábrica de Anúncios — F3 (Subir Campanha no Meta) — Design

**Data:** 2026-07-10
**Fase:** F3 — última perna da esteira (criativos → campanha no Meta Ads)
**Status:** Design aprovado — pronto para plano
**Depende de:** F1 (seleção por loja) + F2a (criativos no Storage). URGENTE: subir 1ª campanha na conta La Vessel/Vessel.

---

## 1. Objetivo

Subir campanhas no **Meta Ads** a partir dos criativos gerados (F2a), **sempre PAUSADAS** (o humano ativa no Gerenciador). O motor é **parametrizado por tipo de campanha** (WhatsApp / Link / Instagram); a primeira entrega são **2 campanhas WhatsApp por loja** (Tivoli, Dom Pedro). Verba de mídia é dinheiro → o motor **valida cada passo** e nunca ativa nada sozinho.

---

## 2. Base técnica (já existe — sem bloqueador)

- **`meta-proxy`** (Edge Function, `verify_jwt=true`) é um **proxy genérico do Graph API v22.0**: recebe `{accountId, path, params, method}` e faz GET/**POST**/DELETE em `graph.facebook.com/v22.0{path}` com o `access_token` da conta (lido de `public.accounts`). Gate: `profiles.role='admin' OR features inclui 'meta'`. **Criar campanha/adset/creative/ad = `method:'POST'` no path certo — não precisa mexer no proxy.**
- **`public.accounts`** tem por conta: `access_token`, `ad_account_id`, `page_id`, `instagram_id`. Conta **Vessel** (`@vessel.brasil`, id `b6883e82-07cb-4f21-9fd7-ea7626786174`): `ad_account_id=1197997517858139`, `page_id=324679337390168`, `instagram_id=17841462952561833`.
- **Criativos** em `public.fabrica_criativos` (F2a) com `url` público no Storage, `arquetipo` (produto/promo), `candidato_id` (→ loja via `fabrica_candidatos`), `formato`.

---

## 3. Estrutura da 1ª entrega (WhatsApp, PAUSADA)

```
act_1197997517858139 (Vessel) · WhatsApp · tudo PAUSED
├─ Campanha TIVOLI
│   ├─ Conjunto "Geral"    — R$50/dia · geo: Santa Bárbara d'Oeste + Americana · público aberto · ads = PROMO 50% OFF
│   └─ Conjunto "De x Por" — R$50/dia · geo: idem · ads = 20 produtos ESTRELA (estoque Tivoli)
└─ Campanha DOM PEDRO
    ├─ Conjunto "Geral"    — R$50/dia · geo: Campinas · ads = PROMO 50% OFF
    └─ Conjunto "De x Por" — R$50/dia · geo: Campinas · ads = 20 produtos ESTRELA (estoque Dom Pedro)
```
- **Orçamento no nível do CONJUNTO (ABO)**, `daily_budget` = R$50 (5000 centavos) cada.
- **"De x Por"** = **20 produtos distintos** (sem contar variações), os **Estrela de melhor performance** da matriz BCG, **em estoque na loja** + **só foto studio** → **1 anúncio por produto** (arte de produto à vista; Story + Feed no mesmo anúncio via placement).
- **"Geral"** = o set **PROMO 50% OFF** (poucos anúncios).
- **A dimensão loja da F1 flui até aqui**: cada "De x Por" usa os estrela em estoque naquela loja.

---

## 4. Motor parametrizado por tipo

Uma função de criação que, dado `{ conta, tipo, destino, conjuntos[] }`, monta a hierarquia no Graph. `tipo ∈ {whatsapp, link, instagram}` define o **objetivo**, o **optimization_goal**, o **destination_type** e o **call_to_action** do criativo:

| tipo | objective | optimization_goal | destino / CTA |
|---|---|---|---|
| **whatsapp** | OUTCOME_ENGAGEMENT (ou OUTCOME_SALES c/ messaging) | CONVERSATIONS | `destination_type: WHATSAPP` · CTA `WHATSAPP_MESSAGE` · número da BM |
| **link** | OUTCOME_TRAFFIC (ou SALES c/ Pixel) | LINK_CLICKS (ou OFFSITE_CONVERSIONS) | `link_data.link` = URL · CTA `SHOP_NOW` |
| **instagram** | OUTCOME_ENGAGEMENT | PROFILE_VISITS/IMPRESSIONS | perfil IG vinculado |

A 1ª entrega usa **whatsapp**; link/instagram ficam suportados pelo motor mas exercitados depois (UI).

### Passos no Graph (por campanha)
1. `POST /act_{id}/campaigns` — `{name, objective, special_ad_categories: [], status: PAUSED}`.
2. `POST /act_{id}/adsets` (por conjunto) — `{name, campaign_id, daily_budget, billing_event: IMPRESSIONS, optimization_goal, destination_type, promoted_object:{page_id}, targeting, status: PAUSED}`.
3. `POST /act_{id}/adimages` — sobe a imagem a partir da **URL pública do Storage** (`url` param) → `image_hash`.
4. `POST /act_{id}/adcreatives` — `object_story_spec:{ page_id, instagram_actor_id, link_data:{ image_hash, message(copy), call_to_action } }`.
5. `POST /act_{id}/ads` — `{name, adset_id, creative:{creative_id}, status: PAUSED}`.

Tudo via `meta-proxy` (`method:'POST'`).

---

## 5. Origem dos 20 Estrela + Geo + Imagem

- **20 Estrela**: quadrante **Estrela** do Gestor (BCG), ranqueado por **performance de vendas** (`gc_vendas_item`/relatórios comerciais), filtrado por **estoque da loja** (Bling) e **foto studio** (`ehFotoStudio`). ⚠️ **Dependência**: precisa haver ≥20 estrela identificáveis por loja; se a extração da F1 sub-marca "estrela", enriquecer a partir da fonte BCG do Gestor.
- **Geo**: resolver os IDs de cidade via `GET /search?type=adgeolocation&q=Santa Bárbara d'Oeste|Americana|Campinas&country_code=BR` → `targeting.geo_locations.cities`.
- **Imagem**: `/adimages` a partir da **URL pública do Storage** (evita base64 no query string do proxy). Se o Meta não copiar de URL, fallback = servir o arquivo e usar `bytes` (avaliar no spike).
- **WhatsApp número**: listar os números disponíveis na BM (`/me/businesses` → WhatsApp Business Accounts → phone numbers, OU o número conectado à Página) e o usuário escolhe (mesmo nas 2 ou 1 por loja).

---

## 6. Segurança (verba real)

- **Tudo PAUSED** na criação. Nenhuma ativação automática — **jamais**.
- **Modo `--dry`**: monta e imprime todos os payloads sem chamar o Graph.
- **Validação passo a passo**: cada POST confere o retorno (id criado) antes do próximo; em falha, aborta e loga o que já criou (rastro pra limpeza manual).
- **Rastro** em `public.fabrica_meta_jobs`: campanha_id, adset_ids, ad_ids, status, criativos usados, timestamp.

---

## 7. Dados (nova tabela)

- `fabrica_meta_jobs` — `id, campanha_fabrica_id (→fabrica_campanhas), conta_id, meta_campaign_id, loja, tipo, payload jsonb, status, created_at`. (Rastro do que subiu; permite auditar/limpar.)

---

## 8. Faseamento

- **F3.0 — Spike de viabilidade (curto, antes de tudo):** via `meta-proxy`, validar: (a) o token tem `ads_management`; (b) criar **1 campanha de teste PAUSED** e deletá-la; (c) `/adimages` aceita a URL do Storage; (d) `adgeolocation` resolve as 3 cidades; (e) listar número(s) de WhatsApp da BM. Sem isso, F3.1 é chute.
- **F3.1 — Motor + as 2 campanhas WhatsApp:** job que gera o lote fresco por loja (20 estrela + promo), monta as 2 campanhas × 2 conjuntos PAUSED, sobe imagens/creatives/ads, grava `fabrica_meta_jobs`. Provável por CLI (`--dry` primeiro).
- **F3.2 — UI seletor:** na Fábrica, escolher tipo (WhatsApp/Link/Insta) → destino dinâmico (números da BM / URL / perfil) + disparar.

---

## 9. Fora de escopo (F3.1)

- **UI seletor** (F3.2).
- **Destinos Link/Instagram completos** (motor suporta; 1ª entrega é WhatsApp).
- **Ativação** — sempre manual pelo humano.
- **Pixel/Conversões** (usa Engagement/CONVERSATIONS por ora).

---

## 10. Riscos & questões abertas

1. **Escopos do token** — `ads_management` + click-to-WhatsApp. Validar no F3.0 (pode exigir re-permissionar o app Meta).
2. **Click-to-WhatsApp** precisa de um número **conectado à Página** (não qualquer número da BM). Confirmar no F3.0 como o Graph expõe/escolhe o número.
3. **`/adimages` a partir de URL** — confirmar suporte; senão, fallback por bytes.
4. **≥20 estrela por loja** com foto studio — pode faltar; plano B: completar com outros quadrantes ou menos ads.
5. **ABO vs CBO** — usando ABO (orçamento no conjunto) conforme pedido; special_ad_categories = [] (moda não é categoria especial).
6. **v22.0** do Graph — confirmar que os campos usados batem com a versão.
