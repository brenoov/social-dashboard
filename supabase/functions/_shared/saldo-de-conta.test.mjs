import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lerSaldo, lerSaldoDoTexto, ehPrePaga, contasParaAvisar, montarAvisoDeSaldo } from './saldo-de-conta.js';

const prePaga = (texto) => ({ is_prepay_account: true, funding_source_details: { type: 20, display_string: texto } });
const cartao = { is_prepay_account: false, funding_source_details: { type: 1, display_string: 'VISA *4726' } };

// ── a armadilha: `balance` NAO e saldo ─────────────────────────────────────

test('conta de CARTAO nao tem saldo pra acabar', () => {
  // O caso real: a Raissa tem balance de R$ 1.486,79 — que e a FATURA, nao
  // saldo. Avisar "dura 1,9 dias" seria dizer o contrario do que acontece.
  const r = lerSaldo(cartao, 800);
  assert.equal(r.nivel, 'nao-se-aplica');
  assert.equal(r.centavos, null);
  assert.match(r.porque, /cartão/);
});

test('reconhece pre-paga pelo flag ou pelo tipo 20', () => {
  assert.equal(ehPrePaga({ is_prepay_account: true }), true);
  assert.equal(ehPrePaga({ funding_source_details: { type: 20 } }), true);
  assert.equal(ehPrePaga(cartao), false);
  assert.equal(ehPrePaga(null), false);
});

// ── o parse, que falha FECHADO ─────────────────────────────────────────────

test('le o saldo de dentro da frase, no formato pt-BR', () => {
  assert.equal(lerSaldoDoTexto('Saldo disponível (R$ 1.673,75 BRL)'), 167375);
  assert.equal(lerSaldoDoTexto('Saldo disponível (R$0,00 BRL)'), 0);
  assert.equal(lerSaldoDoTexto('Saldo disponível (R$ 87,50 BRL)'), 8750);
});

test('formato que nao reconhece devolve NULL, nunca zero', () => {
  // null = "nao sei" e cala o aviso. Zero seria uma AFIRMACAO de que acabou —
  // e mandaria um push dizendo que a conta parou quando ela esta rodando.
  for (const t of ['VISA *4726', 'Available balance: $1,673.75', 'Saldo disponível', '', null, undefined]) {
    assert.equal(lerSaldoDoTexto(t), null, `"${t}" deveria ser null`);
  }
});

test('exige os centavos: "R$ 1.673" sozinho nao vira 1673 reais', () => {
  // Sem os dois decimais nao da pra saber se o ponto e milhar ou decimal.
  assert.equal(lerSaldoDoTexto('Saldo disponível (R$ 1.673 BRL)'), null);
});

test('pre-paga com texto ilegivel cai em "nao-sei" e NAO vira aviso', () => {
  const r = lerSaldo(prePaga('formato novo da Meta'), 100);
  assert.equal(r.nivel, 'nao-sei');
  assert.deepEqual(contasParaAvisar([r]), [], 'aviso sem valor gera desconfianca e vira ruido');
});

// ── os niveis ──────────────────────────────────────────────────────────────

test('saldo zerado ja acabou — as campanhas NAO vao parar, elas pararam', () => {
  // Vessel real: R$ 0,00 gastando R$ 460/dia.
  const r = lerSaldo(prePaga('Saldo disponível (R$0,00 BRL)'), 460);
  assert.equal(r.nivel, 'acabou');
  assert.equal(r.diasRestantes, 0);
  assert.match(r.porque, /já podem ter parado/);
});

test('menos de um dia e critico; ate tres dias e atencao; acima disso ok', () => {
  assert.equal(lerSaldo(prePaga('Saldo disponível (R$ 100,00 BRL)'), 460).nivel, 'critico');
  assert.equal(lerSaldo(prePaga('Saldo disponível (R$ 200,00 BRL)'), 100).nivel, 'atencao');
  assert.equal(lerSaldo(prePaga('Saldo disponível (R$ 1.673,75 BRL)'), 101).nivel, 'ok');
});

test('sem saber o ritmo nao inventa prazo', () => {
  // R$ 200 sao dez dias numa conta que gasta R$ 20 e horas numa que gasta R$ 460.
  const r = lerSaldo(prePaga('Saldo disponível (R$ 200,00 BRL)'), 0);
  assert.equal(r.diasRestantes, null);
  assert.equal(r.nivel, 'ok');
  assert.match(r.porque, /não sei o ritmo/i);
});

// ── o que vira push ────────────────────────────────────────────────────────

test('so o urgente vira aviso, e o mais grave vem primeiro', () => {
  const avisos = contasParaAvisar([
    { nivel: 'atencao', diasRestantes: 2 },
    { nivel: 'ok', diasRestantes: 30 },
    { nivel: 'acabou', diasRestantes: 0 },
    { nivel: 'nao-sei' },
    { nivel: 'critico', diasRestantes: 0.4 },
  ]);
  assert.deepEqual(avisos.map((a) => a.nivel), ['acabou', 'critico', 'atencao']);
});

test('uma conta so: frase direta com o valor', () => {
  const a = montarAvisoDeSaldo([{ ...lerSaldo(prePaga('Saldo disponível (R$0,00 BRL)'), 460), conta: 'Vessel' }]);
  assert.equal(a.titulo, 'Vessel está sem saldo');
  assert.match(a.corpo, /R\$ 0,00/);
});

test('varias contas: a pior no titulo, as outras no corpo', () => {
  // Notificacao com lista longa nao se le na tela de bloqueio.
  const a = montarAvisoDeSaldo([
    { ...lerSaldo(prePaga('Saldo disponível (R$ 200,00 BRL)'), 100), conta: 'Breno Vale' },
    { ...lerSaldo(prePaga('Saldo disponível (R$0,00 BRL)'), 460), conta: 'Vessel' },
  ]);
  assert.match(a.titulo, /^Vessel está sem saldo/);
  assert.match(a.corpo, /Vessel: sem saldo/);
  assert.match(a.corpo, /Breno Vale: R\$ 200,00/);
});

test('nada urgente NAO gera push', () => {
  // Push que chega sem motivo ensina a ignorar push.
  assert.equal(montarAvisoDeSaldo([{ nivel: 'ok' }, { nivel: 'nao-se-aplica' }]), null);
  assert.equal(montarAvisoDeSaldo([]), null);
  assert.equal(montarAvisoDeSaldo(null), null);
});
