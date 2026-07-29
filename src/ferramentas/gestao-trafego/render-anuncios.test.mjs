import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// EXECUTA _renderGtAds com um DOM de mentira.
//
// POR QUE ISTO EXISTE: ao remover o selo da IA do cartão do anúncio eu apaguei
// junto a criação do `card`, e sobrou uma linha usando uma variável que não
// existia mais. `npm run build` passou — é JavaScript válido, o erro só aparece
// quando a função RODA — e a aba Campanhas quebrou inteira com "card is not
// defined" (2026-07-29). Nenhum teste pegava porque a função vive dentro do
// .vue e nunca era chamada fora do navegador.
//
// A função é extraída do arquivo e executada aqui com stubs. Frágil se ela for
// renomeada — e é esse o ponto: quem renomear vai reler este comentário.

const fonte = readFileSync(new URL('./tela-de-gestao-trafego.vue', import.meta.url), 'utf8');

// Recorta o texto da função pelo nome, contando chaves até fechar.
function corpoDaFuncao(nome) {
  const i = fonte.indexOf(`function ${nome}(`);
  assert.ok(i > 0, `não achei a função ${nome}`);
  let d = 0, dentro = false;
  for (let j = fonte.indexOf('{', i); j < fonte.length; j++) {
    const c = fonte[j];
    if (c === '{') { d++; dentro = true; }
    else if (c === '}') { d--; if (dentro && d === 0) return fonte.slice(i, j + 1); }
  }
  throw new Error(`função ${nome} não fecha`);
}

// DOM mínimo: só o que a função toca.
function domFalso() {
  const criados = [];
  const el = () => {
    const e = {
      className: '', textContent: '', innerHTML: '', style: { cssText: '' }, title: '',
      filhos: [], appendChild(f) { this.filhos.push(f); return f; },
      addEventListener() {}, querySelectorAll: () => [], querySelector: () => null,
    };
    criados.push(e);
    return e;
  };
  return { document: { createElement: el }, criados };
}

test('_renderGtAds monta o cartão sem referenciar variável inexistente', () => {
  const { document, criados } = domFalso();
  const pane = { filhos: [], appendChild(f) { this.filhos.push(f); }, className: '', style: { cssText: '' } };

  // Stubs das dependências. Qualquer nome que a função use e NÃO esteja aqui
  // nem declarado nela estoura — que é exatamente o bug que se quer pegar.
  const escopo = {
    document,
    _gtEsc: (s) => String(s == null ? '' : s),
    _maFmtPct: (v) => `${v}%`,
    _maFmtR: (v) => `R$ ${v}`,
    _gtBalde: () => 'trafego',
    _gtSeloObjetivoEl: () => null,
    _gtSelCaixa: () => null,
    _gtManualToggleBtn: () => null,
    // Devolve null como os outros botões opcionais: o cartão faz `if(bDupAd)`
    // antes de encaixar, então null exercita o caminho de "sem permissão".
    _gtBotaoDuplicar: () => null,
    _gtVerCriativo: () => {},
    _gtReguaAtiva: () => ({ pesos: {}, limiares: {}, metas: {} }),
    _gtObjetivoInteracao: {},
    interacaoValida: () => false,
    quantidadesDoInsight: () => ({}),
    custoDaInteracao: () => null,
    metaDoBalde: () => 0,
    avaliarAlvo: () => ({ faixa: 'sem-dados' }),
    INTERACOES: {},
    _gtCurAcc: { id: 'conta-1' },
  };

  const nomes = Object.keys(escopo);
  const fn = new Function(...nomes, `${corpoDaFuncao('_renderGtAds')}; return _renderGtAds;`)(...nomes.map((n) => escopo[n]));

  const ads = [
    { ad_id: 'a1', ad_name: 'Criativo A', adset_name: 'Conjunto X', ctr: '1.5', spend: '100', effective_status: 'ACTIVE' },
    { ad_id: 'a2', ad_name: 'Criativo B', ctr: '0.3', spend: '40', effective_status: 'PAUSED' },
  ];
  fn(pane, ads, [], [], 1, false);

  assert.equal(pane.filhos.length, 3, 'rótulo + um cartão por anúncio');
  const nomesCriados = criados.map((c) => c.className);
  assert.ok(nomesCriados.includes('gt-ad-card'), 'o cartão do anúncio precisa existir');
  assert.ok(nomesCriados.some((c) => c.startsWith('gt-status-badge')), 'e o badge de status junto');
});

test('_renderGtAds sem anúncio nenhum não quebra', () => {
  const { document } = domFalso();
  const pane = { filhos: [], appendChild(f) { this.filhos.push(f); } };
  const escopo = { document };
  const fn = new Function('document', `${corpoDaFuncao('_renderGtAds')}; return _renderGtAds;`)(document);
  fn(pane, [], [], [], 1, false);
  assert.equal(pane.filhos.length, 2, 'rótulo + aviso de vazio');
});

test('o cartão NÃO traz mais o selo de julgamento da IA', () => {
  // O selo "Manter"/"Pausar" migrou pra Fila; se voltar aqui, a mesma decisão
  // passa a existir em dois lugares e a daqui não deixa registro.
  const corpo = corpoDaFuncao('_renderGtAds');
  assert.ok(!corpo.includes('gt-ad-pill'), 'a pílula de veredito não pode voltar');
  assert.ok(!corpo.includes('_gtAdIA'), 'nem a leitura da análise por anúncio');
});
