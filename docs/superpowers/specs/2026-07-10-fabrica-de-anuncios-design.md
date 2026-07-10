# Fábrica de Anúncios — Design

**Data:** 2026-07-10
**Módulo:** Meta Ads (nova seção dentro do módulo existente)
**Status:** Design aprovado — pronto para plano de implementação (F1)

---

## 1. Objetivo

Esteira **semi-automática** que transforma o briefing semanal do Gestor Comercial em campanhas no Meta Ads, com um freio de aprovação humana antes de gastar verba. O fluxo:

> Briefing do Gestor → extração de produtos-anúncio → enriquecimento no Bling → **você aprova** → criativos gerados no Canva → salvos no Zoho → campanha subida no Meta.

Mora dentro do módulo **Meta Ads** do iamundi, como uma nova seção ("Fábrica de Anúncios") com permissão própria gateada por admin.

**Princípio central:** automação sem freio em cima de orçamento de mídia dói. Todo item passa por uma tela de aprovação/curadoria antes de virar gasto.

---

## 2. Fluxo da esteira

```
Briefing (prosa markdown, tabela gestao_comercial_briefings)
   │
   ▼ [edge: extrair-candidatos]   IA (Opus) lê o briefing → lista de SKUs + ângulo + fonte(quadrante BCG)
   ▼ [edge: enriquecer-bling]     por SKU: preço De/Por + foto + ESTOQUE POR LOJA
   ▼
TELA (seção em Meta Ads) — PASSO 1: SELEÇÃO (agrupada por loja)
   • Oportunidades da semana → já marcadas (todas)
   • Estrelas / Interrogação / Garimpo do Gestor → pré-marcadas, você ajusta
   • Abacaxi → fora
   • [+ Adicionar Promo] (ex.: "50% OFF - Sales", "Toda a loja")
   │
   ▼ [edge: gerar-criativos-canva]  Canva Autofill → 6×2 por produto, 4×2 por promo
   ▼
TELA — PASSO 2: CURADORIA (você marca as favoritas — só elas sobem)
   │
   ▼ [edge: salvar-zoho]   artes escolhidas caem na pasta do Zoho
   ▼ [edge: subir-meta]    cria campanha POR LOJA (detalhe fino = F3, tratado como caixa por ora)
```

---

## 3. Regra de seleção (briefing → candidatos)

Comportamento: **aprovação humana com pré-seleção automática por quadrante** (o sistema pré-marca, você bate o martelo).

| Fonte | Default | Você pode |
|---|---|---|
| Oportunidades da semana | **todas** (sempre entram) | — |
| Estrelas | pré-marcadas | escolher algumas ou todas |
| Interrogação | pré-marcadas | escolher algumas ou todas |
| Garimpo do Gestor | pré-marcadas | escolher algumas ou todas |
| Abacaxi | fora | — |
| **Promo/Desconto** (ex.: 50% OFF) | criada por você na mão | — |

---

## 4. Dimensão LOJA (estrutural)

O estoque é **por loja**, então a loja é dimensão de primeira classe: um SKU só vira candidato numa loja onde **tem peça em estoque**.

- Lojas ativas: **Tivoli (Santa Bárbara)** e **Shopping Dom Pedro**.
- **Atacado Nuvem Shop fica de fora** desta fábrica por enquanto.
- Modelo **extensível**: loja é tabela de lookup (`fabrica_lojas`), não hardcode — dá pra plugar canal novo depois.
- **A arte é idêntica entre lojas** (a loja é metadado de roteamento, não muda a arte). Logo: os criativos são gerados **uma vez por produto** e reaproveitados; a **seleção e a campanha** é que são por loja.

---

## 5. Matriz de criativos

Cada variação sai nos **2 formatos**: Feed **1:1** e Story/Reels **9:16**.

**Por PRODUTO** (6 layouts → 12 artes):
- **4 variações** → "De X por Y", preço original **riscado** + destaque no **preço final à vista** (cheio)
- **2 variações** → "De X por Y", preço original **riscado** + destaque no **parcelado**

**Por PROMO/campanha guarda-chuva** (4 layouts → 8 artes):
- **4 variações abertas** → tipo "Sales 50%", "Toda a loja"

**Curadoria (Passo 2):** a tela mostra todas as variações e você marca as favoritas — **só as escolhidas sobem** pro Meta (mais controle, menos ruído).

**Templates:** parte já existe no Canva (a definir quais). O restante nós criamos: no mínimo um template-base de **produto** (com campos De/Por/riscado/parcelado como variáveis de Autofill) e um de **promo**.

---

## 6. Arquitetura & componentes

- **Motor** = Edge Functions no Supabase (mesmas que um cron futuro pode chamar). Nada de lógica pesada no front.
- **UI** = nova seção dentro do módulo **Meta Ads** (Vue), topbar padrão, **permissão própria** (`module:meta:fabrica`) gateada por admin — seguindo a regra "submódulo novo = permissão própria".
- **IA de extração** = Opus, chave/segredo separado (padrão dos outros robôs do projeto).

### Edge Functions
| Função | Responsabilidade |
|---|---|
| `extrair-candidatos` | IA lê o briefing → lista estruturada de SKUs + ângulo + fonte |
| `enriquecer-bling` | por SKU: preço De/Por + foto + estoque por loja (via `bling-proxy`) |
| `gerar-criativos-canva` | Canva Autofill dos templates → variações × formatos |
| `salvar-zoho` | sobe as artes escolhidas na pasta do Zoho |
| `subir-meta` | cria campanha por loja no Meta (via `meta-proxy`) — detalhe = F3 |

---

## 7. Modelo de dados (tabelas novas, prefixo `fabrica_`)

- `fabrica_lojas` — lookup de lojas (Tivoli, Dom Pedro; extensível). Campos: id, nome, ativo, meta_ad_account_id (F3).
- `fabrica_rodadas` — uma por briefing processado (liga em `gestao_comercial_briefings`).
- `fabrica_candidatos` — produto-anúncio, chave **produto + loja**: sku, nome, fonte/quadrante, ângulo, preço_de, preço_por, foto_url, estoque, selecionado, status.
- `fabrica_criativos` — cada variação, por **produto** (arte compartilhada entre lojas): produto/sku, layout, formato (1:1 / 9:16), canva_design_id, zoho_url, escolhido.
- `fabrica_promos` — campanhas guarda-chuva manuais (50% OFF etc.).
- `fabrica_templates` — registro dos templates Canva: tipo (produto/promo), formato, canva_template_id, campos de Autofill.
- `fabrica_meta_jobs` — rastro do que subiu no Meta (F3).

---

## 8. Integrações & dependências

| Peça | Estado | O que precisa |
|---|---|---|
| **Bling** | ✅ tem `bling-proxy` | confirmar que produtos têm foto cadastrada; puxar estoque por loja/depósito |
| **Meta** | ✅ tem `meta-proxy` | detalhe de campanha (objetivo/verba/público) = **F3** |
| **Canva** | ⚠️ novo | registrar app **Canva Connect API** (token OAuth server-side do robô) + criar templates de marca com campos Autofill |
| **Zoho** | ⚠️ verificar | **checar se já existe app/OAuth server-side** (talvez do módulo Controle de Acessos) antes de construir; definir a pasta destino (WorkDrive) |

> Nota: a fábrica roda headless (edge functions), então um MCP interativo do Zoho **não** serve ao robô — é preciso OAuth server-side. Verificar reaproveitamento antes de registrar app novo.

---

## 9. Faseamento (1 fase por sessão, pra não estourar token e validar cada elo)

- **F1 — A lista sai certa:** extração (IA) + enriquecimento Bling (preço/foto/estoque por loja) + tela de seleção agrupada por loja. **Sem Canva ainda.** Prova, em cima de um briefing real, que os SKUs/preços/estoque vêm corretos.
- **F2 — Criativos:** Canva Connect + templates (produto/promo) + Autofill + preview + curadoria + salvar no Zoho.
- **F3 — Subir Meta:** destrinchar a criação de campanha (objetivo, verba, público, estrutura por loja) e disparar.

---

## 10. Fora de escopo agora (YAGNI)

- **Cron 100% automático** — o motor (edge functions) já nasce pronto pra ser chamado por um cron, mas o disparo é manual por enquanto (o freio de aprovação é intencional).
- **Detalhe fino da campanha Meta** — objetivo/verba/público ficam pra F3.
- **Atacado Nuvem Shop** — fora desta fábrica por ora (modelo já suporta plugar depois).

---

## 11. Riscos & questões abertas

1. **Produtos sem foto no Bling** — decidir fallback (Canva gera arte sem foto real, ou pula o item). Risco, não bloqueia.
2. **Extração de SKU da prosa pode errar** — o briefing é markdown livre; a tela de aprovação humana cobre falsos positivos/negativos.
3. **OAuth Canva/Zoho** — setup de app server-side é trabalho real de F2 (Zoho: verificar reaproveitamento).
4. **Pasta do Zoho destino** — pendente definição do caminho.
5. **Estoque por loja no Bling** — confirmar que o `bling-proxy` expõe saldo por depósito/loja.
