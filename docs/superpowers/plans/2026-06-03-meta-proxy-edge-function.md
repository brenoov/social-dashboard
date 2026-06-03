# meta-proxy Edge Function — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tirar o token Meta do navegador: toda chamada à Graph API passa por uma Edge Function `meta-proxy` (token só no servidor) e a leitura de `accounts.access_token` pelo cliente é revogada.

**Architecture:** Espelha o `bling-proxy` existente. O cliente manda o JWT da sessão + `{accountId, path, params}`; a função valida usuário + permissão (`admin` ou feature `meta`), lê o token via `service_role`, chama a Graph e devolve JSON. Depois revoga `SELECT(access_token)` de anon/authenticated.

**Tech Stack:** Supabase Edge Functions (Deno/TS), supabase-js, Graph API v22.0, HTML/JS vanilla. Deploy via MCP `mcp__plugin_supabase_supabase__deploy_edge_function`; migrations via `mcp__plugin_supabase_supabase__apply_migration`; SQL via `execute_sql` (project_id `kounqtdoioootxqegkij`).

**Convenções:** após editar o HTML, `cp projetos/central-inteligencia/central-inteligencia-v1.3.html index.html` + push. Sem runner de testes — verificação por grep + checagem de sintaxe (Node) + invocação da função.

**Referência (molde):** o `bling-proxy` usa `verify_jwt:true`, `createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)`, CORS, e devolve `{...data}` com o status. O `meta-proxy` segue o mesmo, somando: extração do usuário (getUser), checagem de permissão, e lookup do token por `accountId`.

---

### Task 1: Criar e deployar a Edge Function `meta-proxy`

**Files:**
- Deploy (via MCP, não há arquivo no repo): function slug `meta-proxy`, `verify_jwt: true`, arquivo `index.ts`.

- [ ] **Step 1: Deployar a função**

Usar `mcp__plugin_supabase_supabase__deploy_edge_function` com `project_id=kounqtdoioootxqegkij`, `name="meta-proxy"`, `verify_jwt=true` (se o parâmetro existir; senão o default já é true), e `files=[{name:"index.ts", content: <abaixo>}]`:

```ts
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const META_GRAPH = 'https://graph.facebook.com/v22.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    const authHeader = req.headers.get('Authorization') || '';
    // 1) usuário a partir do JWT da sessão
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: 'nao autenticado' }, 401);

    const svc = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // 2) permissão: admin OU feature 'meta' (espelha hasPermission('tool:meta'))
    const { data: prof } = await svc.from('profiles').select('role, features').eq('id', user.id).single();
    const allowed = !!prof && (prof.role === 'admin' || (Array.isArray(prof.features) && prof.features.includes('meta')));
    if (!allowed) return json({ error: 'sem permissao' }, 403);

    // 3) entrada
    const { accountId, path, params } = await req.json();
    if (!accountId || !path) return json({ error: 'accountId e path obrigatorios' }, 400);

    // 4) token no servidor
    const { data: acc, error: accErr } = await svc.from('accounts').select('access_token').eq('id', accountId).single();
    if (accErr || !acc?.access_token) return json({ error: 'conta sem token' }, 400);

    // 5) chama a Graph
    const url = new URL(META_GRAPH + path);
    url.searchParams.set('access_token', acc.access_token);
    for (const [k, v] of Object.entries(params || {})) {
      if (v === undefined || v === null) continue;
      url.searchParams.set(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
    }
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);
    try {
      const resp = await fetch(url.toString(), { signal: ctrl.signal });
      const text = await resp.text();
      let data; try { data = JSON.parse(text); } catch { data = { raw: text }; }
      return json(data, resp.status);
    } finally { clearTimeout(timer); }
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
```

- [ ] **Step 2: Confirmar deploy**

Rodar `mcp__plugin_supabase_supabase__list_edge_functions` (project_id `kounqtdoioootxqegkij`) e confirmar que `meta-proxy` aparece com `status: ACTIVE` e `verify_jwt: true`.

- [ ] **Step 3: Testar o portão de auth (server-side)**

`curl` (via Bash) chamando a função com a anon key como Bearer (usuário NÃO autenticado de verdade → getUser nulo). Pegar `SUPABASE_URL` e a anon key do HTML (linha `SUPABASE_ANON_KEY=`).
Run:
```bash
ANON='<anon key do HTML>'
curl -s -X POST 'https://kounqtdoioootxqegkij.supabase.co/functions/v1/meta-proxy' \
  -H "Authorization: Bearer $ANON" -H "apikey: $ANON" -H 'Content-Type: application/json' \
  -d '{"accountId":"x","path":"/me","params":{}}' | head -c 300
```
Expected: resposta `401 {"error":"nao autenticado"}` (a anon key não é um usuário) — prova que o portão rejeita não-usuários. (O caminho de sucesso será exercido pelo cliente na Task 2; o token nunca volta ao cliente.)

- [ ] **Step 4: Commit (marcador — função vive no Supabase, não no repo)**

```bash
cd /Users/erickmartins/iamundi && git commit --allow-empty -m "deploy: meta-proxy edge function (token Meta no servidor)"
```

---

### Task 2: Cliente chama o proxy (sem token no navegador)

**Files:**
- Modify: `projetos/central-inteligencia/central-inteligencia-v1.3.html` (metaFetch/metaFetchAll + chamadores + selects de contas)

- [ ] **Step 1: Localizar tudo que usa token Meta**

Run:
```bash
cd /Users/erickmartins/iamundi && F=projetos/central-inteligencia/central-inteligencia-v1.3.html
grep -n "async function metaFetch\|metaFetchAll(\|metaFetch(\|\.access_token\|select=id,name,access_token\|select=id,name,instagram_id,access_token" "$F"
```
Anotar: a def de `metaFetch`/`metaFetchAll`; cada chamador (`_fetchInsights`, `_fetchCampaigns`, `_fetchDaily`, `_fetchAdInsights`, `_fetchAccountReach`, os fetches da tela Google, e os previews de saldo/gasto na lista de contas); e os 2 `select` de `accounts` que pedem `access_token`.

- [ ] **Step 2: Reescrever metaFetch/metaFetchAll para usar o proxy**

Substituir as funções atuais (assinatura `(path, params, token)`) por (assinatura `(path, params, accountId)`):

```javascript
async function metaFetch(path,params,accountId){
  const{data:{session}}=await sbClient.auth.getSession();
  if(!session)throw new Error('Não autenticado');
  const ctrl=new AbortController();const timer=setTimeout(()=>ctrl.abort(),15000);
  try{
    const r=await fetch(SUPABASE_URL+'/functions/v1/meta-proxy',{
      method:'POST',signal:ctrl.signal,
      headers:{'Authorization':'Bearer '+session.access_token,'apikey':SUPABASE_ANON_KEY,'Content-Type':'application/json'},
      body:JSON.stringify({accountId,path,params})
    });
    const d=await r.json();
    if(d&&d.error)throw new Error((d.error&&d.error.message)||d.error||'Meta API error');
    return d;
  }finally{clearTimeout(timer);}
}
async function metaFetchAll(path,params,accountId){
  let results=[];const p={...params,limit:500};
  let data=await metaFetch(path,p,accountId);
  results=results.concat(data.data||[]);
  while(data.paging?.cursors?.after&&results.length<2000){
    const np={...p,after:data.paging.cursors.after};
    data=await metaFetch(path,np,accountId);
    results=results.concat(data.data||[]);
  }
  return results;
}
```

- [ ] **Step 3: Trocar o argumento `token` por `accountId` em TODOS os chamadores**

Em cada função/chamada que hoje passa um token Meta para `metaFetch`/`metaFetchAll`, passar o **id da conta** (`_maCurAcc.id` na tela Meta Ads, `_gtCurAcc.id` na tela Google, e `acc.id` no preview da lista de contas). Exemplos (ajustar a assinatura interna de cada `_fetch*` de `(adAccId, token, ...)` para `(adAccId, accountId, ...)` e repassar `accountId`):

```javascript
// ANTES:  metaFetchAll(`/act_${_maCleanAccId(adAccId)}/insights`, {...}, token)
// DEPOIS: metaFetchAll(`/act_${_maCleanAccId(adAccId)}/insights`, {...}, accountId)
```
E em `loadMaData`/`loadGtData` e no preview da lista, trocar `_maCurAcc.access_token` / `_gtCurAcc.access_token` / `a.access_token` por `_maCurAcc.id` / `_gtCurAcc.id` / `a.id`.

- [ ] **Step 4: Remover `access_token` dos selects de contas**

Nos 2 `sb('accounts?...&select=...access_token...')` (carregamento das contas nas telas Meta Ads e Google), remover `,access_token` do `select`. Manter `id`, `ad_account_id`, `name`, etc. Garantir que nenhuma query de `accounts` use `select=*`.

- [ ] **Step 5: Verificar que o cliente não lê mais o token**

Run:
```bash
cd /Users/erickmartins/iamundi && grep -n "access_token" projetos/central-inteligencia/central-inteligencia-v1.3.html | grep -v "session.access_token\|SUPABASE_ANON_KEY\|Bearer"
```
Expected: **nenhuma linha** referente a ler `accounts.access_token` (só podem sobrar usos de `session.access_token`, que é o JWT do usuário, não o token Meta). Se sobrar qualquer `select` com `access_token` ou uso de `.access_token` de conta, corrigir.

- [ ] **Step 6: Checar sintaxe**

Run:
```bash
cd /Users/erickmartins/iamundi && cp projetos/central-inteligencia/central-inteligencia-v1.3.html index.html && node -e '
const fs=require("fs"),vm=require("vm");const html=fs.readFileSync("index.html","utf8");
const re=/<script\b([^>]*)>([\s\S]*?)<\/script>/gi;let m,i=0,bad=0;
while((m=re.exec(html))){if(/\bsrc=/.test(m[1]||""))continue;i++;try{new vm.Script(m[2]);}catch(e){bad++;console.log("X #"+i+": "+e.message);}}
console.log("scripts:",i,"| erros:",bad,bad===0?"OK":"FALHOU");'
```
Expected: `erros: 0 OK`.

- [ ] **Step 7: Commit + push**

```bash
cd /Users/erickmartins/iamundi && git add index.html projetos/central-inteligencia/central-inteligencia-v1.3.html && git commit -m "Meta: chamadas via meta-proxy (token sai do navegador); selects de contas sem access_token" && git push origin main
```

---

### Task 3: Revogar leitura do token no banco (RLS)

**Files:**
- Migration (via MCP): `revoke_accounts_access_token_client`

- [ ] **Step 1: Confirmar pré-condição (cliente limpo)**

Run (repetir o grep da Task 2 Step 5):
```bash
cd /Users/erickmartins/iamundi && grep -n "access_token" projetos/central-inteligencia/central-inteligencia-v1.3.html | grep -v "session.access_token\|SUPABASE_ANON_KEY\|Bearer"
```
Expected: **vazio**. Se NÃO estiver vazio, PARAR — não revogar (quebraria o cliente). Voltar à Task 2.

- [ ] **Step 2: Aplicar a revogação (column-level)**

Via `mcp__plugin_supabase_supabase__apply_migration` (project_id `kounqtdoioootxqegkij`, name `revoke_accounts_access_token_client`):
```sql
revoke select (access_token) on public.accounts from anon, authenticated;
```
(`service_role` — coletor, gerar_tokens.py e meta-proxy — não é afetado.)

- [ ] **Step 3: Verificar que anon/authenticated não leem mais o token**

Via `execute_sql`:
```sql
select has_column_privilege('authenticated','public.accounts','access_token','SELECT') AS auth_le,
       has_column_privilege('anon','public.accounts','access_token','SELECT')          AS anon_le,
       has_column_privilege('service_role','public.accounts','access_token','SELECT')  AS service_le;
```
Expected: `auth_le=false`, `anon_le=false`, `service_le=true`.

- [ ] **Step 4: Confirmar que o coletor ainda lê (service_role)**

Via `execute_sql` (lê como dono/serviço): `select count(*) filter (where access_token is not null) as com_token from accounts;` → deve retornar 7 (todas com token). Prova que o token continua acessível server-side.

- [ ] **Step 5: Commit (marcador)**

```bash
cd /Users/erickmartins/iamundi && git commit --allow-empty -m "RLS: revoga leitura de accounts.access_token por anon/authenticated (token só server-side)"
```

---

## Self-Review (preenchido)

**1. Cobertura da spec:**
- Seção 1 (meta-proxy: JWT + permissão + token server-side + Graph) → Task 1. ✓
- Seção 2 (cliente via proxy; accountId; selects sem token) → Task 2. ✓
- Seção 3 (revogar coluna; verificação por grep+teste, sem navegador) → Task 1 Step 3 (teste auth) + Task 2 Step 5 (grep) + Task 3. ✓
- Permissão = admin OU feature `meta` (ajuste do `tool:meta`/`tool:google` da spec p/ a realidade do `hasPermission`; ambas as telas usam `tool:meta`). ✓

**2. Placeholders:** o único "<anon key do HTML>" é um valor a copiar da linha `SUPABASE_ANON_KEY=` do HTML (instrução concreta), não um TODO. Sem outros.

**3. Consistência de tipos/nomes:** `metaFetch(path,params,accountId)` e `metaFetchAll(path,params,accountId)` usados de forma consistente; corpo do proxy `{accountId,path,params}` casa cliente↔função; permissão checa `profiles.features` contém `'meta'` (igual ao `keyMap` do front).

**Limitação honesta:** não há como mintar um JWT de usuário real aqui sem navegador, então o teste de sucesso ponta-a-ponta da função roda só quando o cliente usa. A **segurança da revogação (Task 3) é garantida pelo grep** (cliente não lê mais o token) — independente do funcional. Se uma tela Meta/Google der erro funcional, é só reportar.
