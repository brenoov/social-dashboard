import { test } from 'node:test';
import assert from 'node:assert/strict';
import { montarPainelFila } from './painel-fila.js';

// Alvo de mentira: o painel só precisa de innerHTML e querySelectorAll. Sem DOM
// de verdade dá pra provar o que importa aqui — o HTML que sai.
const alvoFalso = () => ({ innerHTML: '', querySelectorAll: () => [] });

const item = (extra) => ({
  campaign_id: 'c1', account_id: 'conta-1', conta_nome: 'Raíssa Herculano',
  campaign_name: 'MODA & BOLSAS', veredito: 'escalar', gerado_em: '2026-07-29T00:00:00Z',
  budget_atual_centavos: 23000, budget_sugerido_centavos: 28000, ...extra,
});
const monta = (o) => { const a = alvoFalso(); montarPainelFila(a, { agora: '2026-07-29T12:00:00Z', ...o }); return a.innerHTML; };

// ── escape: justificativa e impacto sao ESCRITOS PELO MODELO ────────────────

test('texto do modelo nao vira HTML', () => {
  const html = monta({
    pendentes: [item({
      justificativa: '<img src=x onerror="alert(1)">',
      impacto_estimado: '</p><script>alert(2)</script>',
    })],
  });
  assert.ok(!html.includes('<img src=x'), 'a tag do modelo nao pode sair viva');
  assert.ok(!html.includes('<script>'), 'nem script');
  assert.ok(html.includes('&lt;img src=x'), 'sai escapado, mas sai — o dono precisa ler o texto');
});

test('nome de campanha e de conjunto tambem sao escapados', () => {
  const html = monta({
    pendentes: [item({
      campaign_name: '"><script>x</script>',
      conta_nome: '<b>conta</b>',
      conjuntos: [{ id: 'a', nome: '<i>conj</i>', deCentavos: 23000 }],
    })],
  });
  assert.ok(!html.includes('<script>x'));
  assert.ok(!html.includes('<b>conta</b>'));
  assert.ok(!html.includes('<i>conj</i>'));
});

test('veredito desconhecido nao injeta classe nem markup', () => {
  const html = monta({ pendentes: [item({ veredito: '"><script>x</script>' })] });
  assert.ok(!html.includes('<script>x'));
  assert.ok(html.includes('gtf-item neutro'), 'cai na cor neutra, que e literal');
});

// ── conteudo ────────────────────────────────────────────────────────────────

test('mostra de -> para e a variacao em %', () => {
  const html = monta({ pendentes: [item()] });
  assert.match(html, /R\$ 230,00/);
  assert.match(html, /R\$ 280,00/);
  assert.match(html, /\+22%/);
});

test('pausar nao mostra de -> para: o que muda e o estado', () => {
  const html = monta({ pendentes: [item({ veredito: 'pausar' })] });
  assert.match(html, /para de rodar/);
  assert.ok(!html.includes('gtf-seta'), 'seta de valor nao faz sentido aqui');
});

test('ABO: a quebra por conjunto aparece ANTES de aprovar, e fecha no total', () => {
  const html = monta({
    pendentes: [item({
      conjuntos: [
        { id: 'a', nome: 'DIA DA BELEZA', deCentavos: 5000 },
        { id: 'b', nome: 'MINI VLOG', deCentavos: 6000 },
        { id: 'c', nome: 'BASTIDORES', deCentavos: 6000 },
        { id: 'd', nome: 'CONSTRUÇÃO BOLSA', deCentavos: 6000 },
      ],
    })],
  });
  assert.match(html, /est(á|&aacute;) em 4 conjuntos/);
  assert.match(html, /DIA DA BELEZA/);
  // a soma tem que bater com os R$ 280 aprovados
  const valores = [...html.matchAll(/gtf-cj-para">R\$ ([\d.,]+)</g)].map((m) => Number(m[1].replace(/\./g, '').replace(',', '.')));
  assert.equal(valores.length, 4);
  assert.equal(Math.round(valores.reduce((t, v) => t + v, 0) * 100), 28000);
});

test('CBO nao mostra bloco de conjuntos', () => {
  const html = monta({ pendentes: [item({ conjuntos: [] })] });
  assert.ok(!html.includes('gtf-conjuntos'));
});

// ── filtro por conta ────────────────────────────────────────────────────────

test('o filtro conta quantas pendencias cada conta tem', () => {
  const html = monta({
    pendentes: [item(), item({ campaign_id: 'c2' }), item({ campaign_id: 'c3', account_id: 'conta-2' })],
    contas: [{ id: 'conta-1', name: 'Raíssa' }, { id: 'conta-2', name: 'Vessel' }, { id: 'conta-3', name: 'Mantova' }],
  });
  // Sem o numero, o dono clicaria conta por conta pra achar as vazias.
  assert.match(html, /Todas as contas<span class="gtf-filtro-n">3</);
  assert.match(html, /Mantova<span class="gtf-filtro-n">0</);
});

test('filtrar por conta mostra so a dela', () => {
  const html = monta({
    pendentes: [item({ campaign_name: 'DA RAISSA' }), item({ campaign_id: 'c2', account_id: 'conta-2', campaign_name: 'DA VESSEL' })],
    contas: [{ id: 'conta-1', name: 'Raíssa' }, { id: 'conta-2', name: 'Vessel' }],
    contaFiltro: 'conta-2',
  });
  assert.ok(html.includes('DA VESSEL'));
  assert.ok(!html.includes('DA RAISSA'));
});

// ── estados ─────────────────────────────────────────────────────────────────

test('fila vazia explica o que vai aparecer ali', () => {
  const html = monta({ pendentes: [] });
  assert.match(html, /Nada esperando decis(ã|&atilde;)o/);
  assert.match(html, /toda madrugada/);
});

test('vencidas ficam dobradas num <details>, com a contagem visivel', () => {
  const html = monta({ pendentes: [], vencidas: [item({ campaign_id: 'v1' }), item({ campaign_id: 'v2' })] });
  assert.match(html, /<details/);
  assert.match(html, /2 sugest(õ|&otilde;)es vencidas/);
  assert.match(html, /parou de reanalisar/);
});

test('silenciadas viram uma nota, nao somem caladas', () => {
  const html = monta({ pendentes: [], silenciadas: [item()] });
  assert.match(html, /recusada volta/);
});

test('sem permissao nao mostra botao de decidir', () => {
  const comPermissao = monta({ pendentes: [item()], editavel: true });
  const sem = monta({ pendentes: [item()], editavel: false });
  assert.match(comPermissao, /data-gtf-aprovar/);
  assert.ok(!sem.includes('data-gtf-aprovar'));
  assert.match(sem, /n(ã|&atilde;)o tem permiss(ã|&atilde;)o/);
});

test('nada quebra sem opcoes', () => {
  const a = alvoFalso();
  montarPainelFila(a, {});
  assert.ok(a.innerHTML.length > 0);
});

// ── saude linkada (2026-07-29) ─────────────────────────────────────────────

test('CONFLITO ganha destaque: robo manda escalar, audiencia queimada', () => {
  const html = monta({ pendentes: [item({
    conflito: true,
    saude: { nivel: 'alerta', veredito: 'reduzir', porque: 'Frequência 4,2× — o mesmo público já viu demais.' },
  })], editavel: true });
  assert.match(html, /gtf-item positivo conflito/);
  assert.match(html, /4,2/);
  assert.match(html, /vale conferir antes de aprovar/);
});

test('saude de atencao aparece discreta, sem alarde', () => {
  const html = monta({ pendentes: [item({ saude: { nivel: 'atencao', veredito: 'monitorar', porque: 'CTR 0,30% baixo.' } })] });
  assert.match(html, /gtf-saude atencao/);
  assert.ok(!html.includes('conflito'));
});

test('item nascido da SAUDE nao repete o mesmo texto duas vezes', () => {
  const html = monta({ pendentes: [item({
    origem: 'saude', veredito: 'reduzir', budget_sugerido_centavos: null,
    justificativa: 'Frequência 4,2× — o mesmo público já viu demais.',
    saude: { nivel: 'alerta', veredito: 'reduzir', porque: 'Frequência 4,2× — o mesmo público já viu demais.' },
  })] });
  assert.equal((html.match(/4,2×/g) || []).length, 1);
  assert.match(html, /saúde da campanha/, 'diz de onde veio');
});

test('SEM valor sugerido nao existe botao de aprovar', () => {
  // Um botao que promete agir e nao sabe o que fazer e pior que nenhum botao.
  const html = monta({ pendentes: [item({ origem: 'saude', veredito: 'reduzir', budget_sugerido_centavos: null })], editavel: true });
  assert.ok(!html.includes('data-gtf-aprovar'));
  assert.match(html, /data-gtf-recusar/, 'mas da pra dispensar');
  assert.match(html, /ajuste o orçamento na aba Campanhas/);
});

test('pausar SEM valor sugerido continua aprovavel: a acao existe', () => {
  const html = monta({ pendentes: [item({ origem: 'saude', veredito: 'pausar', budget_sugerido_centavos: null })], editavel: true });
  assert.match(html, /data-gtf-aprovar/);
});

test('sem valor sugerido mostra o gasto de hoje, nao um "de -> para" vazio', () => {
  const html = monta({ pendentes: [item({ origem: 'saude', veredito: 'reduzir', budget_sugerido_centavos: null })] });
  assert.match(html, /R\$ 230,00/);
  assert.match(html, /gtf-hoje/);
});
