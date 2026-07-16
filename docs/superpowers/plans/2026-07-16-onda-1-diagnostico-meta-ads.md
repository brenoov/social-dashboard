# Diagnóstico — "Meta Ads não aparece dado nenhum"

Data: 2026-07-16 · Task 3 da Onda 1 · Método: `superpowers:systematic-debugging`

**Reclamação:** *"alguns usuários relatam que ao abrir a dash de redes sociais, e as ferramentas do meta ads n aparece dado nenhum"*

---

## Resposta curta

A causa raiz **não é o fuso horário**. É uma **quarta causa**, que ninguém tinha levantado:

> O coletor de dados decide de qual conta de anúncios buscar usando uma **lista fixa escrita à mão dentro do código** (`AD_ACCOUNTS`, `coletar-dados/index.ts:8`), em vez de ler a coluna `accounts.ad_account_id` do banco — que é a que as telas usam. Para o perfil **Mantova Móveis** os dois números **não batem**. O coletor busca uma conta de anúncios errada, a Meta não devolve nada, o erro é engolido por um `catch` vazio, e o perfil fica **sem nenhum dado de Meta Ads, para sempre**.

Não depende da hora. Não depende do usuário. Depende de **qual perfil está selecionado**.

---

## A evidência que confirma

O coletor (`supabase/functions/coletar-dados/index.ts:393`) faz:

```ts
const adAccountId = AD_ACCOUNTS[igId];   // lista fixa no código, linha 8
if (adAccountId) { ...coleta os anúncios... }
```

E a coleta erra em silêncio (`coletar-dados/index.ts:317`):

```ts
} catch { /* sem dados de ads */ }
```

Cruzando a lista fixa do coletor com o banco (consulta só-leitura, 2026-07-16):

| Perfil | `ad_account_id` no banco | na lista fixa do coletor | Batem? | Linhas em `campaign_insights` |
|---|---|---|---|---|
| Breno Vale | 1523458001735386 | 1523458001735386 | sim | **3.255** |
| Motoeasy | 803642218253857 | 803642218253857 | sim | **1.094** |
| Raíssa Herculano | 591630990582441 | 591630990582441 | sim | **5.280** |
| Vessel | 1197997517858139 | 1197997517858139 | sim | **805** |
| **Mantova Móveis** | **1449585576442706** | **786453150398609** | **NÃO** | **0** |
| Gustavo Guerra | (não tem) | (não tem) | — | 0 (esperado) |
| Humberto Mendonça | (não tem) | (não tem) | — | 0 (esperado) |

**A correlação é perfeita: 4 de 4 perfis em que os números batem têm milhares de linhas; o único perfil em que divergem tem exatamente zero — e nunca teve nenhuma, desde sempre.**

Mantova tem token válido e tem `ad_account_id` preenchido no banco. Não é falta de cadastro: é o coletor procurando no lugar errado.

### Por que a falha é invisível (o agravante)

Três camadas escondem o problema — por isso ninguém viu um erro na tela:

1. `coletar-dados/index.ts:317` — `catch { /* sem dados de ads */ }` engole a recusa da Meta.
2. `buscar-e-salvar-dados.js:13` — `return Array.isArray(json) ? json : []`. **Provado com requisição real:**
   - token anônimo (sessão perdida) → **HTTP 200 + `[]`** (a RLS de `campaign_insights` libera só o papel `authenticated`; o anônimo não recebe erro, recebe lista vazia)
   - token vencido → **HTTP 401 + objeto de erro** → não é lista → vira `[]`. **O `catch` nunca dispara**, porque `fetch` não rejeita em 401.
3. `controle-de-login-e-usuario.js:32` — `profiles?.[0] || {}`: num 401 o perfil vira `{}` e o usuário fica **sem permissão nenhuma**, silenciosamente, também sem passar pelo `catch`.

Nenhuma dessas camadas *causa* o bug do Mantova, mas todas garantem que ele apareça como "zero" em vez de "deu erro".

---

## Hipóteses descartadas (e por quê)

### 1. Fuso horário — DESCARTADA como causa de "não aparece nada"

É verdade que `_gi(now)` (`tela-de-gestao-trafego.vue:525`) usa UTC e às 22h30 BRT devolve a data de **amanhã**. Mas isso **não esvazia a tela que o usuário abre**.

O padrão do filtro é `_gtPreset='sofar'` (`tela-de-gestao-trafego.vue:215`), e ele **não é salvo** entre sessões (é um `let` de módulo). Ou seja: **toda vez que alguém abre a Gestão de Tráfego, cai no "sofar"** — nunca no "hoje".

Provado com `node --test` + `mock.timers` às 22h30 BRT (5 testes, todos passando):

| Filtro | Janela pedida às 22h30 BRT | Efeito |
|---|---|---|
| `sofar` (**o padrão**) | 2026-07-01 → 2026-07-17 | **cobre os dias reais → tem dado** |
| `30` | 2026-06-17 → 2026-07-17 | cobre os dias reais → tem dado |
| `today` | 2026-07-17 → 2026-07-17 | janela no futuro → vazio |
| `1d` | 2026-07-16 (devia ser 15) | mostra hoje no lugar de ontem → dado errado, não vazio |

O `until` cair no futuro é inofensivo: a janela continua cobrindo 01→16.

**Conclusão:** o fuso é um bug **real**, mas só morde quem **clica em "Hoje"** entre 21h e 00h. Não explica "abri e não tem nada". Além disso, a tela de Redes Sociais **já usa o jeito certo** (`toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })`, linhas 710, 750, 777, 1064) — ali o fuso não é problema.

### 2. `sb()` engolindo erro — DESCARTADA como causa raiz (é agravante, não gatilho)

O mecanismo existe e foi provado (ver acima), mas:

- **Não pode explicar o quadro da Gestão de Tráfego.** As 3 chamadas `sb()` daquela tela (linhas 417, 425, 433) só buscam `gt_config_metricas`, `gt_budget_analises` e `gt_ad_analises`. As campanhas vêm do `meta-proxy` (linhas 536-541), que tem o **seu próprio** engolidor: `.catch(()=>[])`.
- **A previsão distintiva não bate.** Se fosse sessão/erro, sumiria ao recarregar ou relogar. A reclamação é de perfil que **nunca** mostra dado.
- A RLS de `campaign_insights` é `authenticated read` com `using true`: **todo usuário logado lê tudo**. Não há filtro por usuário que possa zerar a tela.

Continua sendo algo a corrigir (falha silenciosa é veneno), mas não é o gatilho.

### 3. `allowed_accounts` — DESCARTADA, morta por dado

Consulta no banco: **os 14 perfis têm `allowed_accounts = null`** (= todos os perfis liberados). **Nenhum usuário está escopado a um subconjunto.** É impossível que esse mecanismo esteja escondendo perfil de alguém hoje.

Observação lateral (não é este bug): 4 usuários (`guilherme.cardoso`, `Abner.levino`, `tv@`, `larissa.sousa`) **não têm** as permissões `meta.*`. Isso não afeta o bloco de Meta Ads da dash de Redes, que só é protegido por `tool:social` (`tela-de-redes-sociais.vue:2149`) — mas explicaria "não vejo as ferramentas de Meta Ads" **no menu**. Vale confirmar com o dono o que o usuário quis dizer.

---

## Onde cada tela dói

As duas telas citadas são **dois problemas diferentes** — não um só:

| Tela | De onde vem o dado de Ads | Sofre o bug do mapa? | Sofre o fuso? |
|---|---|---|---|
| **Redes Sociais** (bloco Meta Ads) | `campaign_insights` (o coletor) | **SIM — causa raiz** | não (já usa BRT certo) |
| **Gestão de Tráfego** | `meta-proxy` ao vivo (`/me/adaccounts`) | não | só no filtro "Hoje", 21h-00h |

A Gestão de Tráfego descobre as contas ao vivo (`tela-de-gestao-trafego.vue:326`), então mostra Mantova normalmente. Quem olha o **bloco de Meta Ads da dash de Redes** com o perfil Mantova vê zero.

---

## O que ainda não está provado

Sendo honesto sobre o limite da evidência: **não consegui provar *por que* a conta `786453150398609` não devolve nada** (se o token não tem acesso, se ela não existe mais, ou se está sem campanhas) — isso exigiria chamar a API da Meta com o token real, que eu não fiz de propósito. Mas isso **não muda o conserto**: o coletor tem que ler `accounts.ad_account_id` do banco, que é a fonte de verdade que as telas já usam. A divergência + zero linhas + correlação perfeita nos outros 4 perfis já fecham a causa.

---

## Recomendação

1. **Task nova (a que resolve a reclamação):** o coletor deve ler `ad_account_id` do banco e apagar o mapa fixo `AD_ACCOUNTS`. Hoje `coletar-dados/index.ts:435` faz `select('id,name,instagram_id,access_token')` — **nem traz a coluna**. Depois de corrigir, rodar um backfill do histórico do Mantova.
2. **Task nova (para não cegar de novo):** trocar os `catch` mudos por registro de erro — no coletor (linhas 290, 317, 339) e no `sb()` — e fazer o `sb()` distinguir "vazio de verdade" de "falhou". Sem isso, o próximo perfil cadastrado errado some do mesmo jeito, em silêncio.
3. **Tasks 4-5 (fuso):** seguem válidas, mas **corrigem outro bug** — o filtro "Hoje" à noite. Não devolvem dado nenhum ao Mantova.

---

## Como reproduzir

```bash
# Prova do fuso (5 testes) — mostra que o filtro PADRÃO não fica vazio
TZ=America/Sao_Paulo node --test prova-fuso.test.mjs

# Prova do silêncio: anônimo devolve 200 + [] (sem erro nenhum)
curl -s -o /dev/null -w "%{http_code}\n" \
  "$SUPABASE_URL/rest/v1/campaign_insights?limit=2&select=campaign_id" \
  -H "apikey: $ANON" -H "Authorization: Bearer $ANON"     # => 200, corpo []
```

A prova do mapa é a tabela de cruzamento acima (consulta só-leitura em `accounts` × `campaign_insights`).
