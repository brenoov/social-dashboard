import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lerSaude, contradiz, categoriaDoObjetivo, CRITERIOS } from './saude.js';

const base = { categoria: 'traffic', gasto: 500, impressoes: 50000, ctr: 2, frequencia: 1.5 };

test('sem volume nao ha leitura — nem boa nem ruim', () => {
  assert.equal(lerSaude({ ...base, gasto: 10 }).nivel, 'sem-volume');
  assert.equal(lerSaude({ ...base, impressoes: 500 }).nivel, 'sem-volume');
});

test('frequencia alta e alerta em QUALQUER tipo de campanha', () => {
  // Audiencia queimada e problema seja qual for o objetivo, e vem antes dele.
  for (const categoria of ['lead', 'traffic', 'engagement', 'video', 'awareness']) {
    const r = lerSaude({ ...base, categoria, frequencia: 4.2 });
    assert.equal(r.nivel, 'alerta', categoria);
    assert.equal(r.veredito, 'reduzir');
    assert.match(r.porque, /4,2/);
  }
});

test('frequencia entre 3,5 e 4 e atencao, nao alerta', () => {
  const r = lerSaude({ ...base, frequencia: 3.6 });
  assert.equal(r.nivel, 'atencao');
});

test('trafego com CTR no chao e alerta de pausar', () => {
  const r = lerSaude({ ...base, ctr: 0.3, gasto: 100, impressoes: 5000 });
  assert.equal(r.nivel, 'alerta');
  assert.equal(r.veredito, 'pausar');
});

test('ENGAJAMENTO nao usa o limiar de CTR do trafego', () => {
  // O erro que quase virou relatorio: aplicar pausCTR de trafego (0,5%) numa
  // campanha de engajamento. Engajamento com CTR 0,30% e MUITA interacao esta
  // saudavel — o criterio dele e volume de interacao, nao CTR.
  const r = lerSaude({ categoria: 'engagement', gasto: 415, impressoes: 200000, ctr: 0.3, frequencia: 1.9, engajamentos: 232000 });
  assert.notEqual(r.nivel, 'alerta', 'nao pode acusar campanha com 232 mil interacoes');
});

test('engajamento que nao conecta: muito gasto, quase nenhuma interacao', () => {
  const r = lerSaude({ categoria: 'engagement', gasto: 200, impressoes: 30000, ctr: 0.2, frequencia: 1.5, engajamentos: 3 });
  assert.equal(r.nivel, 'alerta');
  assert.equal(r.veredito, 'pausar');
});

test('lead sem nenhum resultado depois de gastar e alerta', () => {
  const r = lerSaude({ categoria: 'lead', gasto: 100, impressoes: 5000, ctr: 1, frequencia: 1.5, resultados: 0 });
  assert.equal(r.nivel, 'alerta');
});

test('lead com CTR bom e zero conversao aponta o gargalo DEPOIS do clique', () => {
  const r = lerSaude({ categoria: 'lead', gasto: 60, impressoes: 3000, ctr: 2, frequencia: 1.5, resultados: 0 });
  assert.equal(r.nivel, 'atencao');
  assert.match(r.porque, /depois do clique/);
});

test('campanha saudavel nao vira notícia', () => {
  assert.equal(lerSaude(base).nivel, 'ok');
});

// ── o cruzamento com o robô ─────────────────────────────────────────────────

test('saude de ALERTA contradiz um "escalar" do robo', () => {
  const alerta = lerSaude({ ...base, frequencia: 4.2 });
  assert.equal(contradiz(alerta, 'escalar'), true);
});

test('nao contradiz reduzir nem pausar — ai os dois concordam', () => {
  const alerta = lerSaude({ ...base, frequencia: 4.2 });
  assert.equal(contradiz(alerta, 'reduzir'), false);
  assert.equal(contradiz(alerta, 'pausar'), false);
});

test('"atencao" NAO contradiz: e observacao, nao veto', () => {
  const at = lerSaude({ ...base, frequencia: 3.6 });
  assert.equal(at.nivel, 'atencao');
  assert.equal(contradiz(at, 'escalar'), false);
});

test('saude ok ou ausente nao contradiz nada', () => {
  assert.equal(contradiz(lerSaude(base), 'escalar'), false);
  assert.equal(contradiz(null, 'escalar'), false);
});

test('categoria: lead, venda, engajamento, video, alcance, trafego', () => {
  assert.equal(categoriaDoObjetivo('OUTCOME_LEADS'), 'lead');
  assert.equal(categoriaDoObjetivo('OUTCOME_SALES'), 'conversion');
  assert.equal(categoriaDoObjetivo('OUTCOME_ENGAGEMENT'), 'engagement');
  assert.equal(categoriaDoObjetivo('VIDEO_VIEWS'), 'video');
  assert.equal(categoriaDoObjetivo('OUTCOME_AWARENESS'), 'awareness');
  assert.equal(categoriaDoObjetivo('OUTCOME_TRAFFIC'), 'traffic');
  assert.equal(categoriaDoObjetivo(null), 'other');
});

test('os limiares seguem os que governavam o cartao', () => {
  // Mexer aqui muda o que a fila mostra — o teste existe pra a mudanca ser deliberada.
  assert.equal(CRITERIOS.freqSatura, 4);
  assert.equal(CRITERIOS.freqAtencao, 3.5);
  assert.equal(CRITERIOS.minGasto, 20);
});

test('entrada vazia nao quebra', () => {
  assert.equal(lerSaude({}).nivel, 'sem-volume');
  assert.equal(lerSaude(null).nivel, 'sem-volume');
});

// ── WhatsApp: o resultado e CONVERSA, nao lead ──────────────────────────────

test('campanha de WhatsApp e lida como mensagem, seja qual for o objetivo', () => {
  assert.equal(categoriaDoObjetivo('OUTCOME_LEADS', true), 'mensagem');
  assert.equal(categoriaDoObjetivo('OUTCOME_TRAFFIC', true), 'mensagem');
  assert.equal(categoriaDoObjetivo('OUTCOME_LEADS', false), 'lead');
});

test('NAO acusa "nenhum resultado" numa campanha cheia de conversas', () => {
  // O alerta falso que isto impede: a "[Leads] Para WhatsApp" da Motoeasy gastou
  // R$ 3.478 e teve mais de mil conversas, mas ZERO leads formais. Medida como
  // lead, virava "pausar" — e pausar o que esta funcionando e o pior erro que a
  // ferramenta pode induzir.
  const r = lerSaude({ categoria: 'mensagem', gasto: 3478, impressoes: 90000, ctr: 1.2, frequencia: 2, resultados: 1020 });
  assert.equal(r.nivel, 'ok');
  assert.match(r.porque, /conversas/);
});

test('WhatsApp que nao gera conversa nenhuma continua sendo alerta', () => {
  const r = lerSaude({ categoria: 'mensagem', gasto: 200, impressoes: 10000, ctr: 0.8, frequencia: 2, resultados: 0 });
  assert.equal(r.nivel, 'alerta');
  assert.match(r.porque, /nenhuma conversa/);
});
