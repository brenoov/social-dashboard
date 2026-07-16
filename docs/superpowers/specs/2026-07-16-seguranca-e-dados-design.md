# Segurança, Autorização e Dados Confiáveis — Design

**Data:** 2026-07-16
**Origem:** auditoria de 6 frentes do repositório (núcleo, redes/acessos, tráfego/vendas, Fábrica, Edge Functions, robôs/SQL)
**Escopo:** frentes A (segurança/autorização/micropermissões) e B (bugs de dado silencioso)

## Por que agora

O repositório `brenoov/social-dashboard` é **público**. Schema, RLS e chave anon são de conhecimento público, então a segurança real depende inteiramente do que o banco e as Edge Functions verificam. A auditoria encontrou três camadas que discordam entre si:

- **Front** (`hasPermission`) decide por `permissions{}` — recurso + ação.
- **Edge Functions** decidem por `hasOwnProperty(recurso)` — existência da chave, ignorando a ação.
- **RLS** decide por `features[]` ou por `USING (true)` — nível de módulo, ou nada.

Dessa discordância saem quase todos os furos: o front esconde o botão, a Edge Function deixa passar, o RLS libera geral.

**Descoberta que inverte o risco percebido:** `hasPermission()` (`src/compartilhado/controle-de-login-e-usuario.js:77-84`) ignora `features[]` por completo. O front já roda 100% em `permissions{}`. Logo, **o RLS hoje é mais frouxo que o front**, não mais apertado, e alinhar o RLS ao `permissions{}` tende a ser quase um no-op para quem usa o sistema.

## Decisões tomadas

| Decisão | Escolha |
|---|---|
| Modelo de autorização | Fonte única no banco: `tem_permissao(recurso, acao)` |
| Migração dos perfis | Auditar dump real + backfill por SQL, conferido antes de ligar |
| Fonte de dados dos KPIs | Um resolvedor só; card e cálculo derivado leem do mesmo lugar |
| Falha de busca | `sb()` devolve array com `.erro` anexado + faixa de aviso na tela |
| Ação `exportar` | Passa a valer, concedendo no backfill a quem já tem `ver` |
| Recursos órfãos | Derivar do módulo-pai |
| Entrega | Três ondas, deploy entre elas |

## Pré-requisitos (bloqueiam a Onda 1)

1. **Acesso ao Supabase do iamundi** (`kounqtdoioootxqegkij`). O MCP está autenticado na conta do Acólitos e só enxerga `fttjgsotuosjfrasttds`. Sem isso não dá para rodar `get_edge_function` — e a memória do projeto registra que o repo **já esteve atrás da produção** (v15 do coletor existia no ar e não no git). Editar a partir do repo e deployar pode sobrescrever código não versionado.
2. **Confirmar exposição do `accounts.access_token`:**
   ```sql
   select policyname, roles::text, cmd, qual::text from pg_policies
   where schemaname='public' and tablename='accounts' and cmd in ('SELECT','ALL');
   ```
   Se houver SELECT para `authenticated`, o token do Meta vaza para qualquer funcionário logado (RLS é row-level, não column-level: a policy que libera `id,name` libera `access_token`).
3. **Dump anônimo dos perfis** (bloqueia só a Onda 2):
   ```sql
   select id, role, is_superadmin, features,
          (select jsonb_object_agg(k, v) from jsonb_each(permissions) as t(k,v)) as permissions,
          allowed_accounts is null as ve_todas_as_contas
   from profiles order by is_superadmin desc, role;
   ```
4. **Confirmar o horário dos relatos** de "Meta Ads sem dados" (se vêm do fim da noite, confirma a hipótese do fuso).

---

## Arquitetura

### Uma regra, três consumidores

```sql
create or replace function public.tem_permissao(recurso text, acao text)
returns boolean language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles p
    where p.id = auth.uid()
      and (p.is_superadmin or (p.permissions -> recurso) ? acao)
  );
$$;

revoke execute on function public.tem_permissao(text,text) from public, anon;
```

- `security definer` — necessário para ler `profiles` sem esbarrar na RLS da própria `profiles` (evita recursão).
- `set search_path = public` — fecha sequestro de schema em função definer.
- `revoke ... from public, anon` — segue o padrão já usado em `acessos` (`002_rls.sql:37-39`). Num repo público, função definer aberta a `anon` é convite.

**Consumidores:**

- **RLS** — cada policy vira uma linha legível: `using (tem_permissao('claude.status','ver'))` para SELECT, `('claude.status','editar')` para UPDATE/DELETE. Some o `USING (true)`.
- **Edge Functions** — módulo novo `supabase/functions/_shared/autorizar.ts`, com `exigirPermissao(req, recurso, acao)`: resolve o JWT, carrega o perfil, devolve 403 se não passar. As 5 funções da Fábrica trocam o `hasOwnProperty` por ele.
- **Front** — `PERMISSION_TREE` rebaixado a **espelho**: serve para esconder botão, nunca para decidir segurança.

### Cron não entra nesse modelo

`coletar-dados` e `auditar-dados` são chamadas por `pg_cron`, não por usuário. Elas recebem o padrão da `fabrica-purga`: segredo próprio, comparação em tempo constante, fail-closed.

**Gotcha obrigatório:** ligar a checagem exige atualizar os jobs do `pg_cron` para enviarem o segredo no header, **na mesma mudança**. Se a checagem entrar e o cron não, o coletor para de coletar — e, pelo `catch` vazio existente, pararia em silêncio.

### Catálogo reconciliado

`RECURSOS` (14 entradas) e `PERMISSION_TREE` (11 entradas) divergem. Faltam no editor de admin: `social.relatorio`, `sales.metas`, `gestor.relatorios`. **Ninguém além de superadmin pode ter essas chaves**, porque não há UI que as conceda.

Risco concreto: a auditoria indica que `gc_vendas_item` deveria ser gateada por `gestor.relatorios`. Ligar a policy sem corrigir isso faz **todo não-superadmin perder os Relatórios Comerciais**.

**Correção:** `RECURSOS` vira fonte única; `PERMISSION_TREE` passa a ser derivado dele, não escrito à mão em paralelo. Recurso novo aparece no editor automaticamente — atende a regra do projeto de "todo submódulo nasce como permissão própria gateada".

---

## Visibilidade de erro

`sb()` (`src/compartilhado/buscar-e-salvar-dados.js`) devolve `[]` para três estados distintos: vazio de verdade, falhou, e sem permissão. É a raiz do "painel verde mentindo" e torna a Onda 3 inauditável — quem perder acesso veria "0 registros" em vez de "sem permissão".

**Não** faremos `sb()` lançar exceção: são **53 sítios de chamada em 10 arquivos** (redes-sociais 19, admin 15, meta-ads 13, gestao-trafego 4, claude-status 2). Um `await sb()` sem guarda vira tela branca. Trocaríamos "mente em silêncio" por "quebra alto".

**Escolha:** o array continua array, com o erro anexado em propriedade **não-enumerável**.

```js
export async function sb(path) {
  const vazio = []
  try {
    const token = estado.currentSession?.access_token || SUPABASE_ANON_KEY
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
    })
    const json = await r.json()
    if (!r.ok) return comErro(vazio, classificar(r.status, json))
    return Array.isArray(json) ? json : comErro(vazio, classificar(r.status, json))
  } catch {
    return comErro(vazio, { tipo: 'rede', mensagem: 'Sem conexão com o servidor.' })
  }
}
```

Quem não conhece o `.erro` funciona como hoje (`.length` é 0, `.map` e spread funcionam). Quem trata faz `if (linhas.erro)`. Adoção **incremental**: na Onda 1 a faixa liga só em Claude Status, seção Meta Ads das redes e Gestão de Tráfego.

| Situação | Texto ao usuário |
|---|---|
| 401 / `PGRST301` | "Sua sessão expirou — entre de novo." + botão |
| 403 / `42501` | "Você não tem permissão para ver isso." |
| 5xx | "O servidor não respondeu. Tente de novo." |
| Falha de rede | "Sem conexão com o servidor." |
| Array vazio sem erro | Estado vazio normal da tela (nada muda) |

Componente compartilhado `faixa-de-erro.vue` com `@tentar-de-novo`. Português literal: o Breno lê "sua sessão expirou", não "PGRST301".

**Custo aceito:** anexar propriedade em array é mágico — `linhas.filter(...)` perde o `.erro`, e quem não conhece o truque não descobre lendo a chamada. A alternativa (`{dados, erro}`) é engenharia melhor mas obriga a mexer nos 53 sítios no mesmo ciclo da segurança. Decisão: mágico-e-reversível agora, migrar para explícito depois, fora deste ciclo.

**Entram junto (mesmo defeito, outra roupa):**

- `carregarPerfil()` (`controle-de-login-e-usuario.js:25-48`) engole qualquer falha e produz `role='viewer'`, `permissions={}` — idêntico ao caminho de sucesso com perfil vazio. Passa a distinguir "é viewer" de "não consegui carregar"; o segundo caso mostra faixa em vez de rebaixar silenciosamente o super-admin.
- `onAuthStateChange` (`ponto-de-partida.js:21`) só chama `setSession()`, que não recarrega perfil nem zera flags. O SDK dispara `SIGNED_IN` sozinho no `visibilitychange` lendo o localStorage — a aba fica com o **token de um usuário e as flags de outro**. Passa a recarregar o perfil quando a sessão troca e a zerar `estado` inteiro no `SIGNED_OUT`.

---

## Datas

**Nem todo `toISOString()` é bug.** Dos 12 sítios, a maioria está correta e não deve ser tocada:

- `updated_at: new Date().toISOString()` — timestamp, uso correto.
- `new Date(s + 'T12:00:00').toISOString()` — truque do meio-dia; ao meio-dia local o UTC ainda é o mesmo dia.
- `new Date(di + 'T00:00:00')` em laços — meia-noite BRT vira 03:00 UTC, mesmo dia.

**Os 4 bugs reais** são onde `toISOString()` extrai *a data de hoje* de um `Date` de "agora":

| Arquivo | Sintoma |
|---|---|
| `redes-sociais/tela-de-redes-sociais.vue:1677` | 21h–00h: anéis de story somem de todos os perfis |
| `gestao-trafego/tela-de-gestao-trafego.vue:525` | 22h: "HOJE" pede amanhã → board vazio; "1D" mostra hoje |
| `analise-vendas/tela-de-analise-vendas.vue:1030-1032` | 22h: coluna "Hoje" zera; "Ontem" mostra hoje |
| `acessos/tela-de-acessos.vue:1028` | Data de fim de contrato pré-preenche o dia seguinte |

**Módulo novo `src/compartilhado/datas.js`:**

```js
const TZ = 'America/Sao_Paulo'
export const hojeLocal = () => new Date().toLocaleDateString('en-CA', { timeZone: TZ })
export const diasAtras = (n) => { /* mesma régua, sempre BRT */ }
```

Usa `toLocaleDateString('en-CA', { timeZone })` — padrão **já usado em 8 lugares** do projeto — em vez do `getFullYear/getMonth/getDate` do `analise-campanhas`. Motivo: `getDate()` devolve o fuso **da máquina de quem olha**; o negócio é no Brasil e a janela tem que ser BRT independentemente de onde o navegador está.

---

## Fonte dos KPIs

A tela mistura ao vivo e coletado no mesmo cálculo:

- Card de investimento mostra ao vivo (R$ 1.200); custo por seguidor divide pelo coletado (R$ 800) → custos ~33% subestimados.
- Card de novos seguidores mostra ao vivo; barra "Meta geral" entra com o coletado → dois números contraditórios na mesma tela.
- Rótulo do comparativo usa `refDate − 1 mês`; o valor comparado usa a janela imediatamente anterior → "vs 9 Jun – 16 Jun" exibindo o número de 02–09/07.

**Módulo novo `src/ferramentas/redes-sociais/fonte-de-dados.js`** (puro, testável): decide a fonte de cada KPI (ao vivo quando disponível, coletado como fallback, selo "consolidando" quando aplicável). Card **e** cálculo derivado passam a ler do mesmo resolvedor.

Não é invenção: o `_inv` (`tela-de-redes-sociais.vue:1561`) já faz essa escolha inline — só que apenas o card a usa. Estamos generalizando um padrão existente.

**Consequência explícita:** custo por seguidor, custo por interação e "Meta geral" **mudam de número**. O número de seguidores **não muda** — ele já vem do resolvedor hoje, e bate com o painel profissional do Breno (conferido pelo dono em 2026-07-16).

**Validação obrigatória antes de tocar na tela real:** página de staging gated por superadmin, 5 perfis × 8 períodos, número velho vs novo lado a lado, diferença destacada. Segue a regra do projeto de validar em HTML temporário antes do app principal.

---

## Testes

Padrão do projeto: **lógica pura fora do `.vue`, `node:test` sem dependência extra**. 24 arquivos `.test.mjs` existem e passam (50 testes), mas **não há `npm test` nem CI que os rode** — só rodam se alguém lembrar. Incluir o script e um job de CI.

| Módulo | Contrato travado pelo teste |
|---|---|
| `datas.js` | "às 22h BRT do dia 16, `hojeLocal()` devolve `2026-07-16`" — trava a classe, não as 4 instâncias |
| `fonte-de-dados.js` | "card e derivado leem a mesma fonte" — impede o R$ 1.200/R$ 800 voltar |
| `classificar-erro.js` | 401 → sessão; 403 → permissão; 5xx → servidor |
| `_shared/autorizar.ts` | dado perfil + recurso/ação, passa ou não (parte pura) |

**Validações com olho humano:**

1. **Staging das redes** — o dono confirma que o seguidor não mexeu.
2. **Teste de RLS real (Onda 3, inegociável)** — script autentica como **usuário descartável** com `permissions{}` conhecido e verifica: lê o que deve, **recebe 403 no que não deve**. Regra do projeto: não mexer em dados reais para testar; criar perfil de teste próprio. Sem essa prova não sabemos se apertamos ou se só achamos que apertamos.
3. **`systematic-debugging` no "Meta Ads sem dados"** antes de tocar nas telas. Se for o fuso, o teste do `datas.js` cobre. Se for outra causa, descobrimos antes de mexer em 4 arquivos.

**Fora de escopo:** teste de componente Vue, Vitest, Testing Library. Dependência e padrão novos no mesmo ciclo que mexe em segurança e dados. A lógica sai do `.vue`; o `.vue` fica fino o suficiente para o olho validar.

---

## Ondas

Dependência dura: **não dá para apertar o RLS antes de as falhas ficarem visíveis e os perfis estarem migrados.** Apertar antes = quebra invisível para os dois lados.

Cada onda recebe **seu próprio plano de implementação** e seu próprio deploy. A Onda 2 não pode ser planejada em detalhe antes do dump dos perfis chegar, e a Onda 3 depende do que a Onda 2 revelar. Planejar as três de uma vez seria inventar os detalhes das duas últimas.

### Onda 1 — risco zero de usuário (é a instrumentação das outras)

- Auth self-contained em `coletar-dados` e `auditar-dados` + atualização do `pg_cron` (juntas).
- `datas.js` + os 4 sítios de fuso.
- `sb()` com `.erro` + `classificar-erro.js` + `faixa-de-erro.vue`; ligar em Claude Status, Meta Ads das redes, Gestão de Tráfego.
- `carregarPerfil()` e `onAuthStateChange` parando de engolir/deixar estado velho.
- "Esqueci a senha" e convite: hoje o link cria sessão e joga no Início, o usuário **nunca vê o formulário de senha nova** (a view `set-pass` é código morto; não há leitura de `type=recovery` em todo o `src/`). Quem pede reset entra e fica trancado quando a sessão expira.
- Guarda de rota para `/claude-status` e `/noticias` (as únicas 2 de 16 sem gate).
- `npm test` + job de CI.
- Investigação do "Meta Ads sem dados" via `systematic-debugging`.

### Onda 2 — precisa dos dados reais

- Reconciliar `RECURSOS` → `PERMISSION_TREE` derivado.
- Auditar o dump anônimo dos perfis.
- Migration de backfill, com as regras explícitas abaixo.
- Conferência linha a linha com o dono **antes** de qualquer policy nova.

**Backfill dos 3 recursos órfãos — derivação do módulo-pai:**

| Ganha a chave | Quem já tem |
|---|---|
| `social.relatorio: ['ver']` | `social: ['ver']` |
| `sales.metas: ['ver']` | `sales.gestao: ['ver']` **ou** `sales.analise: ['ver']` |
| `gestor.relatorios: ['ver']` | `gestor: ['ver']` |

**Backfill do `exportar` — concedido a quem já tem `ver` no mesmo recurso**, nos 6 recursos que declaram a ação em `RECURSOS`: `social`, `social.relatorio`, `sales.gestao`, `sales.analise`, `meta.campanha`, `gestor.relatorios`. Ninguém perde a capacidade de exportar no deploy; a partir daí a ação passa a ser removível pelo editor.

Nota: `sales.metas` declara `['ver','editar']` e `social.relatorio`/`gestor.relatorios` declaram `['ver','exportar']`. O backfill dos órfãos concede **apenas `ver`**; `editar`/`exportar` desses três seguem a regra geral acima (`exportar` acompanha o `ver` recém-concedido; `editar` de `sales.metas` **não** é concedido automaticamente e fica para concessão manual).

### Onda 3 — fecha

- `tem_permissao()` + `revoke` de `anon`/`public`.
- Policies novas nas 4 tabelas com `USING (true)`: `gc_vendas_item`, `gc_estoque_item`, `gestao_comercial_briefings`, `ia_execucoes`; e escrita de `projetos_status` (hoje INSERT/UPDATE/DELETE para qualquer autenticado — dá para apagar o painel inteiro pelo console).
- `_shared/autorizar.ts` nas 5 funções da Fábrica (hoje `hasOwnProperty` = usuário "somente ver" apaga campanhas).
- `allowed_accounts` verificado em `insights-ao-vivo`, `contar-collabs`, `serie-novos-dia` (hoje só filtra o seletor no front; trocar `account_id` no request lê investimento em R$ de outro perfil).
- Checagem de ação `editar` nas mutações do Gestor de Tráfego (hoje pausar/orçamento não checam nada; `_gtOpenEditor`/`_gtSaveEditor` estão expostos em `window`).
- `accounts.access_token` conforme o resultado do SQL de pré-requisito: mover para tabela própria sem policy, ou expor `accounts` ao front via view sem a coluna.
- Confirmar RLS de UPDATE em `profiles` restringindo `is_superadmin`/`role` a superadmins (a auditoria não conseguiu ler as policies; sem isso, `role='admin'` se autopromove por REST).
- Teste de RLS com usuário descartável.

## Fora do escopo deste ciclo

Frentes que ficam para ciclos seguintes, cada uma com sua própria spec: publicação duplicada na Meta (Fábrica), gráficos novos e modal das redes, velocímetros da Gestão à Vista, conjuntos ABO e saldo do Gestor de Tráfego, redesign dos Acessos + foco Zoho, agendamento dos agentes de IA, kanban duplo do Claude Status.

Registrados aqui para não se perderem, com o que a auditoria já apurou:

- **`valida_ate` ignorado** (`gt_budget_analises`): aplicar sugestão vencida derruba R$ 300/dia para R$ 62,50 sob rótulo "escalar".
- **Projeção da Gestão à Vista**: divide o mês anterior inteiro (30 dias) pelos dias corridos do mês atual (16) → queda falsa de ~48% num mês idêntico.
- **Upload do Banco**: `upsert:true` com chave derivada só do nome, sem confirmação — sobrescreve arquivo bom em silêncio.
- **`status-projetos.mjs`**: `/\bNO AR\b/` sobre o documento inteiro → 7 planos com 0 checkboxes publicados como "no ar"; e a proteção de edições manuais falha em aberto (503 → `Set()` vazio → sobrescreve curadoria manual).
- **`serie-novos-dia`**: `catch` vazio transforma falha da Meta em gráfico de zeros com 200 OK.
- **Backlog "editor de orçamento CBO/ABO"**: abriria o furo que o orçamento hardcoded hoje fecha.
