# Redes Sociais — Híbrido de Fidelidade (KPIs ao vivo) — Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) ou superpowers:executing-plans. Passos com checkbox (`- [ ]`).

**Goal:** os KPIs da tela de Redes Sociais (total seguidores, novos seguidores em 3 linhas, engajamento) passam a vir **ao vivo da Meta com a janela exata**, batendo 100% com o painel, pra qualquer perfil e período; gráficos/histórico continuam do dado coletado.

**Architecture:** função Edge `insights-ao-vivo` (token server-side) devolve os números da Meta para janelas dadas; um helper no front calcula as janelas por período (engajamento = mês-calendário; follows = mesma janela −1 dia); a tela busca os KPIs ao vivo e cai no coletado se a Meta falhar.

**Tech Stack:** Deno/TypeScript (Edge Function), supabase-js (`sbClient.functions.invoke`), Vue SFC, Node (teste do helper), Playwright (validação de UI).

## Global Constraints

- **Branch:** `feat/redes-hibrido` a partir do `main`. `git config user.email=breno@rbvcompany.com`.
- **Receita das janelas (fuso America/Sao_Paulo):** engajamento = faixa do período (mês passado = `[01/mês-ant 00:00, 01/mês-atual 00:00)`); **follows = a MESMA janela deslocada −1 dia** em ambas as pontas. Total seguidores = `followers_count` **atual**.
- **Chamada AGREGADA** (`metric_type=total_value` sobre `since/until`), NUNCA somar chamadas diárias.
- **Nunca número falso:** Meta fora → cai no último coletado com selo "não foi possível atualizar ao vivo (última coleta DD/MM HH:MM)".
- **Token nunca no front** — só a função Edge usa (via `SUPABASE_SERVICE_ROLE_KEY` lendo `accounts.access_token`).
- **Vale pra todos os perfis** (janela por período, sem hardcode). Validar em "mês passado" (bate com a régua) + outro período. `npm run build` verde.
- **Régua (perfil Breno Vale, mês passado):** total 24.300 · seguiu 1.281 / deixou 571 / total 710 · views 1.651.342 · reach 1.014.049 · interações 9.926 · visitas 9.108.
- Bundle: incluir no merge o commit já pronto do **total de seguidores atual** (branch `feat/redes-fidelidade-2`).

---

### Task 1: Edge Function `insights-ao-vivo` (KPIs da Meta, token seguro)

**Files:** Create `supabase/functions/insights-ao-vivo/index.ts`. Deploy via MCP `deploy_edge_function`.

**Interfaces:**
- Consumes (body): `{ account_id, engSince, engUntil, folSince, folUntil }` (os 4 timestamps unix em string).
- Produces (JSON): `{ followers_count, novos:{seguiu,deixou,total}, engajamento:{views,reach,interacoes,visitas}, meta_erro?:string }`.

- [ ] **Step 1: Escrever a função** (base no probe validado; token server-side; chamadas agregadas):
```ts
import { createClient } from 'jsr:@supabase/supabase-js@2'
const GRAPH = 'https://graph.facebook.com/v21.0'
async function apiGet(path: string, params: Record<string,string>) {
  const url = new URL(`${GRAPH}/${path}`); for (const [k,v] of Object.entries(params)) url.searchParams.set(k,v)
  return await (await fetch(url.toString())).json()
}
Deno.serve(async (req) => {
  try {
    const { account_id, engSince, engUntil, folSince, folUntil } = await req.json()
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: acc } = await sb.from('accounts').select('instagram_id,access_token').eq('id', account_id).single()
    if (!acc) return Response.json({ meta_erro: 'conta não encontrada' }, { status: 404 })
    const ig = acc.instagram_id as string, token = acc.access_token as string
    const out: any = { novos: {}, engajamento: {} }
    const f = await apiGet(`${ig}`, { fields: 'followers_count', access_token: token })
    out.followers_count = f.followers_count ?? null
    const eng = await apiGet(`${ig}/insights`, { metric:'views,reach,total_interactions,profile_views', period:'day', metric_type:'total_value', since:engSince, until:engUntil, access_token: token })
    const em: Record<string,number> = {}; for (const it of (eng.data ?? [])) em[it.name] = it.total_value?.value ?? 0
    out.engajamento = { views: em.views ?? 0, reach: em.reach ?? 0, interacoes: em.total_interactions ?? 0, visitas: em.profile_views ?? 0 }
    const fu = await apiGet(`${ig}/insights`, { metric:'follows_and_unfollows', period:'day', metric_type:'total_value', breakdown:'follow_type', since:folSince, until:folUntil, access_token: token })
    let seguiu = 0, deixou = 0
    for (const r of (fu.data?.[0]?.total_value?.breakdowns?.[0]?.results ?? [])) {
      const dv = (r.dimension_values ?? [null])[0]
      if (dv === 'FOLLOWER') seguiu = r.value; else if (dv === 'NON_FOLLOWER') deixou = r.value
    }
    out.novos = { seguiu, deixou, total: seguiu - deixou }
    if (eng.error || fu.error) out.meta_erro = (eng.error?.message || fu.error?.message)
    return Response.json(out)
  } catch (e) { return Response.json({ meta_erro: String(e) }, { status: 500 }) }
})
```

- [ ] **Step 2: Deploy** via MCP `deploy_edge_function` (project `kounqtdoioootxqegkij`, name `insights-ao-vivo`).

- [ ] **Step 3: Validar contra a régua** — invocar via `net.http_post` (mesma auth anon do cron; `timeout_milliseconds:=25000`) com os timestamps de junho:
  - engSince=`01/06 00:00 BRT`, engUntil=`01/07 00:00 BRT`; folSince=`31/05 00:00 BRT`, folUntil=`30/06 00:00 BRT`; account_id=`9233a796-6e6c-47b7-ad43-b0735f51515b`.
  - Ler `net._http_response`. **Esperado:** followers_count=24300+ (atual), novos {seguiu:1281,deixou:571,total:710}, engajamento {views:1651342,reach:1014049,interacoes:9926,visitas:9108}.

- [ ] **Step 4: Commit** (versiona a função no repo)
```bash
git add supabase/functions/insights-ao-vivo/index.ts
git commit -m "feat(redes): edge function insights-ao-vivo — KPIs exatos da Meta (token server-side, chamada agregada)"
```

---

### Task 2: Helper de janelas por período (a receita, no front)

**Files:** Modify `src/ferramentas/redes-sociais/tela-de-redes-sociais.vue` (adicionar `janelasDoPeriodo`). Test: `scratchpad/test-janelas.mjs` (node).

**Interfaces:**
- Produces: `janelasDoPeriodo(periodo: string, hoje: Date) => { engSince, engUntil, folSince, folUntil }` (unix em string). `follows = eng deslocado −1 dia`.

- [ ] **Step 1: Escrever o teste** (`scratchpad/test-janelas.mjs`) — "mês passado" a partir de 2026-07-06 deve dar as janelas de junho:
```js
import assert from 'node:assert'
// cópia do helper (mesma lógica que vai no .vue)
function janelasDoPeriodo(periodo, hoje) {
  const brt = d => Math.floor(new Date(d).getTime()/1000)
  const y = hoje.getFullYear(), m = hoje.getMonth()
  const iso = (yy,mm,dd) => `${yy}-${String(mm).padStart(2,'0')}-${String(dd).padStart(2,'0')}T00:00:00-03:00`
  let engS, engU
  if (periodo === 'mespassado') { engS = iso(y, m, 1) /*1º mês atual −1 mês via Date*/; }
  // (implementação real usa Date pra rolar meses; ver Step 3)
  return null
}
// asserção-alvo (valores do probe):
// mês passado (hoje=2026-07-06): engSince=01/06, engUntil=01/07 ; folSince=31/05, folUntil=30/06
```
(O teste-alvo: para `hoje=2026-07-06`, `mespassado` → engSince=`ts(2026-06-01)`, engUntil=`ts(2026-07-01)`, folSince=`ts(2026-05-31)`, folUntil=`ts(2026-06-30)`.)

- [ ] **Step 2: Rodar o teste — falha** (`node scratchpad/test-janelas.mjs` → função incompleta).

- [ ] **Step 3: Implementar `janelasDoPeriodo`** no `.vue` (e copiar pro teste). Lógica:
```js
function janelasDoPeriodo(periodo, hoje = new Date()) {
  const TS = (yy, mm, dd) => String(Math.floor(new Date(`${yy}-${String(mm).padStart(2,'0')}-${String(dd).padStart(2,'0')}T00:00:00-03:00`).getTime()/1000))
  const y = hoje.getFullYear(), m = hoje.getMonth() // 0-based
  const primeiroDia = (yy, mIdx) => { const d = new Date(yy, mIdx, 1); return [d.getFullYear(), d.getMonth()+1, 1] }
  const menosUmDia = (yy, mm, dd) => { const d = new Date(`${yy}-${String(mm).padStart(2,'0')}-${String(dd).padStart(2,'0')}T12:00:00`); d.setDate(d.getDate()-1); return [d.getFullYear(), d.getMonth()+1, d.getDate()] }
  let engS, engU
  if (periodo === 'mespassado') { const [ay,am] = primeiroDia(y, m-1); const [by,bm] = primeiroDia(y, m); engS = [ay,am,1]; engU = [by,bm,1] }
  else if (periodo === 'mesatual') { const [ay,am] = primeiroDia(y, m); engS = [ay,am,1]; engU = null /* agora */ }
  else { const n = ({ '7d':7,'14d':14,'30d':30,'1d':1,'hoje':0 })[periodo] ?? 30
         const a = new Date(hoje); a.setDate(a.getDate()-n); engS = [a.getFullYear(), a.getMonth()+1, a.getDate()]
         engU = [hoje.getFullYear(), hoje.getMonth()+1, hoje.getDate()] }
  const engSince = TS(...engS)
  const engUntil = engU ? TS(...engU) : String(Math.floor(hoje.getTime()/1000))
  const [fsY,fsM,fsD] = menosUmDia(...engS)
  const [fuY,fuM,fuD] = engU ? menosUmDia(...engU) : [hoje.getFullYear(), hoje.getMonth()+1, hoje.getDate()]
  const folSince = TS(fsY,fsM,fsD)
  const folUntil = engU ? TS(fuY,fuM,fuD) : String(Math.floor(hoje.getTime()/1000))
  return { engSince, engUntil, folSince, folUntil }
}
```
(Ajustar o mapeamento `periodo` para os códigos reais das abas da tela — ver `buildPeriodTabs()`; o `1d/hoje/mesatual` pode ter regra própria de `until`.)

- [ ] **Step 4: Rodar o teste — passa** (`node scratchpad/test-janelas.mjs` sem erro; as 4 janelas de "mês passado" batem os timestamps-alvo).

- [ ] **Step 5: Commit**
```bash
git add src/ferramentas/redes-sociais/tela-de-redes-sociais.vue
git commit -m "feat(redes): helper janelasDoPeriodo (engajamento = mês-calendário; follows = −1 dia)"
```

---

### Task 3: Buscar os KPIs ao vivo na tela + renderizar

**Files:** Modify `tela-de-redes-sociais.vue` (`fetchData`/`update` + wiring; usar `sbClient.functions.invoke`).

**Interfaces:** Consumes `janelasDoPeriodo` (T2) + a função `insights-ao-vivo` (T1).

- [ ] **Step 1: Buscar ao vivo** — dentro do fluxo de `update`/`refresh`, para a conta+período atuais:
```js
const { engSince, engUntil, folSince, folUntil } = janelasDoPeriodo(currentPeriodCode, new Date())
let live = null
try {
  const { data } = await sbClient.functions.invoke('insights-ao-vivo', { body: { account_id: accountId, engSince, engUntil, folSince, folUntil } })
  if (data && !data.meta_erro) live = data
} catch (e) { live = null }
```

- [ ] **Step 2: Renderizar os KPIs do `live`** (com fallback pro coletado quando `live` for null):
  - Total: `animCountFull('#total-followers', live ? live.followers_count : d.followerTotal)`
  - Novos (3 linhas): `#nf-gained = live.novos.seguiu`, `#nf-lost = live.novos.deixou`, `#nf-total = live.novos.total` (via `animCount`). Fallback: os valores coletados de hoje.
  - Engajamento: `#eng-views = live.engajamento.views`, `#eng-reach`, `#eng-interactions`, `#eng-profile-views`. Fallback: `d.eng.*`.

- [ ] **Step 3: Gráficos/comparativos INALTERADOS** — continuam do `d` (coletado). Confirmar que nenhum gráfico quebra por depender de um KPI que agora vem do `live`.

- [ ] **Step 4: Validar** — build OK. Como a tela é login-gated, validar os NÚMEROS via a Task 1 (a função já provou os valores); validar a UI por render (troca de período dispara nova busca; 3 linhas + engajamento populam). Breno confere na produção (Task 5).

- [ ] **Step 5: Commit**
```bash
git add src/ferramentas/redes-sociais/tela-de-redes-sociais.vue
git commit -m "feat(redes): KPIs (total, novos 3 linhas, engajamento) vêm ao vivo da Meta com janela exata"
```

---

### Task 4: Estados de carregando + fallback honesto

**Files:** Modify `tela-de-redes-sociais.vue` (`<style scoped>` + wiring).

- [ ] **Step 1: Carregando** — ao trocar de período/perfil, mostrar um estado "atualizando…" nos KPIs (ex.: opacidade + um mini-spinner) até o `live` voltar. Reaproveitar o padrão de loading existente da tela.

- [ ] **Step 2: Falha da Meta** — se `live` for null (erro/timeout), além de cair no coletado, mostrar um selo discreto: `⚠ não foi possível atualizar ao vivo — mostrando a última coleta (${dataUltimaColeta})`. Nunca esconder que é fallback.

- [ ] **Step 3: Cache leve** — memorizar o `live` por (conta+período) por ~3 min pra não rechamar a Meta a cada re-render. Limpar ao trocar conta/período de fato.

- [ ] **Step 4: Validar** (render dos dois estados) + **Commit**
```bash
git add src/ferramentas/redes-sociais/tela-de-redes-sociais.vue
git commit -m "feat(redes): estados de carregando + fallback honesto (selo de última coleta) nos KPIs ao vivo"
```

---

### Task 5: Validação final + merge (com o total-followers)

- [ ] **Step 1:** `npm run build` OK; a tela carrega; `git diff main --stat` só toca redes-sociais + a função.
- [ ] **Step 2: Trazer o commit do total atual** da branch `feat/redes-fidelidade-2` (cherry-pick) — para o merge levar tudo junto.
- [ ] **Step 3: Merge** `feat/redes-hibrido`→`main` + push. Deploy Vercel READY.
- [ ] **Step 4: Breno valida na produção** em "mês passado": total 24.300 · novos 1.281/571/710 · engajamento 1.651.342/1.014.049/9.926/9.108. Depois troca pra 7d/30d (números coerentes). Meta fora → selo aparece. Rollback via `git revert` se preciso.

---

### Task 6: Limpeza + extensões (mesmo padrão)

- [ ] **Step 1: Remover a função-probe temporária** `probe-fidelidade` (não deixar rodando na produção).
- [ ] **Step 2 (extensões, mesma arquitetura ao vivo — tasks à parte depois):** investimento = todas as campanhas (validar R$ 10.442,58); stories seguidores×não-seguidores (breakdown `reach`/`follow_type` já provado no nível conta — probar a nível story); alcance stories (Visão Geral); collabs na contagem de posts. Cada um: probe da chamada certa → adicionar à `insights-ao-vivo` → renderizar.

---

## Notas de execução

- **Ordem:** T1 (função) → T2 (helper+teste) → T3 (KPIs ao vivo) → T4 (estados) → T5 (merge) → T6 (limpeza/extensões).
- **`insights-ao-vivo` é invocada pelo front via `sbClient.functions.invoke`** (auth da sessão do usuário; a função usa service-role internamente pra pegar o token — o front nunca vê token).
- **Validação de números** se apoia na Task 1 (a função devolve os números; comparo com a régua) — a tela é login-gated, então a UI valido por render + o Breno confere na produção.
- **Render obrigatório** dos estados de UI antes de subir.
