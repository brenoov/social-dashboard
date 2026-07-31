# Duplicar campanha / conjunto / anúncio — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar ao Gestor de Tráfego um botão "⧉ Duplicar" nos três níveis (campanha, conjunto de anúncios e anúncio), criando sempre cópias PAUSADAS na mesma conta.

**Architecture:** Motor puro em `duplicar.js` que separa PLANEJAR de EXECUTAR. `planoDeCopia()` recebe dados e devolve a lista ordenada de passos; `executarPlano()` percorre os passos chamando uma função `enviar` que é **injetada por fora** (nos testes, uma Meta de mentira; na tela, o `metaPost` que já existe). A cópia é em cascata — campanha vazia, depois conjuntos, depois anúncios — para escapar do teto de 3 anúncios do `deep_copy` da Meta.

**Tech Stack:** JavaScript ES modules (sem TypeScript), Vue 3 (o `.vue` monta a tela via DOM puro, não template reativo), `node:test` + `node:assert/strict`, Meta Graph API via a Edge Function `meta-proxy`.

**Spec:** `docs/superpowers/specs/2026-07-28-gestor-duplicar-design.md`

## Global Constraints

Valem para TODAS as tarefas abaixo.

- **`status_option: 'PAUSED'` explícito em toda chamada de cópia.** Nunca confiar no padrão da Meta.
- **`deep_copy: false` explícito** nos níveis campanha e conjunto. A cascata é nossa, não da Meta.
- **Não modificar `_gtConfirm`.** É o portão compartilhado de todas as ações da tela, marcado no código como "Preservado intacto/verbatim". A janela do duplicar é função nova e separada.
- **Permissão:** o botão só é desenhado se `hasPermission('meta.gestor', 'editar')` for verdadeiro.
- **Texto de tela em português literal, sem jargão.** Quem lê é o dono do negócio, não um programador. Nada de "adset", "payload", "endpoint" na interface — use "conjunto de anúncios", "cópia", "passo".
- **Testes** ficam em `<nome>.test.mjs` ao lado do módulo, usando `import { test } from 'node:test'` e `import assert from 'node:assert/strict'`, no mesmo estilo de `alvos.test.mjs`.
- **Nenhum teste toca em conta real.** A função `enviar` é sempre de mentira nos testes.
- **Nada é apagado automaticamente.** Falhou no meio, relata e para. Nunca "limpar" criando ou removendo por conta própria.
- **Rodar o conjunto todo** com `npm test` antes de cada commit.
- **Mensagens de commit em português**, escopo `(gestor)`, terminando com:
  `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`

## Fatos da Meta que o código depende (verificados na documentação)

- `POST /{campaign_id}/copies` devolve `{ copied_campaign_id, ad_object_ids: [...] }`
- `POST /{adset_id}/copies` devolve `{ copied_adset_id, ... }` e aceita `campaign_id` para reparentar
- `POST /{ad_id}/copies` devolve `{ copied_ad_id }` e aceita `adset_id` para reparentar
- **A Meta NÃO devolve um campo `id`.** Cada nível usa o próprio nome. Chutar `id` quebra a cascata no primeiro passo.
- `rename_options` é um objeto JSON com `rename_strategy` (`DEEP_RENAME` | `ONLY_TOP_LEVEL_RENAME` | `NO_RENAME`), `rename_prefix` e `rename_suffix`.

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `src/ferramentas/gestao-trafego/duplicar.js` (criar) | Motor puro: monta o plano e executa passo a passo. Sem DOM, sem rede, sem imports da tela. |
| `src/ferramentas/gestao-trafego/duplicar.test.mjs` (criar) | Testes do motor, com Meta de mentira. |
| `src/ferramentas/gestao-trafego/tela-de-gestao-trafego.vue` (modificar) | Janela do duplicar, botões nos três níveis e ligação com `metaPost`. |
| `src/ferramentas/gestao-trafego/LEIA-ME.txt` (modificar) | Documentar o duplicar para o dono. |

---

### Task 1: `planoDeCopia` — planejar a cascata

**Files:**
- Create: `src/ferramentas/gestao-trafego/duplicar.js`
- Test: `src/ferramentas/gestao-trafego/duplicar.test.mjs`

**Interfaces:**
- Consumes: nada (primeira tarefa).
- Produces:
  - `SUFIXO_PADRAO: string` — `'· cópia'`
  - `planoDeCopia(alvo, opts) -> Passo[]`
    - `alvo`: `{ nivel: 'campanha'|'conjunto'|'anuncio', campanha?: {id,name}, conjuntos?: [{id,name}], anuncios?: [{id,name,adset_id}] }`
    - `opts`: `{ quantidade?: number (1..5), sufixo?: string }`
    - `Passo`: `{ id: string, nivel: string, origemId: string, origemNome: string, copia: number, paiPasso: string|null, paiCampo: 'campaign_id'|'adset_id'|null, params: object }`

- [ ] **Step 1: Escrever os testes que falham**

Criar `src/ferramentas/gestao-trafego/duplicar.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planoDeCopia, SUFIXO_PADRAO } from './duplicar.js';

const CAMPANHA = { id: '100', name: 'Bolsas · Tivoli · Vendas' };
const CONJUNTOS = [{ id: '200', name: 'Tivoli · Vendas' }, { id: '201', name: 'Tivoli · Remarketing' }];
const ANUNCIOS = [
  { id: '300', name: 'Anúncio A', adset_id: '200' },
  { id: '301', name: 'Anúncio B', adset_id: '200' },
  { id: '302', name: 'Anúncio C', adset_id: '201' },
];

test('campanha: o plano sai na ordem campanha -> conjuntos -> anuncios', () => {
  const plano = planoDeCopia({ nivel: 'campanha', campanha: CAMPANHA, conjuntos: CONJUNTOS, anuncios: ANUNCIOS });
  assert.deepEqual(plano.map(p => p.nivel), [
    'campanha', 'conjunto', 'anuncio', 'anuncio', 'conjunto', 'anuncio',
  ]);
  assert.equal(plano.length, 6, 'campanha + 2 conjuntos + 3 anuncios');
});

test('cada filho aponta para o PASSO do pai, nao para o id de origem', () => {
  const plano = planoDeCopia({ nivel: 'campanha', campanha: CAMPANHA, conjuntos: CONJUNTOS, anuncios: ANUNCIOS });
  const campanha = plano[0];
  const conjunto = plano.find(p => p.nivel === 'conjunto' && p.origemId === '200');
  const anuncio = plano.find(p => p.nivel === 'anuncio' && p.origemId === '300');
  assert.equal(campanha.paiPasso, null);
  assert.equal(conjunto.paiPasso, campanha.id);
  assert.equal(conjunto.paiCampo, 'campaign_id');
  assert.equal(anuncio.paiPasso, conjunto.id);
  assert.equal(anuncio.paiCampo, 'adset_id');
});

test('TODO passo manda status_option PAUSED — nenhuma copia nasce gastando', () => {
  const alvos = [
    { nivel: 'campanha', campanha: CAMPANHA, conjuntos: CONJUNTOS, anuncios: ANUNCIOS },
    { nivel: 'conjunto', conjuntos: [CONJUNTOS[0]], anuncios: ANUNCIOS.filter(a => a.adset_id === '200') },
    { nivel: 'anuncio', anuncios: [ANUNCIOS[0]] },
  ];
  for (const alvo of alvos) {
    const plano = planoDeCopia(alvo, { quantidade: 3 });
    assert.ok(plano.length > 0, 'plano vazio em ' + alvo.nivel);
    for (const p of plano) assert.equal(p.params.status_option, 'PAUSED', p.id + ' sem PAUSED');
  }
});

test('campanha e conjunto mandam deep_copy false — a cascata e nossa, nao da Meta', () => {
  const plano = planoDeCopia({ nivel: 'campanha', campanha: CAMPANHA, conjuntos: CONJUNTOS, anuncios: ANUNCIOS });
  for (const p of plano.filter(x => x.nivel !== 'anuncio')) assert.equal(p.params.deep_copy, false);
});

test('so o objeto duplicado e renomeado; os filhos mantem o nome', () => {
  const plano = planoDeCopia({ nivel: 'campanha', campanha: CAMPANHA, conjuntos: CONJUNTOS, anuncios: ANUNCIOS });
  const renomeia = JSON.parse(plano[0].params.rename_options);
  assert.equal(renomeia.rename_strategy, 'ONLY_TOP_LEVEL_RENAME');
  assert.ok(renomeia.rename_suffix.includes(SUFIXO_PADRAO));
  for (const p of plano.slice(1)) assert.equal(p.params.rename_options, undefined, p.id + ' nao devia renomear');
});

test('varias copias geram sufixos distintos e passos com ids distintos', () => {
  const plano = planoDeCopia({ nivel: 'anuncio', anuncios: [ANUNCIOS[0]] }, { quantidade: 3 });
  assert.equal(plano.length, 3);
  const sufixos = plano.map(p => JSON.parse(p.params.rename_options).rename_suffix);
  assert.equal(new Set(sufixos).size, 3, 'sufixos repetidos criariam nomes iguais');
  assert.equal(new Set(plano.map(p => p.id)).size, 3, 'ids de passo repetidos quebram a cascata');
});

test('quantidade e presa entre 1 e 5, mesmo recebendo lixo', () => {
  const alvo = { nivel: 'anuncio', anuncios: [ANUNCIOS[0]] };
  assert.equal(planoDeCopia(alvo, { quantidade: 0 }).length, 1);
  assert.equal(planoDeCopia(alvo, { quantidade: 99 }).length, 5);
  assert.equal(planoDeCopia(alvo, { quantidade: 'abc' }).length, 1);
  assert.equal(planoDeCopia(alvo).length, 1);
});

test('faltando dado, devolve plano vazio em vez de quebrar', () => {
  assert.deepEqual(planoDeCopia({ nivel: 'inventado', campanha: CAMPANHA }), []);
  assert.deepEqual(planoDeCopia({ nivel: 'campanha' }), []);
  assert.deepEqual(planoDeCopia({ nivel: 'conjunto', conjuntos: [] }), []);
  assert.deepEqual(planoDeCopia(null), []);
  assert.deepEqual(planoDeCopia(undefined), []);
});

test('campanha sem conjunto e conjunto sem anuncio copiam so o que existe', () => {
  const soCamp = planoDeCopia({ nivel: 'campanha', campanha: CAMPANHA, conjuntos: [], anuncios: [] });
  assert.deepEqual(soCamp.map(p => p.nivel), ['campanha']);
  const soConj = planoDeCopia({ nivel: 'conjunto', conjuntos: [CONJUNTOS[0]], anuncios: [] });
  assert.deepEqual(soConj.map(p => p.nivel), ['conjunto']);
});

test('anuncio orfao (adset_id que nao esta na lista) nao entra no plano', () => {
  const plano = planoDeCopia({
    nivel: 'campanha', campanha: CAMPANHA, conjuntos: [CONJUNTOS[0]],
    anuncios: [...ANUNCIOS, { id: '999', name: 'Órfão', adset_id: '777' }],
  });
  assert.ok(!plano.some(p => p.origemId === '999'), 'anuncio sem pai no plano ficaria sem adset_id');
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test 2>&1 | grep -E "duplicar|^ℹ (tests|pass|fail)"`
Expected: FAIL — `Cannot find module './duplicar.js'`

- [ ] **Step 3: Escrever a implementação mínima**

Criar `src/ferramentas/gestao-trafego/duplicar.js`:

```js
// Duplicar campanha / conjunto de anúncios / anúncio no Meta.
//
// MÓDULO PURO: sem tela, sem rede. Só monta o plano e executa passo a passo
// chamando uma função `enviar` que quem usa entrega por fora. É isso que
// permite testar a cópia inteira — inclusive a falha no meio — sem nunca
// encostar numa conta de anúncios de verdade.
//
// POR QUE EM CASCATA (e não deep_copy=true): o `deep_copy` da Meta copia os
// filhos de uma vez, mas trava em 3 anúncios por chamada — justamente a
// campanha grande que o dono mais quer duplicar. Aqui a cópia é feita nível
// por nível: campanha vazia -> cada conjunto pra dentro dela -> cada anúncio
// pro conjunto novo. Sem teto, com progresso visível, e falha identificável.

export const SUFIXO_PADRAO = '· cópia';
const NIVEIS = ['campanha', 'conjunto', 'anuncio'];

// A Meta NÃO devolve um campo `id` na cópia — cada nível devolve o seu nome.
// Chutar `id` quebraria a cascata logo no primeiro passo.
const CAMPO_ID_NOVO = {
  campanha: 'copied_campaign_id',
  conjunto: 'copied_adset_id',
  anuncio: 'copied_ad_id',
};

function paramsDe(nivel, sufixo) {
  const params = { status_option: 'PAUSED' };
  // Explícito de propósito: o padrão da Meta hoje é PAUSED e deep_copy false,
  // mas padrão de terceiro muda sem avisar. O que protege a conta do dono vai
  // escrito na chamada.
  if (nivel !== 'anuncio') params.deep_copy = false;
  if (sufixo) {
    params.rename_options = JSON.stringify({
      rename_strategy: 'ONLY_TOP_LEVEL_RENAME',
      rename_suffix: ' ' + sufixo,
    });
  }
  return params;
}

function passo(id, nivel, origem, sufixo, paiPasso, paiCampo, copia) {
  return {
    id,
    nivel,
    origemId: String(origem.id),
    origemNome: origem.name || origem.nome || '(sem nome)',
    copia,
    paiPasso: paiPasso || null,
    paiCampo: paiCampo || null,
    params: paramsDe(nivel, sufixo),
  };
}

function limitarQuantidade(valor) {
  const n = Math.floor(Number(valor));
  if (!Number.isFinite(n)) return 1;
  return Math.min(Math.max(n, 1), 5);
}

// Monta a lista ordenada de passos. Não executa nada: recebe dados, devolve
// dados. Só o objeto que o dono mandou duplicar leva sufixo no nome — repetir
// "· cópia" em cada conjunto e anúncio dentro de uma campanha já renomeada só
// sujaria a lista.
export function planoDeCopia(alvo, opts = {}) {
  const nivel = alvo && alvo.nivel;
  if (!NIVEIS.includes(nivel)) return [];

  const campanha = alvo.campanha || null;
  const conjuntos = alvo.conjuntos || [];
  const anuncios = alvo.anuncios || [];
  const quantidade = limitarQuantidade(opts.quantidade);
  const base = String(opts.sufixo == null ? SUFIXO_PADRAO : opts.sufixo).trim() || SUFIXO_PADRAO;

  if (nivel === 'campanha' && !campanha) return [];
  if (nivel === 'conjunto' && !conjuntos.length) return [];
  if (nivel === 'anuncio' && !anuncios.length) return [];

  const passos = [];
  for (let c = 1; c <= quantidade; c++) {
    const sufixo = quantidade > 1 ? base + ' ' + c : base;

    if (nivel === 'campanha') {
      const raiz = 'c' + c + ':camp';
      passos.push(passo(raiz, 'campanha', campanha, sufixo, null, null, c));
      for (const cj of conjuntos) {
        const idCj = 'c' + c + ':cj:' + cj.id;
        passos.push(passo(idCj, 'conjunto', cj, null, raiz, 'campaign_id', c));
        for (const ad of anuncios.filter(a => String(a.adset_id) === String(cj.id))) {
          passos.push(passo('c' + c + ':ad:' + ad.id, 'anuncio', ad, null, idCj, 'adset_id', c));
        }
      }
    } else if (nivel === 'conjunto') {
      const cj = conjuntos[0];
      const raiz = 'c' + c + ':cj';
      passos.push(passo(raiz, 'conjunto', cj, sufixo, null, null, c));
      for (const ad of anuncios) {
        passos.push(passo('c' + c + ':ad:' + ad.id, 'anuncio', ad, null, raiz, 'adset_id', c));
      }
    } else {
      passos.push(passo('c' + c + ':ad', 'anuncio', anuncios[0], sufixo, null, null, c));
    }
  }
  return passos;
}
```

`CAMPO_ID_NOVO` fica sem `export` de propósito: quem usa o módulo nunca
precisa dele, só a `executarPlano` da Task 2 usa, e ela mora no mesmo arquivo.

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm test 2>&1 | grep -E "^ℹ (tests|pass|fail)"`
Expected: PASS — `fail 0`, e o total sobe de 300 para 310.

- [ ] **Step 5: Commitar**

```bash
git add src/ferramentas/gestao-trafego/duplicar.js src/ferramentas/gestao-trafego/duplicar.test.mjs
git commit -m "feat(gestor): plano de cópia em cascata (campanha → conjuntos → anúncios)

Módulo puro que monta a lista de passos sem executar nada. Cascata em vez
de deep_copy porque o deep_copy da Meta trava em 3 anúncios por chamada.

PAUSED e deep_copy:false vão explícitos em todo passo — padrão de terceiro
muda sem avisar, e o que protege a conta do dono vai escrito na chamada.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: `executarPlano` — executar com a Meta injetada

**Files:**
- Modify: `src/ferramentas/gestao-trafego/duplicar.js`
- Test: `src/ferramentas/gestao-trafego/duplicar.test.mjs`

**Interfaces:**
- Consumes: `planoDeCopia`, `CAMPO_ID_NOVO` (Task 1).
- Produces:
  - `executarPlano(plano, { enviar, aoProgredir, feitos }) -> Promise<Relatorio>`
    - `enviar(caminho: string, params: object) -> Promise<object>` — quem fala com a Meta
    - `aoProgredir({ passo, novoId, feitos, total })` — opcional
    - `feitos`: `{ [idDoPasso]: idNovo }` — usado na Task 3
    - `Relatorio`: `{ criados: {[idPasso]: idNovo}, concluidos: string[], falhou: { passo, motivo } | null }`

- [ ] **Step 1: Escrever os testes que falham**

Acrescentar ao fim de `duplicar.test.mjs`:

```js
import { executarPlano } from './duplicar.js';

// Meta de mentira: registra as chamadas e devolve o campo certo por nível.
function metaFalsa({ falharNo } = {}) {
  const chamadas = [];
  let n = 0;
  const enviar = async (caminho, params) => {
    chamadas.push({ caminho, params });
    if (falharNo && caminho === falharNo) throw new Error('A Meta recusou.');
    n += 1;
    if (params.deep_copy === false && params.campaign_id) return { copied_adset_id: 'novo-cj-' + n };
    if (params.deep_copy === false) return { copied_campaign_id: 'novo-camp-' + n };
    return { copied_ad_id: 'novo-ad-' + n };
  };
  return { enviar, chamadas };
}

const ALVO_CAMPANHA = { nivel: 'campanha', campanha: CAMPANHA, conjuntos: CONJUNTOS, anuncios: ANUNCIOS };

test('executa todos os passos e devolve o id novo de cada um', async () => {
  const meta = metaFalsa();
  const plano = planoDeCopia(ALVO_CAMPANHA);
  const rel = await executarPlano(plano, { enviar: meta.enviar });
  assert.equal(rel.falhou, null);
  assert.equal(rel.concluidos.length, 6);
  assert.equal(Object.keys(rel.criados).length, 6);
});

test('cada chamada vai para /{id de origem}/copies', async () => {
  const meta = metaFalsa();
  await executarPlano(planoDeCopia(ALVO_CAMPANHA), { enviar: meta.enviar });
  assert.equal(meta.chamadas[0].caminho, '/100/copies');
  assert.ok(meta.chamadas.some(c => c.caminho === '/200/copies'));
  assert.ok(meta.chamadas.some(c => c.caminho === '/300/copies'));
});

test('o filho recebe o id NOVO do pai, nao o id de origem', async () => {
  const meta = metaFalsa();
  const rel = await executarPlano(planoDeCopia(ALVO_CAMPANHA), { enviar: meta.enviar });
  const idCampNova = rel.criados['c1:camp'];
  const chamadaConjunto = meta.chamadas.find(c => c.caminho === '/200/copies');
  assert.equal(chamadaConjunto.params.campaign_id, idCampNova);
  const idConjNovo = rel.criados['c1:cj:200'];
  const chamadaAnuncio = meta.chamadas.find(c => c.caminho === '/300/copies');
  assert.equal(chamadaAnuncio.params.adset_id, idConjNovo);
});

test('falha no meio para ali, relata o que deu certo e nao tenta o resto', async () => {
  const meta = metaFalsa({ falharNo: '/301/copies' });
  const plano = planoDeCopia(ALVO_CAMPANHA);
  const rel = await executarPlano(plano, { enviar: meta.enviar });
  assert.ok(rel.falhou, 'devia ter falhado');
  assert.equal(rel.falhou.passo.origemId, '301');
  assert.match(rel.falhou.motivo, /recusou/);
  assert.equal(rel.concluidos.length, 3, 'campanha + conjunto 200 + anuncio 300');
  assert.ok(!meta.chamadas.some(c => c.caminho === '/302/copies'), 'nao devia seguir apos falhar');
});

test('resposta sem o id da copia e tratada como falha, nao como sucesso', async () => {
  const rel = await executarPlano(planoDeCopia({ nivel: 'anuncio', anuncios: [ANUNCIOS[0]] }), {
    enviar: async () => ({}),
  });
  assert.ok(rel.falhou);
  assert.match(rel.falhou.motivo, /não devolveu/i);
});

test('avisa o progresso a cada passo, com a conta certa', async () => {
  const meta = metaFalsa();
  const vistos = [];
  await executarPlano(planoDeCopia(ALVO_CAMPANHA), {
    enviar: meta.enviar,
    aoProgredir: (p) => vistos.push(p.feitos + '/' + p.total),
  });
  assert.deepEqual(vistos, ['1/6', '2/6', '3/6', '4/6', '5/6', '6/6']);
});

test('plano vazio nao chama a Meta nenhuma vez', async () => {
  const meta = metaFalsa();
  const rel = await executarPlano([], { enviar: meta.enviar });
  assert.equal(meta.chamadas.length, 0);
  assert.equal(rel.falhou, null);
  assert.deepEqual(rel.concluidos, []);
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test 2>&1 | grep -E "^ℹ (tests|pass|fail)"`
Expected: FAIL — `executarPlano is not a function`

- [ ] **Step 3: Escrever a implementação**

Acrescentar ao fim de `duplicar.js`:

```js
function idNovoDaResposta(nivel, resposta) {
  const campo = CAMPO_ID_NOVO[nivel];
  const valor = resposta && (resposta[campo] != null ? resposta[campo] : null);
  return valor == null ? null : String(valor);
}

// Percorre o plano chamando `enviar` passo a passo. `enviar` é injetada de
// fora: nos testes é uma Meta de mentira, na tela é o metaPost que já existe.
//
// FALHOU NO MEIO: para ali e devolve o relatório. NÃO desfaz nada — apagar
// campanha por conta própria pra "limpar" é pior que o problema: um engano
// apaga o objeto errado. Tudo que ficou está PAUSADO, então nada gasta.
export async function executarPlano(plano, opts = {}) {
  const { enviar, aoProgredir, feitos } = opts;
  const criados = Object.assign({}, feitos || {});
  const relatorio = { criados, concluidos: [], falhou: null };
  const passos = plano || [];

  for (const p of passos) {
    // Retomada: passo já concluído numa tentativa anterior não é refeito.
    if (criados[p.id]) { relatorio.concluidos.push(p.id); continue; }

    const params = Object.assign({}, p.params);
    if (p.paiPasso) {
      const idPai = criados[p.paiPasso];
      if (!idPai) {
        relatorio.falhou = { passo: p, motivo: 'O item onde esta cópia deveria entrar não foi criado.' };
        return relatorio;
      }
      params[p.paiCampo] = idPai;
    }

    try {
      const resposta = await enviar('/' + p.origemId + '/copies', params);
      const novoId = idNovoDaResposta(p.nivel, resposta);
      if (!novoId) throw new Error('A Meta não devolveu o número da cópia.');
      criados[p.id] = novoId;
      relatorio.concluidos.push(p.id);
      if (aoProgredir) {
        aoProgredir({ passo: p, novoId, feitos: relatorio.concluidos.length, total: passos.length });
      }
    } catch (e) {
      relatorio.falhou = { passo: p, motivo: String((e && e.message) || e) };
      return relatorio;
    }
  }
  return relatorio;
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm test 2>&1 | grep -E "^ℹ (tests|pass|fail)"`
Expected: PASS — `fail 0`, total sobe para 317.

- [ ] **Step 5: Commitar**

```bash
git add src/ferramentas/gestao-trafego/duplicar.js src/ferramentas/gestao-trafego/duplicar.test.mjs
git commit -m "feat(gestor): executar o plano de cópia com a Meta injetada por fora

A função que fala com a Meta entra por parâmetro — nos testes é de mentira,
na tela é o metaPost que já existe. Assim a cópia inteira, inclusive a falha
no meio, é testada sem encostar em conta real.

Cada nível lê o campo de id que a Meta realmente devolve (copied_campaign_id,
copied_adset_id, copied_ad_id) — não existe campo 'id' na resposta. Resposta
sem o id vira falha, não sucesso silencioso.

Falha no meio para e relata. Nada é desfeito: apagar por conta própria pra
limpar arrisca apagar o objeto errado, e o que ficou está pausado.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Esperar e tentar de novo quando a Meta pedir calma

**Files:**
- Modify: `src/ferramentas/gestao-trafego/duplicar.js`
- Test: `src/ferramentas/gestao-trafego/duplicar.test.mjs`

**Interfaces:**
- Consumes: nada das tarefas anteriores (envolve a função `enviar` por fora).
- Produces:
  - `ehPedidoDeCalma(erro) -> boolean`
  - `comEspera(enviar, { tentativas?, esperar?, baseMs? }) -> enviar` — devolve
    uma `enviar` que repete sozinha quando a Meta reclama de excesso de chamadas.

**Por que existe:** copiar uma campanha com 7 anúncios são 9 chamadas
seguidas à Meta. Bater no limite de chamadas não é exceção rara, é o caso
normal — e fazer o dono clicar "tentar continuar" por causa disso seria
transferir pra ele um problema que o código resolve sozinho. Só o limite de
chamadas é repetido: erro de permissão repetido 4 vezes continua sendo erro
de permissão, e insistir só demora mais pra dar a má notícia.

- [ ] **Step 1: Escrever os testes que falham**

Acrescentar a `duplicar.test.mjs` (incluir `comEspera` e `ehPedidoDeCalma` no import de `./duplicar.js`):

```js
test('reconhece o pedido de calma da Meta e ignora os outros erros', () => {
  assert.equal(ehPedidoDeCalma(new Error('(#17) User request limit reached')), true);
  assert.equal(ehPedidoDeCalma(new Error('(#4) Too many calls')), true);
  assert.equal(ehPedidoDeCalma(new Error('please reduce the amount of data')), true);
  assert.equal(ehPedidoDeCalma(new Error('(#200) Permissions error')), false);
  assert.equal(ehPedidoDeCalma(new Error('qualquer outra coisa')), false);
  assert.equal(ehPedidoDeCalma(null), false);
});

test('repete no limite de chamadas e devolve o sucesso da tentativa seguinte', async () => {
  let n = 0;
  const esperas = [];
  const enviar = comEspera(async () => {
    n += 1;
    if (n < 3) throw new Error('(#17) User request limit reached');
    return { copied_ad_id: 'ok' };
  }, { esperar: async (ms) => { esperas.push(ms); } });

  const r = await enviar('/1/copies', {});
  assert.deepEqual(r, { copied_ad_id: 'ok' });
  assert.equal(n, 3, 'devia ter tentado 3 vezes');
  assert.deepEqual(esperas, [2000, 4000], 'a espera precisa crescer entre as tentativas');
});

test('NAO repete erro que nao e de limite — nao adianta insistir em permissao', async () => {
  let n = 0;
  const enviar = comEspera(async () => { n += 1; throw new Error('(#200) Permissions error'); },
    { esperar: async () => {} });
  await assert.rejects(() => enviar('/1/copies', {}), /Permissions/);
  assert.equal(n, 1, 'insistir so demoraria pra dar a ma noticia');
});

test('desiste depois das tentativas e propaga o erro da Meta', async () => {
  let n = 0;
  const enviar = comEspera(async () => { n += 1; throw new Error('(#17) User request limit reached'); },
    { tentativas: 3, esperar: async () => {} });
  await assert.rejects(() => enviar('/1/copies', {}), /#17/);
  assert.equal(n, 3);
});

test('a espera envolvida continua repassando caminho e parametros intactos', async () => {
  const vistas = [];
  const enviar = comEspera(async (caminho, params) => { vistas.push({ caminho, params }); return { copied_ad_id: '1' }; },
    { esperar: async () => {} });
  await enviar('/300/copies', { status_option: 'PAUSED', adset_id: '9' });
  assert.deepEqual(vistas, [{ caminho: '/300/copies', params: { status_option: 'PAUSED', adset_id: '9' } }]);
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test 2>&1 | grep -E "^ℹ (tests|pass|fail)"`
Expected: FAIL — `comEspera is not a function`

- [ ] **Step 3: Escrever a implementação**

Acrescentar ao fim de `duplicar.js`:

```js
// A Meta reclamou de excesso de chamadas? Copiar uma campanha com 7 anúncios
// são 9 chamadas seguidas — bater no limite é o caso normal, não a exceção.
export function ehPedidoDeCalma(erro) {
  const m = String((erro && erro.message) || erro || '');
  return /\(#17\)|\(#4\)|\(#80004\)|rate limit|too many calls|request limit reached|reduce the amount/i.test(m);
}

// Envolve a função que fala com a Meta para ela mesma esperar e repetir
// quando levar pedido de calma. `esperar` entra por fora para que os testes
// não durmam de verdade.
//
// SÓ o limite de chamadas é repetido. Erro de permissão repetido 4 vezes
// continua sendo erro de permissão — insistir só demora pra dar a má notícia.
export function comEspera(enviar, opts = {}) {
  const tentativas = opts.tentativas || 4;
  const baseMs = opts.baseMs || 2000;
  const esperar = opts.esperar || ((ms) => new Promise((r) => setTimeout(r, ms)));
  return async function (caminho, params) {
    for (let i = 0; i < tentativas; i++) {
      try {
        return await enviar(caminho, params);
      } catch (e) {
        if (!ehPedidoDeCalma(e) || i === tentativas - 1) throw e;
        await esperar(baseMs * Math.pow(2, i));
      }
    }
  };
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm test 2>&1 | grep -E "^ℹ (tests|pass|fail)"`
Expected: PASS — `fail 0`, total sobe para 322.

- [ ] **Step 5: Commitar**

```bash
git add src/ferramentas/gestao-trafego/duplicar.js src/ferramentas/gestao-trafego/duplicar.test.mjs
git commit -m "feat(gestor): esperar e repetir quando a Meta pedir calma

Copiar uma campanha com 7 anúncios são 9 chamadas seguidas — bater no limite
de chamadas é o caso normal, não exceção. Repetir sozinho evita transferir
pro dono um problema que o código resolve.

Só o limite é repetido: erro de permissão repetido 4 vezes continua sendo
erro de permissão. A espera entra por parâmetro pra os testes não dormirem.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Continuar de onde parou

**Files:**
- Modify: `src/ferramentas/gestao-trafego/duplicar.js`
- Test: `src/ferramentas/gestao-trafego/duplicar.test.mjs`

**Interfaces:**
- Consumes: `executarPlano`, `Relatorio` (Task 2).
- Produces: `retomar(plano, relatorioAnterior, { enviar, aoProgredir }) -> Promise<Relatorio>`

- [ ] **Step 1: Escrever os testes que falham**

Acrescentar a `duplicar.test.mjs` (ajustar o import de `./duplicar.js` para incluir `retomar`):

```js
test('retomar refaz so o que faltou, sem recriar o que ja existe', async () => {
  const plano = planoDeCopia(ALVO_CAMPANHA);
  const primeira = metaFalsa({ falharNo: '/301/copies' });
  const rel1 = await executarPlano(plano, { enviar: primeira.enviar });
  assert.equal(rel1.concluidos.length, 3);

  const segunda = metaFalsa();
  const rel2 = await retomar(plano, rel1, { enviar: segunda.enviar });
  assert.equal(rel2.falhou, null);
  assert.equal(rel2.concluidos.length, 6, 'o relatorio final cobre o plano inteiro');
  const refeitos = segunda.chamadas.map(c => c.caminho);
  assert.ok(!refeitos.includes('/100/copies'), 'a campanha ja existia, nao podia ser recriada');
  assert.ok(!refeitos.includes('/200/copies'), 'o conjunto ja existia');
  assert.ok(refeitos.includes('/301/copies'), 'o passo que falhou precisa ser refeito');
});

test('retomar mantem os ids ja criados no relatorio final', async () => {
  const plano = planoDeCopia(ALVO_CAMPANHA);
  const rel1 = await executarPlano(plano, { enviar: metaFalsa({ falharNo: '/301/copies' }).enviar });
  const idCampOriginal = rel1.criados['c1:camp'];
  const rel2 = await retomar(plano, rel1, { enviar: metaFalsa().enviar });
  assert.equal(rel2.criados['c1:camp'], idCampOriginal, 'nao pode trocar o id do que ja existe');
});

test('retomar sem relatorio anterior e o mesmo que executar do zero', async () => {
  const meta = metaFalsa();
  const plano = planoDeCopia({ nivel: 'anuncio', anuncios: [ANUNCIOS[0]] });
  const rel = await retomar(plano, null, { enviar: meta.enviar });
  assert.equal(rel.concluidos.length, 1);
  assert.equal(meta.chamadas.length, 1);
});

test('retomar um plano ja completo nao chama a Meta', async () => {
  const plano = planoDeCopia({ nivel: 'anuncio', anuncios: [ANUNCIOS[0]] });
  const rel1 = await executarPlano(plano, { enviar: metaFalsa().enviar });
  const meta = metaFalsa();
  const rel2 = await retomar(plano, rel1, { enviar: meta.enviar });
  assert.equal(meta.chamadas.length, 0);
  assert.equal(rel2.falhou, null);
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test 2>&1 | grep -E "^ℹ (tests|pass|fail)"`
Expected: FAIL — `retomar is not a function`

- [ ] **Step 3: Escrever a implementação**

Acrescentar ao fim de `duplicar.js`:

```js
// Continuar de onde parou. Reaproveita os ids que o relatório anterior já
// guardou: os passos concluídos são pulados e os filhos apontam pros pais
// que já existem.
//
// De propósito NÃO sai varrendo a conta pra "descobrir" o que já está lá:
// adivinhar pelo nome é exatamente como se criam duplicatas indesejadas.
// A única fonte de verdade é o relatório da tentativa anterior.
export function retomar(plano, relatorioAnterior, opts = {}) {
  const feitos = (relatorioAnterior && relatorioAnterior.criados) || {};
  return executarPlano(plano, Object.assign({}, opts, { feitos }));
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm test 2>&1 | grep -E "^ℹ (tests|pass|fail)"`
Expected: PASS — `fail 0`, total sobe para 326.

- [ ] **Step 5: Commitar**

```bash
git add src/ferramentas/gestao-trafego/duplicar.js src/ferramentas/gestao-trafego/duplicar.test.mjs
git commit -m "feat(gestor): continuar a cópia de onde parou

Usa os ids do relatório da tentativa anterior: pula o que já foi criado e
liga os filhos aos pais que já existem.

Não varre a conta pra adivinhar o que já está lá — adivinhar pelo nome é
como se criam duplicatas indesejadas.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: A janela de duplicar na tela

**Files:**
- Modify: `src/ferramentas/gestao-trafego/tela-de-gestao-trafego.vue`

**Interfaces:**
- Consumes: `planoDeCopia`, `executarPlano`, `comEspera`, `retomar`, `SUFIXO_PADRAO` (Tasks 1–4); `metaPost`, `_gtConfirm`, `_gtEsc`, `_gtCurAcc`, `loadGtData` (já existem no arquivo).
- Produces: `_gtAbrirDuplicar(alvo)` — abre a janela, executa e relata.

**Por que não reusar `_gtConfirm`:** ele só devolve sim/não, não tem campo de formulário, e o comentário no código o marca como o portão preservado de TODAS as ações. A janela do duplicar é função nova, com o mesmo visual, para não mexer nesse portão compartilhado.

- [ ] **Step 1: Importar o motor**

Ao lado do import que já existe de `orcamento-hierarquia.js` (procure a linha `import { orcamentoDe, detectarNivelOrcamento,`), acrescentar:

```js
import { planoDeCopia, executarPlano, comEspera, retomar, SUFIXO_PADRAO } from './duplicar.js'
```

- [ ] **Step 2: Escrever a janela**

Inserir logo APÓS a função `_gtConfirm` (que termina com `});\n}` por volta da linha 1565), sem tocar nela:

```js
// Janela do DUPLICAR. Não usa _gtConfirm porque aquele modal só devolve
// sim/não — aqui precisamos de quantas cópias e do sufixo do nome. Mesmo
// visual, função separada, para não mexer no portão compartilhado de todas
// as outras ações.
function _gtDuplicarModal(resumo){
  return new Promise(resolve=>{
    let ov=document.getElementById('gt-dup-ov');
    if(!ov){ov=document.createElement('div');ov.id='gt-dup-ov';ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;';document.body.appendChild(ov);}
    ov.innerHTML='';ov.style.display='flex';
    const box=document.createElement('div');
    box.style.cssText='background:var(--surface,#fff);color:var(--text,#111);border-radius:14px;max-width:440px;width:100%;padding:24px;box-shadow:0 24px 60px rgba(0,0,0,.45);font-family:var(--fonte-principal);';
    box.innerHTML=
      '<div style="font-size:calc(16px*var(--gt-fs,1.3));font-weight:800;margin-bottom:9px;">Duplicar</div>'+
      '<div style="font-size:calc(13px*var(--gt-fs,1.3));color:var(--muted,#666);line-height:1.55;margin-bottom:16px;">'+resumo+'</div>'+
      '<label style="display:block;font-size:calc(12px*var(--gt-fs,1.3));font-weight:700;margin-bottom:5px;">Quantas cópias</label>'+
      '<select data-dup-qtd style="width:100%;padding:9px;border-radius:8px;border:1px solid var(--border,#ddd);background:var(--surface,#fff);color:var(--text,#111);font-size:calc(13px*var(--gt-fs,1.3));margin-bottom:14px;">'+
        [1,2,3,4,5].map(n=>'<option value="'+n+'">'+n+(n===1?' cópia':' cópias')+'</option>').join('')+
      '</select>'+
      '<label style="display:block;font-size:calc(12px*var(--gt-fs,1.3));font-weight:700;margin-bottom:5px;">O que acrescentar no nome</label>'+
      '<input data-dup-sufixo value="'+_gtEsc(SUFIXO_PADRAO)+'" style="width:100%;padding:9px;border-radius:8px;border:1px solid var(--border,#ddd);background:var(--surface,#fff);color:var(--text,#111);font-size:calc(13px*var(--gt-fs,1.3));margin-bottom:16px;">'+
      '<div style="background:rgba(22,163,74,.12);border:1px solid rgba(22,163,74,.35);border-radius:8px;padding:11px 13px;font-size:calc(12px*var(--gt-fs,1.3));line-height:1.5;margin-bottom:18px;"><b>A cópia nasce PAUSADA.</b> Nada vai gastar até você ativar.</div>';
    const bar=document.createElement('div');bar.style.cssText='display:flex;gap:10px;justify-content:flex-end;';
    const close=v=>{ov.style.display='none';resolve(v);};
    const c=document.createElement('button');c.textContent='Cancelar';
    c.style.cssText='padding:9px 16px;border-radius:8px;border:1px solid var(--border,#ddd);background:none;color:var(--text,#111);font-weight:600;font-size:calc(13px*var(--gt-fs,1.3));cursor:pointer;';
    c.onclick=()=>close(null);bar.appendChild(c);
    const ok=document.createElement('button');ok.textContent='Duplicar';
    ok.style.cssText='padding:9px 18px;border-radius:8px;border:none;background:var(--accent,#6366f1);color:#fff;font-weight:700;font-size:calc(13px*var(--gt-fs,1.3));cursor:pointer;';
    ok.onclick=()=>close({
      quantidade:parseInt(box.querySelector('[data-dup-qtd]').value,10)||1,
      sufixo:box.querySelector('[data-dup-sufixo]').value,
    });
    bar.appendChild(ok);
    box.appendChild(bar);ov.appendChild(box);
    ov.onclick=e=>{if(e.target===ov)close(null);};
  });
}

// Caixa de progresso/resultado da cópia. Reusa o visual do _gtConfirm.
function _gtDupStatus(html,acoes){
  let ov=document.getElementById('gt-dup-ov');
  if(!ov)return;
  ov.innerHTML='';ov.style.display='flex';
  const box=document.createElement('div');
  box.style.cssText='background:var(--surface,#fff);color:var(--text,#111);border-radius:14px;max-width:440px;width:100%;padding:24px;box-shadow:0 24px 60px rgba(0,0,0,.45);font-family:var(--fonte-principal);font-size:calc(13px*var(--gt-fs,1.3));line-height:1.6;';
  box.innerHTML=html;
  if(acoes&&acoes.length){
    const bar=document.createElement('div');bar.style.cssText='display:flex;gap:10px;justify-content:flex-end;margin-top:18px;';
    for(const a of acoes){
      const b=document.createElement('button');b.textContent=a.texto;
      b.style.cssText='padding:9px 16px;border-radius:8px;border:'+(a.primario?'none':'1px solid var(--border,#ddd)')+';background:'+(a.primario?'var(--accent,#6366f1)':'none')+';color:'+(a.primario?'#fff':'var(--text,#111)')+';font-weight:700;font-size:calc(13px*var(--gt-fs,1.3));cursor:pointer;';
      b.onclick=a.aoClicar;bar.appendChild(b);
    }
    box.appendChild(bar);
  }
  ov.appendChild(box);
}
function _gtDupFechar(){const ov=document.getElementById('gt-dup-ov');if(ov)ov.style.display='none';}
```

- [ ] **Step 3: Escrever o orquestrador**

Inserir logo depois do que foi adicionado no passo anterior:

```js
const _GT_DUP_ROTULO={campanha:'campanha',conjunto:'conjunto de anúncios',anuncio:'anúncio'};

// AÇÃO REAL na Meta: cria cópias. Sempre PAUSADAS, sempre após confirmação.
async function _gtAbrirDuplicar(alvo){
  const tok=_gtCurAcc?.id;
  if(!tok){await _gtConfirm('Sem conta selecionada','Escolha uma conta de anúncios antes de duplicar.',{okOnly:true});return;}

  const nome=alvo.nivel==='campanha'?alvo.campanha?.name
    :alvo.nivel==='conjunto'?alvo.conjuntos?.[0]?.name
    :alvo.anuncios?.[0]?.name;
  const nCj=alvo.nivel==='campanha'?(alvo.conjuntos||[]).length:0;
  const nAd=alvo.nivel==='anuncio'?0:(alvo.anuncios||[]).length;
  const filhos=[nCj?nCj+(nCj===1?' conjunto':' conjuntos'):'',nAd?nAd+(nAd===1?' anúncio':' anúncios'):'']
    .filter(Boolean).join(' e ');
  // AVISO NECESSÁRIO: a lista de anúncios da tela vem dos insights do período
  // escolhido — anúncio sem gasto no período NÃO está nela e portanto NÃO
  // será copiado. Copiar de menos calado seria o pior desfecho possível aqui,
  // então isso vai escrito na janela, não num comentário de código.
  const resumo='Vai copiar '+(_GT_DUP_ROTULO[alvo.nivel]||'item')+' <b>«'+_gtEsc(nome||'sem nome')+'»</b>'
    +(filhos?', com '+filhos+'.':'.')
    +(nAd?'<br><span style="color:var(--orange,#d97706)">Só entram os anúncios com gasto no período que está selecionado.</span>':'');

  const escolha=await _gtDuplicarModal(resumo);
  if(!escolha)return;

  const plano=planoDeCopia(alvo,escolha);
  if(!plano.length){
    _gtDupStatus('<b>Não há o que copiar.</b><br>Abra a campanha para carregar os conjuntos e anúncios antes de duplicar.',
      [{texto:'Entendi',primario:true,aoClicar:_gtDupFechar}]);
    return;
  }

  // comEspera: se a Meta pedir calma no meio da cascata, ela mesma espera e
  // repete, sem devolver o problema pro dono.
  const enviar=comEspera((caminho,params)=>metaPost(caminho,params,tok));
  const passoTxt=p=>_GT_DUP_ROTULO[p.passo.nivel]+' «'+_gtEsc(p.passo.origemNome)+'»';
  const aoProgredir=p=>_gtDupStatus('<b>Copiando…</b><br>'+p.feitos+' de '+p.total+' — '+passoTxt(p));

  _gtDupStatus('<b>Copiando…</b><br>0 de '+plano.length);
  const rel=await executarPlano(plano,{enviar,aoProgredir});
  _gtDupRelatar(plano,rel,enviar);
}

// Mostra o desfecho. Falhou no meio: NADA é desfeito — o que ficou está
// pausado, e o dono escolhe continuar ou deixar assim.
function _gtDupRelatar(plano,rel,enviar){
  if(!rel.falhou){
    _gtDupStatus('<b>Pronto.</b><br>'+rel.concluidos.length+' '+(rel.concluidos.length===1?'item copiado':'itens copiados')+
      ', tudo <b>pausado</b>. Ative quando quiser, e ajuste o orçamento no botão «✎ editar».',
      [{texto:'Fechar',primario:true,aoClicar:()=>{_gtDupFechar();loadGtData();}}]);
    return;
  }
  const motivo=_gtDupTraduzir(rel.falhou.motivo);
  const feitos=rel.concluidos.length;
  _gtDupStatus(
    '<b>Parei no meio.</b><br>'+motivo+
    '<br><br>Copiei '+feitos+' de '+plano.length+' '+(plano.length===1?'item':'itens')+'. '+
    (feitos?'O que já foi criado está <b>pausado</b> e não vai gastar. Não apaguei nada.':'Nada foi criado.'),
    [
      {texto:'Deixar assim',aoClicar:()=>{_gtDupFechar();loadGtData();}},
      {texto:'Tentar continuar',primario:true,aoClicar:async()=>{
        _gtDupStatus('<b>Continuando…</b>');
        const novo=await retomar(plano,rel,{enviar,
          aoProgredir:p=>_gtDupStatus('<b>Continuando…</b><br>'+p.feitos+' de '+p.total)});
        _gtDupRelatar(plano,novo,enviar);
      }},
    ]);
}

// Traduz o erro da Meta. Mesmo espírito do tradutor de _gtApplyAction: o dono
// não precisa ver jargão técnico, precisa saber o que fazer.
function _gtDupTraduzir(msg){
  const m=String(msg||'');
  if(/permiss|#200|#10\b|#272|OAuth|token|management/i.test(m))
    return 'O acesso desta conta <b>não tem permissão de gerenciar anúncios</b>. Verifique na Meta.';
  if(/#17|rate|limit|too many|reduce the amount/i.test(m))
    return 'A Meta pediu para <b>diminuir o ritmo</b> (limite de chamadas). Espere alguns minutos e tente continuar.';
  if(/não devolveu/i.test(m))
    return 'A Meta aceitou o pedido mas <b>não informou o número da cópia</b>, então parei para não criar item solto.';
  return '<b>A Meta recusou:</b> '+_gtEsc(m.slice(0,180));
}
```

- [ ] **Step 4: Verificar que compila e que nada quebrou**

Run: `npm run build && npm test 2>&1 | grep -E "^ℹ (tests|pass|fail)"`
Expected: build `✓ built`, testes `fail 0` (ainda 326 — esta tarefa não acrescenta teste automatizado; a tela é montada por DOM puro e não tem cobertura de teste neste projeto, igual ao resto do arquivo).

- [ ] **Step 5: Commitar**

```bash
git add src/ferramentas/gestao-trafego/tela-de-gestao-trafego.vue
git commit -m "feat(gestor): janela de duplicar com quantidade, sufixo e progresso

Modal próprio em vez de estender o _gtConfirm: aquele só devolve sim/não e
é o portão preservado de todas as outras ações — mexer nele arriscaria o
resto da tela.

Falhou no meio, a tela diz quantos itens ficaram, avisa que estão pausados
e oferece continuar ou deixar assim. Nada é apagado automaticamente.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: Os botões nos três níveis

**Files:**
- Modify: `src/ferramentas/gestao-trafego/tela-de-gestao-trafego.vue`

**Interfaces:**
- Consumes: `_gtAbrirDuplicar` (Task 5), `hasPermission` (já importado na linha 115).

**Regra de permissão:** o botão só é desenhado quando `hasPermission('meta.gestor','editar')` for verdadeiro — o mesmo critério que já trava a edição de orçamento. Duplicar cria objetos novos na conta: fica no critério mais rígido que a ferramenta já usa.

- [ ] **Step 1: Helper do botão**

Inserir logo antes de `_gtWireBudgetControls` (por volta da linha 1082):

```js
// Botão "⧉ Duplicar". Só existe para quem tem permissão de EDITAR nesta
// ferramenta — mesmo critério do orçamento. Duplicar cria objeto novo na
// conta, então fica no portão mais rígido que a tela já usa.
function _gtBotaoDuplicar(alvo){
  if(!hasPermission('meta.gestor','editar'))return null;
  const b=document.createElement('button');
  b.className='gt-btn-dup';b.textContent='⧉ Duplicar';b.title='Criar uma cópia pausada';
  b.addEventListener('click',ev=>{ev.stopPropagation();_gtAbrirDuplicar(alvo);});
  return b;
}
```

**ATENÇÃO AOS NOMES DOS CAMPOS.** Os anúncios nesta tela vêm dos *insights*
da Meta, então usam **`ad.ad_id` e `ad.ad_name`** — **não** `ad.id`/`ad.name`.
Trocar isso monta o plano com id vazio e a cópia falha no primeiro anúncio.
Os conjuntos, por virem do endpoint `/adsets`, usam `id`/`name` normais.

- [ ] **Step 2: Botão na campanha**

Em `_renderGtCampaigns`, logo APÓS o bloco 4 (o `if(!encerrada&&!bannerHasPause){...}`
que cria o `actBar` do pausar, por volta da linha 1357) e ANTES da linha
`_gtWireBudgetControls(inner,ins,camp,iaRow,permCamp);`:

```js
      // 4b) Duplicar a campanha inteira. `conjuntos` e `ads` já estão em escopo
      // aqui (linhas ~1194/1196) — é por isso que o botão nasce neste ponto e
      // não dentro de _gtWireBudgetControls, que não recebe essas listas.
      const bDupCamp=_gtBotaoDuplicar({
        nivel:'campanha',
        campanha:{id:ins.campaign_id,name:ins.campaign_name||camp?.name||''},
        conjuntos:conjuntos.map(c=>({id:c.id,name:c.name})),
        anuncios:ads.map(a=>({id:a.ad_id,name:a.ad_name,adset_id:a.adset_id})),
      });
      if(bDupCamp){
        // Reaproveita a linha de ações do pausar, se ela existir; senão cria.
        let barraDup=inner.querySelector('.gt-action-row');
        if(!barraDup){barraDup=document.createElement('div');barraDup.className='gt-action-row';inner.appendChild(barraDup);}
        barraDup.appendChild(bDupCamp);
      }
```

- [ ] **Step 3: Botão no conjunto**

Em `_renderGtConjuntos`, logo APÓS o bloco `if(orc){...}` que termina por volta
da linha 1485, e ANTES do comentário `// Anúncios do conjunto.`:

```js
    // `g` vem de montarHierarquia: g.id, g.nome e g.anuncios (os anúncios do
    // conjunto, já vindos dos insights — daí ad_id/ad_name).
    const bDupCj=_gtBotaoDuplicar({
      nivel:'conjunto',
      conjuntos:[{id:g.id,name:g.nome}],
      anuncios:(g.anuncios||[]).map(a=>({id:a.ad_id,name:a.ad_name,adset_id:g.id})),
    });
    if(bDupCj){
      const barraCj=document.createElement('div');barraCj.className='gt-action-row';
      barraCj.appendChild(bDupCj);card.appendChild(barraCj);
    }
```

- [ ] **Step 4: Botão no anúncio**

Em `_renderGtAds`, logo APÓS a linha `if(adTgl)actBar.appendChild(adTgl);`
(por volta da linha 1541) e ANTES de `card.appendChild(actBar);`:

```js
    const bDupAd=_gtBotaoDuplicar({nivel:'anuncio',anuncios:[{id:ad.ad_id,name:ad.ad_name||ad.adset_name||''}]});
    if(bDupAd)actBar.appendChild(bDupAd);
```

- [ ] **Step 5: Estilo do botão**

No bloco `<style scoped>` do arquivo, junto das outras classes `gt-`:

```css
.gt-btn-dup{
  padding:6px 11px;border-radius:7px;border:1px solid var(--border,#ddd);
  background:none;color:var(--text,#111);font-weight:600;
  font-size:calc(12px*var(--gt-fs,1.3));cursor:pointer;white-space:nowrap;
}
.gt-btn-dup:hover{background:var(--surface-2,rgba(0,0,0,.05));}
```

- [ ] **Step 6: Verificar no navegador**

```bash
npm run dev -- --port 5199 --strictPort
```

Abrir `http://localhost:5199`, ir em Meta Ads → Gestão de Tráfego, escolher uma conta e conferir:
- o botão "⧉ Duplicar" aparece nos três níveis;
- clicar abre a janela com o resumo certo ("com 2 conjuntos e 7 anúncios");
- **cancelar não dispara nada** — confirme na aba Rede do navegador que nenhuma chamada a `meta-proxy` saiu.

**NÃO confirmar a duplicação nesta verificação.** Isso criaria campanha de verdade na conta do cliente. A confirmação de ponta a ponta é a Task 6, e é decisão do dono.

- [ ] **Step 7: Commitar**

```bash
git add src/ferramentas/gestao-trafego/tela-de-gestao-trafego.vue
git commit -m "feat(gestor): botão duplicar na campanha, no conjunto e no anúncio

Só aparece para quem tem permissão de editar nesta ferramenta — mesmo
critério do orçamento. Duplicar cria objeto novo na conta, então fica no
portão mais rígido que a tela já usa.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: Documentar e fechar

**Files:**
- Modify: `src/ferramentas/gestao-trafego/LEIA-ME.txt`

- [ ] **Step 1: Documentar para o dono**

Acrescentar ao `LEIA-ME.txt`, seguindo o tom das outras seções (português literal, explicando o porquê):

```
DUPLICAR CAMPANHA / CONJUNTO / ANÚNCIO (desde 2026-07-28)
==========================================================
Botão "⧉ Duplicar" nos três níveis. Só aparece para quem tem permissão de
EDITAR nesta ferramenta — a mesma que libera mexer no orçamento e na régua.

A CÓPIA SEMPRE NASCE PAUSADA. Isso vai escrito em toda chamada, não é
confiança no padrão da Meta. Nada gasta até você ativar na mão.

A cópia é feita em CASCATA: primeiro a campanha vazia, depois cada conjunto
pra dentro dela, depois cada anúncio pro conjunto novo. Parece trabalho a
mais, e é de propósito: o jeito "copie tudo de uma vez" da Meta (deep_copy)
trava em 3 anúncios por chamada — justamente a campanha grande que você mais
quer duplicar. Em cascata não tem teto, você vê o progresso, e se algo falhar
dá pra saber exatamente onde parou.

SE PARAR NO MEIO: nada é apagado. O que foi criado fica lá, PAUSADO, e a tela
oferece "Tentar continuar" (refaz só o que faltou) ou "Deixar assim". A
ferramenta nunca apaga sozinha pra "limpar" — um engano apagaria o item
errado.

SÓ ENTRAM OS ANÚNCIOS COM GASTO NO PERÍODO SELECIONADO. A tela só conhece os
anúncios que a Meta devolveu para o período escolhido lá em cima (HOJE, 7D,
30D...). Anúncio que não gastou nesse período não aparece na lista e portanto
NÃO é copiado. A janela do duplicar avisa isso. Se você quer levar todos,
escolha um período maior ANTES de duplicar.

O QUE O DUPLICAR NÃO FAZ (e por quê):
- Não copia para OUTRA conta de anúncios. A Meta não oferece isso em nenhum
  nível. Levar uma campanha pra outra loja exige recriar do zero na conta de
  destino, inclusive re-subindo as imagens (no Meta a imagem pertence à
  conta). É outro projeto.
- Não troca criativo, público ou posicionamento na hora de copiar. Isso é
  edição, e ainda não existe aqui.
- Não muda o orçamento na cópia — a Meta não aceita. Duplique e ajuste depois
  no botão "✎ editar" do orçamento, que já existe.

Arquivos: duplicar.js (o motor, PURO — monta o plano e executa) e
duplicar.test.mjs (testes, com uma Meta de mentira: nenhum teste encosta em
conta real). Rodam com `npm test`.
```

- [ ] **Step 2: Verificação final**

```bash
npm test 2>&1 | grep -E "^ℹ (tests|pass|fail)"
npm run build 2>&1 | tail -3
```

Expected: `fail 0` (326 testes) e `✓ built`.

As 2 falhas de `coletor/gerar-criativos.test.mjs` são pré-existentes (batem no Supabase real e tomam 401 sem credencial local) e não entram no `test:ci`. Confirme com `npm run test:ci` que dá `fail 0`.

- [ ] **Step 3: Commitar**

```bash
git add src/ferramentas/gestao-trafego/LEIA-ME.txt
git commit -m "docs(gestor): explica o duplicar, a cascata e o que ele não faz

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

- [ ] **Step 4: Juntar com a main antes de abrir o PR**

```bash
git fetch origin
git log --oneline HEAD..origin/main          # o que a outra frente mandou
git rebase origin/main                        # resolver conflito, se houver
npm run test:ci && npm run build              # tem que passar DEPOIS de juntar
```

A outra frente trabalha em `ponderada.js`, `veredito.js`, `alvos.js`,
`painel-regua.js` e na aba "A régua". Conflito, se vier, será no
`tela-de-gestao-trafego.vue`. **Nunca usar `--force`** e nunca descartar o
lado dela: em caso de conflito, ler os dois lados e manter os dois
comportamentos.

- [ ] **Step 5: Parar e chamar o dono**

**NÃO abrir PR nem fazer push sem o dono mandar.** O combinado desta sessão é
trabalho local; subir é decisão dele, e a duplicação de ponta a ponta ainda
não foi testada numa conta real — esse teste cria campanha de verdade e só
ele pode autorizar.

Apresentar: o que foi feito, o resultado dos testes e do build, e que falta o
teste ao vivo.

---

## Fora do escopo (registrado, não esquecido)

- **Copiar para outra conta de anúncios** — a Meta não permite; exige recriar. Vai para o projeto C.
- **Trocar criativo/público/posicionamento ao duplicar** — é edição. Projeto C.
- **`meta-proxy` com portão mais frouxo que a tela** (`features.includes('meta')` contra `meta.gestor`). Falha pré-existente, já vale hoje para pausar e orçamento. Corrigir como projeto próprio.
- **Pausar/reativar não exige permissão de editar, mas orçamento exige.** Inconsistência pré-existente, reportada ao dono. Não mexer aqui — é decisão dele e é território da outra frente.
