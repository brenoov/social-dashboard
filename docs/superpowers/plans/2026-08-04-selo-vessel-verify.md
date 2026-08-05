# Selo Vessel — página `/verify` — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Colocar no ar `vesselbrasil.com.br/verify/<código>` — a página que abre quando a cliente encosta o celular na tag NFC da bolsa, provando que a peça é original e registrando a garantia de 2 anos em nome dela.

**Architecture:** Página estática única em `public/verify/index.html` (mesmo padrão do `public/escritorio-3d`), sem framework e sem carregar o bundle do painel. Ela não lê tabela nenhuma: conversa com duas funções `security definer` no Supabase, chamadas por `fetch` direto no endpoint `/rest/v1/rpc/` com a chave anônima. Roteamento por `vercel.json` no mesmo projeto Vercel que já existe.

**Tech Stack:** HTML/CSS/JS puro (sem dependência nova), Supabase Postgres (`kounqtdoioootxqegkij`), Vercel rewrites, `node --test` para as funções puras.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-04-selo-vessel-verify-design.md`.
- **A garantia é de 2 anos para todo mundo, sem registro.** O registro VALIDA (guarda em nome da cliente), nunca estende. Nenhum texto da página pode prometer tempo extra por registrar.
- O texto do termo é o do certificado impresso, **copiado sem reescrever**.
- Paleta oficial: Espresso Profundo `#29211C` · Verde Oliva `#667355` · Mushroom Beige `#F2EFE6` · Off White Quente `#B7AA9A` · fundo olive noir `#20261C` · variação `#2A3023` · acento champagne `#C3A36A`.
- Tipografia: **Montserrat** (substituta oficial da Versatile, definida em `vessel-creative-tokens.json`).
- Logo só como asset oficial — nunca redesenhar, distorcir ou recompor.
- Nunca tratar o produto como couro (é **canvas**). Nunca público masculino.
- Código da peça: 10 caracteres do alfabeto `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (sem `O`, `0`, `I`, `1`).
- Nomes de arquivo e de coluna em português literal, como o resto do repositório.
- Testes rodam com `npm test` (glob `src/**/*.test.mjs`).

---

### Task 1: Funções puras da página + testes

**Files:**
- Create: `public/verify/regras.js`
- Test: `src/verify-regras.test.mjs`

**Interfaces:**
- Consumes: nada.
- Produces: `normalizarCodigo(texto) -> string`, `pecaDaSerie(numero, total) -> string`, `mesPorExtenso(iso) -> string`, `dataPorExtenso(iso) -> string`, `whatsappLimpo(texto) -> string`, `whatsappValido(texto) -> boolean`. Consumidas pela Task 4.

- [ ] **Step 1: Escrever o teste que falha**

```js
// src/verify-regras.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizarCodigo, pecaDaSerie, mesPorExtenso, dataPorExtenso, whatsappLimpo, whatsappValido } from '../public/verify/regras.js';

test('normalizarCodigo: maiusculas, sem espaco nem hifen', () => {
  assert.equal(normalizarCodigo(' k7m4-x9qp 2r '), 'K7M4X9QP2R');
});

test('normalizarCodigo: nao inventa letra que nao existe no alfabeto', () => {
  // O alfabeto do codigo nao tem O, 0, I nem 1. Se a cliente digitar um desses,
  // a funcao NAO adivinha o que ela quis dizer — so limpa e sobe. A busca nao
  // acha e a pagina mostra "nao conseguimos confirmar", que e o comportamento
  // certo: melhor dizer que nao confirmou do que confirmar a peca errada.
  assert.equal(normalizarCodigo('k7m4x9qp2r'), 'K7M4X9QP2R');
  assert.equal(normalizarCodigo('K7M4 X9QP-2R'), 'K7M4X9QP2R');
});

test('pecaDaSerie: sempre duas casas', () => {
  assert.equal(pecaDaSerie(7, 20), '07 de 20');
  assert.equal(pecaDaSerie(12, 200), '12 de 200');
});

test('mesPorExtenso: mes e ano, em portugues', () => {
  assert.equal(mesPorExtenso('2026-03-09'), 'março de 2026');
});

test('dataPorExtenso: dia, mes e ano', () => {
  assert.equal(dataPorExtenso('2028-08-04'), '4 de agosto de 2028');
});

test('whatsappLimpo: so digitos', () => {
  assert.equal(whatsappLimpo('(19) 99123-4567'), '19991234567');
});

test('whatsappValido: aceita 10 e 11 digitos, recusa o resto', () => {
  assert.equal(whatsappValido('(19) 99123-4567'), true);
  assert.equal(whatsappValido('1991234567'), true);
  assert.equal(whatsappValido('991234567'), false);
  assert.equal(whatsappValido('199912345678'), false);
});
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `npm test`
Expected: FAIL — `Cannot find module '../public/verify/regras.js'`

- [ ] **Step 3: Escrever o módulo**

```js
// public/verify/regras.js
// Regras puras da pagina do certificado. Sem DOM, sem rede — por isso da pra testar.

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

// Tira espaco, hifen e ponto, e sobe pra maiuscula. NAO adivinha caractere:
// se a cliente digitar uma letra que nao existe no alfabeto do codigo, a busca
// nao acha e a pagina mostra "nao conseguimos confirmar" — que e o certo.
export function normalizarCodigo(texto) {
  return String(texto || '').replace(/[\s.\-_]/g, '').toUpperCase();
}

export function pecaDaSerie(numero, total) {
  return `${String(numero).padStart(2, '0')} de ${total}`;
}

export function mesPorExtenso(iso) {
  const [ano, mes] = String(iso).split('-');
  return `${MESES[Number(mes) - 1]} de ${ano}`;
}

export function dataPorExtenso(iso) {
  const [ano, mes, dia] = String(iso).split('-');
  return `${Number(dia)} de ${MESES[Number(mes) - 1]} de ${ano}`;
}

export function whatsappLimpo(texto) {
  return String(texto || '').replace(/\D/g, '');
}

export function whatsappValido(texto) {
  const n = whatsappLimpo(texto).length;
  return n === 10 || n === 11;
}
```

- [ ] **Step 4: Rodar o teste e ver passar**

Run: `npm test`
Expected: PASS — todos os testes de `verify-regras`.

- [ ] **Step 5: Commit**

```bash
git add public/verify/regras.js src/verify-regras.test.mjs
git commit -m "feat(verify): regras puras da pagina do certificado + testes"
```

---

### Task 2: Migration — tabelas, funções fechadas e códigos de teste

**Files:**
- Create: `db/migrations/2026-08-04-vessel-verify.sql`

**Interfaces:**
- Consumes: nada.
- Produces: `vessel_verificar(p_codigo text) -> json` e `vessel_registrar(p_codigo text, p_nome text, p_whatsapp text, p_onde text, p_comprado_em date) -> json`, ambas `security definer` e executáveis por `anon`. Consumidas pela Task 4.

**Formato do retorno de `vessel_verificar`** (a Task 4 depende destes nomes exatos):

```json
{ "ok": true, "modelo": "Altiva", "cor": "Preto Espresso", "numero": 7, "total": 20,
  "fabricado_em": "2026-03-01", "registrada": false, "nome_mascarado": null,
  "registrada_em": null, "garantia_ate": null }
```

Código inexistente devolve `{ "ok": false }` — e nada mais, de propósito.

**Retorno de `vessel_registrar`:** `{ "ok": true, "garantia_ate": "2028-08-04" }`, ou `{ "ok": false, "motivo": "ja_registrada", "registrada_em": "2026-03-12" }`, ou `{ "ok": false, "motivo": "nao_existe" }`.

- [ ] **Step 1: Escrever a migration**

```sql
-- db/migrations/2026-08-04-vessel-verify.sql
-- A pagina publica do certificado (vesselbrasil.com.br/verify/<codigo>).
--
-- POR QUE FUNCAO E NAO TABELA: a pagina e publica e carrega a chave anonima no
-- proprio HTML. Se o anon pudesse dar SELECT em vessel_pecas, qualquer um
-- baixaria a lista inteira de codigos e gravaria mil tags clonadas. Entao as
-- tabelas ficam com RLS ligada e ZERO politica, e todo acesso passa por duas
-- funcoes security definer que devolvem so o necessario.
--
-- A GARANTIA E DE 2 ANOS PARA TODO MUNDO. O registro nao estende nada: ele
-- guarda a garantia em nome da cliente, substituindo o certificado de papel que
-- hoje depende de a loja preencher a mao.

create table if not exists public.vessel_lotes (
  id            uuid primary key default gen_random_uuid(),
  modelo        text not null,
  cor           text,
  sku           text,
  quantidade    int  not null,
  fabricado_em  date not null default current_date,
  criado_por    uuid,
  criado_em     timestamptz not null default now()
);

create table if not exists public.vessel_pecas (
  codigo           text primary key,
  lote_id          uuid references public.vessel_lotes(id) on delete cascade,
  numero_na_serie  int  not null,
  gravada_em       timestamptz,
  criado_em        timestamptz not null default now()
);

comment on column public.vessel_pecas.gravada_em is
  'Quando a tag NFC desta peca foi efetivamente gravada. Nulo = codigo criado mas tag ainda em branco.';

-- O codigo como chave primaria e o que impede DUAS donas para a mesma peca.
-- Regra de negocio no banco, nao na tela.
create table if not exists public.vessel_registros (
  codigo         text primary key references public.vessel_pecas(codigo) on delete cascade,
  nome           text not null,
  whatsapp       text not null,
  onde_comprou   text,
  comprado_em    date,
  garantia_ate   date not null,
  registrado_em  timestamptz not null default now()
);

create table if not exists public.vessel_leituras (
  id        bigserial primary key,
  codigo    text not null,
  achou     boolean not null,
  agente    text,
  ip_hash   text,
  lido_em   timestamptz not null default now()
);

create index if not exists vessel_leituras_codigo_idx on public.vessel_leituras (codigo, lido_em desc);

alter table public.vessel_lotes     enable row level security;
alter table public.vessel_pecas     enable row level security;
alter table public.vessel_registros enable row level security;
alter table public.vessel_leituras  enable row level security;

-- Sem policy nenhuma: nem anon nem authenticated leem direto. O painel da fase 2
-- vai ler por funcoes proprias, gateadas por permissao.

-- Consulta publica. Grava a leitura ACHANDO OU NAO — leitura de codigo que nao
-- existe e justamente o sinal de que alguem esta tentando adivinhar.
create or replace function public.vessel_verificar(p_codigo text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_codigo text := upper(regexp_replace(coalesce(p_codigo, ''), '[\s.\-_]', '', 'g'));
  v_peca   record;
  v_reg    record;
  v_cab    json := nullif(current_setting('request.headers', true), '')::json;
begin
  select p.codigo, p.numero_na_serie, l.modelo, l.cor, l.quantidade, l.fabricado_em
    into v_peca
    from public.vessel_pecas p
    join public.vessel_lotes l on l.id = p.lote_id
   where p.codigo = v_codigo;

  insert into public.vessel_leituras (codigo, achou, agente, ip_hash)
  values (
    left(v_codigo, 32),
    v_peca.codigo is not null,
    left(coalesce(v_cab ->> 'user-agent', ''), 300),
    encode(digest(coalesce(v_cab ->> 'x-forwarded-for', 'sem-ip'), 'sha256'), 'hex')
  );

  if v_peca.codigo is null then
    return json_build_object('ok', false);
  end if;

  select * into v_reg from public.vessel_registros where codigo = v_codigo;

  return json_build_object(
    'ok', true,
    'modelo', v_peca.modelo,
    'cor', v_peca.cor,
    'numero', v_peca.numero_na_serie,
    'total', v_peca.quantidade,
    'fabricado_em', v_peca.fabricado_em,
    'registrada', v_reg.codigo is not null,
    -- so a primeira parte do nome: quem tem a bolsa se reconhece, e quem esta
    -- lendo tag alheia nao colhe nome de cliente.
    'nome_mascarado', case when v_reg.codigo is null then null
                           else split_part(v_reg.nome, ' ', 1) || '***' end,
    'registrada_em', v_reg.registrado_em,
    'garantia_ate', v_reg.garantia_ate
  );
end;
$$;

-- Registro da garantia. Recusa peca inexistente e peca ja registrada.
create or replace function public.vessel_registrar(
  p_codigo text, p_nome text, p_whatsapp text, p_onde text, p_comprado_em date
) returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_codigo text := upper(regexp_replace(coalesce(p_codigo, ''), '[\s.\-_]', '', 'g'));
  v_zap    text := regexp_replace(coalesce(p_whatsapp, ''), '\D', '', 'g');
  v_ate    date;
  v_reg    record;
begin
  if not exists (select 1 from public.vessel_pecas where codigo = v_codigo) then
    return json_build_object('ok', false, 'motivo', 'nao_existe');
  end if;

  select * into v_reg from public.vessel_registros where codigo = v_codigo;
  if v_reg.codigo is not null then
    return json_build_object('ok', false, 'motivo', 'ja_registrada',
                             'registrada_em', v_reg.registrado_em);
  end if;

  if coalesce(trim(p_nome), '') = '' or length(v_zap) not in (10, 11) then
    return json_build_object('ok', false, 'motivo', 'dados_invalidos');
  end if;

  -- 2 anos contados da COMPRA. Sem data da compra, conta de hoje.
  v_ate := coalesce(p_comprado_em, current_date) + interval '2 years';

  insert into public.vessel_registros (codigo, nome, whatsapp, onde_comprou, comprado_em, garantia_ate)
  values (v_codigo, left(trim(p_nome), 120), v_zap, left(coalesce(p_onde, ''), 120), p_comprado_em, v_ate);

  return json_build_object('ok', true, 'garantia_ate', v_ate);
end;
$$;

revoke all on function public.vessel_verificar(text) from public;
revoke all on function public.vessel_registrar(text, text, text, text, date) from public;
grant execute on function public.vessel_verificar(text) to anon, authenticated;
grant execute on function public.vessel_registrar(text, text, text, text, date) to anon, authenticated;

-- LOTE DE DEMONSTRACAO: 5 codigos fixos (escolhidos a mao, nao sorteados) pra
-- gravar numa tag e provar a coisa funcionando no celular antes de existir
-- painel. Modelo real da linha, pra demonstracao nao parecer maquete.
insert into public.vessel_lotes (id, modelo, cor, sku, quantidade, fabricado_em)
values ('00000000-0000-4000-8000-000000000001', 'Altiva', 'Preto Espresso', 'DEMO-ALTIVA', 20, '2026-03-01')
on conflict (id) do nothing;

insert into public.vessel_pecas (codigo, lote_id, numero_na_serie)
values
  ('K7M4X9QP2R', '00000000-0000-4000-8000-000000000001', 7),
  ('T3H8ZC5WVN', '00000000-0000-4000-8000-000000000001', 8),
  ('B6RJ2YKD9F', '00000000-0000-4000-8000-000000000001', 9),
  ('X4NQ7PLM3S', '00000000-0000-4000-8000-000000000001', 10),
  ('G9WD5TBK6H', '00000000-0000-4000-8000-000000000001', 11)
on conflict (codigo) do nothing;
```

- [ ] **Step 2: Conferir se a extensão do hash existe antes de aplicar**

A função usa `digest(...)`, que vem de `pgcrypto`. Rodar no Supabase (MCP `execute_sql`):

```sql
select extname from pg_extension where extname in ('pgcrypto');
```

Expected: uma linha `pgcrypto`. Se voltar vazio, acrescentar `create extension if not exists pgcrypto with schema extensions;` no topo da migration e usar `extensions.digest(...)`.

- [ ] **Step 3: Aplicar a migration**

Aplicar via MCP do Supabase (`apply_migration`, projeto `kounqtdoioootxqegkij`) — confirmado funcionando neste projeto.

- [ ] **Step 4: Provar as duas funções pelo PostgREST, como a página vai chamar**

```bash
ANON="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtvdW5xdGRvaW9vb3R4cWVna2lqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyMDMwMDUsImV4cCI6MjA5NDc3OTAwNX0.MVXa6jngjKXkH3eZ7as_j_k8Eb7lJKcFmO4kCKAnuHM"
BASE="https://kounqtdoioootxqegkij.supabase.co/rest/v1/rpc"

# codigo que existe -> ok:true, registrada:false
curl -s -X POST "$BASE/vessel_verificar" -H "apikey: $ANON" -H "Content-Type: application/json" \
  -d '{"p_codigo":"k7m4-x9qp 2r"}'

# codigo que nao existe -> {"ok":false}
curl -s -X POST "$BASE/vessel_verificar" -H "apikey: $ANON" -H "Content-Type: application/json" \
  -d '{"p_codigo":"NAOEXISTE9"}'

# tentar ler a tabela direto -> tem que vir vazio ou negado, NUNCA a lista
curl -s "https://kounqtdoioootxqegkij.supabase.co/rest/v1/vessel_pecas?select=codigo" -H "apikey: $ANON"
```

Expected: o primeiro devolve `"ok":true` com `"modelo":"Altiva"` e `"numero":7`; o segundo devolve exatamente `{"ok":false}`; o terceiro **não** devolve nenhum código.

- [ ] **Step 5: Provar o registro e a recusa do segundo registro**

```bash
curl -s -X POST "$BASE/vessel_registrar" -H "apikey: $ANON" -H "Content-Type: application/json" \
  -d '{"p_codigo":"G9WD5TBK6H","p_nome":"Maria Teste","p_whatsapp":"(19) 99123-4567","p_onde":"Loja Tivoli","p_comprado_em":"2026-08-04"}'

# de novo, no mesmo codigo
curl -s -X POST "$BASE/vessel_registrar" -H "apikey: $ANON" -H "Content-Type: application/json" \
  -d '{"p_codigo":"G9WD5TBK6H","p_nome":"Outra Pessoa","p_whatsapp":"11999998888","p_onde":"Site","p_comprado_em":"2026-08-04"}'

# e conferir que a consulta agora mascara o nome
curl -s -X POST "$BASE/vessel_verificar" -H "apikey: $ANON" -H "Content-Type: application/json" \
  -d '{"p_codigo":"G9WD5TBK6H"}'
```

Expected: primeiro `{"ok":true,"garantia_ate":"2028-08-04"}`; segundo `{"ok":false,"motivo":"ja_registrada",...}`; terceiro traz `"registrada":true` e `"nome_mascarado":"Maria***"` — **nunca o nome inteiro**.

- [ ] **Step 6: Commit**

```bash
git add db/migrations/2026-08-04-vessel-verify.sql
git commit -m "feat(verify): tabelas e funcoes fechadas do certificado de autenticidade"
```

---

### Task 3: Assets da marca, prontos para web

**Files:**
- Create: `public/verify/marca/logomarca.png`, `public/verify/marca/monograma.png`, `public/verify/marca/pattern.png`

Os originais já estão baixados do WorkDrive em `/private/tmp/claude-501/-Users-erickmartins/1a7cf7f7-f7bf-4abe-8d6b-a25211ef44de/scratchpad/marca/`. A logomarca oficial é 4166×4166 **sem transparência** (preto sobre branco) — sobre o fundo escuro da página ela apareceria dentro de um quadrado branco. Precisa virar off-white com fundo transparente, sem redesenhar nada (regra da marca: só o asset oficial).

**Interfaces:**
- Produces: três arquivos PNG com alfa, referenciados pela Task 4 como `marca/logomarca.png`, `marca/monograma.png`, `marca/pattern.png`.

- [ ] **Step 1: Converter, recortar e otimizar**

```bash
cd /private/tmp/claude-501/-Users-erickmartins/1a7cf7f7-f7bf-4abe-8d6b-a25211ef44de/scratchpad && ./venv/bin/pip install -q pillow && ./venv/bin/python - <<'PY'
from PIL import Image
DEST = '/Users/erickmartins/iamundi/public/verify/marca/'
import os; os.makedirs(DEST, exist_ok=True)

# logomarca: preto sobre branco -> off-white sobre transparente
im = Image.open('marca/logomarca.png').convert('L')
alfa = im.point(lambda v: 255 - v)              # tinta preta vira opacidade
cx = alfa.getbbox()                              # recorta a moldura branca
alfa = alfa.crop(cx)
logo = Image.new('RGBA', alfa.size, (242, 239, 230, 255))  # Mushroom Beige
logo.putalpha(alfa)
logo.thumbnail((1200, 1200), Image.LANCZOS)
logo.save(DEST + 'logomarca.png', optimize=True)

for origem, destino, largura in [('marca/monograma.png', 'monograma.png', 320),
                                 ('marca/pattern-oficial.png', 'pattern.png', 900)]:
    a = Image.open(origem).convert('RGBA')
    a.thumbnail((largura, largura), Image.LANCZOS)
    a.save(DEST + destino, optimize=True)

for f in ('logomarca.png', 'monograma.png', 'pattern.png'):
    print(f, os.path.getsize(DEST + f), 'bytes')
PY
```

Expected: os três arquivos impressos, cada um **abaixo de 120 KB**. Se `logomarca.png` passar disso, baixar o `thumbnail` para 900 px e rodar de novo.

- [ ] **Step 2: Conferir a olho que o recorte não comeu parte da marca**

Abrir `public/verify/marca/logomarca.png` e confirmar: lê-se `VESSEL` com `BRASIL` embaixo, em off-white, sem moldura branca e sem letra cortada.

- [ ] **Step 3: Commit**

```bash
git add public/verify/marca/
git commit -m "feat(verify): assets oficiais da marca prontos para o fundo escuro"
```

---

### Task 4: A página do certificado

**Files:**
- Create: `public/verify/index.html`
- Create: `public/verify/LEIA-ME.txt`

**Interfaces:**
- Consumes: `./regras.js` (Task 1), as RPCs `vessel_verificar` / `vessel_registrar` (Task 2), os PNGs (Task 3).
- Produces: a página em si.

**Estrutura obrigatória do arquivo:**

1. `<head>` com `<meta name="viewport" content="width=device-width, initial-scale=1">`, `<meta name="robots" content="noindex">` (certificado de peça não é conteúdo pra Google), `<title>Certificado de Autenticidade · VESSEL BRASIL</title>` e Montserrat do Google Fonts com `display=swap` e `preconnect`.
2. Variáveis CSS com as cores da Global Constraints — nada de cor solta no meio do arquivo.
3. Quatro estados, um `<section>` cada, alternados por uma classe no `<body>`: `carregando`, `autentica`, `invalida`. O "já registrada" é a variação de `autentica` que esconde o botão de registro e mostra a faixa.
4. O código sai de `location.pathname` (`/verify/K7M4X9QP2R`), passa por `normalizarCodigo` e vai pra RPC.
5. O pop-up de registro é `<dialog>` nativo — sem biblioteca.
6. Todo o texto do termo vem do certificado impresso, sem reescrita (ver spec).
7. Rodapé com `lavessel.com.br`, `@vessel.brasil` e o endereço da fábrica: R. Adelino Gasparine, 165 — Jardim Verona, Itatiba/SP.

**Chamada das RPCs (usar exatamente este formato):**

```js
const SUPABASE = 'https://kounqtdoioootxqegkij.supabase.co';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtvdW5xdGRvaW9vb3R4cWVna2lqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyMDMwMDUsImV4cCI6MjA5NDc3OTAwNX0.MVXa6jngjKXkH3eZ7as_j_k8Eb7lJKcFmO4kCKAnuHM';

async function rpc(nome, corpo) {
  const r = await fetch(`${SUPABASE}/rest/v1/rpc/${nome}`, {
    method: 'POST',
    headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo),
  });
  if (!r.ok) throw new Error('rpc ' + nome + ' -> ' + r.status);
  return r.json();
}
```

**Textos que a página exibe (copiar literalmente):**

- Selo: **"Peça autêntica"** · abaixo: *"Você acaba de adquirir um produto original La vessel®."*
- Chamada do registro: **"Registre sua garantia de 2 anos no seu nome."**
- Apoio do registro: *"A garantia de 2 anos é sua de qualquer jeito. Registrando, ela fica guardada com a gente, no seu nome — sem depender do papel preenchido pela loja."*
- Depois de registrar: **"Garantia registrada até {dataPorExtenso(garantia_ate)}"**
- Já registrada por outra pessoa: *"Esta peça foi registrada em {dataPorExtenso(registrada_em)} por {nome_mascarado}."*
- Estado inválido: **"Não conseguimos confirmar esta peça"** + botão "Falar com a Vessel" apontando pro WhatsApp comercial.

- [ ] **Step 1: Escrever a página**

Seguir a estrutura acima. O arquivo inteiro (fora os PNGs) deve ficar **abaixo de 40 KB** — é o que garante o "selo em 1 segundo no 4G da loja" que a spec exige.

- [ ] **Step 2: Escrever o LEIA-ME da pasta**

`public/verify/LEIA-ME.txt`, em português para iniciante, dizendo: o que é a pasta, que o endereço real é `vesselbrasil.com.br/verify/<código>`, que os códigos de teste estão na migration `db/migrations/2026-08-04-vessel-verify.sql`, e que a garantia é de 2 anos para todo mundo (o registro só valida).

- [ ] **Step 3: Ver os três estados rodando de verdade**

```bash
npm run dev -- --port 5199 --strictPort
```

Abrir no navegador e conferir um por um:
- `http://localhost:5199/verify/K7M4X9QP2R` → selo, modelo Altiva, "07 de 20", pop-up de registro
- `http://localhost:5199/verify/G9WD5TBK6H` → faixa "registrada por Maria***", sem pop-up
- `http://localhost:5199/verify/NAOEXISTE9` → tela de não confirmado

Conferir também em largura de celular (390 px): nada estourando a tela, nenhum texto cortado.

- [ ] **Step 4: Commit**

```bash
git add public/verify/index.html public/verify/LEIA-ME.txt
git commit -m "feat(verify): pagina do certificado de autenticidade e garantia"
```

---

### Task 5: Roteamento e domínio

**Files:**
- Modify: `vercel.json`

**Interfaces:**
- Consumes: a página da Task 4.
- Produces: `/verify/<codigo>` servindo `public/verify/index.html` em vez do painel.

- [ ] **Step 1: Ajustar o `vercel.json`**

A ordem importa — o rewrite do `/verify` tem que vir **antes** do catch-all do painel, e o catch-all precisa passar a excluir `verify`:

```json
{
  "redirects": [
    { "source": "/", "has": [{ "type": "host", "value": "vesselbrasil.com.br" }],
      "destination": "https://lavessel.com.br", "permanent": false }
  ],
  "rewrites": [
    { "source": "/verify/:codigo", "destination": "/verify/index.html" },
    { "source": "/((?!escritorio-3d|verify).*)", "destination": "/index.html" }
  ]
}
```

O bloco `headers` que já existe fica intacto. O redirect é **temporário** (`permanent: false`) de propósito: o dono ainda vai decidir o que fica na raiz.

- [ ] **Step 2: Conferir que o painel não quebrou**

```bash
npm run build && npm run preview -- --port 5198 --strictPort
```

Abrir `http://localhost:5198/` e confirmar que o painel carrega normal, e `http://localhost:5198/verify/K7M4X9QP2R` que a página do certificado aparece. (O `preview` do Vite não aplica `vercel.json`; a checagem aqui é só de que o build não quebrou e os arquivos foram parar em `dist/verify/`.)

```bash
ls dist/verify/
```

Expected: `index.html`, `regras.js` e a pasta `marca/`.

- [ ] **Step 3: Commit e subir**

```bash
git add vercel.json
git commit -m "feat(verify): rota /verify e redirect da raiz do vesselbrasil"
git push origin main
```

- [ ] **Step 4: Passos que só o dono pode fazer (documentar, não tentar)**

A CLI da Vercel desta máquina está logada em `erickjcbp-1650`, não em `brenoov` — então **não** tentar `vercel domains add`. Entregar ao dono:

1. No painel da Vercel, projeto `social-dashboard` → Settings → Domains → adicionar `vesselbrasil.com.br`.
2. No Registro.br, apontar o domínio para a Vercel com os registros que a própria Vercel mostrar na tela.
3. Avisar quando propagar, para a conferência final.

---

### Task 6: Conferir no ar

**Files:** nenhum.

- [ ] **Step 1: Conferir pelo domínio do painel (funciona antes do DNS propagar)**

```bash
curl -s https://socialdashboard.rbvcompany.com/verify/K7M4X9QP2R | head -40
```

Expected: HTML da página do certificado (contém `Peça autêntica`), **não** o `index.html` do painel.

- [ ] **Step 2: Depois do DNS, conferir pelo domínio real**

```bash
curl -sI https://vesselbrasil.com.br/ | head -5                    # 307/308 -> lavessel.com.br
curl -s  https://vesselbrasil.com.br/verify/K7M4X9QP2R | grep -c "Peça autêntica"
```

Expected: a raiz redireciona; a página do certificado responde com o selo.

- [ ] **Step 3: Testar na tag de verdade**

Gravar `https://vesselbrasil.com.br/verify/T3H8ZC5WVN` numa tag NFC pelo app do celular, encostar o telefone e confirmar que abre no selo e que o registro funciona até o fim.

---

## Fora deste plano

O painel de administração (gerar lote, tela de gravação das tags, lista de registros, alertas de clonagem) é fase 2, descrita no fim da spec, e só começa se o projeto for aprovado. Sem ele, os códigos só nascem por migration — o que basta para demonstrar, e não basta para produzir.
