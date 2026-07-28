# Métrica Ponderada — Fase 1 (motor + régua + veredito na lista)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer a Gestão de Tráfego pontuar campanhas e anúncios pela métrica ponderada (custo por ponto contra meta editável) e usar isso no veredito do cartão, com uma aba nova onde o dono edita pesos, metas e limiares.

**Architecture:** Dois módulos puros (`ponderada.js` e `veredito.js`) fazem toda a conta sem tocar em tela nem na Meta — é o que permite testar com `node --test`. A régua (pesos/metas/limiares) mora numa tabela nova do Supabase com histórico de alterações. A tela ganha uma casca de abas: "Campanhas" (a de hoje) e "A régua" (a nova). O veredito do cartão passa a ser calculado por `veredito.js`, que combina saúde, Opus e ponderada numa ordem fixa de precedência.

**Tech Stack:** Vue 3 + Vite, Supabase (PostgREST + RLS), Graph API v21.0, testes com `node --test`.

**Spec:** `docs/superpowers/specs/2026-07-28-meta-ads-metrica-ponderada-design.md`

## Global Constraints

- **Idioma:** todo nome de arquivo, função, variável e texto de tela em **português literal**, sem jargão — quem lê o painel é leigo no assunto.
- **Módulos puros não fazem I/O:** sem `fetch`, sem `document`, sem Supabase. Só entram números e saem números.
- **Testes:** `npm test` (roda `node --test` em `src/**/*.test.mjs`). A suíte hoje tem 256 testes e **não pode regredir**.
- **Métricas líquidas primeiro:** onde a Meta oferecer a versão líquida (`onsite_conversion.post_net_*`), ela vence a bruta. Líquida **presente com valor 0 é 0** — não cai pra bruta.
- **Nunca inventar número:** sem dado → "sem dados". Nunca zero no lugar de desconhecido.
- **Money-path:** nada neste plano aplica mudança em campanha real. A Fase 1 só lê e recomenda.
- **Escrita no banco** via `sbClient` (JWT do usuário, protegido por RLS); leitura via `sb()`.
- **CSS:** classes com prefixo próprio (`.pnd-`), nunca reusar nome global — classes de `estilos-globais.css` vazam para dentro de telas scoped neste projeto.

---

### Task 1: Módulo puro da métrica ponderada

**Files:**
- Create: `src/ferramentas/gestao-trafego/ponderada.js`
- Test: `src/ferramentas/gestao-trafego/ponderada.test.mjs`

**Interfaces:**
- Consumes: nada (é a base).
- Produces:
  - `PESOS_PADRAO: {curtidas:1, comentarios:10, salvamentos:30, compartilhamentos:20}`
  - `LIMIARES_PADRAO: {escalarForte:0.8, dentroMeta:1.0, manter:1.3}`
  - `quantidadesDoInsight(row) -> {curtidas, comentarios, salvamentos, compartilhamentos, gasto}`
  - `calcularPonderada(qtds, {pesos, limiares, meta}) -> {pontos, interacoes, custoPorPonto, qualidade, indice, faixa}`
  - `faixa` é uma de: `'escalar-forte' | 'dentro-da-meta' | 'manter' | 'otimizar' | 'sem-dados'`

- [ ] **Step 1: Write the failing test**

Create `src/ferramentas/gestao-trafego/ponderada.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcularPonderada, quantidadesDoInsight, PESOS_PADRAO } from './ponderada.js';

test('pontos = soma de quantidade x peso', () => {
  const r = calcularPonderada({ curtidas: 100, comentarios: 2, salvamentos: 3, compartilhamentos: 1, gasto: 50 });
  // 100*1 + 2*10 + 3*30 + 1*20 = 230
  assert.equal(r.pontos, 230);
  assert.equal(r.interacoes, 106);
});

test('custo por ponto = gasto / pontos', () => {
  const r = calcularPonderada({ curtidas: 100, gasto: 50 });
  assert.equal(r.custoPorPonto, 0.5);
});

test('qualidade = pontos / interacoes (quanto vale cada interacao)', () => {
  const r = calcularPonderada({ curtidas: 10, salvamentos: 10, gasto: 1 });
  // pontos 310, interacoes 20
  assert.equal(r.qualidade, 15.5);
});

test('sem interacao nenhuma nao divide por zero: devolve null e sem-dados', () => {
  const r = calcularPonderada({ gasto: 100 }, { meta: 0.2 });
  assert.equal(r.pontos, 0);
  assert.equal(r.custoPorPonto, null);
  assert.equal(r.qualidade, null);
  assert.equal(r.indice, null);
  assert.equal(r.faixa, 'sem-dados');
});

test('meta ausente ou zero nao gera indice', () => {
  const r = calcularPonderada({ curtidas: 100, gasto: 50 }, { meta: 0 });
  assert.equal(r.indice, null);
  assert.equal(r.faixa, 'sem-dados');
});

test('faixas do semaforo nas bordas exatas dos limiares', () => {
  // meta 1 => custoPorPonto = indice. 100 pontos, gasto = indice*100.
  const faixaCom = (indice) => calcularPonderada({ curtidas: 100, gasto: indice * 100 }, { meta: 1 }).faixa;
  assert.equal(faixaCom(0.80), 'escalar-forte');   // borda inferior inclusiva
  assert.equal(faixaCom(0.81), 'dentro-da-meta');
  assert.equal(faixaCom(1.00), 'dentro-da-meta');  // borda inclusiva
  assert.equal(faixaCom(1.01), 'manter');
  assert.equal(faixaCom(1.30), 'manter');          // borda inclusiva
  assert.equal(faixaCom(1.31), 'otimizar');
});

test('pesos e limiares customizados sobrescrevem os padroes', () => {
  const r = calcularPonderada({ curtidas: 10, gasto: 10 }, { pesos: { curtidas: 5 }, meta: 1 });
  assert.equal(r.pontos, 50);
  assert.equal(PESOS_PADRAO.curtidas, 1, 'nao pode mutar o padrao');
});

test('quantidadesDoInsight prefere a metrica LIQUIDA sobre a bruta', () => {
  const row = {
    spend: '30',
    actions: [
      { action_type: 'post_reaction', value: '100' },
      { action_type: 'onsite_conversion.post_net_like', value: '90' },
      { action_type: 'comment', value: '5' },
      { action_type: 'onsite_conversion.post_save', value: '7' },
      { action_type: 'post', value: '3' },
    ],
  };
  const q = quantidadesDoInsight(row);
  assert.equal(q.curtidas, 90, 'liquida vence a bruta');
  assert.equal(q.comentarios, 5, 'sem liquida, usa a bruta');
  assert.equal(q.salvamentos, 7);
  assert.equal(q.compartilhamentos, 3);
  assert.equal(q.gasto, 30);
});

test('liquida presente valendo ZERO e zero mesmo (nao cai pra bruta)', () => {
  const row = {
    spend: '10',
    actions: [
      { action_type: 'post_reaction', value: '100' },
      { action_type: 'onsite_conversion.post_net_like', value: '0' },
    ],
  };
  assert.equal(quantidadesDoInsight(row).curtidas, 0);
});

test('insight sem actions nao quebra', () => {
  const q = quantidadesDoInsight({ spend: '5' });
  assert.deepEqual(q, { curtidas: 0, comentarios: 0, salvamentos: 0, compartilhamentos: 0, gasto: 5 });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test 2>&1 | grep -A3 "ponderada"`
Expected: FAIL — `Cannot find module './ponderada.js'`

- [ ] **Step 3: Write minimal implementation**

Create `src/ferramentas/gestao-trafego/ponderada.js`:

```js
// Métrica ponderada: em vez de contar interações no bruto, converte cada uma em
// PONTOS conforme o valor que ela representa (um salvamento vale mais que uma
// curtida) e mede o custo por ponto contra uma meta.
// PURO: sem rede, sem tela, sem Supabase — só entram números e saem números.
// É isso que permite testar a conta inteira com `node --test`.

export const PESOS_PADRAO = { curtidas: 1, comentarios: 10, salvamentos: 30, compartilhamentos: 20 };
export const LIMIARES_PADRAO = { escalarForte: 0.8, dentroMeta: 1.0, manter: 1.3 };

// Ordem importa: a LÍQUIDA vem primeiro e vence a bruta. Líquida já desconta quem
// descurtiu/dessalvou, e a casa toda usa a régua "líquido com sinal".
const FONTES = {
  curtidas: ['onsite_conversion.post_net_like', 'post_reaction'],
  comentarios: ['onsite_conversion.post_net_comment', 'comment'],
  salvamentos: ['onsite_conversion.post_net_save', 'onsite_conversion.post_save'],
  compartilhamentos: ['post', 'share'],
};

function numero(v) { const n = Number(v); return Number.isFinite(n) ? n : 0; }

// Devolve o valor da PRIMEIRA ação encontrada na ordem pedida.
// Achar com valor 0 é diferente de não achar: 0 é resposta, não ausência.
function valorDaAcao(acoes, tipos) {
  if (!Array.isArray(acoes)) return null;
  for (const tipo of tipos) {
    const achou = acoes.find((a) => a && a.action_type === tipo);
    if (achou) return numero(achou.value);
  }
  return null;
}

export function quantidadesDoInsight(linha) {
  const acoes = linha && linha.actions;
  const q = { gasto: numero(linha && linha.spend) };
  for (const chave of Object.keys(FONTES)) {
    const v = valorDaAcao(acoes, FONTES[chave]);
    q[chave] = v == null ? 0 : v;
  }
  return { curtidas: q.curtidas, comentarios: q.comentarios, salvamentos: q.salvamentos, compartilhamentos: q.compartilhamentos, gasto: q.gasto };
}

function faixaDoIndice(indice, limiares) {
  if (indice == null) return 'sem-dados';
  if (indice <= limiares.escalarForte) return 'escalar-forte';
  if (indice <= limiares.dentroMeta) return 'dentro-da-meta';
  if (indice <= limiares.manter) return 'manter';
  return 'otimizar';
}

export function calcularPonderada(quantidades, opcoes) {
  const o = opcoes || {};
  const pesos = { ...PESOS_PADRAO, ...(o.pesos || {}) };
  const limiares = { ...LIMIARES_PADRAO, ...(o.limiares || {}) };
  const meta = numero(o.meta);
  const gasto = numero(quantidades && quantidades.gasto);

  let pontos = 0, interacoes = 0;
  for (const chave of Object.keys(pesos)) {
    const qtd = numero(quantidades && quantidades[chave]);
    pontos += qtd * numero(pesos[chave]);
    interacoes += qtd;
  }

  const custoPorPonto = pontos > 0 ? gasto / pontos : null;
  const qualidade = interacoes > 0 ? pontos / interacoes : null;
  const indice = (custoPorPonto != null && meta > 0) ? custoPorPonto / meta : null;

  return { pontos, interacoes, custoPorPonto, qualidade, indice, faixa: faixaDoIndice(indice, limiares) };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test 2>&1 | tail -8`
Expected: `pass 266` (256 anteriores + 10 novos), `fail 0`

- [ ] **Step 5: Commit**

```bash
git add src/ferramentas/gestao-trafego/ponderada.js src/ferramentas/gestao-trafego/ponderada.test.mjs
git commit -m "feat(ponderada): módulo puro da métrica ponderada"
```

---

### Task 2: Módulo puro do veredito único

**Files:**
- Create: `src/ferramentas/gestao-trafego/veredito.js`
- Test: `src/ferramentas/gestao-trafego/veredito.test.mjs`

**Interfaces:**
- Consumes: a `faixa` produzida por `calcularPonderada` (Task 1).
- Produces: `decidirVeredito({saude, opus, ponderada}) -> {veredito, origem, porque}`
  - `veredito`: `'pausar' | 'escalar' | 'manter' | 'otimizar' | 'sem-dados'`
  - `origem`: `'saude' | 'opus' | 'ponderada' | 'nenhuma'`
  - `porque`: frase em português explicando a decisão

- [ ] **Step 1: Write the failing test**

Create `src/ferramentas/gestao-trafego/veredito.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decidirVeredito } from './veredito.js';

test('saude mandando pausar VETA tudo, por mais barato que esteja', () => {
  const r = decidirVeredito({
    saude: { veredito: 'pausar', justificativa: 'Frequência 5,2× — criativo com fadiga.' },
    opus: { veredito: 'escalar', justificativa: 'performance boa' },
    ponderada: { faixa: 'escalar-forte', custoPorPonto: 0.05, meta: 0.2 },
  });
  assert.equal(r.veredito, 'pausar');
  assert.equal(r.origem, 'saude');
  assert.match(r.porque, /fadiga/);
});

test('saude ok e Opus presente: vale o Opus', () => {
  const r = decidirVeredito({
    saude: { veredito: 'manter', justificativa: 'sem sinal de fadiga' },
    opus: { veredito: 'reduzir', justificativa: 'CPA subindo há 3 dias' },
    ponderada: { faixa: 'escalar-forte', custoPorPonto: 0.05, meta: 0.2 },
  });
  assert.equal(r.veredito, 'reduzir');
  assert.equal(r.origem, 'opus');
});

test('saude ok e SEM Opus: vale a ponderada', () => {
  const r = decidirVeredito({
    saude: { veredito: 'manter', justificativa: '' },
    opus: null,
    ponderada: { faixa: 'escalar-forte', custoPorPonto: 0.05, meta: 0.2 },
  });
  assert.equal(r.veredito, 'escalar');
  assert.equal(r.origem, 'ponderada');
  assert.match(r.porque, /0,05/);
  assert.match(r.porque, /0,20/);
});

test('cada faixa da ponderada vira o veredito certo', () => {
  const de = (faixa) => decidirVeredito({ saude: null, opus: null, ponderada: { faixa, custoPorPonto: 1, meta: 1 } }).veredito;
  assert.equal(de('escalar-forte'), 'escalar');
  assert.equal(de('dentro-da-meta'), 'escalar');
  assert.equal(de('manter'), 'manter');
  assert.equal(de('otimizar'), 'otimizar');
});

test('nada decidivel: sem-dados, nunca um palpite', () => {
  const r = decidirVeredito({ saude: null, opus: null, ponderada: { faixa: 'sem-dados' } });
  assert.equal(r.veredito, 'sem-dados');
  assert.equal(r.origem, 'nenhuma');
});

test('ponderada ausente por completo tambem da sem-dados', () => {
  assert.equal(decidirVeredito({}).veredito, 'sem-dados');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test 2>&1 | grep -A3 "veredito"`
Expected: FAIL — `Cannot find module './veredito.js'`

- [ ] **Step 3: Write minimal implementation**

Create `src/ferramentas/gestao-trafego/veredito.js`:

```js
// Veredito único do cartão. NÃO existem dois selos disputando: existe UM veredito,
// decidido em ordem fixa de precedência (decisão do dono, 2026-07-28):
//   1. saúde manda pausar -> PAUSA, por mais barato que esteja (frequência alta
//      queima audiência; barato não conserta isso);
//   2. saúde ok e há análise do Opus -> vale o Opus (precedência que já existia);
//   3. saúde ok e sem Opus -> vale a ponderada.
// PURO: sem rede, sem tela.

const VEREDITO_POR_FAIXA = {
  'escalar-forte': 'escalar',
  'dentro-da-meta': 'escalar',
  'manter': 'manter',
  'otimizar': 'otimizar',
};

const reais = (v) => 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function porqueDaPonderada(p) {
  const custo = reais(p.custoPorPonto);
  const meta = reais(p.meta);
  if (p.faixa === 'escalar-forte') return `Barato por ponto: ${custo} contra a meta de ${meta}. Há espaço claro para escalar.`;
  if (p.faixa === 'dentro-da-meta') return `Dentro da meta: ${custo} por ponto contra ${meta}. Pode escalar.`;
  if (p.faixa === 'manter') return `Um pouco acima da meta: ${custo} por ponto contra ${meta}. Observar antes de mexer.`;
  return `Caro por ponto: ${custo} contra a meta de ${meta}. Revisar criativo ou público.`;
}

export function decidirVeredito(entrada) {
  const e = entrada || {};
  const saude = e.saude, opus = e.opus, ponderada = e.ponderada;

  if (saude && saude.veredito === 'pausar') {
    return { veredito: 'pausar', origem: 'saude', porque: saude.justificativa || 'Sinal de saúde ruim na campanha.' };
  }
  if (opus && opus.veredito) {
    return { veredito: opus.veredito, origem: 'opus', porque: opus.justificativa || 'Análise da IA.' };
  }
  if (ponderada && VEREDITO_POR_FAIXA[ponderada.faixa]) {
    return { veredito: VEREDITO_POR_FAIXA[ponderada.faixa], origem: 'ponderada', porque: porqueDaPonderada(ponderada) };
  }
  return { veredito: 'sem-dados', origem: 'nenhuma', porque: 'Ainda não há dado suficiente para recomendar.' };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test 2>&1 | tail -8`
Expected: `pass 272`, `fail 0`

- [ ] **Step 5: Commit**

```bash
git add src/ferramentas/gestao-trafego/veredito.js src/ferramentas/gestao-trafego/veredito.test.mjs
git commit -m "feat(veredito): módulo puro do veredito único (saúde > Opus > ponderada)"
```

---

### Task 3: Tabelas da régua no Supabase

**Files:**
- Create: `supabase/migrations/20260728_ponderada_config.sql`

**Interfaces:**
- Produces: tabelas `gt_ponderada_config` (linha única) e `gt_ponderada_config_log` (histórico).

**Contexto que o implementador precisa:** o projeto tem drift conhecido — a maioria das migrations só existe no banco. O arquivo aqui é o registro versionado; a aplicação em produção é feita via MCP do Supabase (`apply_migration`), que **funciona** neste projeto (ref `kounqtdoioootxqegkij`). O check `Supabase Preview` do PR vai ficar vermelho: é ruído conhecido, documentado em `project_iamundi_deploy`.

- [ ] **Step 1: Escrever a migration**

Create `supabase/migrations/20260728_ponderada_config.sql`:

```sql
-- A RÉGUA da métrica ponderada: pesos, metas por objetivo e limiares do semáforo.
-- Linha ÚNICA (id = 1): é uma configuração da casa, não uma por usuário.
create table if not exists public.gt_ponderada_config (
  id          int primary key default 1 check (id = 1),
  pesos       jsonb not null default '{"curtidas":1,"comentarios":10,"salvamentos":30,"compartilhamentos":20}'::jsonb,
  metas       jsonb not null default '{"engajamento":0.20,"trafego":0.20,"reconhecimento":0.20,"mensagens":0.20,"leads":0.20,"vendas":0.20,"padrao":0.20}'::jsonb,
  limiares    jsonb not null default '{"escalarForte":0.8,"dentroMeta":1.0,"manter":1.3}'::jsonb,
  updated_at  timestamptz not null default now(),
  updated_by  uuid
);

insert into public.gt_ponderada_config (id) values (1) on conflict (id) do nothing;

-- HISTÓRICO: sem ele, a recomendação mudar de comportamento de uma semana pra
-- outra vira mistério. Guarda o antes e o depois inteiros.
create table if not exists public.gt_ponderada_config_log (
  id          bigserial primary key,
  mudou_em    timestamptz not null default now(),
  mudou_quem  uuid,
  antes       jsonb,
  depois      jsonb
);

alter table public.gt_ponderada_config enable row level security;
alter table public.gt_ponderada_config_log enable row level security;

-- Leitura: qualquer usuário logado (a tela inteira depende da régua pra calcular).
create policy ponderada_config_leitura on public.gt_ponderada_config
  for select to authenticated using (true);
create policy ponderada_log_leitura on public.gt_ponderada_config_log
  for select to authenticated using (true);

-- Escrita: só admin. Mexer num peso muda a recomendação de todo mundo.
-- Mesmo padrão de gt_config_metricas.
create policy ponderada_config_escrita on public.gt_ponderada_config
  for update to authenticated using (get_my_role() = 'admin') with check (get_my_role() = 'admin');
create policy ponderada_log_escrita on public.gt_ponderada_config_log
  for insert to authenticated with check (get_my_role() = 'admin');
```

- [ ] **Step 2: Aplicar em produção**

Aplicar o conteúdo do arquivo via MCP do Supabase: `apply_migration` com `project_id: kounqtdoioootxqegkij` e `name: ponderada_config`.

- [ ] **Step 3: Conferir que subiu**

Rodar via MCP `execute_sql`:

```sql
select id, pesos, metas, limiares from public.gt_ponderada_config;
```

Expected: 1 linha, `id = 1`, com os padrões da planilha (curtidas 1, comentários 10, salvamentos 30, compartilhamentos 20).

- [ ] **Step 4: Conferir as políticas**

```sql
select tablename, policyname, cmd from pg_policies
where tablename in ('gt_ponderada_config','gt_ponderada_config_log') order by tablename, policyname;
```

Expected: 4 linhas — leitura (SELECT) e escrita (UPDATE/INSERT) nas duas tabelas.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260728_ponderada_config.sql
git commit -m "feat(ponderada): tabelas da régua com histórico de alterações"
```

---

### Task 4: Leitura da régua com queda pro padrão

**Files:**
- Create: `src/ferramentas/gestao-trafego/regua.js`
- Test: `src/ferramentas/gestao-trafego/regua.test.mjs`

**Interfaces:**
- Consumes: `PESOS_PADRAO` e `LIMIARES_PADRAO` de `./ponderada.js` (Task 1).
- Produces: `normalizarRegua(linhaDoBanco) -> {pesos, metas, limiares}` e `metaDoBalde(regua, balde) -> number`.

**Por que existe:** a tela nunca pode quebrar porque a linha da régua sumiu, veio incompleta ou com texto no lugar de número. Este módulo é o filtro entre o banco e a conta.

- [ ] **Step 1: Write the failing test**

Create `src/ferramentas/gestao-trafego/regua.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizarRegua, metaDoBalde } from './regua.js';
import { PESOS_PADRAO, LIMIARES_PADRAO } from './ponderada.js';

test('linha vazia ou nula cai inteira no padrao', () => {
  assert.deepEqual(normalizarRegua(null).pesos, PESOS_PADRAO);
  assert.deepEqual(normalizarRegua(null).limiares, LIMIARES_PADRAO);
  assert.deepEqual(normalizarRegua(undefined).pesos, PESOS_PADRAO);
});

test('preenche so o que faltou, mantendo o que veio do banco', () => {
  const r = normalizarRegua({ pesos: { curtidas: 2 } });
  assert.equal(r.pesos.curtidas, 2, 'respeita o do banco');
  assert.equal(r.pesos.salvamentos, 30, 'completa com o padrao');
});

test('valor invalido (texto, negativo, NaN) cai no padrao daquele campo', () => {
  const r = normalizarRegua({ pesos: { curtidas: 'abc', comentarios: -5 }, limiares: { escalarForte: null } });
  assert.equal(r.pesos.curtidas, 1);
  assert.equal(r.pesos.comentarios, 10);
  assert.equal(r.limiares.escalarForte, 0.8);
});

test('metaDoBalde devolve a meta do balde e cai em padrao quando nao ha', () => {
  const r = normalizarRegua({ metas: { engajamento: 0.15, padrao: 0.3 } });
  assert.equal(metaDoBalde(r, 'engajamento'), 0.15);
  assert.equal(metaDoBalde(r, 'balde-que-nao-existe'), 0.3);
});

test('sem meta nenhuma devolve 0 (que o calculo trata como sem-dados)', () => {
  const r = normalizarRegua({ metas: {} });
  assert.equal(metaDoBalde(r, 'engajamento'), 0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test 2>&1 | grep -A3 "regua"`
Expected: FAIL — `Cannot find module './regua.js'`

- [ ] **Step 3: Write minimal implementation**

Create `src/ferramentas/gestao-trafego/regua.js`:

```js
// Filtro entre o banco e a conta. A tela NUNCA pode quebrar porque a linha da régua
// sumiu, veio pela metade ou com texto no lugar de número — aqui tudo vira número
// válido, caindo no padrão campo a campo. PURO: sem rede, sem tela.
import { PESOS_PADRAO, LIMIARES_PADRAO } from './ponderada.js';

// Número positivo e finito; qualquer outra coisa devolve o padrão daquele campo.
function positivoOu(valor, padrao) {
  const n = Number(valor);
  return (Number.isFinite(n) && n > 0) ? n : padrao;
}

function completar(vindo, padrao) {
  const saida = {};
  for (const chave of Object.keys(padrao)) saida[chave] = positivoOu(vindo && vindo[chave], padrao[chave]);
  return saida;
}

export function normalizarRegua(linha) {
  const l = linha || {};
  const metas = {};
  for (const [balde, valor] of Object.entries(l.metas || {})) {
    const n = Number(valor);
    if (Number.isFinite(n) && n > 0) metas[balde] = n;
  }
  return {
    pesos: completar(l.pesos, PESOS_PADRAO),
    limiares: completar(l.limiares, LIMIARES_PADRAO),
    metas,
  };
}

// Meta do balde; sem ela, tenta o 'padrao'; sem nenhum, devolve 0 — e 0 faz o
// cálculo devolver "sem-dados", que é melhor que inventar uma meta.
export function metaDoBalde(regua, balde) {
  const m = (regua && regua.metas) || {};
  if (m[balde] > 0) return m[balde];
  if (m.padrao > 0) return m.padrao;
  return 0;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test 2>&1 | tail -8`
Expected: `pass 277`, `fail 0`

- [ ] **Step 5: Commit**

```bash
git add src/ferramentas/gestao-trafego/regua.js src/ferramentas/gestao-trafego/regua.test.mjs
git commit -m "feat(ponderada): leitura da régua com queda pro padrão campo a campo"
```

---

### Task 5: Casca de abas na tela

**Files:**
- Modify: `src/ferramentas/gestao-trafego/tela-de-gestao-trafego.vue` (template: logo após `<div class="tela-gestao-trafego">`, e o bloco `<style scoped>`)

**Interfaces:**
- Produces: `_gtAbaAtiva` (`'campanhas' | 'regua'`) e a função `_gtTrocarAba(nome)`; o conteúdo atual da tela passa a viver dentro de `#gt-painel-campanhas`, e existe um `#gt-painel-regua` vazio para a Task 6 preencher.

**Contexto:** a tela é montada por DOM imperativo. A casca de abas só mostra/esconde painéis — **não** remonta nada, para não mexer no que já decide dinheiro.

- [ ] **Step 1: Adicionar a barra de abas e os painéis no template**

Logo abaixo da `<div class="gv-topbar">` que já existe, inserir:

```html
<div class="pnd-abas" role="tablist">
  <button class="pnd-aba ativa" id="pnd-aba-campanhas" role="tab" onclick="_gtTrocarAba('campanhas')">Campanhas</button>
  <button class="pnd-aba" id="pnd-aba-regua" role="tab" onclick="_gtTrocarAba('regua')">A régua</button>
</div>
```

E envolver todo o conteúdo que já existe abaixo da topbar num `<div id="gt-painel-campanhas">`, adicionando depois dele:

```html
<div id="gt-painel-regua" style="display:none"></div>
```

- [ ] **Step 2: Adicionar a troca de aba no script**

Junto das outras variáveis de estado (perto de `let _gtStatusFilter='all';`):

```js
let _gtAbaAtiva = 'campanhas';
```

E a função, junto das que já são expostas para `onclick` no template:

```js
// Troca de aba: só mostra/esconde painel. NÃO remonta a lista de campanhas —
// remontar dispararia chamadas à Meta de novo e pode custar rate-limit.
function _gtTrocarAba(nome) {
  _gtAbaAtiva = nome;
  for (const n of ['campanhas', 'regua']) {
    const painel = document.getElementById('gt-painel-' + n);
    const aba = document.getElementById('pnd-aba-' + n);
    if (painel) painel.style.display = (n === nome) ? '' : 'none';
    if (aba) aba.classList.toggle('ativa', n === nome);
  }
}
```

Expor a função do mesmo jeito que as vizinhas (`setGtPeriod`, `loadGtData`) já são expostas no `window`, seguindo o bloco que existe no fim do `<script setup>`.

- [ ] **Step 3: Adicionar o CSS**

No `<style scoped>`, junto dos outros `:deep()`:

```css
/* Abas da ferramenta. Prefixo .pnd- próprio: nomes globais vazam pra dentro de
   telas scoped neste projeto e já causaram bug antes. */
.tela-gestao-trafego :deep(.pnd-abas){display:flex;gap:4px;padding:0 4px 12px;flex-wrap:wrap;}
.tela-gestao-trafego :deep(.pnd-aba){font-family:var(--fonte-principal);font-size:calc(11px*var(--gt-fs,1.3));font-weight:700;letter-spacing:.4px;padding:7px 16px;border-radius:8px;cursor:pointer;border:1px solid var(--border);background:none;color:var(--muted);transition:all .15s;}
.tela-gestao-trafego :deep(.pnd-aba:hover){color:var(--accent);border-color:var(--accent);}
.tela-gestao-trafego :deep(.pnd-aba.ativa){background:var(--accent-light);border-color:var(--accent);color:var(--accent);}
```

- [ ] **Step 4: Conferir que nada quebrou**

Run: `npm run build 2>&1 | tail -3`
Expected: `✓ built in ...` sem erro.

Run: `npm test 2>&1 | tail -6`
Expected: `pass 277`, `fail 0`

Abrir a tela e conferir: as duas abas aparecem, "Campanhas" começa ativa com a lista igual a antes, e clicar em "A régua" mostra um painel vazio sem derrubar a lista.

- [ ] **Step 5: Commit**

```bash
git add src/ferramentas/gestao-trafego/tela-de-gestao-trafego.vue
git commit -m "feat(gestão de tráfego): casca de abas (Campanhas | A régua)"
```

---

### Task 6: Aba "A régua" — tabelas editáveis com exemplo vivo

**Files:**
- Create: `src/ferramentas/gestao-trafego/painel-regua.js`
- Modify: `src/ferramentas/gestao-trafego/tela-de-gestao-trafego.vue` (chamar o painel ao abrir a aba; CSS)

**Interfaces:**
- Consumes: `normalizarRegua`, `metaDoBalde` (Task 4); `calcularPonderada`, `PESOS_PADRAO`, `LIMIARES_PADRAO` (Task 1).
- Produces: `montarPainelRegua(elemento, {regua, exemplo, aoSalvar})` — desenha as tabelas e chama `aoSalvar(reguaNova)` quando o dono confirma. Puro quanto a I/O: **não** fala com o Supabase; quem salva é a tela.

**Regra de tela:** o campo é editável só para quem tem permissão de editar (`hasPermission('meta.gestor','editar')`); sem ela, mostra os valores em modo leitura. A escrita ainda é barrada por RLS no banco — a tela é espelho, não é a tranca.

- [ ] **Step 1: Escrever o painel**

Create `src/ferramentas/gestao-trafego/painel-regua.js`:

```js
// Aba "A régua": as tabelas que governam a métrica ponderada em toda a ferramenta.
// Não fala com o banco — recebe a régua pronta e devolve a editada pelo callback.
// O EXEMPLO VIVO ao lado é o ponto: sem ele o dono editaria peso no escuro.
import { calcularPonderada, PESOS_PADRAO, LIMIARES_PADRAO } from './ponderada.js';

const ROTULO_PESO = {
  curtidas: 'Curtida', comentarios: 'Comentário',
  salvamentos: 'Salvamento', compartilhamentos: 'Compartilhamento',
};
const ROTULO_BALDE = {
  engajamento: 'Engajamento', trafego: 'Tráfego', reconhecimento: 'Reconhecimento',
  mensagens: 'Mensagens', leads: 'Leads', vendas: 'Vendas', padrao: 'Padrão (usado quando não há regra própria)',
};
const ROTULO_LIMIAR = {
  escalarForte: 'Escalar forte quando o custo for até (× a meta)',
  dentroMeta: 'Dentro da meta quando for até (× a meta)',
  manter: 'Manter e observar quando for até (× a meta)',
};
const ROTULO_FAIXA = {
  'escalar-forte': '🟢 Escalar forte', 'dentro-da-meta': '🟢 Dentro da meta',
  'manter': '🟡 Manter / observar', 'otimizar': '🔴 Otimizar ou pausar', 'sem-dados': 'Sem dados',
};
const reais = (v) => v == null ? '—' : 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const inteiro = (v) => Number(v || 0).toLocaleString('pt-BR');
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function campo(id, valor, passo, editavel) {
  if (!editavel) return `<span class="pnd-valor">${esc(valor)}</span>`;
  return `<input class="pnd-input" id="${esc(id)}" type="number" min="0" step="${passo}" value="${esc(valor)}">`;
}

export function montarPainelRegua(alvo, opcoes) {
  const o = opcoes || {};
  const regua = o.regua;
  const editavel = !!o.editavel;
  const exemplo = o.exemplo || null;

  const linhasPeso = Object.keys(PESOS_PADRAO).map((k) =>
    `<tr><td>${ROTULO_PESO[k]}</td><td>${campo('pnd-peso-' + k, regua.pesos[k], '1', editavel)}</td></tr>`).join('');

  const linhasMeta = Object.keys(ROTULO_BALDE).map((b) =>
    `<tr><td>${ROTULO_BALDE[b]}</td><td>${campo('pnd-meta-' + b, regua.metas[b] != null ? regua.metas[b] : '', '0.01', editavel)}</td></tr>`).join('');

  const linhasLimiar = Object.keys(LIMIARES_PADRAO).map((k) =>
    `<tr><td>${ROTULO_LIMIAR[k]}</td><td>${campo('pnd-limiar-' + k, regua.limiares[k], '0.05', editavel)}</td></tr>`).join('');

  alvo.innerHTML = `
    <div class="pnd-regua">
      <div class="pnd-col">
        <div class="pnd-bloco">
          <h3 class="pnd-titulo">Quanto vale cada interação</h3>
          <p class="pnd-ajuda">Uma curtida vale 1 ponto. Se um salvamento vale 30, é como dizer que salvar equivale a 30 curtidas.</p>
          <table class="pnd-tabela"><tbody>${linhasPeso}</tbody></table>
        </div>
        <div class="pnd-bloco">
          <h3 class="pnd-titulo">Quanto você aceita pagar</h3>
          <p class="pnd-ajuda">Seu custo-alvo por ponto, em reais, para cada tipo de campanha. É o que dispara a decisão de verba.</p>
          <table class="pnd-tabela"><tbody>${linhasMeta}</tbody></table>
        </div>
        <div class="pnd-bloco">
          <h3 class="pnd-titulo">Quando cada cor acende</h3>
          <p class="pnd-ajuda">Multiplicadores da meta. 0,8 significa "custando 80% da meta ou menos".</p>
          <table class="pnd-tabela"><tbody>${linhasLimiar}</tbody></table>
        </div>
        ${editavel ? '<button class="pnd-salvar" id="pnd-salvar">Salvar a régua</button>' : '<p class="pnd-ajuda">Você não tem permissão para editar a régua.</p>'}
      </div>
      <div class="pnd-col">
        <div class="pnd-bloco pnd-exemplo" id="pnd-exemplo"></div>
      </div>
    </div>`;

  // Lê o que está nos campos AGORA (ou a régua atual, quando só-leitura).
  function reguaDaTela() {
    if (!editavel) return regua;
    const ler = (id, padrao) => {
      const el = document.getElementById(id);
      const n = el ? Number(el.value) : NaN;
      return (Number.isFinite(n) && n > 0) ? n : padrao;
    };
    const pesos = {}, metas = {}, limiares = {};
    for (const k of Object.keys(PESOS_PADRAO)) pesos[k] = ler('pnd-peso-' + k, PESOS_PADRAO[k]);
    for (const b of Object.keys(ROTULO_BALDE)) { const v = ler('pnd-meta-' + b, 0); if (v > 0) metas[b] = v; }
    for (const k of Object.keys(LIMIARES_PADRAO)) limiares[k] = ler('pnd-limiar-' + k, LIMIARES_PADRAO[k]);
    return { pesos, metas, limiares };
  }

  // EXEMPLO VIVO: recalcula com uma campanha real a cada tecla.
  function pintarExemplo() {
    const caixa = document.getElementById('pnd-exemplo');
    if (!caixa) return;
    if (!exemplo) {
      caixa.innerHTML = '<h3 class="pnd-titulo">Exemplo</h3><p class="pnd-ajuda">Abra a aba Campanhas primeiro para eu usar uma campanha sua de verdade aqui.</p>';
      return;
    }
    const r = reguaDaTela();
    const meta = r.metas[exemplo.balde] > 0 ? r.metas[exemplo.balde] : (r.metas.padrao || 0);
    const c = calcularPonderada(exemplo.quantidades, { pesos: r.pesos, limiares: r.limiares, meta });
    caixa.innerHTML = `
      <h3 class="pnd-titulo">Como fica na prática</h3>
      <p class="pnd-ajuda">Campanha <b>${esc(exemplo.nome)}</b>, com os números reais dela. Mexa nos campos ao lado e veja mudar aqui.</p>
      <table class="pnd-tabela"><tbody>
        <tr><td>Gasto</td><td>${reais(exemplo.quantidades.gasto)}</td></tr>
        <tr><td>Curtidas</td><td>${inteiro(exemplo.quantidades.curtidas)}</td></tr>
        <tr><td>Comentários</td><td>${inteiro(exemplo.quantidades.comentarios)}</td></tr>
        <tr><td>Salvamentos</td><td>${inteiro(exemplo.quantidades.salvamentos)}</td></tr>
        <tr><td>Compartilhamentos</td><td>${inteiro(exemplo.quantidades.compartilhamentos)}</td></tr>
        <tr class="pnd-destaque"><td>Pontos</td><td>${inteiro(c.pontos)}</td></tr>
        <tr class="pnd-destaque"><td>Custo por ponto</td><td>${reais(c.custoPorPonto)}</td></tr>
        <tr><td>Sua meta</td><td>${meta > 0 ? reais(meta) : '— (defina ao lado)'}</td></tr>
        <tr class="pnd-destaque"><td>Resultado</td><td>${ROTULO_FAIXA[c.faixa]}</td></tr>
      </tbody></table>`;
  }

  if (editavel) {
    alvo.querySelectorAll('.pnd-input').forEach((el) => el.addEventListener('input', pintarExemplo));
    const botao = document.getElementById('pnd-salvar');
    if (botao) botao.addEventListener('click', () => o.aoSalvar && o.aoSalvar(reguaDaTela(), botao));
  }
  pintarExemplo();
}
```

- [ ] **Step 2: Ligar o painel na tela**

Em `tela-de-gestao-trafego.vue`, importar no topo do `<script setup>`, junto dos outros imports:

```js
import { montarPainelRegua } from './painel-regua.js';
import { normalizarRegua, metaDoBalde } from './regua.js';
import { quantidadesDoInsight } from './ponderada.js';
```

Adicionar o estado e as funções de banco:

```js
let _gtRegua = normalizarRegua(null);   // começa no padrão; o banco sobrescreve

async function _gtCarregarRegua() {
  try {
    const linhas = await sb('gt_ponderada_config?select=pesos,metas,limiares&id=eq.1');
    _gtRegua = normalizarRegua((linhas || [])[0]);
  } catch (e) { _gtRegua = normalizarRegua(null); }
}

async function _gtSalvarRegua(nova, botao) {
  const orig = botao ? botao.textContent : '';
  if (botao) { botao.disabled = true; botao.textContent = 'Salvando...'; }
  try {
    const antes = _gtRegua;
    const { error } = await sbClient.from('gt_ponderada_config')
      .update({ pesos: nova.pesos, metas: nova.metas, limiares: nova.limiares, updated_at: new Date().toISOString() })
      .eq('id', 1);
    if (error) throw error;
    // histórico: guarda o antes e o depois inteiros (falha aqui NÃO desfaz o save)
    await sbClient.from('gt_ponderada_config_log').insert({ antes, depois: nova });
    _gtRegua = nova;
    adminToast('Régua salva');
    await loadGtData();           // a lista inteira recalcula com os pesos novos
  } catch (e) {
    adminToast('Erro ao salvar a régua: ' + String((e && e.message) || e || 'erro desconhecido'), false);
  } finally {
    if (botao) { botao.disabled = false; botao.textContent = orig; }
  }
}

// Campanha de maior gasto na tela, usada como exemplo vivo da aba da régua.
function _gtExemploParaRegua() {
  const linha = [..._gtInsights].sort((a, b) => Number(b.spend || 0) - Number(a.spend || 0))[0];
  if (!linha) return null;
  return {
    nome: linha.campaign_name || 'sua campanha',
    balde: _gtBalde(linha.objective),
    quantidades: quantidadesDoInsight(linha),
  };
}
```

Fazer `_gtTrocarAba` montar o painel ao entrar na aba da régua — substituir o corpo da função criada na Task 5 por:

```js
function _gtTrocarAba(nome) {
  _gtAbaAtiva = nome;
  for (const n of ['campanhas', 'regua']) {
    const painel = document.getElementById('gt-painel-' + n);
    const aba = document.getElementById('pnd-aba-' + n);
    if (painel) painel.style.display = (n === nome) ? '' : 'none';
    if (aba) aba.classList.toggle('ativa', n === nome);
  }
  if (nome === 'regua') {
    const alvo = document.getElementById('gt-painel-regua');
    if (alvo) montarPainelRegua(alvo, {
      regua: _gtRegua,
      editavel: hasPermission('meta.gestor', 'editar'),
      exemplo: _gtExemploParaRegua(),
      aoSalvar: _gtSalvarRegua,
    });
  }
}
```

E chamar `await _gtCarregarRegua();` dentro de `loadGtData()`, logo depois de `await _gtLoadConfig();`.

- [ ] **Step 3: Adicionar o CSS**

No `<style scoped>`:

```css
.tela-gestao-trafego :deep(.pnd-regua){display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:16px;align-items:start;}
.tela-gestao-trafego :deep(.pnd-col){display:flex;flex-direction:column;gap:16px;min-width:0;}
.tela-gestao-trafego :deep(.pnd-bloco){background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:16px;}
.tela-gestao-trafego :deep(.pnd-titulo){font-family:var(--fonte-principal);font-size:calc(13px*var(--gt-fs,1.3));font-weight:800;color:var(--text);margin:0 0 4px;}
.tela-gestao-trafego :deep(.pnd-ajuda){font-family:var(--fonte-principal);font-size:calc(11px*var(--gt-fs,1.3));color:var(--muted);margin:0 0 12px;line-height:1.5;}
.tela-gestao-trafego :deep(.pnd-tabela){width:100%;border-collapse:collapse;}
.tela-gestao-trafego :deep(.pnd-tabela td){padding:7px 0;border-bottom:1px solid var(--border);font-family:var(--fonte-principal);font-size:calc(12px*var(--gt-fs,1.3));color:var(--text);}
.tela-gestao-trafego :deep(.pnd-tabela td:last-child){text-align:right;white-space:nowrap;}
.tela-gestao-trafego :deep(.pnd-destaque td){font-weight:800;}
.tela-gestao-trafego :deep(.pnd-input){width:96px;padding:5px 8px;border:1px solid var(--border);border-radius:7px;background:var(--surface2);color:var(--text);font-family:var(--fonte-principal);font-size:calc(12px*var(--gt-fs,1.3));text-align:right;}
.tela-gestao-trafego :deep(.pnd-input:focus){outline:none;border-color:var(--accent);}
.tela-gestao-trafego :deep(.pnd-valor){font-weight:700;}
.tela-gestao-trafego :deep(.pnd-salvar){align-self:flex-start;padding:9px 20px;border-radius:20px;border:none;background:var(--accent);color:#fff;font-family:var(--fonte-principal);font-size:calc(12px*var(--gt-fs,1.3));font-weight:700;cursor:pointer;}
.tela-gestao-trafego :deep(.pnd-salvar:disabled){opacity:.65;cursor:default;}
```

- [ ] **Step 4: Conferir**

Run: `npm run build 2>&1 | tail -3` → sem erro.
Run: `npm test 2>&1 | tail -6` → `pass 277`, `fail 0`.

Na tela: abrir "A régua"; as três tabelas aparecem preenchidas; mudar o peso do salvamento de 30 para 60 muda os pontos e o resultado do exemplo **na hora**; salvar mostra "Régua salva" e a lista de campanhas recalcula.

- [ ] **Step 5: Commit**

```bash
git add src/ferramentas/gestao-trafego/painel-regua.js src/ferramentas/gestao-trafego/tela-de-gestao-trafego.vue
git commit -m "feat(ponderada): aba da régua com pesos, metas, limiares e exemplo vivo"
```

---

### Task 7: Custo por ponto e veredito único no cartão

**Files:**
- Modify: `src/ferramentas/gestao-trafego/tela-de-gestao-trafego.vue` (dentro de `renderList`, onde hoje se calcula `iaRow` — linha ~971 antes das tarefas anteriores)

**Interfaces:**
- Consumes: `calcularPonderada`, `quantidadesDoInsight` (Task 1); `decidirVeredito` (Task 2); `metaDoBalde` (Task 4); `_gtRegua` (Task 6).
- Produces: nada para tarefas seguintes — é o consumo final da Fase 1.

**Contexto:** hoje o cartão faz
`const iaRow = _gtBudgetIA[ins.campaign_id] || ((!encerrada && status==='ACTIVE') ? _gtRegraCampanha(camp,ins,insights) : null);`
e passa `iaRow` para `_gtRecBanner`. A mudança é: calcular a ponderada, decidir o veredito pela ordem de precedência, e mostrar o custo por ponto entre os KPIs.

- [ ] **Step 1: Calcular a ponderada e o veredito no cartão**

Substituir a linha do `iaRow` por:

```js
// PONDERADA: pontos e custo por ponto desta campanha, com a régua do dono.
const qtdsPnd = quantidadesDoInsight(ins);
const metaPnd = metaDoBalde(_gtRegua, _gtBalde(kpiObjective));
const pnd = calcularPonderada(qtdsPnd, { pesos: _gtRegua.pesos, limiares: _gtRegua.limiares, meta: metaPnd });

// VEREDITO ÚNICO (ver veredito.js): saúde veta > Opus > ponderada.
// _gtRegraCampanha continua sendo a leitura de SAÚDE (frequência, CTR).
const saudePnd = (!encerrada && status === 'ACTIVE') ? _gtRegraCampanha(camp, ins, insights) : null;
const opusPnd = _gtBudgetIA[ins.campaign_id] || null;
const decisao = decidirVeredito({
  saude: saudePnd,
  opus: opusPnd,
  ponderada: { ...pnd, meta: metaPnd },
});

// A faixa continua recebendo o formato que ela já espera hoje.
const iaRow = decisao.veredito === 'sem-dados' ? null : {
  veredito: decisao.veredito,
  justificativa: decisao.porque,
  budget_sugerido_centavos: (opusPnd && opusPnd.budget_sugerido_centavos) || (saudePnd && saudePnd.budget_sugerido_centavos) || null,
};
```

- [ ] **Step 2: Mostrar o custo por ponto entre os KPIs**

Logo depois de `metrics.innerHTML=_gtKpisHtml(...)`, acrescentar:

```js
// Custo por ponto aparece SEMPRE, independente de quem deu o veredito:
// é informação, não decisão.
if (pnd.custoPorPonto != null) {
  const cor = pnd.faixa === 'escalar-forte' || pnd.faixa === 'dentro-da-meta' ? 'var(--green)'
    : pnd.faixa === 'manter' ? 'var(--orange)' : pnd.faixa === 'otimizar' ? 'var(--red)' : 'var(--muted)';
  const extra = document.createElement('div');
  extra.className = 'gt-metric';
  extra.title = `${_maFmt(pnd.pontos, 0)} pontos · cada interação vale ${_maFmt(pnd.qualidade, 1)}`;
  extra.innerHTML = `Custo/ponto <span style="color:${cor}">${_maFmtR(pnd.custoPorPonto)}</span>`;
  metrics.appendChild(extra);
}
```

- [ ] **Step 3: Conferir que o build e a suíte seguem de pé**

Run: `npm run build 2>&1 | tail -3` → sem erro.
Run: `npm test 2>&1 | tail -6` → `pass 277`, `fail 0`.

- [ ] **Step 4: Conferir na tela, com número conferido na mão**

Abrir a Gestão de Tráfego na conta **Breno Vale** e conferir três coisas:
1. toda campanha com interação mostra "Custo/ponto";
2. numa campanha qualquer, `gasto ÷ pontos` bate com o que a tela mostra — some as interações e multiplique pelos pesos da aba da régua;
3. campanha sem interação nenhuma **não** mostra o KPI (em vez de mostrar R$ 0,00).

- [ ] **Step 5: Commit**

```bash
git add src/ferramentas/gestao-trafego/tela-de-gestao-trafego.vue
git commit -m "feat(ponderada): custo por ponto e veredito único no cartão da campanha"
```

---

### Task 8: LEIA-ME da ferramenta

**Files:**
- Modify: `src/ferramentas/gestao-trafego/LEIA-ME.txt`

**Contexto:** a casa documenta cada pasta com um LEIA-ME em português para iniciante. A Fase 1 mudou como o veredito é decidido — sem isso registrado, quem abrir a pasta daqui a três meses não entende por que a recomendação mudou.

- [ ] **Step 1: Acrescentar a seção**

Adicionar ao fim de `src/ferramentas/gestao-trafego/LEIA-ME.txt`:

```
MÉTRICA PONDERADA (desde 2026-07-28)
=====================================
Em vez de contar interações no bruto, a ferramenta converte cada uma em PONTOS
conforme o valor dela. Curtir vale 1; salvar vale 30. A ideia: quem salva um post
demonstra muito mais interesse do que quem curte, e a conta precisa refletir isso.

Com os pontos, sai o CUSTO POR PONTO (gasto ÷ pontos). Comparado com a meta que o
dono define na aba "A régua", ele acende o semáforo.

Arquivos:
- ponderada.js .... a conta (pontos, custo por ponto, qualidade, semáforo). Puro.
- veredito.js ..... decide o veredito do cartão. Puro.
- regua.js ........ lê a régua do banco sem deixar a tela quebrar. Puro.
- painel-regua.js . a aba onde o dono edita pesos, metas e limiares.
Os três primeiros têm teste ao lado (.test.mjs) e rodam com `npm test`.

O VEREDITO É UM SÓ, decidido nesta ordem (não existem dois selos disputando):
  1. Saúde manda pausar  -> PAUSA, por mais barato que esteja. Frequência alta
     queima a audiência, e preço baixo não conserta isso.
  2. Saúde ok e há análise do Opus -> vale o Opus.
  3. Saúde ok e sem Opus -> vale a ponderada.
O custo por ponto aparece SEMPRE, independente de quem deu o veredito: ele é
informação, não decisão.

MÉTRICAS LÍQUIDAS: quando a Meta oferece a versão líquida (que já desconta quem
descurtiu ou dessalvou), ela vence a bruta. Líquida valendo ZERO é zero mesmo —
não cai pra bruta.

A RÉGUA fica na tabela gt_ponderada_config (linha única) e toda alteração é
gravada em gt_ponderada_config_log. Sem esse histórico, a recomendação mudar de
comportamento de uma semana pra outra viraria mistério.
```

- [ ] **Step 2: Commit**

```bash
git add src/ferramentas/gestao-trafego/LEIA-ME.txt
git commit -m "docs(gestão de tráfego): explica a métrica ponderada e a ordem do veredito"
```

---

## Autorrevisão do plano

**Cobertura da spec (Fase 1):** módulos puros → Tasks 1 e 2. Régua com pesos, metas por objetivo, limiares, exemplo vivo e histórico → Tasks 3, 4 e 6. Ponderada visível na aba 1 (coluna + veredito) → Task 7. Permissão da aba 4 (editar) → Task 6, com RLS na Task 3. Métricas líquidas → Task 1. Divisão por zero e "nunca inventar número" → Tasks 1 e 7.

**Fora da Fase 1, por desenho:** abas Funil, Conteúdo e Aprovação; filtro de campanhas; aposentadoria de `/meta-campanhas`; escada de mensagens e funil de vendas na ponderação (a régua já guarda meta por balde, mas quem consome hoje é só o balde de engajamento). Tudo isso está nas fases 2 a 4 da spec.

**Consistência de nomes conferida:** `calcularPonderada`, `quantidadesDoInsight`, `PESOS_PADRAO`, `LIMIARES_PADRAO` (Task 1) são usados com o mesmo nome nas Tasks 4, 6 e 7; `normalizarRegua`/`metaDoBalde` (Task 4) idem nas Tasks 6 e 7; `decidirVeredito` (Task 2) na Task 7; `montarPainelRegua` (Task 6) chamado por `_gtTrocarAba` (Task 5). A contagem de testes cresce 256 → 266 → 272 → 277 e é conferida ao fim de cada tarefa.
