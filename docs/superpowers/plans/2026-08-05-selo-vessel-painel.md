# Selo Vessel — Fase 2: painel Autenticidade — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar à equipe as telas que faltam para o Selo Vessel sair da demonstração e virar produção: gerar lotes de códigos, gravar as tags sem se perder, ver quem registrou a garantia e ser avisado de clonagem.

**Architecture:** Submódulo `Autenticidade` dentro de Gestão Interna, ao lado de Colaboradores, Patrimônio e Frota. Tela Vue única com abas, lendo o banco pelo `sbClient` como as outras ferramentas. O que precisa de privilégio (gerar códigos, ler leituras) passa por funções `security definer` gateadas por `is_vessel_admin()`.

**Tech Stack:** Vue 3 + vue-router (padrão do repo), Supabase Postgres (`kounqtdoioootxqegkij`), `node --test` nas funções puras.

## Global Constraints

- Fase 1 (a página pública) está NO AR e não pode quebrar: `vessel_verificar` e `vessel_registrar` mantêm o contrato atual.
- **A permissão nova nasce DESMARCADA** — nenhuma migration concede acesso a ninguém.
- Os dois modelos de permissão precisam da chave: `RECURSOS`/`PERMISSION_TREE` (front, `permissions{}`) **e** `features[]` (o que o RLS lê).
- Chave da permissão: `autenticidade`. Rótulo: "Autenticidade e Garantia".
- Alfabeto do código: `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (sem `O`, `0`, `I`, `1`). 10 caracteres, sorteados.
- Nomes de arquivo, coluna e função em português literal.
- Nunca tratar o produto como couro (é **canvas**); nunca público masculino.
- Datas mostradas ao usuário em horário de São Paulo.

---

### Task 1: Banco — porteiro, RLS e as funções do painel

**Files:**
- Create: `db/migrations/2026-08-05-vessel-painel.sql`

**Interfaces produzidas** (a Task 3 depende destes nomes):

- `is_vessel_admin() -> boolean` — mesmo desenho de `is_frota_admin()`.
- `vessel_gerar_lote(p_modelo text, p_cor text, p_sku text, p_quantidade int, p_fabricado_em date, p_fotos text[]) -> json` → `{ok, lote_id, codigos[]}`.
- `vessel_marcar_gravada(p_codigo text) -> json` → `{ok}`.
- `vessel_alertas() -> json` → `{repetidas[], invalidas[], registros_barrados[]}`.
- SELECT direto liberado (via RLS) em `vessel_lotes`, `vessel_pecas`, `vessel_registros`, `vessel_leituras` para quem é `is_vessel_admin()`.

**Decisões que o implementador não deve reabrir:**

- **Os códigos nascem no banco, não no navegador.** A unicidade é do `primary key`; gerar no front obrigaria a checar colisão por ida e volta de rede, e um lote de 200 viraria 200 requisições.
- **A leitura das tabelas vira SELECT normal com RLS**, não mais função. O anônimo continua sem política nenhuma — só o `authenticated` com a chave ganha acesso. Isso mantém o ataque original (baixar a lista de códigos) fechado.
- **`vessel_alertas` é função e não view** porque cruza três perguntas diferentes e devolve tudo numa viagem só.

- [ ] **Step 1: Escrever a migration**

```sql
-- db/migrations/2026-08-05-vessel-painel.sql
-- Fase 2 do Selo Vessel: o painel. A fase 1 (pagina publica) ja esta no ar e
-- NAO muda — vessel_verificar e vessel_registrar seguem intactas.

-- Porteiro, no mesmo desenho de is_frota_admin(): le features[], que e o campo
-- que o RLS enxerga (o permissions{} do front nao chega aqui).
create or replace function public.is_vessel_admin()
returns boolean language sql stable security definer set search_path to 'public'
as $$
  select coalesce(
    (select 'autenticidade' = any(p.features) or p.is_superadmin
       from public.profiles p where p.id = auth.uid()),
    false);
$$;

-- Leitura para quem tem a chave. O anon continua SEM politica nenhuma: e ele
-- quem clonaria tags se pudesse listar codigos.
drop policy if exists vessel_lotes_read     on public.vessel_lotes;
drop policy if exists vessel_pecas_read     on public.vessel_pecas;
drop policy if exists vessel_registros_read on public.vessel_registros;
drop policy if exists vessel_leituras_read  on public.vessel_leituras;

create policy vessel_lotes_read     on public.vessel_lotes     for select to authenticated using (public.is_vessel_admin());
create policy vessel_pecas_read     on public.vessel_pecas     for select to authenticated using (public.is_vessel_admin());
create policy vessel_registros_read on public.vessel_registros for select to authenticated using (public.is_vessel_admin());
create policy vessel_leituras_read  on public.vessel_leituras  for select to authenticated using (public.is_vessel_admin());

-- Gera o lote e os codigos de uma vez. Sorteia do alfabeto sem ambiguidade e
-- repete em caso de colisao (o primary key e quem garante).
create or replace function public.vessel_gerar_lote(
  p_modelo text, p_cor text, p_sku text, p_quantidade int,
  p_fabricado_em date, p_fotos text[]
) returns json language plpgsql security definer set search_path to 'public'
as $$
declare
  ALFABETO constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_lote uuid;
  v_codigo text;
  v_codigos text[] := array[]::text[];
  i int; j int; tentativa int;
begin
  if not public.is_vessel_admin() then
    return json_build_object('ok', false, 'motivo', 'sem_permissao');
  end if;
  if coalesce(trim(p_modelo), '') = '' or coalesce(p_quantidade, 0) < 1 or p_quantidade > 500 then
    return json_build_object('ok', false, 'motivo', 'dados_invalidos');
  end if;

  insert into public.vessel_lotes (modelo, cor, sku, quantidade, fabricado_em, fotos, criado_por)
  values (trim(p_modelo), nullif(trim(coalesce(p_cor, '')), ''), nullif(trim(coalesce(p_sku, '')), ''),
          p_quantidade, coalesce(p_fabricado_em, current_date), p_fotos, auth.uid())
  returning id into v_lote;

  for i in 1..p_quantidade loop
    tentativa := 0;
    loop
      v_codigo := '';
      for j in 1..10 loop
        v_codigo := v_codigo || substr(ALFABETO, 1 + floor(random() * length(ALFABETO))::int, 1);
      end loop;
      begin
        insert into public.vessel_pecas (codigo, lote_id, numero_na_serie)
        values (v_codigo, v_lote, i);
        exit;
      exception when unique_violation then
        tentativa := tentativa + 1;
        if tentativa > 20 then raise exception 'nao consegui sortear codigo livre'; end if;
      end;
    end loop;
    v_codigos := v_codigos || v_codigo;
  end loop;

  return json_build_object('ok', true, 'lote_id', v_lote, 'codigos', v_codigos);
end;
$$;

-- Marca que a tag daquela peca ja foi gravada. E o que impede a equipe de se
-- perder no meio de 20 etiquetas iguais.
create or replace function public.vessel_marcar_gravada(p_codigo text)
returns json language plpgsql security definer set search_path to 'public'
as $$
begin
  if not public.is_vessel_admin() then
    return json_build_object('ok', false, 'motivo', 'sem_permissao');
  end if;
  update public.vessel_pecas set gravada_em = now()
   where codigo = upper(trim(p_codigo)) and gravada_em is null;
  return json_build_object('ok', true);
end;
$$;

-- Tres perguntas de fraude numa viagem so.
create or replace function public.vessel_alertas()
returns json language plpgsql security definer set search_path to 'public'
as $$
declare v json;
begin
  if not public.is_vessel_admin() then
    return json_build_object('ok', false, 'motivo', 'sem_permissao');
  end if;

  select json_build_object(
    'ok', true,
    -- peca lida muitas vezes por muitos aparelhos diferentes: cheiro de tag copiada
    'repetidas', coalesce((
      select json_agg(x) from (
        select l.codigo, count(*) as leituras, count(distinct l.ip_hash) as aparelhos,
               max(l.lido_em) as ultima
          from public.vessel_leituras l
         where l.achou and l.lido_em > now() - interval '30 days'
         group by l.codigo
        having count(distinct l.ip_hash) >= 5
         order by count(distinct l.ip_hash) desc limit 20) x), '[]'::json),
    -- codigo que nao existe: alguem tentando adivinhar
    'invalidas', coalesce((
      select json_agg(x) from (
        select l.codigo, count(*) as tentativas, max(l.lido_em) as ultima
          from public.vessel_leituras l
         where not l.achou and l.lido_em > now() - interval '30 days'
         group by l.codigo order by count(*) desc limit 20) x), '[]'::json),
    -- peca registrada ha pouco e lida por muita gente depois
    'total_leituras', (select count(*) from public.vessel_leituras where lido_em > now() - interval '30 days')
  ) into v;
  return v;
end;
$$;

revoke all on function public.vessel_gerar_lote(text, text, text, int, date, text[]) from public, anon;
revoke all on function public.vessel_marcar_gravada(text) from public, anon;
revoke all on function public.vessel_alertas() from public, anon;
grant execute on function public.vessel_gerar_lote(text, text, text, int, date, text[]) to authenticated;
grant execute on function public.vessel_marcar_gravada(text) to authenticated;
grant execute on function public.vessel_alertas() to authenticated;
```

- [ ] **Step 2: Aplicar e provar**

```bash
cd coletor && node run-acessos-sql.mjs ../db/migrations/2026-08-05-vessel-painel.sql
node consultar.mjs "select public.vessel_gerar_lote('Teste Plano','Cor','SKU-X',3,'2026-08-05',null)"
node consultar.mjs "select codigo, numero_na_serie from vessel_pecas p join vessel_lotes l on l.id=p.lote_id where l.modelo='Teste Plano' order by numero_na_serie"
```

Expected: a chamada direta pelo `psql` roda como dono do banco (sem `auth.uid()`), então `is_vessel_admin()` devolve false e o retorno é `{"ok":false,"motivo":"sem_permissao"}` — **isso é o certo** e prova o porteiro. A prova de que gera de verdade é feita pela tela, logada.

- [ ] **Step 3: Provar que o anônimo continua fora**

```bash
ANON="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtvdW5xdGRvaW9vb3R4cWVna2lqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyMDMwMDUsImV4cCI6MjA5NDc3OTAwNX0.MVXa6jngjKXkH3eZ7as_j_k8Eb7lJKcFmO4kCKAnuHM"
curl -s "https://kounqtdoioootxqegkij.supabase.co/rest/v1/vessel_pecas?select=codigo" -H "apikey: $ANON"
curl -s -X POST "https://kounqtdoioootxqegkij.supabase.co/rest/v1/rpc/vessel_gerar_lote" -H "apikey: $ANON" -H "Content-Type: application/json" -d '{"p_modelo":"X","p_cor":"Y","p_sku":"Z","p_quantidade":1,"p_fabricado_em":"2026-08-05","p_fotos":null}'
```

Expected: o primeiro devolve `[]`; o segundo devolve erro de permissão (`42501`) — nunca um lote criado.

- [ ] **Step 4: Commit**

```bash
git add db/migrations/2026-08-05-vessel-painel.sql
git commit -m "feat(autenticidade): porteiro, RLS e funcoes do painel"
```

---

### Task 2: Permissão, rota e porta de entrada

**Files:**
- Modify: `src/compartilhado/controle-de-login-e-usuario.js` (RECURSOS + PERMISSION_TREE)
- Modify: `src/mapa-de-enderecos.js` (rota `/autenticidade` com `meta.recurso`)
- Modify: `src/ferramentas/gestao-interna/tela-de-menu-gestao-interna.vue` (card)

- [ ] **Step 1: Registrar a chave nos dois lugares**

Em `RECURSOS`, depois de `frota.aprovar`:

```js
  { key: 'autenticidade', label: 'Autenticidade e Garantia', acoes: ['ver', 'criar', 'editar'] },
```

Em `PERMISSION_TREE`, dentro dos filhos de `gestao-interna`:

```js
    { key: 'autenticidade', label: 'Autenticidade e Garantia' },
```

- [ ] **Step 2: Rota**

```js
  { path: '/autenticidade', name: 'autenticidade', component: () => import('./ferramentas/autenticidade/tela-de-autenticidade.vue'), meta: { recurso: 'autenticidade' } },
```

- [ ] **Step 3: Card no menu, seguindo os três que já existem**

`podeAutenticidade = computed(() => hasPermission('autenticidade', 'ver'))`, card com ícone de selo/escudo, título "Autenticidade e Garantia", descrição "As etiquetas NFC das bolsas, as garantias registradas e os sinais de cópia." E incluir `podeAutenticidade` no `onMounted` que devolve pra Central quem não tem nada.

- [ ] **Step 4: Commit**

```bash
git add src/compartilhado/controle-de-login-e-usuario.js src/mapa-de-enderecos.js src/ferramentas/gestao-interna/tela-de-menu-gestao-interna.vue
git commit -m "feat(autenticidade): permissao, rota e card na Gestao Interna"
```

---

### Task 3: As regras puras do módulo + testes

**Files:**
- Create: `src/ferramentas/autenticidade/lotes.js`
- Create: `src/ferramentas/autenticidade/lotes.test.mjs`

**Produces:** `enderecoDaTag(codigo)`, `progressoDoLote(pecas)`, `proximaPorGravar(pecas)`, `linhasDoCsv(registros)`, `resumoDeAlertas(alertas)`.

- [ ] **Step 1: Escrever os testes**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { enderecoDaTag, progressoDoLote, proximaPorGravar, linhasDoCsv, resumoDeAlertas } from './lotes.js';

test('enderecoDaTag: e o endereco que vai gravado na etiqueta', () => {
  assert.equal(enderecoDaTag('K7M4X9QP2R'), 'https://vesselbrasil.com.br/verify/K7M4X9QP2R');
});

test('progressoDoLote: conta so as gravadas', () => {
  const pecas = [{ gravada_em: '2026-08-05T10:00:00Z' }, { gravada_em: null }, { gravada_em: null }];
  assert.deepEqual(progressoDoLote(pecas), { gravadas: 1, total: 3, texto: '1 de 3' });
});

test('proximaPorGravar: a primeira sem gravacao, na ordem da serie', () => {
  const pecas = [
    { codigo: 'B', numero_na_serie: 2, gravada_em: null },
    { codigo: 'A', numero_na_serie: 1, gravada_em: '2026-08-05T10:00:00Z' },
    { codigo: 'C', numero_na_serie: 3, gravada_em: null },
  ];
  assert.equal(proximaPorGravar(pecas).codigo, 'B');
});

test('proximaPorGravar: lote inteiro gravado devolve nulo', () => {
  assert.equal(proximaPorGravar([{ codigo: 'A', numero_na_serie: 1, gravada_em: 'x' }]), null);
});

test('linhasDoCsv: cabecalho + uma linha por registro, com ponto-e-virgula', () => {
  const csv = linhasDoCsv([{ codigo: 'K7M4X9QP2R', nome: 'Ana', whatsapp: '19998887766',
    onde_comprou: 'Loja Tivoli', comprado_em: '2026-08-01', garantia_ate: '2028-08-01' }]);
  assert.equal(csv.split('\n')[0], 'codigo;nome;whatsapp;onde comprou;comprado em;garantia ate');
  assert.match(csv.split('\n')[1], /^K7M4X9QP2R;Ana;19998887766;Loja Tivoli;2026-08-01;2028-08-01$/);
});

test('linhasDoCsv: ponto-e-virgula no texto nao quebra a coluna', () => {
  const csv = linhasDoCsv([{ codigo: 'A', nome: 'Ana; Maria', whatsapp: '1', onde_comprou: '', comprado_em: '', garantia_ate: '' }]);
  assert.match(csv.split('\n')[1], /^A;"Ana; Maria";1;;;$/);
});

test('resumoDeAlertas: sem nada suspeito, diz que esta limpo', () => {
  assert.equal(resumoDeAlertas({ repetidas: [], invalidas: [] }).limpo, true);
});

test('resumoDeAlertas: conta os dois tipos', () => {
  const r = resumoDeAlertas({ repetidas: [{ codigo: 'A' }], invalidas: [{ codigo: 'B' }, { codigo: 'C' }] });
  assert.deepEqual({ limpo: r.limpo, repetidas: r.repetidas, invalidas: r.invalidas },
    { limpo: false, repetidas: 1, invalidas: 2 });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test` — Expected: FAIL, módulo não existe.

- [ ] **Step 3: Escrever `lotes.js`** com as cinco funções acima, sem DOM e sem rede.

- [ ] **Step 4: Rodar e ver passar** — `npm test`.

- [ ] **Step 5: Commit**

```bash
git add src/ferramentas/autenticidade/
git commit -m "feat(autenticidade): regras puras do painel + testes"
```

---

### Task 4: A tela

**Files:**
- Create: `src/ferramentas/autenticidade/tela-de-autenticidade.vue`
- Create: `src/ferramentas/autenticidade/LEIA-ME.txt`

Quatro abas, no padrão de `tela-de-frota.vue` (barra de topo + abas + `sbClient`):

1. **Lotes** — lista (modelo, cor, referência, quantidade, quantas tags já gravadas, data). Botão "Gerar lote" abre formulário: modelo, cor, referência (SKU), quantidade, data de fabricação. Chama `vessel_gerar_lote`.
2. **Gravar tags** — escolhe o lote e mostra **uma peça por vez**: o endereço em letra grande e monoespaçada, botão "Copiar endereço", botão "✓ Gravei essa" (chama `vessel_marcar_gravada` e pula pra próxima), e o progresso "7 de 20". É a tela que impede a equipe de se perder no meio de 20 etiquetas iguais.
3. **Registros** — lista das garantias registradas (peça, nome, WhatsApp, onde comprou, data da compra, garantia até), com busca por nome/código e botão "Baixar planilha" (CSV pelo `linhasDoCsv`).
4. **Alertas** — o que `vessel_alertas` devolve, em português claro: "peça lida por 7 aparelhos diferentes" e "código inexistente tentado 12 vezes". Quando não há nada, a aba diz que está tudo limpo — silêncio não pode parecer erro.

Regras da tela:
- Botão de ação some (`v-if`) para quem só tem `ver` — `hasPermission('autenticidade','criar')` para gerar lote, `'editar'` para marcar gravada.
- Toda data mostrada em horário de São Paulo.
- Nada de `confirm()`/`alert()` nativos — usar o padrão de avisos do repo.

- [ ] **Step 1: Escrever a tela**
- [ ] **Step 2: Escrever o LEIA-ME.txt da pasta**, em português para iniciante.
- [ ] **Step 3: Provar no navegador, logado**: gerar um lote de 3, gravar uma tag, ver o progresso virar "1 de 3", abrir a página pública de um dos códigos gerados e ver o certificado responder.
- [ ] **Step 4: Commit**

---

### Task 5: Conceder a permissão e conferir no ar

- [ ] **Step 1: `npm test` e `npm run build`** — ambos limpos.
- [ ] **Step 2: Push** e esperar o build da Vercel.
- [ ] **Step 3: Conceder a chave ao dono** pela tela de Admin (não por migration — a regra do projeto é que permissão nova nasce desmarcada). Se o próprio dono precisar do acesso para testar, ele concede a si mesmo pelo painel.
- [ ] **Step 4: Conferir no ar** que a Gestão Interna mostra o card para quem tem a chave e **não** mostra para quem não tem.

## O que este plano NÃO faz

- Não sobe fotos pelo painel: as fotos do lote continuam entrando por migration. Subir arquivo pede Storage e um fluxo próprio — vira fase 3 se o dono quiser.
- Não imprime QR: a recomendação de imprimir um QR com o mesmo endereço continua valendo, mas é gráfica, não software.
