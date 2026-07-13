# Estúdio (Fábrica de Anúncios) — SP-4: Localização + Público

**Data:** 2026-07-12
**Status:** aprovado no brainstorm, aguardando revisão do spec
**Relação:** quarto dos 6 sub-projetos do Estúdio (SP-1 polimento · SP-2 home/não-travar · SP-3 objetivo — todos no ar). Evolui a feature em `/fabrica-estudio`.

## Objetivo

Hoje o `criarCampanhaNova` (`coletor/subir-estudio.mjs`) crava o targeting do conjunto: `geo_locations.cities` = `fabrica_lojas.geo_cities` da loja, sem idade/gênero/interesses/públicos. O SP-4 dá **controle de targeting por campanha** — **localização** (cidades, raio, exclusões, idade/gênero) e **público** (amplo, interesses, e públicos salvos de engajamento/lookalike) — escolhidos no passo **Subir**, com **presets reutilizáveis**. O objetivo do SP-3 continua ditando *o quê* (objective/otimização/destino); o público define *pra quem*. Tudo PAUSED.

## Decisões travadas no brainstorm

- **Onde:** no passo **Subir**, no caminho destino='nova' (targeting é de conjunto; não afeta criativo). 'existente' não muda (já tem conjuntos com targeting próprio).
- **Abordagem A:** o front fala com o **meta-proxy** (lista/busca/cria audiences e interesses, como já lista campanhas); o targeting é montado como JSON e passado pro `subir`; um helper puro `montarTargeting(publico, loja)` constrói o objeto; presets numa tabela `fabrica_publicos`. Pouco backend novo.
- **Híbrido nos públicos salvos:** geo/amplo/interesses montados na hora; engajamento e lookalike **criar via API OU selecionar** um existente; **lista de clientes (CSV+hash) fica pra etapa futura**.
- **Presets reutilizáveis:** tabela `fabrica_publicos` nomeada/editável.
- **Faseamento dentro do SP-4:** **Fase A** = geo (cidades+raio+excluir) + idade/gênero + interesses + amplo + presets (espinha). **Fase B** = criar/selecionar audiences (engajamento/lookalike). Cada fase vai ao ar testável.
- **Controles de geo:** adicionar/remover cidades, raio por cidade/ponto, excluir regiões, idade e gênero (todos pedidos).

## Modelo de dados

### `fabrica_publicos` (tabela nova, preset)
- `id uuid pk default gen_random_uuid()`
- `nome text not null`
- `marca_id uuid null` (null = global; senão por marca — FK `fabrica_marcas`)
- `geo jsonb not null default '{}'` — `{ cities: [{key, radius, distance_unit}], excluded: [{key, type}] }` (`type` ∈ city/region; `distance_unit` ∈ mile/kilometer)
- `idade_min int not null default 18`, `idade_max int not null default 65`
- `generos int[] not null default '{}'` — Meta: 1=masc, 2=fem; vazio = todos
- `interesses jsonb not null default '[]'` — `[{id, name}]`
- `custom_audiences jsonb not null default '[]'` — `[{id, name, subtype}]` (Fase B)
- `ativo boolean not null default true`, `criado_por uuid`, `created_at timestamptz default now()`
- RLS: `select` para `authenticated` (o front lê direto); sem policy de write para authenticated (escrita só service-role, via a Edge).

Migration `023_fabrica_publicos.sql`.

### Onde o público vive por campanha
O `publico` (preset escolhido OU config inline — **mesmo shape** das colunas acima) viaja em `params.destino.publico` no disparo do `subir`. Não precisa persistir na rodada (o Subir é o ponto de decisão); opcionalmente o `fabrica_meta_jobs` já guarda o rastro da subida.

## Montagem do targeting — `coletor/lib/publico.mjs`

Helper puro testável `montarTargeting(publico, loja)`:
- **Sem `publico`** (amplo, retrocompat): `{ geo_locations: { cities: (loja.geoCities||[]).map((key) => ({ key })) } }` — o comportamento de hoje.
- **Com `publico`:**
  - `geo_locations.cities` = `publico.geo.cities` mapeado pra `{ key, radius, distance_unit }` (só inclui `radius`/`distance_unit` quando presentes); se `publico.geo.cities` vazio → cai pras cidades da loja (nunca fica sem geo).
  - `excluded_geo_locations` = `publico.geo.excluded` (quando houver).
  - `age_min`/`age_max` de `idade_min`/`idade_max`.
  - `genders` = `publico.generos` (omitido quando vazio = todos).
  - `flexible_spec: [{ interests: publico.interesses.map(i => ({ id: i.id, name: i.name })) }]` (só quando houver interesses).
  - `custom_audiences: publico.custom_audiences.map(a => ({ id: a.id }))` (só quando houver — Fase B).
- Retorna um objeto `targeting` pronto pro adset.

### Aplicação em `criarCampanhaNova`
`payloadCampanhaAdset(row, marca, loja, cfg)` (SP-3) passa a receber também o `publico` (ou o targeting já montado) e usa `montarTargeting(publico, loja)` no lugar do `targeting` geo-only atual. O objetivo (`row`) segue ditando objective/optimization/destination/promoted_object. `run()` recebe o `publico` de `params.destino.publico` e repassa.

## UI — passo Subir (Fase A)

`painel-subir.vue`, quando `destino.tipo==='nova'`, abre a seção **Localização + Público** (estética `.fest`):
- **Preset:** dropdown dos `fabrica_publicos` ativos (lidos direto via `sb('fabrica_publicos?...')`) + opções "configurar do zero" e "salvar como preset". Escolher um preenche os campos abaixo.
- **Localização:** busca de cidades via `sbClient.functions.invoke('meta-proxy', { path:'/search', params:{ type:'adgeolocation', location_types:['city'], q } })` → chips das selecionadas, cada uma com input de **raio** + unidade (km/mi); lista de **excluídas**; inicia com as cidades da loja (nomes resolvidos por busca/estado).
- **Idade/gênero:** `idade_min`/`idade_max` (inputs) + toggle masc/fem/todos.
- **Interesses:** busca via meta-proxy `type:'adinterest'` → chips multi-seleção `{id,name}`.
- Os campos compõem o objeto `publico` mandado no `subir` (`params.destino.publico`).
- **Salvar/gerir preset:** "salvar como preset" e "excluir preset" chamam a Edge **`fabrica-publicos`** (gated). Leitura é direta (RLS).

## Públicos salvos — Fase B (criar/selecionar)

Bloco **Públicos salvos** na mesma seção:
- **Listar existentes:** meta-proxy `GET /{adAccount}/customaudiences` (fields `id,name,subtype,approximate_count`) → multi-seleção.
- **Criar engajamento:** botão → meta-proxy `POST /{adAccount}/customaudiences` `{ subtype:'ENGAGEMENT', name, rule: <engajadores do IG/FB da marca>, retention_days }` → `id` entra na seleção.
- **Criar lookalike:** escolher fonte (uma audience existente) + país + percentual → meta-proxy `POST /{adAccount}/customaudiences` `{ subtype:'LOOKALIKE', origin_audience_id, lookalike_spec:{ country, ratio, type:'similarity' } }` → `id`.
- Ids selecionados entram em `publico.custom_audiences` → `montarTargeting` → `adset.targeting.custom_audiences`.
- Nota: público recém-criado leva tempo pra popular; o anúncio sobe PAUSED referenciando mesmo assim (não bloqueia).

## Edge `fabrica-publicos` (escrita gated dos presets)

Nova Edge (Deno, gate igual ao `fabrica-trigger`: getUser + role='admin' OR is_superadmin OR permissions ? 'meta.fabrica'). Ações via `{ acao, ... }`:
- `salvar` (upsert): recebe o objeto do preset (`nome/geo/idade/generos/interesses/custom_audiences/marca_id`), faz insert/update em `fabrica_publicos`, grava `criado_por`. Retorna `{ id }`.
- `apagar`: `{ id }` → delete. Idempotente.
Sem tocar no Meta (só a tabela). A criação de audiences (Fase B) vai pelo meta-proxy direto do front — não por esta Edge.

## Segurança / cuidados

- Tudo PAUSED; SP-4 é targeting, não ativa nada. Ativação segue no job `ativar` com confirmação, intocado.
- `fabrica_publicos`: leitura authenticated, escrita só via Edge gated (`meta.fabrica`).
- Criação de audiences via meta-proxy usa o token já gated do proxy; nada de PII em claro no SP-4 (a lista CSV, que teria PII, está fora de escopo).
- `montarTargeting` nunca deixa o conjunto sem geo (fallback pras cidades da loja) — evita público mundial acidental.

## Testes

- **node:test puros (`coletor/lib/publico.test.mjs`):** `montarTargeting` — amplo (geo da loja), cidades+raio+unidade, excluídas, idade/gênero, interesses (flexible_spec), custom_audiences; `geo.cities` vazio → cai pra loja; omissões corretas (genders vazio, sem interesses).
- **`payloadCampanhaAdset`/`criarCampanhaNova`:** targeting montado a partir do `publico` (dry, sem Graph).
- **Edge `fabrica-publicos`:** gate 401/403; salvar/apagar preset.
- **Front:** `vite build` + smoke (editor de geo, salvar/usar preset, criar audience na Fase B).
- **Ao vivo (checkpoint):** subir 1 campanha PAUSED com público montado (cidades+raio+interesses+audience) e confirmar aceite do Graph — reusar o padrão de `coletor/validar-objetivos-combos.mjs`.

## Fora de escopo (próximos)

- **Lista de clientes (CSV + hash SHA-256 / LGPD)** — etapa futura do público.
- **Remarketing de site / carrinho (Pixel)** — gated até existir site+Pixel (mesmo caso do sub-destino 'site' da conversão no SP-3).
- Itens do antigo "construtor de campanhas": WhatsApp específico por conjunto, avulso vs remessa, vídeo — SP posterior.
- SP-5 gestão de templates/looks (+Canva); SP-6 tutorial.

## Referências

- `coletor/subir-estudio.mjs` (`criarCampanhaNova`/`payloadCampanhaAdset` do SP-3, `run()`), `coletor/lib/objetivos.mjs` (padrão de config-as-data), `coletor/lib/config-lojas.mjs` (loja/geoCities/marca), novo `coletor/lib/publico.mjs`.
- `src/ferramentas/meta-ads/painel-subir.vue` (ganha a seção Localização+Público), `estudio.css`.
- `supabase/functions/meta-proxy` (busca/cria audiences e interesses), nova `supabase/functions/fabrica-publicos` (presets).
- Tabelas: `fabrica_publicos` (migration 023), `fabrica_lojas`/`fabrica_marcas` (SP-2), `fabrica_objetivos` (SP-3). Validador ao vivo: `coletor/validar-objetivos-combos.mjs` (padrão a reusar).
