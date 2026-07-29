import { test } from 'node:test';
import assert from 'node:assert/strict';
import { montarFila, distribuirEntreConjuntos, pedeAcao, DIAS_DE_SILENCIO } from './fila.js';

// Relógio fixo: o silêncio de 7 dias não se testa esperando 7 dias.
const AGORA = '2026-07-29T12:00:00Z';
const dias = (n) => new Date(Date.parse(AGORA) + n * 86400000).toISOString();

const analise = (extra) => ({
  campaign_id: 'c1', veredito: 'escalar', gerado_em: dias(-1),
  budget_atual_centavos: 23000, budget_sugerido_centavos: 28000, ...extra,
});

// ── o que entra na fila ─────────────────────────────────────────────────────

test('"manter" nao entra: nao ha nada pra aprovar num conselho de nao mexer', () => {
  // Das 38 analises guardadas em 29/07, 12 eram 'manter'.
  assert.equal(pedeAcao({ veredito: 'escalar' }), true);
  assert.equal(pedeAcao({ veredito: 'reduzir' }), true);
  assert.equal(pedeAcao({ veredito: 'pausar' }), true);
  assert.equal(pedeAcao({ veredito: 'manter' }), false);
  const f = montarFila([analise({ veredito: 'manter' })], [], AGORA);
  assert.equal(f.pendentes.length, 0);
});

test('analise sem decisao nenhuma fica pendente', () => {
  const f = montarFila([analise()], [], AGORA);
  assert.equal(f.pendentes.length, 1);
});

test('a fila vem com o MAIOR gasto primeiro', () => {
  const f = montarFila([
    analise({ campaign_id: 'pequena', budget_atual_centavos: 3500 }),
    analise({ campaign_id: 'grande', budget_atual_centavos: 23000 }),
    analise({ campaign_id: 'media', budget_atual_centavos: 9000 }),
  ], [], AGORA);
  assert.deepEqual(f.pendentes.map((i) => i.campaign_id), ['grande', 'media', 'pequena']);
});

// ── decisao ja tomada ───────────────────────────────────────────────────────

test('aprovada some da fila', () => {
  const f = montarFila([analise()], [{ campaign_id: 'c1', decisao: 'aprovada', decidido_em: dias(0) }], AGORA);
  assert.equal(f.pendentes.length, 0);
  assert.equal(f.respondidas.length, 1);
});

test('analise NOVA depois da decisao volta a perguntar — e outro contexto', () => {
  // O robo roda todo dia. Se a situacao mudou e ele sugeriu de novo, a pergunta
  // vale outra vez; senao aprovar uma vez calaria a campanha pra sempre.
  const f = montarFila(
    [analise({ gerado_em: dias(0) })],
    [{ campaign_id: 'c1', decisao: 'aprovada', decidido_em: dias(-2) }],
    AGORA,
  );
  assert.equal(f.pendentes.length, 1, 'a analise e mais nova que a decisao');
});

// ── o silencio de 7 dias ────────────────────────────────────────────────────

test('recusada cala a campanha mesmo com analise NOVA', () => {
  // Este e o ponto do silencio: o robo regrava todo dia, entao sem valer sobre
  // analise nova a recusa duraria algumas horas.
  const f = montarFila(
    [analise({ gerado_em: dias(0) })],
    [{ campaign_id: 'c1', decisao: 'recusada', decidido_em: dias(-1), silenciar_ate: dias(6) }],
    AGORA,
  );
  assert.equal(f.pendentes.length, 0);
  assert.equal(f.silenciadas.length, 1);
});

test('passados os 7 dias a sugestao VOLTA', () => {
  const f = montarFila(
    [analise({ gerado_em: dias(0) })],
    [{ campaign_id: 'c1', decisao: 'recusada', decidido_em: dias(-8), silenciar_ate: dias(-1) }],
    AGORA,
  );
  assert.equal(f.pendentes.length, 1);
});

test('recusa sem silenciar_ate gravado cai nos 7 dias por padrao', () => {
  const dentro = montarFila([analise()], [{ campaign_id: 'c1', decisao: 'recusada', decidido_em: dias(-3) }], AGORA);
  assert.equal(dentro.silenciadas.length, 1, `${DIAS_DE_SILENCIO} dias ainda nao passaram`);
  const fora = montarFila([analise()], [{ campaign_id: 'c1', decisao: 'recusada', decidido_em: dias(-8) }], AGORA);
  assert.equal(fora.pendentes.length, 1);
});

// ── vencidas ────────────────────────────────────────────────────────────────

test('vencida sai da lista principal mas NAO some', () => {
  // Campanha que o robo parou de reanalisar e justamente o que ninguem percebe
  // faltando — em 29/07 havia tres, de 23 a 26 dias.
  const f = montarFila([analise({ valida_ate: dias(-2) })], [], AGORA);
  assert.equal(f.pendentes.length, 0);
  assert.equal(f.vencidas.length, 1, 'fica contavel pra tela avisar');
});

test('sem valida_ate a analise nao vence', () => {
  const f = montarFila([analise({ valida_ate: null })], [], AGORA);
  assert.equal(f.pendentes.length, 1);
});

test('vale a decisao MAIS RECENTE quando ha varias na mesma campanha', () => {
  const f = montarFila([analise({ gerado_em: dias(-1) })], [
    { campaign_id: 'c1', decisao: 'recusada', decidido_em: dias(-20), silenciar_ate: dias(-13) },
    { campaign_id: 'c1', decisao: 'aprovada', decidido_em: dias(0) },
  ], AGORA);
  assert.equal(f.respondidas.length, 1, 'a recusa velha nao pode mandar');
  assert.equal(f.pendentes.length, 0);
});

// ── distribuicao proporcional (ABO) ─────────────────────────────────────────

test('reparte mantendo a proporcao entre os conjuntos', () => {
  // "[ENGAJAMENTO] FEED | P1" real: R$ 90 em 3 conjuntos iguais -> R$ 117.
  const r = distribuirEntreConjuntos(
    [{ id: 'a', deCentavos: 3000 }, { id: 'b', deCentavos: 3000 }, { id: 'c', deCentavos: 3000 }],
    11700,
  );
  assert.deepEqual(r.map((x) => x.paraCentavos), [3900, 3900, 3900]);
});

test('quem tinha o dobro continua com o dobro', () => {
  const r = distribuirEntreConjuntos([{ id: 'a', deCentavos: 2000 }, { id: 'b', deCentavos: 4000 }], 12000);
  assert.deepEqual(r.map((x) => x.paraCentavos), [4000, 8000]);
});

test('a soma das partes bate EXATAMENTE com o total aprovado', () => {
  // "MODA & BOLSAS" real: R$ 230 -> R$ 280 em 4 conjuntos desiguais. Arredondar
  // cada parte por conta propria nao fecha, e aprovar R$ 280 aplicando R$ 279,98
  // e uma promessa quebrada em silencio.
  const conj = [
    { id: 'a', deCentavos: 5000 }, { id: 'b', deCentavos: 6000 },
    { id: 'c', deCentavos: 6000 }, { id: 'd', deCentavos: 6000 },
  ];
  const r = distribuirEntreConjuntos(conj, 28000);
  assert.equal(r.reduce((t, x) => t + x.paraCentavos, 0), 28000);
  assert.ok(r.every((x) => Number.isInteger(x.paraCentavos)), 'centavos sao inteiros');
});

test('a sobra do arredondamento vai pros maiores restos, e o resultado e estavel', () => {
  const conj = [{ id: 'a', deCentavos: 1000 }, { id: 'b', deCentavos: 1000 }, { id: 'c', deCentavos: 1000 }];
  const um = distribuirEntreConjuntos(conj, 10000);
  const dois = distribuirEntreConjuntos(conj, 10000);
  assert.equal(um.reduce((t, x) => t + x.paraCentavos, 0), 10000);
  assert.deepEqual(um, dois, 'mesma entrada, mesma saida');
});

test('conjunto SEM orcamento nao recebe nada', () => {
  const r = distribuirEntreConjuntos([{ id: 'a', deCentavos: 3000 }, { id: 'b', deCentavos: 0 }], 6000);
  assert.equal(r.length, 1);
  assert.equal(r[0].id, 'a');
  assert.equal(r[0].paraCentavos, 6000);
});

test('entrada vazia ou invalida devolve [] em vez de inventar', () => {
  assert.deepEqual(distribuirEntreConjuntos([], 10000), []);
  assert.deepEqual(distribuirEntreConjuntos(null, 10000), []);
  assert.deepEqual(distribuirEntreConjuntos([{ id: 'a', deCentavos: 3000 }], 0), []);
  assert.deepEqual(distribuirEntreConjuntos([{ id: 'a', deCentavos: 3000 }], null), []);
});

test('o conjunto original e preservado no resultado (a tela precisa do nome)', () => {
  const r = distribuirEntreConjuntos([{ id: 'a', nome: 'DIA DA BELEZA', deCentavos: 5000 }], 6000);
  assert.equal(r[0].nome, 'DIA DA BELEZA');
  assert.equal(r[0].deCentavos, 5000, 'o "de" continua disponivel pro antes -> depois');
});

test('nada quebra com lista de analises nula', () => {
  const f = montarFila(null, null, AGORA);
  assert.deepEqual(f.pendentes, []);
});

// ── saude linkada as analises (2026-07-29) ─────────────────────────────────

import { mesclarSaude } from './fila.js';

const saudeAlerta = { nivel: 'alerta', veredito: 'reduzir', porque: 'Frequência 4,2× — o mesmo público já viu demais.' };
const saudeAtencao = { nivel: 'atencao', veredito: 'monitorar', porque: 'CTR 0,30% baixo para engajamento.' };

test('a saude GRUDA no item que o robo ja trouxe', () => {
  const f = montarFila([analise()], [], AGORA);
  const r = mesclarSaude(f, [{ campaign_id: 'c1', saude: saudeAtencao }]);
  assert.equal(r.pendentes[0].saude.nivel, 'atencao');
  assert.equal(r.pendentes.length, 1, 'nao duplica o item');
});

test('alerta em campanha que o robo NAO trouxe vira item proprio', () => {
  // O caso real: robo disse 'manter' (nao entra na fila) numa campanha com
  // frequencia 4,2x. Sem isto o alerta ficava invisivel.
  const f = montarFila([], [], AGORA);
  const r = mesclarSaude(f, [{
    campaign_id: 'so-saude', campaign_name: '[Leads] Para WhatsApp', conta_nome: 'Motoeasy',
    saude: saudeAlerta, budget_atual_centavos: 11532,
  }]);
  assert.equal(r.pendentes.length, 1);
  assert.equal(r.pendentes[0].veredito, 'reduzir');
  assert.equal(r.pendentes[0].origem, 'saude');
  assert.equal(r.pendentes[0].budget_sugerido_centavos, null, 'ninguem calculou um numero — nao se inventa');
});

test('"atencao" sozinha NAO cria item: e observacao, nao pendencia', () => {
  const f = montarFila([], [], AGORA);
  const r = mesclarSaude(f, [{ campaign_id: 'x', saude: saudeAtencao }]);
  assert.equal(r.pendentes.length, 0);
});

test('alerta em campanha SILENCIADA nao ressuscita pela saude', () => {
  // Senao a recusa de 7 dias seria contornada por um caminho lateral.
  const f = montarFila([analise()], [{ campaign_id: 'c1', decisao: 'recusada', decidido_em: dias(-1), silenciar_ate: dias(6) }], AGORA);
  const r = mesclarSaude(f, [{ campaign_id: 'c1', saude: saudeAlerta }]);
  assert.equal(r.pendentes.length, 0);
});

test('alerta em campanha ja RESPONDIDA tambem nao volta', () => {
  const f = montarFila([analise()], [{ campaign_id: 'c1', decisao: 'aprovada', decidido_em: dias(0) }], AGORA);
  const r = mesclarSaude(f, [{ campaign_id: 'c1', saude: saudeAlerta }]);
  assert.equal(r.pendentes.length, 0);
});

test('itens de saude entram na mesma ordem por gasto', () => {
  const f = montarFila([analise({ campaign_id: 'media', budget_atual_centavos: 9000 })], [], AGORA);
  const r = mesclarSaude(f, [
    { campaign_id: 'grande', saude: saudeAlerta, budget_atual_centavos: 30000 },
    { campaign_id: 'pequena', saude: saudeAlerta, budget_atual_centavos: 1000 },
  ]);
  assert.deepEqual(r.pendentes.map((i) => i.campaign_id), ['grande', 'media', 'pequena']);
});

test('sem saude nenhuma a fila passa intacta', () => {
  const f = montarFila([analise()], [], AGORA);
  assert.deepEqual(mesclarSaude(f, []).pendentes.length, 1);
  assert.deepEqual(mesclarSaude(f, null).pendentes.length, 1);
});
