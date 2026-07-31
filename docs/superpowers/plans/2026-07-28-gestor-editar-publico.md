# Editar o público de um conjunto (C1) — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar ao Gestor de Tráfego um botão "👥 Público" em cada conjunto de anúncios, que mostra e permite editar localização, idade, gênero, interesses, públicos personalizados e a chave do Advantage+.

**Architecture:** Módulo puro `publico-alvo.js` que traduz o `targeting` da Meta nos dois sentidos. A regra que sustenta tudo: ao escrever de volta, **partir do objeto original e sobrescrever só as chaves gerenciadas** — o `targeting` carrega dados que este editor não gerencia (onde o anúncio aparece, aparelhos, idiomas) e montá-lo do zero os apagaria em silêncio. A tela desenha o editor no estilo imperativo do arquivo.

**Tech Stack:** JavaScript ES modules (sem TypeScript), Vue 3 (a tela monta DOM imperativo, não template), `node:test` + `node:assert/strict`, Meta Graph API via a Edge Function `meta-proxy`.

**Spec:** `docs/superpowers/specs/2026-07-28-gestor-editar-publico-design.md`

## Global Constraints

Valem para TODAS as tarefas.

- **`montarTargeting` NUNCA monta o objeto do zero.** Parte do `targeting` original e sobrescreve apenas as chaves gerenciadas. Chave desconhecida passa intacta. Violar isso apaga em silêncio onde o anúncio aparece.
- **Chaves gerenciadas, e só elas:** `geo_locations`, `excluded_geo_locations`, `age_min`, `age_max`, `genders`, `flexible_spec` (só a parte de interesses — ver Task 2), `custom_audiences`, `excluded_custom_audiences`, `targeting_automation`.
- **Exclusão de público é `excluded_custom_audiences`.** Pôr público dentro de `exclusions` está descontinuado na Meta.
- **Advantage+ e restrições manuais não convivem.** A Meta rejeita a combinação (código 1870227, validado ao vivo em 2026-07-12 e registrado em `coletor/lib/publico.mjs`). A tela exige a escolha; não deixa salvar e tomar o erro.
- **Não modificar `_gtConfirm`** — portão sim/não compartilhado por todas as ações da tela, marcado no código como preservado verbatim.
- **Permissão:** o botão só é desenhado se `hasPermission('meta.gestor','editar')`.
- **Texto de tela em português literal, sem jargão.** Quem lê é o dono do negócio. "conjunto de anúncios", nunca "adset"; "público personalizado", nunca "custom audience".
- Texto vindo da Meta (nome de cidade, interesse, público, erro) passa por `_gtEsc` antes de ir para `innerHTML`.
- **Testes** em `<nome>.test.mjs` ao lado do módulo, com `import { test } from 'node:test'` e `import assert from 'node:assert/strict'`, no estilo de `duplicar.test.mjs`. Nenhum teste toca conta real.
- Rodar `npm test` (e `npm run build` nas tarefas de tela) antes de cada commit.
- Commit em português, escopo `(gestor)`, terminando com `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`, feito com `git -c user.name="brenoov" -c user.email="breno@rbvcompany.com" commit ...` — email vazio trava o deploy do Vercel.
- **Nunca salvar de verdade num conjunto real** durante o desenvolvimento. Não rodar `npm run dev` nas tarefas do motor.
- **Toda função de módulo usada no `.vue` precisa estar importada** — há um teste que varre isso (`imports.test.mjs`). Ver a seção "Três testes novos" abaixo antes de escrever no `.vue`.
- **Dependência nova numa função que tem teste de isolamento entra na lista de dublês do teste** — nunca afrouxe o teste para caber. Idem seção abaixo.

## Formas de `targeting` já validadas ao vivo neste projeto

De `coletor/lib/publico.mjs` (provado numa conta real em 2026-07-12):

```js
geo_locations:          { cities: [{ key, radius, distance_unit }] }
excluded_geo_locations: { cities: [{ key }], regions: [{ key }] }
age_min, age_max:       número
genders:                [1] masculino, [2] feminino, [] todos
flexible_spec:          [{ interests: [{ id, name }] }]
custom_audiences:       [{ id }]
targeting_automation:   { advantage_audience: 0 }   // 0 = desligado
```

Confirmado na documentação: exclusão de público personalizado é
`excluded_custom_audiences: [{ id }]`; usar `exclusions` para isso está
descontinuado.

**Raio mínimo:** a Meta recusa raio de cidade abaixo de ~17 km / 10 milhas
(código 1487110). `publico.mjs` já faz esse ajuste; aqui ele é **relatado**.

**Não verificado:** se algum campo de targeting é imutável após a criação do
conjunto. Tratar recusa da Meta como caminho normal, com mensagem clara.

## ESTADO DO ARQUIVO — reancorado em 2026-07-29

**Este plano foi escrito em 28/07 e reancorado em 29/07.** Entre uma data e
outra a outra frente de trabalho mandou 28 PRs (#45–#72) e o
`tela-de-gestao-trafego.vue` foi de 2.366 para **3.458 linhas**. Todos os
números de linha abaixo foram conferidos no arquivo atual — mas **confira de
novo antes de inserir**: se a outra frente mandar mais PRs, eles andam outra vez.
O jeito seguro é procurar pelo NOME (`grep -n "function _gtDupTraduzir"`), não
pelo número.

| Âncora | Linha hoje |
|---|---|
| `import ... from './duplicar.js'` | 130 |
| `import { sbClient, ... }` | 121 |
| `metaFetchAll` | 242 |
| `campFields` (já traz `objective`) | 1357 |
| `setFields` | 1364 |
| `function _gtBotaoDuplicar` | 1653 |
| `function _renderGtConjuntos` | 2284 |
| `function _renderGtAds` | 2364 |
| `function _gtConfirm` | 2464 |
| `function _gtDupTraduzir` | 2709 |

**Mudanças que afetam este plano:**

- `_renderGtConjuntos` e `_renderGtAds` ganharam um parâmetro a mais
  (`temMensagemCampanha`). Ao inserir, **não mexa nas assinaturas**.
- `sbClient` está importado na linha 121 e já é usado para ler e gravar tabela
  em vários pontos (582, 683, 945, 1170). A Task 5 pode usá-lo com segurança —
  a dúvida que este plano deixara em aberto está resolvida.
- O mapa objetivo→balde saiu do `.vue` e virou módulo próprio (`baldes.js`).
- **Baseline de testes agora é 514/514**, não 327. Os números esperados nas
  tarefas abaixo já estão corrigidos.

## Três testes novos que impõem regra ao seu código

A outra frente escreveu isto depois de a tela quebrar em produção duas vezes
no mesmo dia. **Leia antes de escrever qualquer coisa no `.vue`:**

1. **`imports.test.mjs`** — varre a tela e exige que **toda função de módulo
   usada esteja importada**. Nasceu de `card is not defined` e
   `baldeEfetivo is not defined`, que passaram no `npm run build` e só
   quebraram na cara do dono: o Vite não resolve identificador livre. Se você
   usar `lerPublico` sem importar, este teste pega.
2. **`render-anuncios.test.mjs`** — executa `_renderGtAds` de verdade, isolada,
   com uma lista de dublês. **Qualquer dependência nova que você acrescentar a
   essa função precisa entrar na lista de dublês do teste.** Foi assim que o
   botão de duplicar quebrou o teste na junção de 29/07: a correção é
   acrescentar o dublê (`_gtBotaoDuplicar: () => null`), **nunca** afrouxar o
   teste. Hoje `_renderGtConjuntos` não tem teste equivalente — se ganhar um,
   vale a mesma regra.
3. **`tela-boot.test.mjs`** — protege a ORDEM de boot (a fila carregava antes
   das contas existirem e anunciava "nada esperando" com nove itens na fila).
   Este plano não mexe no boot, mas não mova chamadas de inicialização.

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `src/ferramentas/gestao-trafego/publico-alvo.js` (criar) | Motor puro: traduz o público nos dois sentidos, resume mudanças, gera avisos. Sem DOM, sem rede. |
| `src/ferramentas/gestao-trafego/publico-alvo.test.mjs` (criar) | Testes do motor. |
| `src/ferramentas/gestao-trafego/tela-de-gestao-trafego.vue` (modificar) | Editor, botão e ligação com a Meta. |
| `src/ferramentas/gestao-trafego/LEIA-ME.txt` (modificar) | Documentar para o dono. |

---

### Task 1: `lerPublico` — traduzir o público da Meta para uma forma simples

**Files:**
- Create: `src/ferramentas/gestao-trafego/publico-alvo.js`
- Test: `src/ferramentas/gestao-trafego/publico-alvo.test.mjs`

**Interfaces:**
- Produces: `lerPublico(targeting) -> Publico`
  - `Publico`: `{ cidades: [{key,nome,raio,unidade}], excluidas: [{key,nome,tipo}], idadeMin: number, idadeMax: number, generos: number[], interesses: [{id,name}], incluir: [{id,name}], excluir: [{id,name}], advantagePlus: boolean }`

- [ ] **Step 1: Escrever os testes que falham**

Criar `src/ferramentas/gestao-trafego/publico-alvo.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lerPublico, PUBLICO_VAZIO } from './publico-alvo.js';

// Forma real devolvida pela Meta (campos conferidos em coletor/lib/publico.mjs).
const ALVO_META = {
  geo_locations: { cities: [{ key: '1058', name: 'Campinas', radius: 25, distance_unit: 'kilometer' }] },
  excluded_geo_locations: { cities: [{ key: '2777', name: 'Americana' }], regions: [{ key: '456', name: 'Litoral' }] },
  age_min: 25,
  age_max: 45,
  genders: [2],
  flexible_spec: [{ interests: [{ id: '6003', name: 'Moda' }] }],
  custom_audiences: [{ id: 'aud1', name: 'Visitantes do site' }],
  excluded_custom_audiences: [{ id: 'aud2', name: 'Já compraram' }],
  targeting_automation: { advantage_audience: 0 },
  // NÃO gerenciados por este editor — presentes de propósito:
  publisher_platforms: ['facebook', 'instagram'],
  instagram_positions: ['stream', 'story'],
};

test('le todos os campos que o editor gerencia', () => {
  const p = lerPublico(ALVO_META);
  assert.deepEqual(p.cidades, [{ key: '1058', nome: 'Campinas', raio: 25, unidade: 'kilometer' }]);
  assert.equal(p.idadeMin, 25);
  assert.equal(p.idadeMax, 45);
  assert.deepEqual(p.generos, [2]);
  assert.deepEqual(p.interesses, [{ id: '6003', name: 'Moda' }]);
  assert.deepEqual(p.incluir, [{ id: 'aud1', name: 'Visitantes do site' }]);
  assert.deepEqual(p.excluir, [{ id: 'aud2', name: 'Já compraram' }]);
});

test('cidade e regiao excluidas vem separadas por tipo', () => {
  const p = lerPublico(ALVO_META);
  assert.deepEqual(p.excluidas, [
    { key: '2777', nome: 'Americana', tipo: 'cidade' },
    { key: '456', nome: 'Litoral', tipo: 'regiao' },
  ]);
});

test('advantage_audience 0 e desligado; 1 e ausente sao ligado', () => {
  assert.equal(lerPublico({ targeting_automation: { advantage_audience: 0 } }).advantagePlus, false);
  assert.equal(lerPublico({ targeting_automation: { advantage_audience: 1 } }).advantagePlus, true);
  // Ausente = padrão da Meta, que é LIGADO. Assumir desligado faria a tela
  // mentir sobre o estado atual da conta do dono.
  assert.equal(lerPublico({}).advantagePlus, true);
});

test('interesses saem de qualquer entrada do flexible_spec, nao so da primeira', () => {
  const p = lerPublico({ flexible_spec: [
    { behaviors: [{ id: 'b1', name: 'Viajantes' }] },
    { interests: [{ id: '1', name: 'Bolsas' }, { id: '2', name: 'Moda' }] },
  ] });
  assert.deepEqual(p.interesses, [{ id: '1', name: 'Bolsas' }, { id: '2', name: 'Moda' }]);
});

test('publico ausente, vazio ou malformado nao quebra', () => {
  for (const entrada of [null, undefined, {}, { geo_locations: null }, { flexible_spec: 'lixo' }]) {
    const p = lerPublico(entrada);
    assert.deepEqual(p.cidades, []);
    assert.deepEqual(p.interesses, []);
    assert.equal(typeof p.idadeMin, 'number');
  }
});

test('PUBLICO_VAZIO tem a forma completa, sem campo faltando', () => {
  for (const chave of ['cidades','excluidas','idadeMin','idadeMax','generos','interesses','incluir','excluir','advantagePlus'])
    assert.ok(chave in PUBLICO_VAZIO, 'faltou ' + chave);
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test 2>&1 | grep -E "publico-alvo|^ℹ (tests|pass|fail)"`
Expected: FAIL — `Cannot find module './publico-alvo.js'`

- [ ] **Step 3: Escrever a implementação**

Criar `src/ferramentas/gestao-trafego/publico-alvo.js`:

```js
// Editar o público de um conjunto de anúncios da Meta.
//
// MÓDULO PURO: sem tela, sem rede. Traduz o `targeting` da Meta nos dois
// sentidos, resume o que mudou e gera os avisos.
//
// O PERIGO QUE MOLDA ESTE ARQUIVO: o `targeting` é UM PACOTE SÓ. Além do que
// este editor mexe, ele carrega onde o anúncio aparece (feed, story, reels),
// em que aparelhos e em que idiomas. Montar esse pacote só com os campos
// editados e mandar de volta APAGARIA todo o resto, em silêncio — o dono
// trocaria uma cidade e o conjunto pararia de rodar no Instagram Stories sem
// nada avisar. Por isso montarTargeting (Task 2) parte do original.

export const PUBLICO_VAZIO = {
  cidades: [], excluidas: [],
  idadeMin: 18, idadeMax: 65,
  generos: [], interesses: [],
  incluir: [], excluir: [],
  advantagePlus: true,
};

const lista = (v) => (Array.isArray(v) ? v : []);
const nomeDe = (o) => (o && (o.name || o.nome)) || '';

// Interesses podem estar em QUALQUER entrada do flexible_spec — a Meta usa
// esse array para combinar grupos (interesses, comportamentos, eventos de
// vida). Ler só a primeira entrada perderia interesses de verdade.
function interessesDe(targeting) {
  const flex = lista(targeting && targeting.flexible_spec);
  const achados = [];
  for (const grupo of flex) {
    for (const i of lista(grupo && grupo.interests)) {
      if (i && i.id != null) achados.push({ id: String(i.id), name: nomeDe(i) });
    }
  }
  return achados;
}

function excluidasDe(targeting) {
  const ex = (targeting && targeting.excluded_geo_locations) || {};
  const fora = [];
  for (const c of lista(ex.cities)) fora.push({ key: String(c.key), nome: nomeDe(c), tipo: 'cidade' });
  for (const r of lista(ex.regions)) fora.push({ key: String(r.key), nome: nomeDe(r), tipo: 'regiao' });
  return fora;
}

// Traduz o público como a Meta devolve para uma forma simples de trabalhar.
// Nunca lança: público ausente ou malformado devolve a forma padrão, porque
// travar a tela por causa de um campo estranho seria pior que mostrar vazio.
export function lerPublico(targeting) {
  const t = targeting && typeof targeting === 'object' ? targeting : {};
  const geo = t.geo_locations || {};
  const auto = t.targeting_automation || {};
  return {
    cidades: lista(geo.cities).map((c) => ({
      key: String(c.key),
      nome: nomeDe(c),
      raio: c.radius == null ? 0 : Number(c.radius),
      unidade: c.distance_unit || 'kilometer',
    })),
    excluidas: excluidasDe(t),
    idadeMin: t.age_min == null ? PUBLICO_VAZIO.idadeMin : Number(t.age_min),
    idadeMax: t.age_max == null ? PUBLICO_VAZIO.idadeMax : Number(t.age_max),
    generos: lista(t.genders).map(Number),
    interesses: interessesDe(t),
    incluir: lista(t.custom_audiences).map((a) => ({ id: String(a.id), name: nomeDe(a) })),
    excluir: lista(t.excluded_custom_audiences).map((a) => ({ id: String(a.id), name: nomeDe(a) })),
    // Ausente = padrão da Meta = LIGADO. Assumir desligado faria a tela mentir
    // sobre o estado atual da conta do dono.
    advantagePlus: auto.advantage_audience == null ? true : Number(auto.advantage_audience) === 1,
  };
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm test 2>&1 | grep -E "^ℹ (tests|pass|fail)"`
Expected: PASS — `fail 0`, `npm run test:ci` sobe de 514 para 520 (6 testes novos).

- [ ] **Step 5: Commitar**

```bash
git add src/ferramentas/gestao-trafego/publico-alvo.js src/ferramentas/gestao-trafego/publico-alvo.test.mjs
git commit -m "feat(gestor): ler o público de um conjunto da Meta

Módulo puro que traduz o targeting numa forma simples de trabalhar.

Advantage+ ausente é lido como LIGADO, que é o padrão da Meta — assumir
desligado faria a tela mentir sobre o estado da conta do dono.

Interesses saem de qualquer entrada do flexible_spec: a Meta usa esse array
para combinar grupos, e ler só a primeira perderia interesses de verdade.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: `montarTargeting` — escrever de volta sem apagar o que não é seu

**Esta é a tarefa mais perigosa do plano.** Um erro aqui muda em silêncio onde os anúncios do dono aparecem.

**Files:**
- Modify: `src/ferramentas/gestao-trafego/publico-alvo.js`
- Test: `src/ferramentas/gestao-trafego/publico-alvo.test.mjs`

**Interfaces:**
- Consumes: `lerPublico`, `PUBLICO_VAZIO` (Task 1).
- Produces:
  - `RAIO_MINIMO_KM = 17`, `RAIO_MINIMO_MI = 10`
  - `montarTargeting(publico, original) -> { targeting, ajustes: [{cidade, de, para, unidade}] }`

- [ ] **Step 1: Escrever os testes que falham**

Acrescentar a `publico-alvo.test.mjs` (juntar os nomes novos no import existente):

```js
test('CAMPO DESCONHECIDO SOBREVIVE A IDA E VOLTA — o teste que segura tudo', () => {
  const original = {
    ...ALVO_META,
    device_platforms: ['mobile'],
    locales: [6],
    algo_que_a_meta_inventar_amanha: { seja_o_que_for: true },
  };
  const { targeting } = montarTargeting(lerPublico(original), original);
  assert.deepEqual(targeting.publisher_platforms, ['facebook', 'instagram'],
    'onde o anúncio aparece NÃO pode sumir por editar público');
  assert.deepEqual(targeting.instagram_positions, ['stream', 'story']);
  assert.deepEqual(targeting.device_platforms, ['mobile']);
  assert.deepEqual(targeting.locales, [6]);
  assert.deepEqual(targeting.algo_que_a_meta_inventar_amanha, { seja_o_que_for: true });
});

test('ida e volta sem mexer em nada devolve o mesmo publico', () => {
  const { targeting } = montarTargeting(lerPublico(ALVO_META), ALVO_META);
  assert.deepEqual(lerPublico(targeting), lerPublico(ALVO_META));
});

test('so as chaves gerenciadas mudam', () => {
  const p = lerPublico(ALVO_META);
  p.idadeMin = 30;
  const { targeting } = montarTargeting(p, ALVO_META);
  assert.equal(targeting.age_min, 30);
  for (const k of ['publisher_platforms', 'instagram_positions'])
    assert.deepEqual(targeting[k], ALVO_META[k], k + ' não devia mudar');
});

test('comportamentos no flexible_spec sobrevivem a troca de interesses', () => {
  const original = { flexible_spec: [
    { behaviors: [{ id: 'b1', name: 'Viajantes' }] },
    { interests: [{ id: '1', name: 'Bolsas' }] },
  ] };
  const p = lerPublico(original);
  p.interesses = [{ id: '9', name: 'Sapatos' }];
  const { targeting } = montarTargeting(p, original);
  assert.ok(targeting.flexible_spec.some(g => g.behaviors),
    'comportamento é do mesmo pacote e não pode ser apagado por editar interesse');
  const ints = targeting.flexible_spec.flatMap(g => g.interests || []);
  assert.deepEqual(ints, [{ id: '9', name: 'Sapatos' }]);
});

test('esvaziar um campo REMOVE a chave em vez de mandar lista vazia', () => {
  const p = lerPublico(ALVO_META);
  p.interesses = []; p.incluir = []; p.excluir = []; p.excluidas = []; p.generos = [];
  const { targeting } = montarTargeting(p, ALVO_META);
  for (const k of ['flexible_spec','custom_audiences','excluded_custom_audiences','excluded_geo_locations','genders'])
    assert.ok(!(k in targeting), k + ' vazio deve sair do pacote, não ir como []');
});

test('advantage+ liga e desliga nos dois sentidos', () => {
  const p = lerPublico(ALVO_META);
  p.advantagePlus = true;
  assert.equal(montarTargeting(p, ALVO_META).targeting.targeting_automation.advantage_audience, 1);
  p.advantagePlus = false;
  assert.equal(montarTargeting(p, ALVO_META).targeting.targeting_automation.advantage_audience, 0);
});

test('raio abaixo do minimo e ajustado E RELATADO, nunca em silencio', () => {
  const p = lerPublico(ALVO_META);
  p.cidades = [{ key: '1058', nome: 'Campinas', raio: 5, unidade: 'kilometer' }];
  const { targeting, ajustes } = montarTargeting(p, ALVO_META);
  assert.equal(targeting.geo_locations.cities[0].radius, 17);
  assert.deepEqual(ajustes, [{ cidade: 'Campinas', de: 5, para: 17, unidade: 'kilometer' }]);
});

test('raio em milhas usa o minimo em milhas', () => {
  const p = lerPublico(ALVO_META);
  p.cidades = [{ key: '1058', nome: 'Campinas', raio: 3, unidade: 'mile' }];
  const { targeting, ajustes } = montarTargeting(p, ALVO_META);
  assert.equal(targeting.geo_locations.cities[0].radius, 10);
  assert.equal(ajustes.length, 1);
});

test('raio zero significa a cidade inteira e NAO e ajustado', () => {
  const p = lerPublico(ALVO_META);
  p.cidades = [{ key: '1058', nome: 'Campinas', raio: 0, unidade: 'kilometer' }];
  const { targeting, ajustes } = montarTargeting(p, ALVO_META);
  assert.ok(!('radius' in targeting.geo_locations.cities[0]), 'raio 0 = cidade inteira');
  assert.deepEqual(ajustes, []);
});

test('incluir e excluir publico nao se misturam', () => {
  const p = lerPublico(ALVO_META);
  const { targeting } = montarTargeting(p, ALVO_META);
  assert.deepEqual(targeting.custom_audiences, [{ id: 'aud1' }]);
  assert.deepEqual(targeting.excluded_custom_audiences, [{ id: 'aud2' }]);
  assert.ok(!('exclusions' in targeting), 'público em exclusions está descontinuado na Meta');
});

test('sem original (conjunto sem targeting) monta do zero sem quebrar', () => {
  const { targeting } = montarTargeting(PUBLICO_VAZIO, null);
  assert.equal(typeof targeting, 'object');
});

test('publico SEM cidade nenhuma nao restaura as antigas em silencio', () => {
  const p = lerPublico(ALVO_META);
  p.cidades = [];
  const { targeting } = montarTargeting(p, ALVO_META);
  // A Meta exige localização (conjunto não mira em lugar nenhum), mas
  // ressuscitar as cidades antigas caladamente faria a tela mentir: o dono
  // apagou tudo e veria o de antes voltar. Quem barra é o aviso bloqueante
  // da Task 4; aqui a chave simplesmente sai do pacote.
  assert.ok(!('geo_locations' in targeting));
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test 2>&1 | grep -E "^ℹ (tests|pass|fail)"`
Expected: FAIL — `montarTargeting is not a function`

- [ ] **Step 3: Escrever a implementação**

Acrescentar a `publico-alvo.js`:

```js
// A Meta recusa raio de cidade abaixo disso (código 1487110, apanhado ao vivo
// em 2026-07-12). Raio 0 é caso à parte: significa "a cidade inteira".
export const RAIO_MINIMO_KM = 17;
export const RAIO_MINIMO_MI = 10;

function cidadeParaMeta(c, ajustes) {
  const saida = { key: String(c.key) };
  const raio = Number(c.raio) || 0;
  if (raio > 0) {
    const unidade = c.unidade === 'mile' ? 'mile' : 'kilometer';
    const minimo = unidade === 'mile' ? RAIO_MINIMO_MI : RAIO_MINIMO_KM;
    if (raio < minimo) {
      ajustes.push({ cidade: c.nome || String(c.key), de: raio, para: minimo, unidade });
      saida.radius = minimo;
    } else {
      saida.radius = raio;
    }
    saida.distance_unit = unidade;
  }
  return saida;
}

// Troca APENAS a parte de interesses do flexible_spec, preservando os outros
// grupos (comportamentos, eventos de vida). Eles moram no mesmo array e
// sobrescrevê-lo inteiro os apagaria — mesma classe de perda que este arquivo
// existe para evitar.
function flexComInteresses(originalFlex, interesses) {
  const outros = (Array.isArray(originalFlex) ? originalFlex : []).filter((g) => g && !g.interests);
  if (!interesses.length) return outros.length ? outros : null;
  return [...outros, { interests: interesses.map((i) => ({ id: String(i.id), name: i.name })) }];
}

// Escreve o público de volta no formato da Meta.
//
// PARTE DO ORIGINAL e sobrescreve só as chaves gerenciadas. Toda chave que
// este editor não conhece passa intacta. Campo gerenciado que ficou vazio é
// REMOVIDO do pacote em vez de ir como lista vazia — a Meta trata `[]` e
// ausente de formas diferentes.
export function montarTargeting(publico, original) {
  const t = Object.assign({}, original && typeof original === 'object' ? original : {});
  const p = Object.assign({}, PUBLICO_VAZIO, publico || {});
  const ajustes = [];
  const põe = (chave, valor) => { if (valor == null) delete t[chave]; else t[chave] = valor; };

  // Sem cidade nenhuma a chave SAI do pacote. Ressuscitar as cidades antigas
  // aqui faria a tela mentir: o dono apagou tudo e veria o de antes voltar.
  // Quem impede de salvar um público sem lugar é o aviso bloqueante (Task 4).
  põe('geo_locations', p.cidades.length
    ? { cities: p.cidades.map((c) => cidadeParaMeta(c, ajustes)) }
    : null);

  const cid = p.excluidas.filter((e) => e.tipo !== 'regiao').map((e) => ({ key: String(e.key) }));
  const reg = p.excluidas.filter((e) => e.tipo === 'regiao').map((e) => ({ key: String(e.key) }));
  const fora = {};
  if (cid.length) fora.cities = cid;
  if (reg.length) fora.regions = reg;
  põe('excluded_geo_locations', Object.keys(fora).length ? fora : null);

  põe('age_min', Number(p.idadeMin));
  põe('age_max', Number(p.idadeMax));
  põe('genders', p.generos.length ? p.generos.map(Number) : null);
  põe('flexible_spec', flexComInteresses(t.flexible_spec, p.interesses));
  põe('custom_audiences', p.incluir.length ? p.incluir.map((a) => ({ id: String(a.id) })) : null);
  põe('excluded_custom_audiences', p.excluir.length ? p.excluir.map((a) => ({ id: String(a.id) })) : null);
  põe('targeting_automation', { ...(t.targeting_automation || {}), advantage_audience: p.advantagePlus ? 1 : 0 });

  return { targeting: t, ajustes };
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm test 2>&1 | grep -E "^ℹ (tests|pass|fail)"`
Expected: PASS — `fail 0`, `test:ci` sobe para 532 (12 testes novos).

- [ ] **Step 5: Commitar**

```bash
git add src/ferramentas/gestao-trafego/publico-alvo.js src/ferramentas/gestao-trafego/publico-alvo.test.mjs
git commit -m "feat(gestor): escrever o público de volta sem apagar o que não é nosso

O targeting é um pacote só: além do público, carrega onde o anúncio aparece,
em que aparelhos e idiomas. Montar esse pacote só com os campos editados
apagaria o resto em silêncio — o dono trocaria uma cidade e o conjunto
pararia de rodar no Stories sem nada avisar.

Por isso parte do original e sobrescreve só o que gerencia. Tem teste
dedicado provando que campo desconhecido sobrevive à ida e volta.

Comportamentos do flexible_spec também sobrevivem a trocar interesses: moram
no mesmo array. Raio abaixo do mínimo é ajustado E relatado, nunca calado.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: `resumoDasMudancas` — dizer em português o que mudou

**Files:**
- Modify: `src/ferramentas/gestao-trafego/publico-alvo.js`
- Test: `src/ferramentas/gestao-trafego/publico-alvo.test.mjs`

**Interfaces:**
- Consumes: `Publico` (Task 1).
- Produces: `resumoDasMudancas(antes, depois) -> string[]` — frases prontas para a tela, uma por campo alterado. Lista vazia = nada mudou.

- [ ] **Step 1: Escrever os testes que falham**

```js
test('sem mudanca, resumo vazio', () => {
  assert.deepEqual(resumoDasMudancas(lerPublico(ALVO_META), lerPublico(ALVO_META)), []);
});

test('cidade entrando e saindo aparecem com nome, nao com codigo', () => {
  const antes = lerPublico(ALVO_META);
  const depois = lerPublico(ALVO_META);
  depois.cidades = [{ key: '999', nome: 'Piracicaba', raio: 0, unidade: 'kilometer' }];
  const r = resumoDasMudancas(antes, depois).join(' | ');
  assert.match(r, /Piracicaba/);
  assert.match(r, /Campinas/);
  assert.ok(!/1058|999/.test(r), 'o dono não entende código de cidade');
});

test('idade, genero e advantage+ saem em frase legivel', () => {
  const antes = lerPublico(ALVO_META);
  const d1 = { ...antes, idadeMin: 30 };
  assert.match(resumoDasMudancas(antes, d1).join(' '), /30/);
  const d2 = { ...antes, generos: [] };
  assert.match(resumoDasMudancas(antes, d2).join(' ').toLowerCase(), /gênero|genero|todos/);
  const d3 = { ...antes, advantagePlus: true };
  assert.match(resumoDasMudancas(antes, d3).join(' '), /Advantage/);
});

test('mudanca de raio da mesma cidade e relatada', () => {
  const antes = lerPublico(ALVO_META);
  const depois = { ...antes, cidades: [{ key: '1058', nome: 'Campinas', raio: 50, unidade: 'kilometer' }] };
  assert.match(resumoDasMudancas(antes, depois).join(' '), /Campinas.*50|50.*Campinas/);
});

test('publicos personalizados: incluidos e excluidos saem separados', () => {
  const antes = lerPublico(ALVO_META);
  const depois = { ...antes, incluir: [], excluir: [] };
  const r = resumoDasMudancas(antes, depois).join(' | ');
  assert.match(r, /Visitantes do site/);
  assert.match(r, /Já compraram/);
});

test('toda frase e texto legivel, sem objeto vazando', () => {
  const antes = lerPublico(ALVO_META);
  const depois = { ...antes, idadeMin: 30, generos: [], interesses: [] };
  for (const frase of resumoDasMudancas(antes, depois)) {
    assert.equal(typeof frase, 'string');
    assert.ok(!frase.includes('[object'), 'objeto vazou pra tela: ' + frase);
  }
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test 2>&1 | grep -E "^ℹ (tests|pass|fail)"` → FAIL, `resumoDasMudancas is not a function`

- [ ] **Step 3: Escrever a implementação**

```js
const GENERO_NOME = { 1: 'homens', 2: 'mulheres' };
const listaNomes = (arr) => arr.map((x) => x.nome || x.name || '').filter(Boolean);

// Compara duas listas por chave e devolve "+entrou, −saiu" com NOMES.
// Código de cidade e id de interesse não significam nada para o dono.
function diffLista(antes, depois, chaveDe, rotulo) {
  const mapa = (arr) => new Map(arr.map((x) => [String(chaveDe(x)), x.nome || x.name || String(chaveDe(x))]));
  const a = mapa(antes), d = mapa(depois);
  const entrou = [...d].filter(([k]) => !a.has(k)).map(([, n]) => '+' + n);
  const saiu = [...a].filter(([k]) => !d.has(k)).map(([, n]) => '−' + n);
  if (!entrou.length && !saiu.length) return null;
  return rotulo + ': ' + [...entrou, ...saiu].join(', ');
}

// Lista em português do que mudou entre dois públicos. É o que o dono lê
// antes de confirmar — por isso nomes, nunca códigos.
export function resumoDasMudancas(antes, depois) {
  const a = Object.assign({}, PUBLICO_VAZIO, antes || {});
  const d = Object.assign({}, PUBLICO_VAZIO, depois || {});
  const linhas = [];

  const cid = diffLista(a.cidades, d.cidades, (x) => x.key, 'Cidades');
  if (cid) linhas.push(cid);

  // Raio muda sem a cidade entrar ou sair — precisa de comparação própria.
  const raioAntes = new Map(a.cidades.map((c) => [c.key, c]));
  for (const c of d.cidades) {
    const ant = raioAntes.get(c.key);
    if (ant && Number(ant.raio) !== Number(c.raio)) {
      const un = c.unidade === 'mile' ? 'mi' : 'km';
      linhas.push(`Raio de ${c.nome || c.key}: ${ant.raio || 'cidade inteira'} → ${c.raio ? c.raio + ' ' + un : 'cidade inteira'}`);
    }
  }

  const exc = diffLista(a.excluidas, d.excluidas, (x) => x.key, 'Lugares excluídos');
  if (exc) linhas.push(exc);

  if (a.idadeMin !== d.idadeMin || a.idadeMax !== d.idadeMax)
    linhas.push(`Idade: ${a.idadeMin}–${a.idadeMax} → ${d.idadeMin}–${d.idadeMax}`);

  const gen = (g) => (g.length ? g.map((x) => GENERO_NOME[x] || x).join(' e ') : 'todos');
  if (gen(a.generos) !== gen(d.generos))
    linhas.push(`Gênero: ${gen(a.generos)} → ${gen(d.generos)}`);

  const int = diffLista(a.interesses, d.interesses, (x) => x.id, 'Interesses');
  if (int) linhas.push(int);

  const inc = diffLista(a.incluir, d.incluir, (x) => x.id, 'Públicos incluídos');
  if (inc) linhas.push(inc);

  const exd = diffLista(a.excluir, d.excluir, (x) => x.id, 'Públicos excluídos');
  if (exd) linhas.push(exd);

  if (a.advantagePlus !== d.advantagePlus)
    linhas.push('Advantage+: ' + (d.advantagePlus ? 'desligado → LIGADO' : 'ligado → DESLIGADO'));

  return linhas;
}
```

- [ ] **Step 4: Rodar e confirmar que passa** — `fail 0`, `test:ci` sobe para 538 (6 testes novos).

- [ ] **Step 5: Commitar**

```bash
git add src/ferramentas/gestao-trafego/publico-alvo.js src/ferramentas/gestao-trafego/publico-alvo.test.mjs
git commit -m "feat(gestor): resumo em português do que mudou no público

É o que o dono lê antes de confirmar, então sai com NOMES de cidade,
interesse e público — código e id não significam nada pra ele.

Raio tem comparação própria: muda sem a cidade entrar nem sair da lista.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: `avisosDe` — o preço da mudança, antes de confirmar

**Files:**
- Modify: `src/ferramentas/gestao-trafego/publico-alvo.js`
- Test: `src/ferramentas/gestao-trafego/publico-alvo.test.mjs`

**Interfaces:**
- Produces: `avisosDe(antes, depois, contexto) -> [{ tipo, texto, bloqueia }]`
  - `contexto`: `{ ativo: boolean, ajustes: [...] }` (ajustes vêm de `montarTargeting`)
  - `bloqueia: true` impede o salvar até o dono resolver.

- [ ] **Step 1: Escrever os testes que falham**

```js
test('conjunto ATIVO avisa que reinicia o aprendizado; pausado nao avisa', () => {
  const a = lerPublico(ALVO_META), d = { ...a, idadeMin: 30 };
  const ativo = avisosDe(a, d, { ativo: true, ajustes: [] });
  assert.ok(ativo.some(x => /aprendizado/i.test(x.texto)));
  const pausado = avisosDe(a, d, { ativo: false, ajustes: [] });
  assert.ok(!pausado.some(x => /aprendizado/i.test(x.texto)),
    'aviso que aparece sempre é aviso que ninguém lê');
});

test('sem mudanca nenhuma, nao avisa nada — nem em conjunto ativo', () => {
  const a = lerPublico(ALVO_META);
  assert.deepEqual(avisosDe(a, a, { ativo: true, ajustes: [] }), []);
});

test('LIGAR advantage+ com restricao manual BLOQUEIA — a Meta recusa (1870227)', () => {
  const a = lerPublico(ALVO_META);
  const d = { ...a, advantagePlus: true };   // ALVO_META tem idade, gênero e interesses
  const avisos = avisosDe(a, d, { ativo: false, ajustes: [] });
  const conflito = avisos.find(x => x.bloqueia);
  assert.ok(conflito, 'combinação que a Meta recusa não pode ser oferecida como se funcionasse');
  assert.match(conflito.texto, /Advantage/);
});

test('ligar advantage+ SEM restricao manual nao bloqueia', () => {
  const a = { ...PUBLICO_VAZIO, advantagePlus: false };
  const d = { ...PUBLICO_VAZIO, advantagePlus: true };
  assert.ok(!avisosDe(a, d, { ativo: false, ajustes: [] }).some(x => x.bloqueia));
});

test('desligar advantage+ avisa, mas nao bloqueia', () => {
  const a = { ...PUBLICO_VAZIO, advantagePlus: true };
  const d = { ...PUBLICO_VAZIO, advantagePlus: false, idadeMin: 25 };
  const avisos = avisosDe(a, d, { ativo: false, ajustes: [] });
  assert.ok(avisos.some(x => /desligado/i.test(x.texto)));
  assert.ok(!avisos.some(x => x.bloqueia));
});

test('ajuste de raio vira aviso com a cidade pelo nome', () => {
  const a = lerPublico(ALVO_META);
  const avisos = avisosDe(a, a, { ativo: false, ajustes: [{ cidade: 'Campinas', de: 5, para: 17, unidade: 'kilometer' }] });
  const r = avisos.find(x => /Campinas/.test(x.texto));
  assert.ok(r);
  assert.match(r.texto, /17/);
});

test('publico sem lugar nenhum BLOQUEIA — a Meta exige localizacao', () => {
  const a = lerPublico(ALVO_META);
  const d = { ...a, cidades: [] };
  const bloq = avisosDe(a, d, { ativo: false, ajustes: [] }).find(x => x.bloqueia);
  assert.ok(bloq, 'conjunto não pode mirar em lugar nenhum');
  assert.match(bloq.texto.toLowerCase(), /cidade|lugar|local/);
});

test('todo aviso tem texto legivel e marca de bloqueio explicita', () => {
  const a = lerPublico(ALVO_META);
  const d = { ...a, advantagePlus: true, idadeMin: 30 };
  for (const x of avisosDe(a, d, { ativo: true, ajustes: [] })) {
    assert.equal(typeof x.texto, 'string');
    assert.ok(x.texto.length > 15);
    assert.equal(typeof x.bloqueia, 'boolean');
  }
});
```

- [ ] **Step 2: Rodar e confirmar que falha** → `avisosDe is not a function`

- [ ] **Step 3: Escrever a implementação**

```js
const temRestricaoManual = (p) =>
  (p.generos && p.generos.length > 0) ||
  (p.interesses && p.interesses.length > 0) ||
  p.idadeMin !== PUBLICO_VAZIO.idadeMin ||
  p.idadeMax !== PUBLICO_VAZIO.idadeMax;

// Os avisos que precedem o salvar. `bloqueia: true` impede a gravação até o
// dono resolver o conflito.
//
// Aviso que aparece sempre é aviso que ninguém lê: se nada mudou, não avisa
// nada, e o aviso de aprendizado só sai em conjunto que está rodando.
export function avisosDe(antes, depois, contexto) {
  const a = Object.assign({}, PUBLICO_VAZIO, antes || {});
  const d = Object.assign({}, PUBLICO_VAZIO, depois || {});
  const ctx = contexto || {};
  const avisos = [];
  const mudou = resumoDasMudancas(a, d).length > 0;

  for (const aj of ctx.ajustes || []) {
    const un = aj.unidade === 'mile' ? 'milhas' : 'km';
    avisos.push({
      tipo: 'raio',
      texto: `Ajustei o raio de ${aj.cidade} de ${aj.de} para ${aj.para} ${un} — a Meta não aceita menos.`,
      bloqueia: false,
    });
  }

  // A Meta exige localização: conjunto não mira em lugar nenhum. Barrar aqui
  // é melhor que deixar salvar e tomar recusa sem entender o motivo.
  if (!d.cidades.length) {
    avisos.push({
      tipo: 'sem-lugar',
      texto: 'O público ficou <b>sem nenhuma cidade</b>. A Meta não aceita um conjunto sem localização — escolha pelo menos uma.',
      bloqueia: true,
    });
  }

  // A Meta REJEITA segmentação manual com o Advantage+ ligado (código 1870227,
  // apanhado ao vivo em 2026-07-12). Deixar salvar e tomar o erro seria
  // transferir pro dono um conflito que a ferramenta já conhece.
  if (d.advantagePlus && temRestricaoManual(d)) {
    avisos.push({
      tipo: 'conflito',
      texto: 'Com o Advantage+ ligado, a Meta <b>recusa</b> idade, gênero e interesses definidos à mão. Escolha: ou desliga o Advantage+, ou limpa essas restrições.',
      bloqueia: true,
    });
  } else if (!d.advantagePlus && a.advantagePlus) {
    avisos.push({
      tipo: 'advantage',
      texto: 'O Advantage+ será <b>desligado</b>. A partir daí idade, gênero e interesses passam a valer como limite de verdade.',
      bloqueia: false,
    });
  }

  if (mudou && ctx.ativo) {
    avisos.push({
      tipo: 'aprendizado',
      texto: 'Este conjunto está rodando. Mudar o público <b>reinicia o aprendizado da Meta</b> — o custo pode piorar por alguns dias até estabilizar.',
      bloqueia: false,
    });
  }

  return avisos;
}
```

- [ ] **Step 4: Rodar e confirmar que passa** — `fail 0`, `test:ci` sobe para 546 (8 testes novos).

- [ ] **Step 5: Commitar**

```bash
git add src/ferramentas/gestao-trafego/publico-alvo.js src/ferramentas/gestao-trafego/publico-alvo.test.mjs
git commit -m "feat(gestor): avisos antes de salvar o público

Reinício de aprendizado só avisa em conjunto que está rodando — aviso que
aparece sempre é aviso que ninguém lê.

Advantage+ ligado junto com restrição manual BLOQUEIA o salvar: a Meta
recusa essa combinação (1870227, apanhado ao vivo em 2026-07-12). Deixar
salvar e tomar o erro seria empurrar pro dono um conflito já conhecido.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: Buscar o público e os públicos personalizados da conta

**Files:**
- Modify: `src/ferramentas/gestao-trafego/tela-de-gestao-trafego.vue`

**Interfaces:**
- Consumes: `metaFetch`, `_gtCurAcc`, `_maCleanAccId` (já existem no arquivo).
- Produces:
  - `_gtBuscarPublico(adsetId) -> Promise<targeting|null>`
  - `_gtListarPublicosSalvos() -> Promise<[{id,name,subtype}]>` (com cache por conta)
  - `_gtListarPresets() -> Promise<[...]>` (da tabela `fabrica_publicos`)

**Padrão já provado:** `src/ferramentas/meta-ads/painel-subir.vue:129` já busca `/act_X/customaudiences` via `meta-proxy` com `fields: 'id,name,subtype,approximate_count_lower_bound,approximate_count_upper_bound'`. Siga a mesma chamada; aqui ela vai por `metaFetch`, que o Gestor já usa.

- [ ] **Step 1: Importar o motor**

Junto do import de `duplicar.js` (linha 130 hoje — ache pelo nome, não pelo número):

```js
import { lerPublico, montarTargeting, resumoDasMudancas, avisosDe, PUBLICO_VAZIO } from './publico-alvo.js'
```

- [ ] **Step 2: As três buscas**

Inserir logo antes de `function _gtBotaoDuplicar` (linha 1653 hoje — ache pelo nome):

```js
// Público de UM conjunto, buscado na hora. O Gestor não traz targeting na
// carga da tela de propósito: pedir isso de todos os conjuntos em toda carga
// deixaria a tela lenta pra um dado que quase nunca é olhado.
async function _gtBuscarPublico(adsetId){
  const tok=_gtCurAcc?.id;
  if(!tok)return null;
  const r=await metaFetch('/'+adsetId,{fields:'targeting,effective_status'},tok);
  return r||null;
}

// Públicos personalizados da conta (remarketing e semelhantes). Buscados UMA
// vez por conta e reaproveitados: a lista muda pouco e a chamada é cara.
let _gtPublicosSalvos=null;      // {conta, lista} | null
async function _gtListarPublicosSalvos(){
  const tok=_gtCurAcc?.id;
  if(!tok)return [];
  if(_gtPublicosSalvos&&_gtPublicosSalvos.conta===tok)return _gtPublicosSalvos.lista;
  // Falha aqui NÃO derruba o editor: lista opcional que não carrega não pode
  // impedir o dono de trocar uma cidade.
  const r=await metaFetchAll(`/act_${_maCleanAccId(tok)}/customaudiences`,
    {fields:'id,name,subtype',limit:200},tok).catch(()=>null);
  if(r===null)return null;       // null = "não consegui carregar", [] = "não tem nenhum"
  _gtPublicosSalvos={conta:tok,lista:r};
  return r;
}

// Públicos prontos montados no Estúdio (tabela fabrica_publicos, leitura
// liberada para autenticados). Escolher um PREENCHE o editor; não salva.
async function _gtListarPresets(){
  const{data,error}=await sbClient.from('fabrica_publicos')
    .select('id,nome,geo,idade_min,idade_max,generos,interesses,custom_audiences')
    .eq('ativo',true).order('created_at',{ascending:false});
  return error?null:(data||[]);
}
```

**Resolvido em 29/07 — não precisa mais confirmar:** `metaFetchAll` existe
(linha 242) e `sbClient` está importado (linha 121), já usado para ler e gravar
tabela em vários pontos da tela (582, 683, 945, 1170). Siga esses precedentes;
**não invente um cliente novo**.

- [ ] **Step 3: Verificar que compila**

Run: `npm run build && npm test 2>&1 | grep -E "^ℹ (tests|pass|fail)"`
Expected: `✓ built`, `fail 0` (contagem inalterada — esta tarefa não acrescenta teste).

- [ ] **Step 4: Commitar**

```bash
git add src/ferramentas/gestao-trafego/tela-de-gestao-trafego.vue
git commit -m "feat(gestor): buscar o público do conjunto e as listas de apoio

Público do conjunto vem sob demanda: pedir targeting de todos os conjuntos
em toda carga deixaria a tela lenta por um dado quase nunca olhado.

Públicos personalizados são buscados uma vez por conta. Se a busca falhar,
devolve null e o editor segue funcionando — lista opcional que não carrega
não pode impedir o dono de trocar uma cidade.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: O editor na tela

**Files:**
- Modify: `src/ferramentas/gestao-trafego/tela-de-gestao-trafego.vue`

**Interfaces:**
- Consumes: Tasks 1–5, mais `_gtConfirm`, `_gtEsc`, `metaPost`, `loadGtData`, `comEspera` (de `duplicar.js`).
- Produces: `_gtAbrirPublico(conjunto)` — abre o editor, salva e relata.

**Estrutura, seguindo o que o duplicar já estabeleceu neste arquivo:**
- `_gtPublicoModal(estado)` — a janela do editor. Função própria; **não estender `_gtConfirm`**.
- `_gtPublicoStatus(html, acoes)` — caixa de progresso/resultado, com o mesmo visual.
- `_gtAbrirPublico(conjunto)` — orquestra: busca → edita → resumo + avisos → confirma → grava.
- Trava de ocupado (`_gtPubBusy`), no mesmo formato do `_gtDupBusy`, liberada em `finally`.

**Regras que a janela precisa cumprir:**
1. Enquanto está gravando, **não** dá para fechar clicando no fundo (`ov.onclick=null`) — mesma correção que o duplicar precisou.
2. Toda saída passa por um botão. Nunca deixar caixa sem botão.
3. Havendo aviso com `bloqueia: true`, o botão de salvar fica **desabilitado**, com o aviso visível explicando o que resolver.
4. A busca dos públicos personalizados devolvendo `null` mostra "não consegui carregar seus públicos salvos" **naquela seção**, e o resto do editor segue normal.
5. Erro da Meta traduzido, reusando o padrão de `_gtDupTraduzir`, mais o caso novo:
   `/1870227|advantage/i` → "A Meta recusou porque o Advantage+ está ligado neste conjunto. Desligue o Advantage+ aqui no editor para que idade, gênero e interesses valham."
6. Gravar é **uma** chamada: `metaPost('/'+adsetId,{targeting},tok)`, envolvida em `comEspera`. Não existe "parou no meio".

**`targeting` vai como OBJETO, não como texto.** O `meta-proxy` já faz
`JSON.stringify` em qualquer valor que seja objeto
(`supabase/functions/meta-proxy/index.ts:102`). Mandar já convertido
converteria duas vezes e a Meta recusaria. É o mesmo caminho que
`coletor/subir-estudio.mjs` usa ao criar conjunto.

**Buscas: use os mesmos caminhos que o Estúdio já provou ao vivo**
(`src/ferramentas/meta-ads/painel-subir.vue`):
- cidade: `/search` com `type:'adgeolocation'`, `location_types:['city']`, `q`, `limit:15`
- interesse: `/search` com `type:'adinterest'`, `q`, `limit:10`
- **Nunca pedir `approximate_count`** nos públicos personalizados: o campo foi
  removido na Graph v22 e a chamada falha em silêncio (erro #100). Se precisar
  do tamanho, é `approximate_count_upper_bound`.
- **Busca que falha tem que aparecer.** O Estúdio já apanhou disso: erro
  engolido numa busca de cidade vira "não inclui nada" sem o dono entender.

- [ ] **Step 1: A caixa de estado e os tijolos do editor**

Inserir depois do bloco do duplicar, ou seja, após `_gtDupTraduzir` (linha 2709 hoje — ache pelo nome):

```js
/* ── EDITOR DE PÚBLICO DO CONJUNTO ──────────────────────────────────────────
   Estado de trabalho no módulo, não passado de função em função: os controles
   são muitos e todos mexem no MESMO objeto. Redesenhar é sempre pelo
   _gtPubRedesenha, para o botão de salvar reavaliar os avisos bloqueantes. */
let _gtPub=null;            // Publico em edição (forma do publico-alvo.js)
let _gtPubAntes=null;       // como estava quando abriu — base do resumo
let _gtPubSalvos=null;      // públicos personalizados da conta (null = não carregou)
let _gtPubPresets=null;     // públicos prontos do Estúdio (null = não carregou)
let _gtPubAtivo=false;      // o conjunto está rodando?
let _gtPubBusy=false;       // trava: um editor por vez
// Começa e termina como função vazia, NUNCA null: os controles do editor
// chamam isto direto, e se algo lançar com a janela aberta um `null` aqui
// viraria erro em cima de erro, deixando o dono com a tela travada.
let _gtPubRedesenha=()=>{};

function _gtPubOverlay(){
  let ov=document.getElementById('gt-pub-ov');
  if(!ov){ov=document.createElement('div');ov.id='gt-pub-ov';ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;';document.body.appendChild(ov);}
  return ov;
}
function _gtPubFechar(){const ov=document.getElementById('gt-pub-ov');if(ov)ov.style.display='none';}

// Caixa de estado (carregando / resultado / erro). SEMPRE zera o ov.onclick:
// durante a gravação não pode fechar clicando fora, e toda saída é por botão —
// lição que o duplicar já pagou (cópia seguia rodando com a tela parecendo parada).
function _gtPubStatus(html,acoes){
  const ov=_gtPubOverlay();ov.innerHTML='';ov.style.display='flex';ov.onclick=null;
  const box=document.createElement('div');
  box.style.cssText='background:var(--surface,#fff);color:var(--text,#111);border-radius:14px;max-width:460px;width:100%;padding:24px;box-shadow:0 24px 60px rgba(0,0,0,.45);font-family:var(--fonte-principal);font-size:calc(13px*var(--gt-fs,1.3));line-height:1.6;';
  box.innerHTML=html;
  if(acoes&&acoes.length){
    const bar=document.createElement('div');bar.style.cssText='display:flex;gap:10px;justify-content:flex-end;margin-top:18px;flex-wrap:wrap;';
    for(const a of acoes){
      const b=document.createElement('button');b.textContent=a.texto;b.disabled=!!a.desabilitado;
      b.style.cssText='padding:9px 16px;border-radius:8px;border:'+(a.primario?'none':'1px solid var(--border,#ddd)')+';background:'+(a.primario?'var(--accent,#6366f1)':'none')+';color:'+(a.primario?'#fff':'var(--text,#111)')+';font-weight:700;font-size:calc(13px*var(--gt-fs,1.3));cursor:'+(a.desabilitado?'not-allowed':'pointer')+';opacity:'+(a.desabilitado?'.5':'1')+';';
      if(!a.desabilitado)b.onclick=a.aoClicar;
      bar.appendChild(b);
    }
    box.appendChild(bar);
  }
  ov.appendChild(box);
}

// Tijolos do editor. Nomes curtos porque aparecem muitas vezes abaixo.
function _gtPubTitulo(txt){const d=document.createElement('div');d.style.cssText='font-size:calc(12px*var(--gt-fs,1.3));font-weight:800;margin:16px 0 6px;';d.textContent=txt;return d;}
function _gtPubAjuda(txt){const d=document.createElement('div');d.style.cssText='font-size:calc(11px*var(--gt-fs,1.3));color:var(--muted,#666);margin:-3px 0 7px;line-height:1.45;';d.textContent=txt;return d;}
function _gtPubLinha(){const d=document.createElement('div');d.style.cssText='display:flex;gap:6px;flex-wrap:wrap;align-items:center;';return d;}
function _gtPubInput(valor,ph,largura){const i=document.createElement('input');i.value=valor==null?'':valor;i.placeholder=ph||'';i.style.cssText='padding:7px 9px;border-radius:7px;border:1px solid var(--border,#ddd);background:var(--surface,#fff);color:var(--text,#111);font-size:calc(12px*var(--gt-fs,1.3));'+(largura?'width:'+largura+';':'flex:1;min-width:120px;');return i;}

// Etiqueta de item escolhido, com o × pra tirar. `extra` entra antes do ×
// (é onde o raio da cidade aparece).
function _gtPubChip(texto,aoRemover,extra){
  const c=document.createElement('span');
  c.style.cssText='display:inline-flex;align-items:center;gap:5px;padding:4px 8px;border-radius:20px;border:1px solid var(--border,#ddd);font-size:calc(11px*var(--gt-fs,1.3));background:var(--surface2,rgba(0,0,0,.03));';
  const t=document.createElement('span');t.textContent=texto;c.appendChild(t);
  if(extra)c.appendChild(extra);
  const x=document.createElement('button');x.textContent='×';x.title='Tirar';
  x.style.cssText='border:none;background:none;color:var(--muted,#666);cursor:pointer;font-size:calc(14px*var(--gt-fs,1.3));line-height:1;padding:0 2px;';
  x.onclick=ev=>{ev.stopPropagation();aoRemover();};
  c.appendChild(x);
  return c;
}

// Campo de busca + resultados. `aoBuscar(termo)` devolve lista ou lança.
// Erro NUNCA é engolido: busca que falha calada vira "não acha nada" e o dono
// não entende por quê (o Estúdio já apanhou exatamente disso).
function _gtPubBusca(ph,aoBuscar,aoEscolher,rotuloDe){
  const cx=document.createElement('div');
  const linha=_gtPubLinha();
  const inp=_gtPubInput('',ph);
  const bt=document.createElement('button');bt.textContent='Buscar';bt.className='gt-btn-dup';
  const res=document.createElement('div');res.style.cssText='display:flex;flex-direction:column;gap:2px;margin-top:6px;';
  const erro=document.createElement('div');erro.style.cssText='font-size:calc(11px*var(--gt-fs,1.3));color:var(--red,#dc2626);margin-top:5px;';
  async function buscar(){
    const termo=inp.value.trim();if(!termo)return;
    res.innerHTML='';erro.textContent='';bt.disabled=true;bt.textContent='…';
    try{
      const achados=await aoBuscar(termo);
      if(!achados.length){erro.textContent='Nada encontrado para essa busca.';return;}
      for(const item of achados){
        const b=document.createElement('button');b.textContent=rotuloDe(item);
        b.style.cssText='text-align:left;padding:6px 9px;border-radius:6px;border:1px solid var(--border,#ddd);background:none;color:var(--text,#111);font-size:calc(11px*var(--gt-fs,1.3));cursor:pointer;';
        b.onclick=ev=>{ev.stopPropagation();aoEscolher(item);inp.value='';res.innerHTML='';_gtPubRedesenha&&_gtPubRedesenha();};
        res.appendChild(b);
      }
    }catch(e){
      erro.textContent='Não consegui buscar agora: '+String((e&&e.message)||e).slice(0,120);
    }finally{bt.disabled=false;bt.textContent='Buscar';}
  }
  bt.onclick=ev=>{ev.stopPropagation();buscar();};
  inp.onkeydown=ev=>{if(ev.key==='Enter'){ev.preventDefault();buscar();}};
  linha.appendChild(inp);linha.appendChild(bt);
  cx.appendChild(linha);cx.appendChild(res);cx.appendChild(erro);
  return cx;
}

// As duas buscas da Meta, nos mesmos caminhos que o Estúdio já provou ao vivo.
async function _gtPubBuscarCidades(termo){
  const tok=_gtCurAcc?.id;
  const r=await metaFetch('/search',{type:'adgeolocation',location_types:JSON.stringify(['city']),q:termo,limit:15},tok);
  return (r&&r.data)||[];
}
async function _gtPubBuscarInteresses(termo){
  const tok=_gtCurAcc?.id;
  const r=await metaFetch('/search',{type:'adinterest',q:termo,limit:10},tok);
  return (r&&r.data)||[];
}
```

- [ ] **Step 2: As seções do editor**

Inserir logo depois:

```js
// Onde o anúncio é mostrado: cidades com raio, e lugares a excluir.
function _gtPubSecaoLugar(){
  const cx=document.createElement('div');
  cx.appendChild(_gtPubTitulo('Onde mostrar'));
  cx.appendChild(_gtPubAjuda('Raio 0 significa a cidade inteira. A Meta não aceita raio menor que 17 km — se você puser menos, eu aviso e ajusto.'));
  const chips=_gtPubLinha();
  for(const c of _gtPub.cidades){
    const raio=_gtPubInput(c.raio,'raio','70px');
    raio.type='number';raio.min='0';raio.title='Raio em km (0 = cidade inteira)';
    // De propósito NÃO redesenha: redesenhar aqui tiraria o cursor do campo no
    // meio da digitação. Raio não gera aviso bloqueante — só o de ajuste, que
    // é recalculado na confirmação.
    raio.onchange=()=>{c.raio=Number(raio.value)||0;};
    chips.appendChild(_gtPubChip(c.nome||c.key,()=>{_gtPub.cidades=_gtPub.cidades.filter(x=>x.key!==c.key);_gtPubRedesenha();},raio));
  }
  if(!_gtPub.cidades.length){
    const vazio=document.createElement('span');
    vazio.style.cssText='font-size:calc(11px*var(--gt-fs,1.3));color:var(--red,#dc2626);';
    vazio.textContent='Sem nenhuma cidade — a Meta não aceita assim.';
    chips.appendChild(vazio);
  }
  cx.appendChild(chips);
  cx.appendChild(_gtPubBusca('Buscar cidade…',_gtPubBuscarCidades,
    c=>{if(!_gtPub.cidades.some(x=>x.key===String(c.key)))_gtPub.cidades.push({key:String(c.key),nome:c.name+(c.region?' · '+c.region:''),raio:0,unidade:'kilometer'});},
    c=>c.name+(c.region?' · '+c.region:'')));

  cx.appendChild(_gtPubTitulo('Onde NÃO mostrar'));
  const fora=_gtPubLinha();
  for(const e of _gtPub.excluidas)
    fora.appendChild(_gtPubChip((e.nome||e.key)+(e.tipo==='regiao'?' (região)':''),()=>{_gtPub.excluidas=_gtPub.excluidas.filter(x=>x.key!==e.key);_gtPubRedesenha();}));
  if(!_gtPub.excluidas.length)fora.appendChild(_gtPubAjuda('Nenhum lugar excluído.'));
  cx.appendChild(fora);
  cx.appendChild(_gtPubBusca('Excluir uma cidade…',_gtPubBuscarCidades,
    c=>{if(!_gtPub.excluidas.some(x=>x.key===String(c.key)))_gtPub.excluidas.push({key:String(c.key),nome:c.name,tipo:'cidade'});},
    c=>c.name+(c.region?' · '+c.region:'')));
  return cx;
}

// Idade, gênero e interesses — os três que brigam com o Advantage+.
function _gtPubSecaoPessoas(){
  const cx=document.createElement('div');
  cx.appendChild(_gtPubTitulo('Idade'));
  const li=_gtPubLinha();
  const de=_gtPubInput(_gtPub.idadeMin,'de','80px');de.type='number';de.min='13';de.max='65';
  const ate=_gtPubInput(_gtPub.idadeMax,'até','80px');ate.type='number';ate.min='13';ate.max='65';
  de.onchange=()=>{_gtPub.idadeMin=Number(de.value)||18;};
  ate.onchange=()=>{_gtPub.idadeMax=Number(ate.value)||65;};
  li.appendChild(de);const t=document.createElement('span');t.textContent='até';li.appendChild(t);li.appendChild(ate);
  cx.appendChild(li);

  cx.appendChild(_gtPubTitulo('Gênero'));
  const lg=_gtPubLinha();
  const opcoes=[{v:[],r:'Todos'},{v:[1],r:'Homens'},{v:[2],r:'Mulheres'}];
  const atual=JSON.stringify(_gtPub.generos);
  for(const o of opcoes){
    const b=document.createElement('button');b.textContent=o.r;b.className='gt-btn-dup';
    if(JSON.stringify(o.v)===atual)b.style.borderColor='var(--accent,#6366f1)',b.style.color='var(--accent,#6366f1)';
    b.onclick=ev=>{ev.stopPropagation();_gtPub.generos=[...o.v];_gtPubRedesenha();};
    lg.appendChild(b);
  }
  cx.appendChild(lg);

  cx.appendChild(_gtPubTitulo('Interesses'));
  const ci=_gtPubLinha();
  for(const i of _gtPub.interesses)
    ci.appendChild(_gtPubChip(i.name||i.id,()=>{_gtPub.interesses=_gtPub.interesses.filter(x=>x.id!==i.id);_gtPubRedesenha();}));
  if(!_gtPub.interesses.length)ci.appendChild(_gtPubAjuda('Nenhum interesse — a Meta escolhe sozinha.'));
  cx.appendChild(ci);
  cx.appendChild(_gtPubBusca('Buscar interesse…',_gtPubBuscarInteresses,
    i=>{if(!_gtPub.interesses.some(x=>x.id===String(i.id)))_gtPub.interesses.push({id:String(i.id),name:i.name});},
    i=>i.name));
  return cx;
}

// Públicos personalizados (remarketing e semelhantes), incluindo e excluindo.
// Lista que não carrega NÃO derruba o editor: avisa só nesta seção.
function _gtPubSecaoPublicos(){
  const cx=document.createElement('div');
  cx.appendChild(_gtPubTitulo('Públicos salvos na conta'));
  if(_gtPubSalvos===null){
    cx.appendChild(_gtPubAjuda('Não consegui carregar seus públicos salvos. O resto do editor funciona normalmente.'));
    return cx;
  }
  if(!_gtPubSalvos.length){
    cx.appendChild(_gtPubAjuda('Esta conta não tem público salvo. Crie no Gerenciador da Meta — criar por aqui está bloqueado pela Meta nesta conta.'));
    return cx;
  }
  cx.appendChild(_gtPubAjuda('Clique uma vez para INCLUIR (verde), duas para EXCLUIR (vermelho), três para tirar.'));
  const lp=_gtPubLinha();
  for(const a of _gtPubSalvos){
    const incluido=_gtPub.incluir.some(x=>x.id===String(a.id));
    const excluido=_gtPub.excluir.some(x=>x.id===String(a.id));
    const b=document.createElement('button');b.textContent=a.name;b.className='gt-btn-dup';
    if(incluido)b.style.borderColor='#16a34a',b.style.color='#16a34a';
    if(excluido)b.style.borderColor='#dc2626',b.style.color='#dc2626',b.textContent='∅ '+a.name;
    b.onclick=ev=>{
      ev.stopPropagation();
      const id=String(a.id),nome=a.name;
      _gtPub.incluir=_gtPub.incluir.filter(x=>x.id!==id);
      _gtPub.excluir=_gtPub.excluir.filter(x=>x.id!==id);
      if(!incluido&&!excluido)_gtPub.incluir.push({id,name:nome});
      else if(incluido)_gtPub.excluir.push({id,name:nome});
      _gtPubRedesenha();
    };
    lp.appendChild(b);
  }
  cx.appendChild(lp);
  return cx;
}

// Advantage+ e "usar um público pronto do Estúdio".
function _gtPubSecaoExtras(){
  const cx=document.createElement('div');
  cx.appendChild(_gtPubTitulo('Advantage+'));
  cx.appendChild(_gtPubAjuda('Ligado, a Meta escolhe o público sozinha. Ligado NÃO convive com idade, gênero e interesses definidos à mão — a Meta recusa a combinação.'));
  const lb=document.createElement('label');
  lb.style.cssText='display:flex;align-items:center;gap:8px;font-size:calc(12px*var(--gt-fs,1.3));cursor:pointer;';
  const ck=document.createElement('input');ck.type='checkbox';ck.checked=!!_gtPub.advantagePlus;
  ck.onchange=()=>{_gtPub.advantagePlus=ck.checked;_gtPubRedesenha();};
  lb.appendChild(ck);const s=document.createElement('span');s.textContent='Deixar a Meta escolher o público (Advantage+)';lb.appendChild(s);
  cx.appendChild(lb);

  if(_gtPubPresets===null){
    cx.appendChild(_gtPubTitulo('Usar um público pronto'));
    cx.appendChild(_gtPubAjuda('Não consegui carregar os públicos montados no Estúdio.'));
    return cx;
  }
  if(!_gtPubPresets.length)return cx;
  cx.appendChild(_gtPubTitulo('Usar um público pronto do Estúdio'));
  cx.appendChild(_gtPubAjuda('Escolher um preenche o editor inteiro. Você ainda vê o que mudou e confirma antes de salvar.'));
  const sel=document.createElement('select');
  sel.style.cssText='width:100%;padding:8px;border-radius:7px;border:1px solid var(--border,#ddd);background:var(--surface,#fff);color:var(--text,#111);font-size:calc(12px*var(--gt-fs,1.3));';
  sel.innerHTML='<option value="">— escolher —</option>'+_gtPubPresets.map(p=>'<option value="'+_gtEsc(p.id)+'">'+_gtEsc(p.nome)+'</option>').join('');
  sel.onchange=()=>{
    const p=_gtPubPresets.find(x=>String(x.id)===sel.value);
    if(!p)return;
    // Preenche, NÃO salva. O preset guarda a mesma forma que o Estúdio usa.
    _gtPub.cidades=((p.geo&&p.geo.cities)||[]).map(c=>({key:String(c.key),nome:c.nome||String(c.key),raio:Number(c.radius)||0,unidade:c.distance_unit||'kilometer'}));
    _gtPub.excluidas=((p.geo&&p.geo.excluded)||[]).map(e=>({key:String(e.key),nome:e.nome||String(e.key),tipo:e.type==='region'?'regiao':'cidade'}));
    _gtPub.idadeMin=p.idade_min==null?18:Number(p.idade_min);
    _gtPub.idadeMax=p.idade_max==null?65:Number(p.idade_max);
    _gtPub.generos=(p.generos||[]).map(Number);
    _gtPub.interesses=(p.interesses||[]).map(i=>({id:String(i.id),name:i.name}));
    _gtPub.incluir=(p.custom_audiences||[]).map(a=>({id:String(a.id),name:a.name}));
    // Público definido à mão não convive com Advantage+ — mesma regra do publico.mjs.
    _gtPub.advantagePlus=false;
    _gtPubRedesenha();
  };
  cx.appendChild(sel);
  return cx;
}
```

- [ ] **Step 3: A janela do editor**

```js
// A janela. Resolve com o Publico editado, ou null se cancelou.
// NÃO estende o _gtConfirm: aquele é o portão sim/não de TODAS as ações da
// tela, marcado no código como preservado verbatim, e não tem formulário.
function _gtPublicoModal(nomeConjunto){
  return new Promise(resolve=>{
    const ov=_gtPubOverlay();ov.onclick=null;
    const box=document.createElement('div');
    box.style.cssText='background:var(--surface,#fff);color:var(--text,#111);border-radius:14px;max-width:560px;width:100%;max-height:86vh;overflow-y:auto;padding:24px;box-shadow:0 24px 60px rgba(0,0,0,.45);font-family:var(--fonte-principal);';
    const corpo=document.createElement('div');
    const barra=document.createElement('div');
    barra.style.cssText='display:flex;gap:10px;justify-content:flex-end;margin-top:20px;position:sticky;bottom:0;background:var(--surface,#fff);padding-top:12px;';
    const bCancelar=document.createElement('button');bCancelar.textContent='Cancelar';
    bCancelar.style.cssText='padding:9px 16px;border-radius:8px;border:1px solid var(--border,#ddd);background:none;color:var(--text,#111);font-weight:600;font-size:calc(13px*var(--gt-fs,1.3));cursor:pointer;';
    bCancelar.onclick=()=>{_gtPubFechar();resolve(null);};
    const bSalvar=document.createElement('button');bSalvar.textContent='Ver o que mudou';
    bSalvar.onclick=()=>{_gtPubFechar();resolve(_gtPub);};
    barra.appendChild(bCancelar);barra.appendChild(bSalvar);

    // Redesenha o corpo e reavalia os avisos. É aqui que o botão de continuar
    // é liberado ou travado — sem isso, o dono só descobriria o conflito de
    // Advantage+ tomando erro da Meta.
    _gtPubRedesenha=()=>{
      corpo.innerHTML='';
      const tit=document.createElement('div');
      tit.style.cssText='font-size:calc(16px*var(--gt-fs,1.3));font-weight:800;margin-bottom:3px;';
      tit.textContent='Quem vê estes anúncios';
      const sub=document.createElement('div');
      sub.style.cssText='font-size:calc(12px*var(--gt-fs,1.3));color:var(--muted,#666);margin-bottom:6px;';
      sub.textContent='Conjunto: '+nomeConjunto;
      corpo.appendChild(tit);corpo.appendChild(sub);
      corpo.appendChild(_gtPubSecaoLugar());
      corpo.appendChild(_gtPubSecaoPessoas());
      corpo.appendChild(_gtPubSecaoPublicos());
      corpo.appendChild(_gtPubSecaoExtras());

      const { ajustes }=montarTargeting(_gtPub,{});
      const avisos=avisosDe(_gtPubAntes,_gtPub,{ativo:_gtPubAtivo,ajustes});
      const trava=avisos.find(a=>a.bloqueia);
      for(const a of avisos.filter(x=>x.bloqueia)){
        const d=document.createElement('div');
        d.style.cssText='margin-top:14px;background:rgba(220,38,38,.10);border:1px solid rgba(220,38,38,.35);border-radius:8px;padding:11px 13px;font-size:calc(12px*var(--gt-fs,1.3));line-height:1.5;';
        d.innerHTML=a.texto;
        corpo.appendChild(d);
      }
      bSalvar.disabled=!!trava;
      bSalvar.style.cssText='padding:9px 18px;border-radius:8px;border:none;background:var(--accent,#6366f1);color:#fff;font-weight:700;font-size:calc(13px*var(--gt-fs,1.3));cursor:'+(trava?'not-allowed':'pointer')+';opacity:'+(trava?'.5':'1')+';';
    };

    ov.innerHTML='';ov.style.display='flex';
    box.appendChild(corpo);box.appendChild(barra);ov.appendChild(box);
    _gtPubRedesenha();
  });
}
```

- [ ] **Step 4: O orquestrador `_gtAbrirPublico`**

```js
const _gtPubClonar=(p)=>JSON.parse(JSON.stringify(p));

// AÇÃO REAL na Meta: muda quem vê os anúncios de um conjunto ao vivo.
async function _gtAbrirPublico(conjunto){
  const tok=_gtCurAcc?.id;
  if(!tok){await _gtConfirm('Sem conta selecionada','Escolha uma conta de anúncios antes de mexer no público.',{okOnly:true});return;}
  if(_gtPubBusy){await _gtConfirm('Já tem um público aberto','Termine o que está aberto antes de abrir outro.',{okOnly:true});return;}
  _gtPubBusy=true;
  try{
    _gtPubStatus('<b>Carregando o público…</b>');
    let dados=null;
    try{ dados=await _gtBuscarPublico(conjunto.id); }
    catch(e){
      _gtPubStatus('<b>Não consegui carregar o público.</b><br>'+_gtDupTraduzir(String((e&&e.message)||e)),
        [{texto:'Fechar',primario:true,aoClicar:_gtPubFechar}]);
      return;
    }
    if(!dados){_gtPubStatus('<b>Não consegui carregar o público deste conjunto.</b>',[{texto:'Fechar',primario:true,aoClicar:_gtPubFechar}]);return;}

    _gtPubAntes=lerPublico(dados.targeting);
    _gtPub=_gtPubClonar(_gtPubAntes);
    _gtPubAtivo=dados.effective_status==='ACTIVE';
    // As duas listas são opcionais: null significa "não carregou", e cada
    // seção avisa por si. Não podem impedir o dono de trocar uma cidade.
    [_gtPubSalvos,_gtPubPresets]=await Promise.all([
      _gtListarPublicosSalvos().catch(()=>null),
      _gtListarPresets().catch(()=>null),
    ]);

    const escolha=await _gtPublicoModal(conjunto.nome||'sem nome');
    if(!escolha)return;

    const {targeting,ajustes}=montarTargeting(escolha,dados.targeting);
    const linhas=resumoDasMudancas(_gtPubAntes,escolha);
    const avisos=avisosDe(_gtPubAntes,escolha,{ativo:_gtPubAtivo,ajustes});
    if(!linhas.length){_gtPubStatus('<b>Nada mudou.</b><br>Não há o que salvar.',[{texto:'Fechar',primario:true,aoClicar:_gtPubFechar}]);return;}

    const html='<b>Confirma estas mudanças?</b><ul style="margin:9px 0 0;padding-left:18px;">'
      +linhas.map(l=>'<li>'+_gtEsc(l)+'</li>').join('')+'</ul>'
      +avisos.map(a=>'<div style="margin-top:12px;background:'+(a.bloqueia?'rgba(220,38,38,.10)':'rgba(217,119,6,.12)')+';border:1px solid '+(a.bloqueia?'rgba(220,38,38,.35)':'rgba(217,119,6,.35)')+';border-radius:8px;padding:11px 13px;line-height:1.5;">'+a.texto+'</div>').join('');

    _gtPubStatus(html,[
      {texto:'Cancelar',aoClicar:_gtPubFechar},
      {texto:'Salvar na Meta',primario:true,desabilitado:avisos.some(a=>a.bloqueia),aoClicar:async()=>{
        _gtPubStatus('<b>Salvando…</b>');
        try{
          // targeting vai como OBJETO: o meta-proxy já faz JSON.stringify.
          // Converter aqui converteria duas vezes e a Meta recusaria.
          const enviar=comEspera((caminho,params)=>metaPost(caminho,params,tok));
          await enviar('/'+conjunto.id,{targeting});
          _gtPubStatus('<b>Pronto.</b><br>O público deste conjunto foi atualizado.',
            [{texto:'Fechar',primario:true,aoClicar:()=>{_gtPubFechar();loadGtData();}}]);
        }catch(e){
          _gtPubStatus('<b>A Meta não aceitou.</b><br>'+_gtPubTraduzir(String((e&&e.message)||e))
            +'<br><br>Nada foi alterado no conjunto.',
            [{texto:'Fechar',primario:true,aoClicar:_gtPubFechar}]);
        }
      }},
    ]);
  }catch(e){
    _gtPubStatus('<b>Deu problema inesperado.</b><br>'+_gtEsc(String((e&&e.message)||e).slice(0,180))
      +'<br><br>Se a gravação não chegou a acontecer, nada mudou no conjunto.',
      [{texto:'Fechar',primario:true,aoClicar:_gtPubFechar}]);
  }finally{
    _gtPubBusy=false;
    _gtPubRedesenha=()=>{};   // função vazia, não null — ver a declaração
  }
}

// Mesmo espírito do _gtDupTraduzir, mais o caso que só existe aqui.
function _gtPubTraduzir(msg){
  const m=String(msg||'');
  if(/1870227|advantage/i.test(m))
    return 'A Meta recusou porque o <b>Advantage+ está ligado</b> neste conjunto. Desligue o Advantage+ no editor para que idade, gênero e interesses valham.';
  if(/1487110|radius/i.test(m))
    return 'A Meta recusou o <b>raio</b> de uma das cidades. O mínimo é 17 km (10 milhas).';
  return _gtDupTraduzir(m);
}
```

**Nota para quem implementar:** `_gtDupTraduzir` já existe (veio do duplicar) e
cobre permissão, limite de chamadas e o texto cru da Meta. Reusar, não copiar.

- [ ] **Step 5: Verificar que compila**

Run: `npm run build && npm test 2>&1 | grep -E "^ℹ (tests|pass|fail)"`
Expected: `✓ built`, `fail 0`.

**NÃO rodar `npm run dev` nem salvar num conjunto real.** Gravar mudaria o público de uma campanha do cliente ao vivo. A conferência no navegador é do dono.

- [ ] **Step 6: Commitar**

```bash
git add src/ferramentas/gestao-trafego/tela-de-gestao-trafego.vue
git commit -m "feat(gestor): editor de público do conjunto

Janela própria, não estende o _gtConfirm — aquele é o portão de todas as
ações da tela. Enquanto grava não dá pra fechar clicando fora, e toda saída
é por botão: lições que o duplicar já pagou.

Conflito de Advantage+ com restrição manual desabilita o salvar em vez de
deixar o dono tomar erro da Meta.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: O botão, a documentação e o fechamento

**Files:**
- Modify: `src/ferramentas/gestao-trafego/tela-de-gestao-trafego.vue`
- Modify: `src/ferramentas/gestao-trafego/LEIA-ME.txt`

- [ ] **Step 1: O botão no conjunto**

Em `_renderGtConjuntos` (linha 2284 hoje), junto do botão de duplicar, na **mesma** `.gt-action-row`. A função ganhou o parâmetro `temMensagemCampanha` em 29/07 — **não mexa na assinatura**:

```js
    const bPub=(g.id==='_sem_conjunto'||!hasPermission('meta.gestor','editar'))?null:(()=>{
      const b=document.createElement('button');
      b.className='gt-btn-dup';b.textContent='👥 Público';b.title='Ver e mudar quem vê estes anúncios';
      b.addEventListener('click',ev=>{ev.stopPropagation();_gtAbrirPublico({id:g.id,nome:g.nome});});
      return b;
    })();
```

e acrescentar `bPub` à mesma barra que recebe `bDupCj` (criando a barra se ela ainda não existir, como o duplicar faz). Reusa a classe `.gt-btn-dup` que já existe — **não crie classe nova** para um botão idêntico.

`_sem_conjunto` fica de fora pelo mesmo motivo do duplicar: não é um conjunto de verdade.

- [ ] **Step 2: Documentar no LEIA-ME**

Acrescentar seção seguindo o tom do arquivo (títulos em CAIXA com `====`, português literal, explicando o porquê). Precisa cobrir:
- o que o botão faz e que só aparece para quem tem permissão de editar;
- **que mudar o público de um conjunto rodando reinicia o aprendizado da Meta**, e que a tela avisa isso;
- **que Advantage+ e restrições manuais não convivem** — a Meta recusa (1870227) —, então a tela obriga a escolher;
- que o raio mínimo é 17 km / 10 milhas e o ajuste é avisado;
- que editar o público **não** mexe em onde o anúncio aparece (isso é o C2), e que há um teste garantindo que essa parte não é apagada;
- que dá pra aplicar um público montado no Estúdio, e que isso preenche o editor sem pular a confirmação.

- [ ] **Step 3: Verificação final**

```bash
npm run test:ci    # deve dar fail 0
npm test           # 2 falhas pré-existentes em coletor/gerar-criativos.test.mjs, e só
npm run build      # ✓ built
```

- [ ] **Step 4: Juntar com a main**

```bash
git fetch origin
git log --oneline HEAD..origin/main
git merge origin/main --no-edit
npm run test:ci && npm run build
```

A outra frente trabalha em `ponderada.js`, `veredito.js`, `alvos.js`,
`painel-regua.js` e na aba "A régua". Conflito, se vier, será no
`tela-de-gestao-trafego.vue`. **Nunca `--force`**, nunca descartar o lado dela:
ler os dois lados e manter os dois comportamentos.

- [ ] **Step 5: Parar e chamar o dono**

**NÃO abrir PR nem fazer push sem o dono mandar.** Apresentar: o que foi feito,
testes e build, e que falta a conferência dele no navegador — e que **salvar de
verdade muda o público de uma campanha ao vivo**, então esse teste é dele.

---

## Fora do escopo (registrado, não esquecido)

- **Editar posicionamentos** (onde o anúncio aparece) — é o **C2**, e herda este módulo puro.
- **Criar campanha no Gestor** — **C3**. **Copiar para outra conta** — **C4**. **Trocar público ao duplicar** — **C5**, depende deste.
- **Criar público personalizado novo** pelo Gestor. O Estúdio já faz (`painel-subir.vue:149`); aqui só se escolhe entre os que existem.
- **Salvar o público editado como preset novo** em `fabrica_publicos`. A escrita naquela tabela é só por service-role (Edge `fabrica-publicos`); abrir isso é decisão à parte.
- **Dependência:** este projeto usa `comEspera` de `duplicar.js` (projeto B), que ainda não subiu. Os dois sobem juntos, ou este depois.
