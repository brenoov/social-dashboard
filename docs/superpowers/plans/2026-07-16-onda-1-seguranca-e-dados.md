# Onda 1 — Segurança e Dados Confiáveis (risco zero de usuário)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fechar o endpoint aberto na internet, matar os 4 bugs de fuso que zeram painéis à noite, e fazer toda falha de busca virar aviso visível — a instrumentação sem a qual as Ondas 2 e 3 seriam cegas.

**Architecture:** Lógica pura em módulos novos fora dos `.vue` (`datas.js`, `classificar-erro.js`), testados com `node:test`. O helper `sb()` passa a anexar `.erro` num array (compatível com os 53 sítios existentes) e as telas críticas ganham uma faixa de aviso. As Edge Functions de cron ganham auth self-contained no padrão já usado pela `fabrica-purga`.

**Tech Stack:** Vue 3 + Vite, Supabase (PostgREST + Edge Functions Deno), `node:test` (sem dependência nova), GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-07-16-seguranca-e-dados-design.md`

## Global Constraints

- **Português literal, sem jargão** em todo texto que o usuário lê. O Breno lê "sua sessão expirou", nunca "PGRST301".
- **Nomes de arquivo/pasta em português kebab-case literal** (ex.: `classificar-erro.js`). Só nomes fixos de ferramenta ficam técnicos.
- **Nenhuma dependência nova.** Testes com `node:test`. Sem Vitest, sem Testing Library.
- **Não tocar** em `legacy/` nem `projetos/central-inteligencia/` (código morto).
- **Não mexer em dados reais** para testar. Usar perfil descartável ou só leitura.
- **Fuso do negócio é `America/Sao_Paulo`**, sempre explícito. Nunca depender do fuso da máquina.
- **Nem todo `toISOString()` é bug.** Só os 4 sítios listados na Task 5. `updated_at: new Date().toISOString()` e o truque `T12:00:00` são corretos — não tocar.
- **Projeto Supabase:** `kounqtdoioootxqegkij`. Repo do GitHub: `brenoov/social-dashboard` (conta `gh`: `brenoov`).
- **Commits:** autoria `brenoov <breno@rbvcompany.com>` (convenção do repo). `user.email` vazio trava o build na Vercel.
- **Não fazer push nem deploy** sem o dono pedir.

---

### Task 1: Rodar os testes automaticamente

Existem 24 arquivos `.test.mjs` (50 testes) que passam, mas nenhum `npm test` e nenhum CI os executa. Sem isso, os testes das tasks seguintes não valem nada.

**Files:**
- Modify: `package.json` (bloco `scripts`)
- Create: `.github/workflows/testes.yml`

**Interfaces:**
- Consumes: nada.
- Produces: `npm test` roda todos os `.test.mjs` de `src/` e `coletor/`. Todas as tasks seguintes usam esse comando.

- [ ] **Step 1: Confirmar que os testes passam hoje**

```bash
cd /Users/erickmartins/iamundi
node --test 'src/**/*.test.mjs' 'coletor/**/*.test.mjs'
```

Esperado: `pass 50`, `fail 0`. Se algo falhar aqui, PARE e reporte — é regressão pré-existente, não parte desta task.

- [ ] **Step 2: Adicionar o script `test` ao package.json**

Em `package.json`, o bloco `scripts` passa de:

```json
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
```

para:

```json
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "node --test 'src/**/*.test.mjs' 'coletor/**/*.test.mjs'"
  },
```

- [ ] **Step 3: Rodar via npm para confirmar**

```bash
npm test
```

Esperado: `pass 50`, `fail 0`.

- [ ] **Step 4: Criar o workflow de CI**

Criar `.github/workflows/testes.yml`:

```yaml
name: Testes

on:
  push:
    branches: [main]
  pull_request:

jobs:
  testes:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
      - run: npm ci
      - run: npm test
```

- [ ] **Step 5: Commit**

```bash
cd /Users/erickmartins/iamundi
git add package.json .github/workflows/testes.yml
git commit -m "test: npm test + CI rodando os 24 arquivos de teste que ninguem rodava"
```

---

### Task 2: Versionar as 5 Edge Functions órfãs

Produção tem 18 funções; o repo tem 13. Cinco nunca foram versionadas — entre elas o `meta-proxy`, que guarda o token da Meta. Um deploy futuro poderia perdê-las. **Esta task não altera comportamento algum**: só traz para o git o que já está no ar.

**Files:**
- Create: `supabase/functions/invite-user/index.ts`
- Create: `supabase/functions/bling-proxy/index.ts`
- Create: `supabase/functions/meta-proxy/index.ts`
- Create: `supabase/functions/comparar-metricas/index.ts`
- Create: `supabase/functions/probe-fidelidade/index.ts`

**Interfaces:**
- Consumes: nada.
- Produces: o `meta-proxy` versionado, que a Onda 3 vai precisar auditar.

- [ ] **Step 1: Baixar o código de cada função da produção**

Para cada slug (`invite-user`, `bling-proxy`, `meta-proxy`, `comparar-metricas`, `probe-fidelidade`), use a ferramenta MCP:

```
mcp__plugin_supabase_supabase__get_edge_function
  project_id: kounqtdoioootxqegkij
  function_slug: <slug>
```

Grave o conteúdo de `files[].content` **verbatim** em `supabase/functions/<slug>/index.ts`. Não reformate, não "melhore", não conserte nada — o objetivo é que o git reflita exatamente o que está no ar.

- [ ] **Step 2: Verificar que nenhum segredo veio junto**

```bash
cd /Users/erickmartins/iamundi
grep -rnE "(eyJ[A-Za-z0-9_-]{20,}|sk-[A-Za-z0-9]{20,}|EAA[A-Za-z0-9]{20,})" supabase/functions/invite-user supabase/functions/bling-proxy supabase/functions/meta-proxy supabase/functions/comparar-metricas supabase/functions/probe-fidelidade
```

Esperado: **nenhuma saída**. Se algo aparecer, é um segredo hardcoded no código de produção — PARE, não commite, e reporte ao dono imediatamente (o repo é público).

- [ ] **Step 3: Registrar o que cada uma faz**

Criar `supabase/functions/LEIA-ME.txt` se não existir, ou acrescentar ao existente uma linha por função nova, em português literal, dizendo o que ela faz e quem a chama. Leia o código que você baixou para escrever isso com precisão — não invente.

- [ ] **Step 4: Commit**

```bash
cd /Users/erickmartins/iamundi
git add supabase/functions/
git commit -m "chore(edge): versiona as 5 funcoes que so existiam em producao

invite-user, bling-proxy, meta-proxy, comparar-metricas, probe-fidelidade.
Codigo copiado verbatim da producao (get_edge_function), sem alteracao de
comportamento. O meta-proxy guarda o token da Meta e por nao estar no repo
ficou de fora da auditoria."
```

---

### Task 3: Investigar "Meta Ads sem dados" antes de consertar

Usuários relatam que a seção Meta Ads não mostra dado nenhum. A hipótese é o fuso (Task 4/5), mas **hipótese bonita não é diagnóstico**. Esta task produz a causa raiz provada.

**REQUIRED SUB-SKILL:** Use `superpowers:systematic-debugging`.

**Files:**
- Create: `docs/superpowers/plans/2026-07-16-onda-1-diagnostico-meta-ads.md` (o achado)

**Interfaces:**
- Consumes: nada.
- Produces: a causa raiz confirmada. Se for o fuso, as Tasks 4-5 cobrem. Se for outra, esta task **acrescenta uma task nova ao plano** antes de seguir.

- [ ] **Step 1: Reproduzir**

Rode a app local (`npm run dev`) e abra a Gestão de Tráfego. Reproduza a condição das 21h-00h BRT sem esperar a noite: no DevTools, force o relógio, ou chame direto o trecho de data com um `Date` fixo. O alvo é `tela-de-gestao-trafego.vue:525`:

```js
const _gi=d=>d.toISOString().slice(0,10);
const _gy=now.getFullYear(),_gm=now.getMonth(),_gt=_gi(now);
if(_gtPreset==='today'){since=_gt;until=_gt;}
```

Verifique: às 22h BRT, `_gt` vira a data de **amanhã**? A Meta devolve vazio para uma janela futura?

- [ ] **Step 2: Listar as hipóteses concorrentes e testar cada uma**

Não pare na primeira. As três candidatas da auditoria:

1. **Fuso** (`_gi` em UTC) → board vazio das 21h às 00h, para todos.
2. **`sb()` engolindo erro** → `catch { return [] }` faz 401/403/5xx virar lista vazia, a qualquer hora.
3. **`allowed_accounts`** → usuário escopado a um perfil vê vazio em outro.

Para distinguir: a hipótese 1 só acontece à noite; a 2 acontece a qualquer hora e some ao recarregar; a 3 depende de qual usuário.

- [ ] **Step 3: Escrever o diagnóstico**

Crie `docs/superpowers/plans/2026-07-16-onda-1-diagnostico-meta-ads.md` com: o que foi reproduzido, qual hipótese sobreviveu, qual evidência a confirma, e quais hipóteses foram descartadas e por quê.

- [ ] **Step 4: Decidir**

- Se a causa for **só o fuso** → siga para a Task 4. Nada muda no plano.
- Se houver **causa adicional** → PARE e reporte ao dono com o diagnóstico antes de escrever código. O plano ganha uma task.

- [ ] **Step 5: Commit**

```bash
cd /Users/erickmartins/iamundi
git add docs/superpowers/plans/2026-07-16-onda-1-diagnostico-meta-ads.md
git commit -m "docs: diagnostico da causa raiz do 'Meta Ads sem dados'"
```

---

### Task 4: Módulo de datas em BRT explícito

Cria a régua única. `toLocaleDateString('en-CA', { timeZone })` é o padrão **já usado em 8 lugares** do projeto e no `coletar-dados`. Superior a `getFullYear/getDate`, que devolve o fuso da máquina de quem olha.

**Files:**
- Create: `src/compartilhado/datas.js`
- Test: `src/compartilhado/datas.test.mjs`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `hojeLocal(): string` → `'YYYY-MM-DD'` de hoje em BRT
  - `diasAtras(n: number): string` → `'YYYY-MM-DD'` de hoje−n em BRT
  - `primeiroDiaDoMes(offsetMeses?: number): string` → `'YYYY-MM-DD'`, offset 0 = mês atual, −1 = mês passado
  - `ultimoDiaDoMes(offsetMeses?: number): string` → `'YYYY-MM-DD'`

- [ ] **Step 1: Escrever os testes que falham**

Criar `src/compartilhado/datas.test.mjs`:

```js
import { test, mock } from 'node:test'
import assert from 'node:assert/strict'
import { hojeLocal, diasAtras, primeiroDiaDoMes, ultimoDiaDoMes } from './datas.js'

// 2026-07-17T01:30:00Z = 16/07/2026 às 22h30 em Brasília (UTC-3).
// É a janela exata do bug: o toISOString() do código atual já diz "17".
const NOITE_DO_DIA_16 = new Date('2026-07-17T01:30:00Z')

test('as 22h30 BRT do dia 16, hoje ainda e o dia 16', () => {
  mock.timers.enable({ apis: ['Date'], now: NOITE_DO_DIA_16 })
  assert.equal(hojeLocal(), '2026-07-16')
  mock.timers.reset()
})

test('as 22h30 BRT, ontem e o dia 15 (nao o 16)', () => {
  mock.timers.enable({ apis: ['Date'], now: NOITE_DO_DIA_16 })
  assert.equal(diasAtras(1), '2026-07-15')
  mock.timers.reset()
})

test('as 22h30 BRT, 7 dias atras e o dia 09', () => {
  mock.timers.enable({ apis: ['Date'], now: NOITE_DO_DIA_16 })
  assert.equal(diasAtras(7), '2026-07-09')
  mock.timers.reset()
})

test('de manha o resultado e o mesmo dia', () => {
  mock.timers.enable({ apis: ['Date'], now: new Date('2026-07-16T13:00:00Z') }) // 10h BRT
  assert.equal(hojeLocal(), '2026-07-16')
  assert.equal(diasAtras(1), '2026-07-15')
  mock.timers.reset()
})

test('diasAtras atravessa a virada do mes', () => {
  mock.timers.enable({ apis: ['Date'], now: new Date('2026-07-02T15:00:00Z') }) // 02/07 12h BRT
  assert.equal(diasAtras(3), '2026-06-29')
  mock.timers.reset()
})

test('diasAtras atravessa a virada do ano', () => {
  mock.timers.enable({ apis: ['Date'], now: new Date('2026-01-02T15:00:00Z') })
  assert.equal(diasAtras(3), '2025-12-30')
  mock.timers.reset()
})

test('primeiro e ultimo dia do mes atual', () => {
  mock.timers.enable({ apis: ['Date'], now: NOITE_DO_DIA_16 })
  assert.equal(primeiroDiaDoMes(), '2026-07-01')
  assert.equal(ultimoDiaDoMes(), '2026-07-31')
  mock.timers.reset()
})

test('primeiro e ultimo dia do mes passado', () => {
  mock.timers.enable({ apis: ['Date'], now: NOITE_DO_DIA_16 })
  assert.equal(primeiroDiaDoMes(-1), '2026-06-01')
  assert.equal(ultimoDiaDoMes(-1), '2026-06-30')
  mock.timers.reset()
})

test('ultimo dia do mes lida com fevereiro bissexto', () => {
  mock.timers.enable({ apis: ['Date'], now: new Date('2028-03-10T15:00:00Z') })
  assert.equal(ultimoDiaDoMes(-1), '2028-02-29')
  mock.timers.reset()
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
cd /Users/erickmartins/iamundi
node --test src/compartilhado/datas.test.mjs
```

Esperado: FALHA com `Cannot find module './datas.js'`.

- [ ] **Step 3: Implementar**

Criar `src/compartilhado/datas.js`:

```js
// Régua única de datas do painel. O negócio é no Brasil: toda janela é BRT,
// independentemente do fuso da máquina de quem está olhando.
//
// NUNCA use new Date().toISOString().slice(0,10) para pegar "hoje": isso devolve
// UTC, e das 21h à meia-noite BRT já é o dia seguinte lá — foi o que fazia o
// painel dizer que ninguém vendeu, gastou ou postou no fim da noite.
const TZ = 'America/Sao_Paulo'

// Data local (BRT) de um Date, no formato YYYY-MM-DD. 'en-CA' produz esse formato.
function _fmt(d) {
  return d.toLocaleDateString('en-CA', { timeZone: TZ })
}

// Meio-dia BRT do dia informado. Âncora segura para aritmética de dias: longe das
// duas bordas, então somar/subtrair dias nunca escorrega por causa de horário de verão.
function _meioDia(diaISO) {
  return new Date(`${diaISO}T12:00:00-03:00`)
}

export function hojeLocal() {
  return _fmt(new Date())
}

export function diasAtras(n) {
  const d = _meioDia(hojeLocal())
  d.setDate(d.getDate() - n)
  return _fmt(d)
}

export function primeiroDiaDoMes(offsetMeses = 0) {
  const [ano, mes] = hojeLocal().split('-').map(Number)
  const d = _meioDia(`${ano}-${String(mes).padStart(2, '0')}-01`)
  d.setMonth(d.getMonth() + offsetMeses)
  return _fmt(d)
}

export function ultimoDiaDoMes(offsetMeses = 0) {
  const [ano, mes] = hojeLocal().split('-').map(Number)
  const d = _meioDia(`${ano}-${String(mes).padStart(2, '0')}-01`)
  // Dia 0 do mês seguinte = último dia deste mês. Cobre 28/29/30/31 sem tabela.
  d.setMonth(d.getMonth() + offsetMeses + 1)
  d.setDate(0)
  return _fmt(d)
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

```bash
cd /Users/erickmartins/iamundi
node --test src/compartilhado/datas.test.mjs
```

Esperado: `pass 9`, `fail 0`.

- [ ] **Step 5: Documentar a pasta**

Acrescentar a `src/compartilhado/LEIA-ME.txt` uma linha sobre o `datas.js`, em português literal: para que serve e por que existe (o bug das 21h).

- [ ] **Step 6: Commit**

```bash
cd /Users/erickmartins/iamundi
git add src/compartilhado/datas.js src/compartilhado/datas.test.mjs src/compartilhado/LEIA-ME.txt
git commit -m "feat(datas): regua unica de datas em BRT explicito

toLocaleDateString('en-CA',{timeZone}) — padrao ja usado em 8 lugares do
projeto e no coletar-dados. Melhor que getDate(), que devolve o fuso da
maquina de quem olha."
```

---

### Task 5: Aplicar a régua nos 4 sítios de fuso

**Só estes 4.** Os demais `toISOString()` do projeto estão corretos (timestamps de `updated_at`; truque `T12:00:00`; laços `T00:00:00` que em UTC-3 permanecem no mesmo dia). Tocar neles quebraria coisa que funciona.

**Files:**
- Modify: `src/ferramentas/gestao-trafego/tela-de-gestao-trafego.vue:523-531`
- Modify: `src/ferramentas/analise-vendas/tela-de-analise-vendas.vue:1030-1032`
- Modify: `src/ferramentas/redes-sociais/tela-de-redes-sociais.vue:1677`
- Modify: `src/ferramentas/acessos/tela-de-acessos.vue:1028`

**Interfaces:**
- Consumes: `hojeLocal`, `diasAtras`, `primeiroDiaDoMes`, `ultimoDiaDoMes` de `src/compartilhado/datas.js` (Task 4).
- Produces: nada.

- [ ] **Step 1: Gestão de Tráfego — o sítio que zera o board à noite**

Em `src/ferramentas/gestao-trafego/tela-de-gestao-trafego.vue`, adicione o import junto aos demais imports do `<script setup>`:

```js
import { hojeLocal, diasAtras, primeiroDiaDoMes, ultimoDiaDoMes } from '../../compartilhado/datas.js'
```

Substitua o bloco (linhas ~523-531):

```js
    // Date range
    const now=new Date();
    let since,until;
    const _gi=d=>d.toISOString().slice(0,10);
    const _gy=now.getFullYear(),_gm=now.getMonth(),_gt=_gi(now);
    if(_gtPreset==='today'){since=_gt;until=_gt;}
    else if(_gtPreset==='1d'){since=until=_gi(new Date(now.getTime()-86400000));}
    else if(_gtPreset==='lastmonth'){since=_gi(new Date(_gy,_gm-1,1));until=_gi(new Date(_gy,_gm,0));}
    else if(_gtPreset==='monthfull'||_gtPreset==='sofar'){since=_gi(new Date(_gy,_gm,1));until=_gt;}
    else{const n=parseInt(_gtPreset)||30;since=_gi(new Date(now.getTime()-n*86400000));until=_gt;}
```

por:

```js
    // Janela de datas — sempre em BRT (ver src/compartilhado/datas.js).
    // Antes usava toISOString() (UTC): das 21h à meia-noite "HOJE" pedia a data de
    // amanhã e o board vinha vazio, como se ninguém tivesse gasto nada.
    let since,until;
    const _gt=hojeLocal();
    if(_gtPreset==='today'){since=_gt;until=_gt;}
    else if(_gtPreset==='1d'){since=until=diasAtras(1);}
    else if(_gtPreset==='lastmonth'){since=primeiroDiaDoMes(-1);until=ultimoDiaDoMes(-1);}
    else if(_gtPreset==='monthfull'||_gtPreset==='sofar'){since=primeiroDiaDoMes();until=_gt;}
    else{const n=parseInt(_gtPreset)||30;since=diasAtras(n);until=_gt;}
```

**Atenção:** `now` era usado só neste bloco? Confirme com `grep -n "now" src/ferramentas/gestao-trafego/tela-de-gestao-trafego.vue | sed -n '1,40p'` antes de remover a linha `const now=new Date();`. Se outro trecho da mesma função usar `now`, mantenha a declaração.

- [ ] **Step 2: Análise de Vendas — a coluna "Hoje" que zera às 22h**

Em `src/ferramentas/analise-vendas/tela-de-analise-vendas.vue`, adicione o import:

```js
import { hojeLocal, diasAtras } from '../../compartilhado/datas.js'
```

Substitua (linhas ~1030-1032):

```js
  const hoje=now.toISOString().slice(0,10);
  const ontem=new Date(now-864e5).toISOString().slice(0,10);
  const diaSem=new Date(now-6*864e5).toISOString().slice(0,10);
```

por:

```js
  // BRT explícito: o toISOString() daqui reconvertia para UTC e somava 3h, então às
  // 22h a coluna "Hoje" zerava para todas as vendedoras e "Ontem" mostrava hoje.
  // (O comentário da linha 307 deste mesmo arquivo já avisava contra isso.)
  const hoje=hojeLocal();
  const ontem=diasAtras(1);
  const diaSem=diasAtras(6);
```

- [ ] **Step 3: Redes Sociais — os anéis de story que somem à noite**

Em `src/ferramentas/redes-sociais/tela-de-redes-sociais.vue`, adicione o import:

```js
import { hojeLocal } from '../../compartilhado/datas.js'
```

Substitua (linha ~1677):

```js
    const today = new Date().toISOString().slice(0, 10)
```

por:

```js
    // BRT: com toISOString() (UTC), das 21h à meia-noite a query pedia um dia que em
    // Brasília nem tinha começado → zero linhas → o anel sumia de TODOS os perfis.
    const today = hojeLocal()
```

- [ ] **Step 4: Acessos — a data de desligamento**

Em `src/ferramentas/acessos/tela-de-acessos.vue`, adicione o import:

```js
import { hojeLocal } from '../../compartilhado/datas.js'
```

Substitua (linha ~1028):

```js
  const hoje=new Date().toISOString().slice(0,10);
```

por:

```js
  const hoje=hojeLocal(); // BRT: às 22h o default vinha com a data de amanhã
```

- [ ] **Step 5: Confirmar que nenhum sítio correto foi tocado**

```bash
cd /Users/erickmartins/iamundi
git diff --stat
grep -rn "toISOString" src --include='*.vue' | grep -vE "updated_at|atualizado_em|criado_em|T12:00:00|T00:00:00"
```

Esperado no `git diff --stat`: exatamente 4 arquivos `.vue` modificados. Esperado no grep: **nenhuma saída**. Se aparecer algo, ou sobrou um sítio, ou você tocou num correto — investigue antes de commitar.

- [ ] **Step 6: Rodar os testes e o build**

```bash
cd /Users/erickmartins/iamundi
npm test && npm run build
```

Esperado: testes passam; build conclui sem erro. O build é o que pega import quebrado num `.vue`.

- [ ] **Step 7: Validar na app**

Suba `npm run dev`, abra a Gestão de Tráfego e confirme que "HOJE", "1D", "7D" e "Mês passado" trazem dados coerentes. Compare "HOJE" com o Gerenciador de Anúncios da Meta.

**Esta validação é obrigatória.** Um teste unitário do `datas.js` não prova que a tela ficou certa.

- [ ] **Step 8: Commit**

```bash
cd /Users/erickmartins/iamundi
git add src/ferramentas/gestao-trafego/tela-de-gestao-trafego.vue src/ferramentas/analise-vendas/tela-de-analise-vendas.vue src/ferramentas/redes-sociais/tela-de-redes-sociais.vue src/ferramentas/acessos/tela-de-acessos.vue
git commit -m "fix(fuso): 4 sitios que zeravam paineis das 21h a meia-noite

toISOString() e UTC: das 21h a meia-noite BRT ja e o dia seguinte, entao
'HOJE' pedia amanha e vinha vazio.
- gestao-trafego: board vazio / '1D' mostrando hoje
- analise-vendas: coluna 'Hoje' zerada, 'Ontem' mostrando hoje
- redes-sociais: aneis de story sumindo de todos os perfis
- acessos: data de fim de contrato pre-preenchida com amanha

Os demais toISOString() do projeto estao corretos e nao foram tocados."
```

---

### Task 6: Classificador de erro

Módulo puro que traduz a resposta do PostgREST para uma mensagem que o Breno entende.

**Files:**
- Create: `src/compartilhado/classificar-erro.js`
- Test: `src/compartilhado/classificar-erro.test.mjs`

**Interfaces:**
- Consumes: nada.
- Produces: `classificarErro(status: number, corpo: object|null): { tipo, mensagem, acao }`
  - `tipo`: `'sessao'` | `'permissao'` | `'servidor'` | `'rede'`
  - `mensagem`: string em português literal
  - `acao`: `'entrar'` | `'tentar'` | `null`

- [ ] **Step 1: Escrever os testes que falham**

Criar `src/compartilhado/classificar-erro.test.mjs`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { classificarErro, ERRO_DE_REDE } from './classificar-erro.js'

test('401 vira sessao expirada com botao de entrar', () => {
  const e = classificarErro(401, { message: 'JWT expired' })
  assert.equal(e.tipo, 'sessao')
  assert.equal(e.acao, 'entrar')
  assert.match(e.mensagem, /sess[ãa]o/i)
})

test('PGRST301 vira sessao mesmo com outro status', () => {
  const e = classificarErro(400, { code: 'PGRST301', message: 'JWT expired' })
  assert.equal(e.tipo, 'sessao')
})

test('403 vira sem permissao e nao oferece tentar de novo', () => {
  const e = classificarErro(403, { message: 'permission denied' })
  assert.equal(e.tipo, 'permissao')
  assert.equal(e.acao, null)
  assert.match(e.mensagem, /permiss[ãa]o/i)
})

test('42501 vira sem permissao', () => {
  const e = classificarErro(400, { code: '42501', message: 'permission denied for table x' })
  assert.equal(e.tipo, 'permissao')
})

test('500 vira erro de servidor com tentar de novo', () => {
  const e = classificarErro(500, null)
  assert.equal(e.tipo, 'servidor')
  assert.equal(e.acao, 'tentar')
})

test('503 tambem e servidor', () => {
  assert.equal(classificarErro(503, null).tipo, 'servidor')
})

test('status desconhecido cai em servidor, nunca em undefined', () => {
  const e = classificarErro(418, null)
  assert.equal(e.tipo, 'servidor')
  assert.ok(e.mensagem.length > 0)
})

test('ERRO_DE_REDE e uma constante pronta pro catch do fetch', () => {
  assert.equal(ERRO_DE_REDE.tipo, 'rede')
  assert.equal(ERRO_DE_REDE.acao, 'tentar')
})

test('nenhuma mensagem vaza jargao tecnico pro usuario', () => {
  const casos = [
    classificarErro(401, { code: 'PGRST301' }),
    classificarErro(403, { code: '42501' }),
    classificarErro(500, null),
    ERRO_DE_REDE,
  ]
  for (const c of casos) {
    assert.doesNotMatch(c.mensagem, /PGRST|JWT|42501|null|undefined|Error/i, `vazou jargao: ${c.mensagem}`)
  }
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
cd /Users/erickmartins/iamundi
node --test src/compartilhado/classificar-erro.test.mjs
```

Esperado: FALHA com `Cannot find module './classificar-erro.js'`.

- [ ] **Step 3: Implementar**

Criar `src/compartilhado/classificar-erro.js`:

```js
// Traduz a falha de uma busca para uma frase que o usuário entende.
// Regra do projeto: o Breno lê "sua sessão expirou", não "PGRST301".
//
// Existe porque o sb() antigo devolvia [] para tudo: "não tem nada", "falhou" e
// "você não tem permissão" ficavam idênticos na tela.

export const ERRO_DE_REDE = Object.freeze({
  tipo: 'rede',
  mensagem: 'Sem conexão com o servidor.',
  acao: 'tentar',
})

export function classificarErro(status, corpo) {
  const codigo = corpo?.code || ''

  if (status === 401 || codigo === 'PGRST301') {
    return { tipo: 'sessao', mensagem: 'Sua sessão expirou — entre de novo.', acao: 'entrar' }
  }
  if (status === 403 || codigo === '42501') {
    return { tipo: 'permissao', mensagem: 'Você não tem permissão para ver isso.', acao: null }
  }
  // Qualquer outra coisa (5xx, status inesperado) é problema do servidor, não do usuário.
  return { tipo: 'servidor', mensagem: 'O servidor não respondeu. Tente de novo.', acao: 'tentar' }
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

```bash
cd /Users/erickmartins/iamundi
node --test src/compartilhado/classificar-erro.test.mjs
```

Esperado: `pass 9`, `fail 0`.

- [ ] **Step 5: Commit**

```bash
cd /Users/erickmartins/iamundi
git add src/compartilhado/classificar-erro.js src/compartilhado/classificar-erro.test.mjs
git commit -m "feat(erro): classificador de falha de busca em portugues literal"
```

---

### Task 7: `sb()` para de engolir erro

O helper devolvia `[]` para três estados distintos. Agora anexa `.erro` — os 53 sítios existentes continuam funcionando sem alteração.

**Files:**
- Modify: `src/compartilhado/buscar-e-salvar-dados.js` (arquivo inteiro)
- Test: `src/compartilhado/buscar-e-salvar-dados.test.mjs`

**Interfaces:**
- Consumes: `classificarErro`, `ERRO_DE_REDE` de `./classificar-erro.js` (Task 6).
- Produces: `sb(path)` devolve um `Array`. Em sucesso, as linhas. Em falha, array **vazio** com propriedade não-enumerável `.erro` (o objeto do `classificarErro`). Também exporta `comErro(array, erro)` para os testes.

- [ ] **Step 1: Escrever os testes que falham**

Criar `src/compartilhado/buscar-e-salvar-dados.test.mjs`:

```js
import { test, mock } from 'node:test'
import assert from 'node:assert/strict'
import { comErro } from './buscar-e-salvar-dados.js'

// O sb() em si depende de fetch + estado global do app; o contrato testável e
// importante é o do comErro(): o array tem que continuar sendo um array normal
// para os 53 sitios que nao sabem do .erro.

test('array com erro continua sendo um array de verdade', () => {
  const a = comErro([], { tipo: 'sessao', mensagem: 'x', acao: 'entrar' })
  assert.ok(Array.isArray(a))
  assert.equal(a.length, 0)
  assert.deepEqual(a.map(x => x), [])
  assert.deepEqual([...a], [])
})

test('o .erro fica acessivel para quem quer tratar', () => {
  const a = comErro([], { tipo: 'permissao', mensagem: 'sem permissao', acao: null })
  assert.equal(a.erro.tipo, 'permissao')
  assert.equal(a.erro.mensagem, 'sem permissao')
})

test('o .erro e nao-enumeravel: nao aparece em JSON nem em for-in', () => {
  const a = comErro([], { tipo: 'rede', mensagem: 'x', acao: 'tentar' })
  assert.equal(JSON.stringify(a), '[]')
  assert.deepEqual(Object.keys(a), [])
})

test('array sem erro tem .erro undefined (o caso "vazio de verdade")', () => {
  const vazio = []
  assert.equal(vazio.erro, undefined)
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
cd /Users/erickmartins/iamundi
node --test src/compartilhado/buscar-e-salvar-dados.test.mjs
```

Esperado: FALHA — `comErro` não é exportado.

- [ ] **Step 3: Implementar**

Substituir o conteúdo inteiro de `src/compartilhado/buscar-e-salvar-dados.js` por:

```js
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './conectar-no-banco-de-dados.js'
import { estado } from './controle-de-login-e-usuario.js'
import { classificarErro, ERRO_DE_REDE } from './classificar-erro.js'

// Anexa o erro ao array SEM torná-lo enumerável: quem não sabe do .erro continua
// vendo um array normal (length 0, map, spread, JSON) — é o que mantém os 53
// sítios de chamada existentes funcionando sem alteração. Quem quer tratar,
// faz `if (linhas.erro)`.
//
// Atenção: linhas.filter(...) devolve um array novo e PERDE o .erro. Cheque o
// .erro logo após a chamada, antes de transformar.
export function comErro(array, erro) {
  Object.defineProperty(array, 'erro', { value: erro, enumerable: false, writable: true })
  return array
}

// Helper de leitura ao REST do Supabase.
// Antes: `catch (e) { return [] }` — qualquer falha virava lista vazia, e a tela
// mostrava "R$ 0" como se fosse verdade. Três estados distintos ("não tem nada",
// "falhou", "sem permissão") colapsavam num só.
export async function sb(path) {
  try {
    const token = estado.currentSession?.access_token || SUPABASE_ANON_KEY
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
    })
    const json = await r.json().catch(() => null)
    if (!r.ok) return comErro([], classificarErro(r.status, json))
    if (!Array.isArray(json)) return comErro([], classificarErro(r.status, json))
    return json
  } catch (e) {
    return comErro([], ERRO_DE_REDE)
  }
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

```bash
cd /Users/erickmartins/iamundi
npm test
```

Esperado: todos passam, incluindo os 4 novos.

- [ ] **Step 5: Confirmar que nada quebrou na app**

```bash
cd /Users/erickmartins/iamundi
npm run build
```

Suba `npm run dev` e abra pelo menos: Início, Redes Sociais, Gestão de Tráfego, Claude Status e Admin. **Nenhuma tela pode ficar branca ou perder dados.** É o teste real de que o `.erro` não quebrou os 53 sítios.

- [ ] **Step 6: Commit**

```bash
cd /Users/erickmartins/iamundi
git add src/compartilhado/buscar-e-salvar-dados.js src/compartilhado/buscar-e-salvar-dados.test.mjs
git commit -m "fix(sb): para de engolir erro — array ganha .erro nao-enumeravel

Antes qualquer falha virava [] e a tela mostrava 'R$ 0' como verdade.
O array continua array (os 53 sitios seguem intactos); quem quer tratar
le o .erro. Sem isso, apertar o RLS na Onda 3 seria invisivel: quem
perdesse acesso veria '0 registros' em vez de 'sem permissao'."
```

---

### Task 8: Faixa de aviso nas telas críticas

**Files:**
- Create: `src/compartilhado/faixa-de-erro.vue`
- Modify: `src/ferramentas/claude-status/tela-de-status-claude.vue` (imports ~212, `carregar()` ~383, template ~80)
- Modify: `src/ferramentas/redes-sociais/tela-de-redes-sociais.vue` (só a seção Meta Ads: buscas ~1200-1201, template ~203)

**Interfaces:**
- Consumes: o `.erro` do `sb()` (Task 7); `roteador` de `src/mapa-de-enderecos.js`.
- Produces: componente `<faixa-de-erro :erro="obj" @tentar-de-novo="fn" />`. Não renderiza nada se `erro` for nulo.

- [ ] **Step 1: Criar o componente**

Criar `src/compartilhado/faixa-de-erro.vue`:

```vue
<template>
  <div v-if="erro" class="faixa-erro" role="alert">
    <span class="faixa-erro-icone" aria-hidden="true">⚠</span>
    <span class="faixa-erro-msg">{{ erro.mensagem }}</span>
    <button v-if="erro.acao === 'entrar'" class="faixa-erro-btn" @click="irParaLogin">Entrar de novo</button>
    <button v-else-if="erro.acao === 'tentar'" class="faixa-erro-btn" @click="$emit('tentar-de-novo')">Tentar de novo</button>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router'

defineProps({
  // Objeto vindo do .erro do sb(): { tipo, mensagem, acao }. Nulo = não mostra nada.
  erro: { type: Object, default: null },
})
defineEmits(['tentar-de-novo'])

const router = useRouter()
function irParaLogin() {
  router.push({ name: 'login' })
}
</script>

<style scoped>
/* Nomes prefixados com faixa-erro- de proposito: o estilos-globais.css tem classes
   genericas (.card, .chip) e ja houve bug de colisao entre global e tela scoped. */
.faixa-erro{display:flex;align-items:center;gap:10px;padding:10px 14px;margin:0 0 12px;border:1px solid #b45309;border-radius:8px;background:rgba(180,83,9,.12);font-family:'IBM Plex Sans',sans-serif;font-size:13px;color:#fbbf24;}
.faixa-erro-icone{font-size:15px;line-height:1;flex-shrink:0;}
.faixa-erro-msg{flex:1;min-width:0;}
.faixa-erro-btn{flex-shrink:0;padding:5px 12px;border:1px solid #b45309;border-radius:6px;background:transparent;color:#fbbf24;font-family:inherit;font-size:12px;font-weight:500;cursor:pointer;transition:background .15s;}
.faixa-erro-btn:hover{background:rgba(180,83,9,.25);}
@media (max-width:640px){
  .faixa-erro{flex-wrap:wrap;font-size:12px;}
  .faixa-erro-msg{flex-basis:100%;}
}
</style>
```

**Nota de escopo — leia antes de começar:** os dados do board da Gestão de Tráfego **não passam pelo `sb()`**. As 3 chamadas `sb()` daquela tela (linhas 417, 425, 433) buscam só `gt_config_metricas`, `gt_budget_analises` e `gt_ad_analises`; o board de campanhas vem do `meta-proxy`. Por isso esta task cobre **Claude Status** e **seção Meta Ads das Redes** (ambas de fato baseadas em `sb()`). A superfície de erro do `meta-proxy` na Gestão de Tráfego depende do que a Task 3 diagnosticar e ganha task própria.

- [ ] **Step 2: Ligar no Claude Status**

**Por que esta tela primeiro:** ela roda `carregar()` a cada 60s. Com o token expirado, hoje renderiza "0 execuções, R$ 0 de custo" — e o Breno lê como "os robôs não rodaram".

Em `src/ferramentas/claude-status/tela-de-status-claude.vue`, acrescente aos imports (que hoje estão nas linhas 212-216):

```js
import FaixaDeErro from '../../compartilhado/faixa-de-erro.vue'
```

Junto às outras refs do `<script setup>`, acrescente:

```js
const erroCarregar = ref(null)
```

Substitua a função `carregar()` (linha ~383) inteira:

```js
async function carregar() {
  const [ex, pr] = await Promise.all([
    sb('ia_execucoes?select=*&order=run_at.desc&limit=200'),
    sb('projetos_status?select=*&arquivado=is.false&order=ordem.desc'),
  ])
  execucoes.value = ex
  projetos.value = pr
  const hh = new Date()
  statusCarga.value = 'atualizado às ' + hh.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}
```

por:

```js
async function carregar() {
  const [ex, pr] = await Promise.all([
    sb('ia_execucoes?select=*&order=run_at.desc&limit=200'),
    sb('projetos_status?select=*&arquivado=is.false&order=ordem.desc'),
  ])
  // Antes: falha virava [] e a tela dizia "0 execuções, R$ 0" como se fosse
  // verdade. Só sobrescreve os dados bons quando a busca deu certo — assim um
  // blip de rede no refresh de 60s não apaga o que já estava na tela.
  erroCarregar.value = ex.erro || pr.erro || null
  if (!ex.erro) execucoes.value = ex
  if (!pr.erro) projetos.value = pr
  if (erroCarregar.value) return
  const hh = new Date()
  statusCarga.value = 'atualizado às ' + hh.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}
```

No `<template>`, logo antes do bloco `<!-- PROJETOS -->` (linha ~80):

```vue
      <faixa-de-erro :erro="erroCarregar" @tentar-de-novo="carregar" />
```

- [ ] **Step 3: Ligar na seção Meta Ads das Redes Sociais**

É onde os usuários relatam "não aparece dado nenhum". As duas buscas ficam nas linhas ~1200-1201 (`campaign_insights`, atual e anterior).

Em `src/ferramentas/redes-sociais/tela-de-redes-sociais.vue`, acrescente aos imports:

```js
import FaixaDeErro from '../../compartilhado/faixa-de-erro.vue'
import { ref } from 'vue'
```

(Se `ref` já estiver importado, não duplique.)

Crie a ref junto às outras do `<script setup>`:

```js
const erroAds = ref(null)
```

No trecho que faz as duas buscas de `campaign_insights` (linhas ~1199-1202), capture o erro logo após o `await`:

```js
const [ciAtual, ciPrev] = await Promise.all([
  sb(`campaign_insights?...`),  // deixe as duas URLs exatamente como estão
  sb(`campaign_insights?...`),
])
erroAds.value = ciAtual.erro || ciPrev.erro || null
```

**Atenção:** capture o `.erro` **imediatamente** após o `await`, antes de qualquer `.filter()`/`.map()` — array transformado perde o `.erro`.

No `<template>`, imediatamente acima do container da seção Meta Ads (o bloco que contém `id="ads-spend-val"`, linha ~203 — suba até a abertura da seção):

```vue
      <faixa-de-erro :erro="erroAds" @tentar-de-novo="refresh" />
```

Confirme o nome real da função de recarga da tela antes de ligar no `@tentar-de-novo` (`grep -n "async function refresh" src/ferramentas/redes-sociais/tela-de-redes-sociais.vue`).

**Não mexa nos outros cards nesta task.** O dono conferiu que os seguidores batem com o painel profissional do Breno — a Onda 1 não toca em número de redes.

- [ ] **Step 5: Provar que a faixa aparece**

Com `npm run dev` rodando, no DevTools:

1. `localStorage.clear()` e recarregue **sem** fazer login → a guarda manda pro login (esperado).
2. Logue, abra o Claude Status, e no DevTools corrompa o token:
   ```js
   const k = Object.keys(localStorage).find(k => k.includes('auth-token'))
   const v = JSON.parse(localStorage[k]); v.access_token = 'token-invalido'; localStorage[k] = JSON.stringify(v)
   ```
   Espere o refresh de 60s (ou recarregue).
3. **Esperado:** a faixa "Sua sessão expirou — entre de novo." com o botão. **Não** pode aparecer "0 execuções, R$ 0".

Use um usuário descartável, nunca a conta do dono ou do Breno.

- [ ] **Step 6: Build + commit**

```bash
cd /Users/erickmartins/iamundi
npm test && npm run build
git add src/compartilhado/faixa-de-erro.vue src/ferramentas/claude-status/tela-de-status-claude.vue src/ferramentas/redes-sociais/tela-de-redes-sociais.vue
git commit -m "feat(erro): faixa de aviso no Claude Status e na secao Meta Ads

O painel para de dizer 'R$ 0' e '0 execucoes' quando na verdade a busca
falhou. A Gestao de Trafego fica de fora: o board dela vem do meta-proxy,
nao do sb() — superficie propria, depende do diagnostico da Task 3."
```

---

### Task 9: Perfil e sessão param de mentir

Dois defeitos irmãos: `carregarPerfil()` rebaixa o super-admin a viewer em silêncio quando a rede falha; `onAuthStateChange` deixa a aba com o token de um usuário e as flags de outro.

**Files:**
- Modify: `src/compartilhado/controle-de-login-e-usuario.js:18-49`
- Modify: `src/ponto-de-partida.js:21`

**Interfaces:**
- Consumes: `classificarErro`, `ERRO_DE_REDE` (Task 6).
- Produces:
  - `carregarPerfil(session)` passa a devolver `{ ok: boolean, erro: object|null }`.
  - `estado.erroPerfil` — objeto de erro ou `null`.
  - `limparEstado()` — zera tudo (usado no `SIGNED_OUT`).

- [ ] **Step 1: Escrever o teste que falha**

Criar `src/compartilhado/controle-de-login-e-usuario.test.mjs`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { estado, limparEstado } from './controle-de-login-e-usuario.js'

test('limparEstado zera TUDO, nao so a sessao', () => {
  estado.currentSession = { access_token: 'x' }
  estado.user = { id: 'u1' }
  estado.role = 'admin'
  estado.is_superadmin = true
  estado.permissions = { 'meta.gestor': ['ver', 'editar'] }
  estado.features = ['meta']
  estado.allowed_accounts = ['conta-a']
  estado.userId = 'u1'
  estado.avatarUrl = 'http://x/y.png'

  limparEstado()

  assert.equal(estado.currentSession, null)
  assert.equal(estado.user, null)
  assert.equal(estado.role, 'viewer')
  assert.equal(estado.is_superadmin, false)
  assert.deepEqual(estado.permissions, {})
  assert.equal(estado.allowed_accounts, null)
  assert.equal(estado.userId, null)
  assert.equal(estado.avatarUrl, null)
  assert.equal(estado.erroPerfil, null)
})

test('estado nasce com erroPerfil nulo', () => {
  limparEstado()
  assert.equal(estado.erroPerfil, null)
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
cd /Users/erickmartins/iamundi
node --test src/compartilhado/controle-de-login-e-usuario.test.mjs
```

Esperado: FALHA — `limparEstado` não é exportado.

- [ ] **Step 3: Implementar**

Em `src/compartilhado/controle-de-login-e-usuario.js`, acrescente `erroPerfil: null` ao `reactive({...})` e substitua `setSession` e `carregarPerfil` por:

```js
export function setSession(session) {
  estado.currentSession = session
  estado.user = session?.user ?? null
}

// Zera TUDO. Antes, sair só limpava a sessão e deixava role/permissions/is_superadmin
// do usuário anterior — a aba ficava com o token de um e as flags de outro.
export function limparEstado() {
  estado.currentSession = null
  estado.user = null
  estado.permissoes = null
  estado.role = 'viewer'
  estado.features = []
  estado.userId = null
  estado.avatarUrl = null
  estado.permissions = {}
  estado.allowed_accounts = null
  estado.is_superadmin = false
  estado.erroPerfil = null
}

// Carrega o perfil (papel + permissões) da tabela `profiles`.
// Antes engolia qualquer falha e produzia role='viewer', permissions={} — idêntico
// ao caminho de sucesso com perfil vazio. Resultado: o super-admin dava F5 num blip
// de rede e via a Central sem nenhum card, sem mensagem, achando que perdeu acesso.
// Agora "é viewer" e "não consegui carregar" são estados distintos.
export async function carregarPerfil(session) {
  estado.erroPerfil = null
  estado.userId = session?.user?.id || null
  try {
    const tok = session?.access_token || SUPABASE_ANON_KEY
    const r = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${session.user.id}&select=role,features,avatar_url,permissions,allowed_accounts,is_superadmin`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${tok}` },
    })
    const corpo = await r.json().catch(() => null)
    if (!r.ok || !Array.isArray(corpo)) {
      estado.erroPerfil = classificarErro(r.status, corpo)
      return { ok: false, erro: estado.erroPerfil }
    }
    const p = corpo[0] || {}
    estado.role = p.role || 'viewer'
    estado.features = p.features || ['banco']
    estado.permissions = p.permissions || {}
    estado.allowed_accounts = p.allowed_accounts ?? null
    estado.is_superadmin = !!p.is_superadmin
    estado.avatarUrl = p.avatar_url || null
    return { ok: true, erro: null }
  } catch (e) {
    estado.erroPerfil = ERRO_DE_REDE
    return { ok: false, erro: ERRO_DE_REDE }
  }
}
```

Acrescente ao topo do arquivo:

```js
import { classificarErro, ERRO_DE_REDE } from './classificar-erro.js'
```

**Atenção:** em erro, NÃO escreva `role`/`permissions`/`is_superadmin`. Deixar o valor anterior é melhor que rebaixar; quem lê decide pelo `erroPerfil`.

- [ ] **Step 4: Consertar o onAuthStateChange**

Em `src/ponto-de-partida.js`, substitua a linha 21:

```js
  sbClient.auth.onAuthStateChange((_evento, session) => { setSession(session) })
```

por:

```js
  // O SDK dispara SIGNED_IN sozinho no visibilitychange, lendo a sessão do
  // localStorage. Se noutra aba alguém trocou de usuário, esta aba recebia a
  // sessão nova e mantinha role/permissions/is_superadmin do usuário ANTERIOR —
  // token de um, flags de outro. Por isso o perfil é recarregado junto.
  sbClient.auth.onAuthStateChange(async (evento, session) => {
    if (evento === 'SIGNED_OUT' || !session) {
      limparEstado()
      return
    }
    const mudouDeUsuario = estado.userId && session.user?.id !== estado.userId
    setSession(session)
    if (mudouDeUsuario || !estado.userId) {
      await carregarPerfil(session)
    }
  })
```

E ajuste os imports da linha 6:

```js
import { setSession, carregarPerfil, limparEstado, estado } from './compartilhado/controle-de-login-e-usuario.js'
```

**Por que só recarrega quando muda de usuário:** o `TOKEN_REFRESHED` dispara a cada ~1h para o mesmo usuário; recarregar o perfil ali seria requisição à toa.

- [ ] **Step 5: Rodar os testes**

```bash
cd /Users/erickmartins/iamundi
npm test && npm run build
```

Esperado: `pass` em tudo.

- [ ] **Step 6: Provar o cenário das duas abas**

1. Aba A: entre com um usuário **descartável** que seja super-admin de teste. Confirme que o card "Administração" aparece.
2. Aba B (mesmo navegador): saia e entre com um usuário **descartável** sem permissões.
3. Volte para a Aba A e deixe-a visível.
4. **Esperado:** a Aba A reflete o usuário novo — sem card de Administração. **Antes:** continuava com as flags de super-admin.

Nunca use as contas reais do dono, do Breno ou do admin para este teste.

- [ ] **Step 7: Commit**

```bash
cd /Users/erickmartins/iamundi
git add src/compartilhado/controle-de-login-e-usuario.js src/compartilhado/controle-de-login-e-usuario.test.mjs src/ponto-de-partida.js
git commit -m "fix(sessao): perfil recarrega ao trocar de usuario; falha nao rebaixa mais

- onAuthStateChange so chamava setSession: a aba ficava com o token de um
  usuario e as flags de outro (o SDK emite SIGNED_IN no visibilitychange).
- carregarPerfil engolia falha e virava viewer/permissions={} — o super-admin
  dava F5 num blip de rede e via a Central vazia, sem mensagem."
```

---

### Task 10: "Esqueci a senha" e convite passam a funcionar

Hoje o link do e-mail cria a sessão e joga o usuário no Início: ele **nunca vê o formulário de senha nova**. A view `set-pass` existe no template e é código morto — não há nenhuma leitura de `type=recovery` em todo o `src/`. Quem pede reset entra, continua sem saber a senha, e fica trancado quando a sessão expira. Idem para convites.

**Files:**
- Modify: `src/ferramentas/login/tela-de-login.vue:96` e `:291-293`
- Test: `src/ferramentas/login/detectar-fluxo-de-senha.test.mjs`
- Create: `src/ferramentas/login/detectar-fluxo-de-senha.js`

**Interfaces:**
- Consumes: nada.
- Produces: `detectarFluxoDeSenha(hash: string, query: string): 'recovery' | 'invite' | null`

- [ ] **Step 1: Escrever os testes que falham**

Criar `src/ferramentas/login/detectar-fluxo-de-senha.test.mjs`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { detectarFluxoDeSenha } from './detectar-fluxo-de-senha.js'

test('link de recuperacao no hash e detectado', () => {
  assert.equal(detectarFluxoDeSenha('#access_token=abc&type=recovery&expires_in=3600', ''), 'recovery')
})

test('link de convite no hash e detectado', () => {
  assert.equal(detectarFluxoDeSenha('#access_token=abc&type=invite', ''), 'invite')
})

test('type=recovery na query string tambem conta', () => {
  assert.equal(detectarFluxoDeSenha('', '?type=recovery&code=xyz'), 'recovery')
})

test('login normal nao dispara nada', () => {
  assert.equal(detectarFluxoDeSenha('', ''), null)
  assert.equal(detectarFluxoDeSenha('#', '?foo=bar'), null)
})

test('type desconhecido nao dispara', () => {
  assert.equal(detectarFluxoDeSenha('#access_token=abc&type=magiclink', ''), null)
})

test('signup nao e tratado como convite', () => {
  assert.equal(detectarFluxoDeSenha('#access_token=abc&type=signup', ''), null)
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
cd /Users/erickmartins/iamundi
node --test src/ferramentas/login/detectar-fluxo-de-senha.test.mjs
```

Esperado: FALHA — módulo não existe.

- [ ] **Step 3: Implementar o detector**

Criar `src/ferramentas/login/detectar-fluxo-de-senha.js`:

```js
// Descobre se a pessoa chegou por um link de "esqueci a senha" ou de convite.
//
// Por que existe: o SDK do Supabase tem detectSessionInUrl ligado por padrão, então
// ele consome o #access_token e cria a sessão sozinho. Sem esta detecção, a pessoa
// era jogada direto no Início e NUNCA via o formulário de senha nova — continuava
// sem saber a senha e ficava trancada quando a sessão expirava.
//
// Roda ANTES do SDK limpar o hash.
export function detectarFluxoDeSenha(hash, query) {
  const h = new URLSearchParams((hash || '').replace(/^#/, ''))
  const q = new URLSearchParams((query || '').replace(/^\?/, ''))
  const tipo = h.get('type') || q.get('type')
  if (tipo === 'recovery') return 'recovery'
  if (tipo === 'invite') return 'invite'
  return null
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

```bash
cd /Users/erickmartins/iamundi
node --test src/ferramentas/login/detectar-fluxo-de-senha.test.mjs
```

Esperado: `pass 6`, `fail 0`.

- [ ] **Step 5: Capturar o fluxo no boot, antes do SDK apagar o hash**

Em `src/ponto-de-partida.js`, **antes** de qualquer `await` (o SDK limpa o hash de forma assíncrona), acrescente no topo da função `iniciar()`:

```js
  // Guardado ANTES de qualquer await: o SDK consome e apaga o #access_token do hash.
  window.__fluxoDeSenha = detectarFluxoDeSenha(location.hash, location.search)
```

E o import:

```js
import { detectarFluxoDeSenha } from './ferramentas/login/detectar-fluxo-de-senha.js'
```

- [ ] **Step 6: Redirecionar para o login no fluxo de senha**

Ainda em `iniciar()`, o bloco atual:

```js
  const { data } = await sbClient.auth.getSession()
  if (data.session) {
    setSession(data.session)
    await carregarPerfil(data.session)
  }
```

passa a:

```js
  const { data } = await sbClient.auth.getSession()
  if (data.session) {
    setSession(data.session)
    await carregarPerfil(data.session)
  }
  // Veio de link de reset/convite: a sessão existe, mas a pessoa PRECISA definir a
  // senha antes de usar o sistema — senão fica trancada quando a sessão expirar.
  if (window.__fluxoDeSenha) {
    roteador.replace({ name: 'login' })
  }
```

- [ ] **Step 7: Abrir a view `set-pass` no login**

Em `src/ferramentas/login/tela-de-login.vue`, substitua a linha 96:

```js
const view = ref('login')
```

por:

```js
// Abre direto no formulário de senha nova quando a pessoa chegou por link de
// recuperação ou convite (o boot detectou e guardou em window.__fluxoDeSenha).
const view = ref(window.__fluxoDeSenha ? 'set-pass' : 'login')
```

Substitua o comentário obsoleto das linhas 128-132:

```js
/* ── Definir senha / convite (doSetPassword) ──
   Nota: o gatilho automático que abre esta view a partir do link de convite
   (leitura de ?type=invite/recovery na URL + onAuthStateChange) pertence à
   inicialização geral do app e será portado em outra tarefa. Aqui a view
   fica disponível e funcional, só não é aberta automaticamente ainda. */
```

por:

```js
/* ── Definir senha / convite (doSetPassword) ──
   Aberta automaticamente quando o boot detecta type=recovery/invite na URL
   (ver detectar-fluxo-de-senha.js). */
```

E ajuste o texto do cabeçalho da view para servir aos dois casos. No `<template>`, linha 32:

```vue
        <p class="auth-info" style="margin-bottom:20px">Você foi convidado! Crie sua senha para acessar o dashboard.</p>
```

vira:

```vue
        <p class="auth-info" style="margin-bottom:20px">{{ textoSetPass }}</p>
```

e no `<script setup>`, junto às outras refs de `set-pass`:

```js
const textoSetPass = window.__fluxoDeSenha === 'recovery'
  ? 'Crie uma senha nova para voltar a acessar o painel.'
  : 'Você foi convidado! Crie sua senha para acessar o painel.'
```

- [ ] **Step 8: Limpar a marca ao concluir**

Em `definirSenha()`, logo após o `history.replaceState(...)` (linha ~156), acrescente:

```js
  window.__fluxoDeSenha = null
```

Sem isso, um F5 depois de definir a senha reabriria o formulário.

- [ ] **Step 9: Provar de ponta a ponta**

Com um **e-mail descartável** (nunca o do dono ou do Breno):

1. Crie um usuário de teste no painel do Supabase.
2. Na tela de login, "Esqueci a senha" → digite o e-mail descartável.
3. Abra o link do e-mail.
4. **Esperado:** cai na tela "Crie uma senha nova para voltar a acessar o painel." **Antes:** caía no Início sem nunca definir senha.
5. Defina a senha, confirme que entra, saia, e entre com a senha nova.

- [ ] **Step 10: Build + commit**

```bash
cd /Users/erickmartins/iamundi
npm test && npm run build
git add src/ferramentas/login/detectar-fluxo-de-senha.js src/ferramentas/login/detectar-fluxo-de-senha.test.mjs src/ferramentas/login/tela-de-login.vue src/ponto-de-partida.js
git commit -m "fix(login): 'esqueci a senha' e convite finalmente pedem a senha nova

O link criava a sessao e jogava a pessoa no Inicio: ela nunca via o
formulario. A view set-pass existia no template e era codigo morto — nao
havia leitura de type=recovery em nenhum lugar do src/. Quem pedia reset
entrava, seguia sem saber a senha, e travava quando a sessao expirava."
```

---

### Task 11: Guarda de permissão nas 2 rotas sem gate

A guarda global só exige **sessão**. O gate por recurso é feito dentro de cada tela — e 2 das 16 esqueceram: `/claude-status` e `/noticias`. Quem tem só `banco:['ver']` digita a URL e entra.

**Files:**
- Modify: `src/mapa-de-enderecos.js:4-37`
- Test: `src/mapa-de-enderecos.test.mjs`

**Interfaces:**
- Consumes: `hasPermission` de `./compartilhado/controle-de-login-e-usuario.js`.
- Produces: `podeEntrar(rota, temSessao, checarPermissao)` — decisão pura, testável.

- [ ] **Step 1: Escrever os testes que falham**

Criar `src/mapa-de-enderecos.test.mjs`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { podeEntrar } from './mapa-de-enderecos.js'

const permiteTudo = () => true
const negaTudo = () => false

test('sem sessao vai pro login', () => {
  assert.deepEqual(podeEntrar({ name: 'inicio', meta: {} }, false, permiteTudo), { name: 'login' })
})

test('o proprio login e acessivel sem sessao', () => {
  assert.equal(podeEntrar({ name: 'login', meta: {} }, false, permiteTudo), true)
})

test('rota sem recurso declarado so exige sessao', () => {
  assert.equal(podeEntrar({ name: 'inicio', meta: {} }, true, negaTudo), true)
})

test('rota com recurso exige a permissao', () => {
  const rota = { name: 'claude-status', meta: { recurso: 'claude.status' } }
  assert.equal(podeEntrar(rota, true, permiteTudo), true)
  assert.deepEqual(podeEntrar(rota, true, negaTudo), { name: 'inicio' })
})

test('noticias exige a permissao noticias', () => {
  const rota = { name: 'noticias', meta: { recurso: 'noticias' } }
  assert.deepEqual(podeEntrar(rota, true, negaTudo), { name: 'inicio' })
})

test('a permissao checada e a declarada na rota', () => {
  const vistos = []
  const espiao = (r) => { vistos.push(r); return true }
  podeEntrar({ name: 'claude-status', meta: { recurso: 'claude.status' } }, true, espiao)
  assert.deepEqual(vistos, ['claude.status'])
})

test('rota inexistente com sessao vai pro inicio, nao da tela branca', () => {
  assert.deepEqual(podeEntrar({ name: undefined, meta: {} }, true, permiteTudo), { name: 'inicio' })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
cd /Users/erickmartins/iamundi
node --test src/mapa-de-enderecos.test.mjs
```

Esperado: FALHA — `podeEntrar` não é exportado.

- [ ] **Step 3: Implementar**

Em `src/mapa-de-enderecos.js`, acrescente `meta: { recurso }` às duas rotas:

```js
  { path: '/noticias', name: 'noticias', component: () => import('./ferramentas/noticias/tela-de-noticias.vue'), meta: { recurso: 'noticias' } },
```

```js
  { path: '/claude-status', name: 'claude-status', component: () => import('./ferramentas/claude-status/tela-de-status-claude.vue'), meta: { recurso: 'claude.status' } },
```

Acrescente uma rota catch-all como **última** entrada do array `rotas` (sem ela, um bookmark antigo dá tela branca):

```js
  { path: '/:pathMatch(.*)*', name: 'nao-encontrada', redirect: { name: 'inicio' } },
```

Substitua a guarda das linhas 34-37 por:

```js
// Decisão pura de acesso — separada da guarda para poder ser testada sem router.
// Devolve `true` (pode entrar) ou o destino do redirecionamento.
export function podeEntrar(rota, temSessao, checarPermissao) {
  if (rota.name === 'login') return true
  if (!temSessao) return { name: 'login' }
  if (!rota.name) return { name: 'inicio' } // rota inexistente: Início, nunca tela branca
  const recurso = rota.meta?.recurso
  if (recurso && !checarPermissao(recurso)) return { name: 'inicio' }
  return true
}

// Guarda global. A permissão por rota mora no meta.recurso — assim o gate não
// depende de cada tela lembrar de checar (foi o que deixou /claude-status e
// /noticias abertas para qualquer usuário logado).
//
// Isto NÃO é segurança: o front é público. É a aparência. Quem manda é o RLS.
roteador.beforeEach((to) => {
  const r = podeEntrar(to, !!estado.currentSession, (recurso) => hasPermission(recurso, 'ver'))
  return r === true ? true : r
})
```

E ajuste o import da linha 2:

```js
import { estado, hasPermission } from './compartilhado/controle-de-login-e-usuario.js'
```

- [ ] **Step 4: Rodar e confirmar que passa**

```bash
cd /Users/erickmartins/iamundi
npm test
```

Esperado: `pass 7` nos novos, tudo verde.

- [ ] **Step 5: Provar na app**

Com um usuário **descartável** que tenha só `banco:['ver']`:

1. Digite `/claude-status` na barra de endereços → **esperado:** volta pro Início. **Antes:** entrava e via `ia_execucoes`.
2. Digite `/noticias` → **esperado:** volta pro Início.
3. Digite `/rota-que-nao-existe` → **esperado:** volta pro Início (antes: tela branca).
4. Com um super-admin descartável, `/claude-status` continua abrindo normalmente.

- [ ] **Step 6: Commit**

```bash
cd /Users/erickmartins/iamundi
git add src/mapa-de-enderecos.js src/mapa-de-enderecos.test.mjs
git commit -m "fix(rotas): gate de permissao no meta.recurso + catch-all

/claude-status e /noticias eram as unicas 2 de 16 telas sem gate: quem tinha
so banco:['ver'] digitava a URL e entrava (e no Claude Status ainda editava
projetos). O gate sai de dentro da tela e vai pra guarda — assim tela nova
nao nasce aberta por esquecimento. Catch-all evita tela branca em bookmark
antigo."
```

---

### Task 12: Fechar o endpoint aberto na internet

`auditar-dados` está com `verify_jwt: false` e `Deno.serve(async () => {...})` — ignora o request. **Não precisa de token nenhum.** Qualquer um apaga a trilha de auditoria do dia, gasta a cota da Graph API das 7 contas e dispara o webhook de alerta. `coletar-dados` está com `verify_jwt: true`, derrotável com a anon key pública.

**Files:**
- Modify: `supabase/functions/auditar-dados/index.ts`
- Modify: `supabase/functions/coletar-dados/index.ts`
- Create: `supabase/functions/_shared/segredo-de-cron.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `exigirSegredo(req: Request, nomeDaVar: string): Response | null` — devolve `Response` 401 se não passar, `null` se passar.

- [ ] **Step 1: Criar o módulo do segredo (padrão da fabrica-purga)**

Criar `supabase/functions/_shared/segredo-de-cron.ts`:

```ts
// Auth SELF-CONTAINED para funções chamadas pelo pg_cron.
//
// Por que não confiar no verify_jwt do gateway: ele só valida que o JWT foi
// assinado pelo projeto — e a anon key É esse JWT, publicada no bundle público
// do site. Qualquer visitante copia e chama.
//
// Mesmo padrão já usado pela fabrica-purga: segredo dedicado, comparação em
// tempo constante, fail-closed (sem segredo configurado = ninguém entra).

// Comparação em tempo constante (evita timing side-channel na checagem do segredo).
export function igualTempoConstante(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a), eb = new TextEncoder().encode(b);
  if (ea.length !== eb.length) return false;
  let diff = 0;
  for (let i = 0; i < ea.length; i++) diff |= ea[i] ^ eb[i];
  return diff === 0;
}

// Devolve null se autorizado, ou a Response 401 pronta se não.
export function exigirSegredo(req: Request, nomeDaVar: string): Response | null {
  const segredo = Deno.env.get(nomeDaVar) || "";
  const auth = req.headers.get("Authorization") || "";
  if (!segredo || !igualTempoConstante(auth, `Bearer ${segredo}`)) {
    return new Response(JSON.stringify({ error: "nao_autorizado" }), {
      status: 401, headers: { "Content-Type": "application/json" },
    });
  }
  return null;
}
```

- [ ] **Step 2: Aplicar no auditar-dados**

Em `supabase/functions/auditar-dados/index.ts`, acrescente ao topo:

```ts
import { exigirSegredo } from "../_shared/segredo-de-cron.ts";
```

Substitua:

```ts
Deno.serve(async () => {
```

por:

```ts
Deno.serve(async (req: Request) => {
  // Apaga trilha de auditoria, gasta cota da Meta e dispara webhook: exige segredo.
  // Estava com verify_jwt=false E sem auth no código = aberto na internet.
  const negado = exigirSegredo(req, "AUDITAR_DADOS_SECRET");
  if (negado) return negado;
```

- [ ] **Step 3: Aplicar no coletar-dados**

Em `supabase/functions/coletar-dados/index.ts`, acrescente ao topo:

```ts
import { exigirSegredo } from "../_shared/segredo-de-cron.ts";
```

Substitua:

```ts
Deno.serve(async (_req: Request) => {
  try {
    const r = await rodarColeta();
```

por:

```ts
Deno.serve(async (req: Request) => {
  // Rotaciona o token da Meta e gasta cota das 7 contas: exige segredo.
  // verify_jwt=true não protegia — a anon key é um JWT válido e é pública.
  const negado = exigirSegredo(req, "COLETAR_DADOS_SECRET");
  if (negado) return negado;
  try {
    const r = await rodarColeta();
```

- [ ] **Step 4: Gerar os segredos e configurá-los**

```bash
echo "AUDITAR_DADOS_SECRET=$(openssl rand -hex 32)"
echo "COLETAR_DADOS_SECRET=$(openssl rand -hex 32)"
```

Cadastre os dois em **Supabase → Settings → Edge Functions → Secrets**. Guarde os valores: o Step 5 precisa deles.

**Nunca** commite os valores. **Nunca** os cole no chat.

- [ ] **Step 5: Atualizar o pg_cron — OBRIGATÓRIO, na mesma janela do deploy**

Se a checagem entrar e o cron não for atualizado, o coletor e o "saúde dos dados" **param — em silêncio**, pelos `catch` do próprio código.

Estado atual (confirmado em produção):

| job | horário UTC | alvo | manda auth? |
|---|---|---|---|
| 1-4 | 10, 15, 21, 2 | `coletar-dados` | Sim, `Bearer <token>` |
| 6 | 2:30 | `auditar-dados` | **Não** |

Rode via MCP (`mcp__plugin_supabase_supabase__execute_sql`, `project_id: kounqtdoioootxqegkij`), trocando `<SEGREDO_*>` pelos valores do Step 4:

```sql
select cron.alter_job(
  job_id := 6,
  command := $$select net.http_post(
    url:='https://kounqtdoioootxqegkij.supabase.co/functions/v1/auditar-dados',
    headers:='{"Content-Type":"application/json","Authorization":"Bearer <SEGREDO_AUDITAR>"}'::jsonb,
    body:='{"origem":"cron"}'::jsonb
  )$$
);
```

E para cada um dos jobs 1, 2, 3, 4 (preservando o `origem` de cada um — `cron-07h`, `cron-12h`, `cron-18h`, `cron-23h` — e o `timeout_milliseconds:=180000`):

```sql
select cron.alter_job(
  job_id := 1,
  command := $$select net.http_post(
    url:='https://kounqtdoioootxqegkij.supabase.co/functions/v1/coletar-dados',
    headers:='{"Content-Type":"application/json","Authorization":"Bearer <SEGREDO_COLETAR>"}'::jsonb,
    body:='{"origem":"cron-07h"}'::jsonb,
    timeout_milliseconds:=180000
  )$$
);
```

Confira antes de mexer:

```sql
select jobid, schedule, command from cron.job where jobid in (1,2,3,4,6) order by jobid;
```

- [ ] **Step 6: Deployar as funções**

```bash
cd /Users/erickmartins/iamundi
npx supabase functions deploy auditar-dados --project-ref kounqtdoioootxqegkij
npx supabase functions deploy coletar-dados --project-ref kounqtdoioootxqegkij
```

O `auditar-dados` continua com `verify_jwt=false` (o segredo não é um JWT) — o mesmo arranjo da `fabrica-purga`. Confirme que o deploy não mudou o toggle.

- [ ] **Step 7: Provar que fechou e que o cron continua funcionando**

Sem segredo — **tem que dar 401**:

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST \
  https://kounqtdoioootxqegkij.supabase.co/functions/v1/auditar-dados
```

Esperado: `401`. **Antes desta task, isto devolvia 200 e apagava a trilha do dia.**

Com a anon key (o vetor do `coletar-dados`) — **tem que dar 401**:

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST \
  -H "Authorization: Bearer <ANON_KEY_PUBLICA>" \
  https://kounqtdoioootxqegkij.supabase.co/functions/v1/coletar-dados
```

Esperado: `401`.

Com o segredo certo — **tem que dar 200**:

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST \
  -H "Authorization: Bearer <SEGREDO_AUDITAR>" \
  https://kounqtdoioootxqegkij.supabase.co/functions/v1/auditar-dados
```

Esperado: `200`.

**E o mais importante — o cron real:** dispare o job na mão e confirme que passa.

```sql
select cron.schedule('teste-auditar-agora', '* * * * *', (select command from cron.job where jobid = 6));
-- espere 1 minuto, depois:
select status, return_message, start_time from cron.job_run_details
where jobid = (select jobid from cron.job where jobname = 'teste-auditar-agora')
order by start_time desc limit 1;
select cron.unschedule('teste-auditar-agora');
```

Esperado: `status = 'succeeded'`. Se der 401 aqui, o cron ficou com o segredo errado — **conserte antes de encerrar a task**, senão a coleta morre em silêncio.

- [ ] **Step 8: Commit**

```bash
cd /Users/erickmartins/iamundi
git add supabase/functions/_shared/segredo-de-cron.ts supabase/functions/auditar-dados/index.ts supabase/functions/coletar-dados/index.ts
git commit -m "fix(edge): fecha auditar-dados e coletar-dados com segredo proprio

auditar-dados estava com verify_jwt=false E sem auth no codigo: endpoint
aberto na internet que apagava a trilha de auditoria do dia, gastava a cota
da Graph API das 7 contas e disparava o webhook de alerta. Sem token nenhum.

coletar-dados tinha verify_jwt=true, que nao protege: a anon key e um JWT
valido do projeto e esta no bundle publico do site.

Padrao copiado da fabrica-purga: segredo dedicado, tempo constante,
fail-closed. pg_cron (jobs 1-4 e 6) atualizado na mesma janela."
```

---

## Encerramento da Onda 1

- [ ] **Rodar tudo**

```bash
cd /Users/erickmartins/iamundi
npm test && npm run build
git log --oneline main..HEAD
```

- [ ] **Conferir a lista com o dono, item a item:**

1. `POST /auditar-dados` sem token devolve 401 (antes: 200 + apagava a trilha).
2. `POST /coletar-dados` com a anon key devolve 401.
3. O cron das 4 coletas e do "saúde dos dados" **continua rodando** (`cron.job_run_details` = `succeeded`).
4. Às 22h BRT, "HOJE" na Gestão de Tráfego mostra dados (antes: vazio).
5. Token expirado no Claude Status mostra "Sua sessão expirou" (antes: "0 execuções, R$ 0").
6. "Esqueci a senha" leva ao formulário de senha nova (antes: caía no Início).
7. Usuário sem permissão em `/claude-status` volta pro Início (antes: entrava e editava).
8. As 5 Edge Functions órfãs estão no git.

- [ ] **Push e deploy só com autorização explícita do dono.**

- [ ] **Escrever o plano da Onda 2** — precisa do dump anônimo de `profiles`, agora obtenível pelo MCP.
