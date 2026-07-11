# Fábrica de Anúncios — F2a (Motor de Criativos) — Design

**Data:** 2026-07-10
**Fase:** F2a (primeiro motor de criativo) da esteira Fábrica de Anúncios
**Status:** Design aprovado — pronto para plano de implementação
**Depende de:** F1 (no ar — seleção de candidatos por loja). Ver `2026-07-10-fabrica-de-anuncios-design.md`.

---

## 1. Objetivo

Gerar os **criativos (PNG)** de anúncio a partir da **seleção curada da F1** + uma **campanha de desconto**, com um **motor próprio** (templates HTML + render headless → PNG), fiel à marca **La Vessel**. Sem Canva e sem OAuth. O motor Canva é F2b; o sync pro Zoho é follow-up.

**Validado por POC (2026-07-10):** template real ("50% OFF · Number Hero") + foto real do Bling (Genebra Panacota) + fontes Cormorant/Archivo → PNG **1080×1920 exato** via Chromium headless. Confirmou: pipeline funciona e a marca fica fiel.

---

## 2. Integração com a F1 (princípio: a curadoria manda)

A F2 **opera sobre a seleção curada da F1**, nunca a ignora:
- Os produtos que entram vêm dos `fabrica_candidatos` **selecionados** (toggles por quadrante BCG, itens extras marcados, add manual por SKU — tudo preservado da F1, por loja).
- A **campanha** define o **desconto**; a seleção define **quais produtos**. Os dois se somam.
- Gerar criativo é um passo **a mais** na mesma tela da F1 (não uma tela nova).

---

## 3. Modelo de Campanha & desconto

Uma **campanha** carrega um desconto; o criativo nasce dela. Três formas:
- **Fixo/global** — um % único pra tudo (ex.: "50% OFF - Sales"). *(caso atual)*
- **Do Gestor** (padrão automático) — usa a **escada por item** que o Gestor entrega (15/20/25/30/35/40% conforme quadrante BCG). Cada produto pega seu %.
- **Personalizado** — o usuário digita o % (da campanha inteira, ou sobrescreve item a item).

**Matemática:** o Bling entrega o **preço cheio atual** = **"De"**. O **"Por" = De × (1 − desconto%)**. O **parcelado = Por ÷ N** (N configurável por campanha; default 10×). Ex.: De ~~R$ 899~~ · Por **R$ 449** · 10× de R$ 44,90.

O mesmo motor cobre os **dois arquétipos**:
- **Promo guarda-chuva** — só o % + bolsa-símbolo (ex.: o POC "50% OFF").
- **Produto** — De/Por calculado + nome + foto (com variações de preço à vista e parcelado em evidência).

---

## 4. Biblioteca de templates

Os 3 arquivos do protótipo do usuário viram a **base versionada** (portados para o repo, parametrizados):
- **Promo** (`50% OFF - Geral`): 4 designs — Sage, Minimal Pearl, Number Hero, Burnt Wood.
- **Produto** (`De x Por - Geral`): 3 direções — Produto-herói, Preço tipográfico, Sage círculo.
- **Editorial** (`La Vessel - Editorial`): reserva.

Cada template é uma **função** `(dados, formato) → HTML`, com slots: `{marca(fixa), foto, nome, precoDe, precoPor, parcelado, oferta%, cta, variantePaleta}`. **Formatos:** Story **1080×1920** e Post **1080×1350**.

**Invariantes de marca** (do `CLAUDE.md` do projeto de design, tratados como regras rígidas do render):
- Paleta: Burnt Wood `#582f0a`, Soft Pearl `#f2f1ed`, Sandstone `#e4e6d9`, Sage Suede `#c2cfb4`, Muted Olive `#89a88b`.
- Fontes: **Cormorant Garamond** (marca + nome + número grande, sempre `lining-nums`) + **Archivo** (rótulos/OFF/CTA).
- Hierarquia marca → produto → nome → oferta → apoio → CTA; "50% OFF" é bloco único; nada encavala o número; contraste por fundo; folga/respiro sempre.

---

## 5. Foto do produto

- Fonte: Bling `produtos/{id}` → `imagemURL` / `midia.imagens` (S3 público). Lógica de extração = `_gcItemImg` (já existe na tela de Gestão Comercial) + fallback variação→produto-pai.
- **Cache local já existe**: `coletor/baixar-fotos-bling.mjs` baixou **751 fotos** (`coletor/fotos-bling/<SKU>.jpg`).
- **Layouts com moldura** (círculo/arco Soft Pearl) usam a **foto crua de fundo branco** — validado no POC, fica limpo.
- **Cutout / remoção de fundo** = enhancement futuro, só necessário pros layouts que jogam a bolsa *solta sobre fundo claro*. Fora da F2a.

---

## 6. Motor de render

- **Onde:** job no `coletor/` (Node) com **Playwright/Chromium** (o GitHub Actions provê Chromium; mesmo padrão headless do POC).
- **Como:** template preenchido → HTML → página servida/local → screenshot no tamanho exato → PNG.
- **Fontes offline:** `export/fonts.css` (Cormorant + Archivo em base64) portado pro repo, embutido no HTML — render não depende de rede.
- **Assets:** monogramas (`lv/monogram-*.png`) e patterns versionados no repo (pequenos).

---

## 7. Papel do Claude no motor

- **Copy/ângulo:** usa o campo `angulo` que o Gestor já entrega por produto (`fabrica_candidatos.angulo`) pra escolher eyebrow/CTA/linha de apoio dentro das regras de marca.
- **Variações novas de template:** sob demanda, o Claude autora um template novo (HTML) seguindo as invariantes — expande a biblioteca sem geração livre descontrolada.

---

## 8. Fluxo & UI (na tela da F1, dentro de Meta Ads)

1. **Campanha:** seletor/criação de campanha + desconto (fixo % / do Gestor / personalizado) + N de parcelas.
2. **Seleção:** a curadoria da F1 (por loja, BCG, extras) define os produtos.
3. **Gerar criativos:** por produto selecionado (arquétipo produto: 6 layouts × 2 formatos) + promo guarda-chuva (4 × 2). Render no coletor.
4. **Preview:** grid das variações geradas.
5. **Curadoria:** marca as favoritas (só elas contam como aprovadas) — mesmo padrão B da F1.
6. **Salvar:** PNG aprovado no **Supabase Storage** (bucket `fabrica-criativos`).

---

## 9. Dados (novas tabelas / extensões)

- `fabrica_campanhas` — `id, nome, desconto_tipo ('fixo'|'gestor'|'personalizado'), desconto_pct, parcelas, created_at`.
- `fabrica_criativos` — `id, candidato_id (nullable p/ promo), campanha_id, arquetipo ('produto'|'promo'), template, formato ('1080x1920'|'1080x1350'), variante, preco_de, preco_por, storage_path, escolhido, created_at`.
- Reusa `fabrica_candidatos` (F1) para os produtos e `angulo`.

---

## 10. Storage

- **F2a:** PNGs no **Supabase Storage** (sem OAuth) — habilita preview/curadoria imediatos.
- **Sync pro Zoho (follow-up):** destino **Pastas de Equipe › 04. Vessel Brasil › 03. Mídia › 03. Criativos › 02. Varejo**. Precisa do **Zoho WorkDrive OAuth server-side** — verificar reuso do módulo de Acessos antes de construir.

---

## 11. Faseamento dentro da F2a

- **F2a.1 — Motor + templates:** portar os 3 templates + fontes/monogramas pro repo, parametrizar, job de render (Chromium) que gera 1 PNG a partir de `{produto/campanha, template, formato}`. Prova: 1 criativo real por CLI.
- **F2a.2 — Campanha & cálculo:** `fabrica_campanhas` + De/Por/parcelado; gerar o set de variações por candidato selecionado + promo.
- **F2a.3 — UI:** seletor de campanha + "gerar" + grid de preview + curadoria + salvar no Supabase Storage.

---

## 12. Fora de escopo (F2a)

- **Sync pro Zoho** (path já definido; precisa OAuth) → follow-up.
- **Motor Canva** (Autofill) → **F2b**, atrás da mesma interface.
- **Cutout / remoção de fundo** das fotos.
- **Cron / automação** do render (dispara na tela por enquanto).

---

## 13. Riscos & questões abertas

1. **Marca na pasta Zoho = "Vessel Brasil"**, mas produtos/protótipos são **La Vessel** — confirmar se é a mesma linha/estrutura antes do sync (não bloqueia F2a).
2. **Chromium no ambiente de render** — validar no GitHub Actions/coletor (no POC rodou local via Playwright). Se pesar, avaliar container dedicado.
3. **N de parcelas** e regra de arredondamento do "Por" — definir default (10×, arredondar centavos).
4. **Onde moram fontes/monogramas no repo** — provavelmente `coletor/templates-criativos/assets/` (versionar os pequenos; `export/fonts.css` é 234KB base64, aceitável).
5. **Fotos brancas em layouts sem moldura** — evitar esses layouts na F2a ou marcar "precisa cutout".
