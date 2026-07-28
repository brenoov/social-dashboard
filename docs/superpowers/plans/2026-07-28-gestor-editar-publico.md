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
Expected: PASS — `fail 0`, `npm run test:ci` sobe de 327 para 333 (6 testes novos).

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
Expected: PASS — `fail 0`, `test:ci` sobe para 345 (12 testes novos).

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

- [ ] **Step 4: Rodar e confirmar que passa** — `fail 0`, `test:ci` sobe para 351 (6 testes novos).

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

- [ ] **Step 4: Rodar e confirmar que passa** — `fail 0`, `test:ci` sobe para 359 (8 testes novos).

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

Junto do import de `duplicar.js` (por volta da linha 123):

```js
import { lerPublico, montarTargeting, resumoDasMudancas, avisosDe, PUBLICO_VAZIO } from './publico-alvo.js'
```

- [ ] **Step 2: As três buscas**

Inserir logo antes de `function _gtBotaoDuplicar` (por volta da linha 1096):

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

**Confirme antes de escrever:** que `metaFetchAll` e `sbClient` existem com esses nomes neste arquivo (`grep -n "function metaFetchAll\|sbClient" src/ferramentas/gestao-trafego/tela-de-gestao-trafego.vue`). Se `sbClient` não estiver disponível, use o mesmo caminho que a tela já usa para ler tabela do Supabase — **não invente um cliente novo**.

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
6. Gravar é **uma** chamada: `metaPost('/'+adsetId,{targeting:JSON.stringify(targeting)},tok)`, envolvida em `comEspera`. Não existe "parou no meio".

**Confirme antes de escrever:** se a Meta, neste projeto, aceita `targeting` como objeto ou exige string JSON no corpo. `coletor/subir-estudio.mjs` monta `targeting` dentro do payload do adset — veja como ele o envia e **siga o mesmo caminho já provado**. Se ficar em dúvida, pergunte em vez de chutar.

- [ ] **Step 1: Escrever a janela do editor**

Inserir depois do bloco do duplicar (após `_gtDupTraduzir`). Campos, na ordem:
localização (busca de cidade + raio + exclusões) · idade · gênero · interesses ·
públicos personalizados (incluir / excluir) · chave do Advantage+ · "usar um
público salvo do Estúdio".

Reaproveite o desenho de `src/ferramentas/meta-ads/painel-subir.vue` como
**referência visual** — mesma ordem, mesmos rótulos em português — mas escrito
em DOM imperativo, no estilo deste arquivo. **Não importe aquele componente.**

- [ ] **Step 2: Escrever o orquestrador `_gtAbrirPublico`**

```
1. trava de ocupado; sem conta selecionada → avisa e sai
2. _gtPublicoStatus('Carregando o público…')
3. const dados = await _gtBuscarPublico(conjunto.id)
   — falhou? caixa de erro com botão Fechar, e sai
4. const antes = lerPublico(dados.targeting)
   const ativo = dados.effective_status === 'ACTIVE'
5. públicos salvos (pode vir null) + presets (pode vir null), em paralelo
6. escolha = await _gtPublicoModal({antes, salvos, presets})  — null = cancelou
7. const { targeting, ajustes } = montarTargeting(escolha, dados.targeting)
   const linhas = resumoDasMudancas(antes, escolha)
   const avisos = avisosDe(antes, escolha, { ativo, ajustes })
8. linhas vazio → "Nada mudou." + Fechar, e sai
9. confirmação mostrando linhas + avisos; havendo bloqueia:true, salvar desabilitado
10. grava (comEspera + metaPost), relata, loadGtData()
11. finally: libera a trava
```

- [ ] **Step 3: Verificar que compila**

Run: `npm run build && npm test 2>&1 | grep -E "^ℹ (tests|pass|fail)"`
Expected: `✓ built`, `fail 0`.

**NÃO rodar `npm run dev` nem salvar num conjunto real.** Gravar mudaria o público de uma campanha do cliente ao vivo. A conferência no navegador é do dono.

- [ ] **Step 4: Commitar**

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

Em `_renderGtConjuntos`, junto do botão de duplicar (por volta da linha 1542–1550), na **mesma** `.gt-action-row`:

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
