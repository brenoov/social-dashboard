import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emVeiculacao, motivoDeNaoVeicular } from './veiculacao.js';

const AGORA = Date.parse('2026-07-29T12:00:00Z');
const dias = (n) => new Date(AGORA + n * 86400000).toISOString();

test('ACTIVE sem data de fim esta rodando', () => {
  assert.equal(emVeiculacao({ effective_status: 'ACTIVE' }, AGORA), true);
});

test('ACTIVE com fim NO PASSADO nao esta rodando', () => {
  // O caso real: "Post do Instagram: Vamos Brasillll" terminou em 05/07 e a
  // Meta continua devolvendo ACTIVE. A fila pedia decisao de orcamento nela
  // quase um mes depois.
  assert.equal(emVeiculacao({ effective_status: 'ACTIVE', stop_time: dias(-24) }, AGORA), false);
  assert.equal(motivoDeNaoVeicular({ effective_status: 'ACTIVE', stop_time: dias(-24) }, AGORA), 'campanha já terminou');
});

test('ACTIVE com fim NO FUTURO continua rodando', () => {
  assert.equal(emVeiculacao({ effective_status: 'ACTIVE', stop_time: dias(10) }, AGORA), true);
  assert.equal(motivoDeNaoVeicular({ effective_status: 'ACTIVE', stop_time: dias(10) }, AGORA), null);
});

test('pausada, arquivada e apagada nao estao rodando — e cada uma diz por que', () => {
  assert.equal(emVeiculacao({ effective_status: 'PAUSED' }, AGORA), false);
  assert.equal(motivoDeNaoVeicular({ effective_status: 'PAUSED' }, AGORA), 'campanha pausada');
  assert.equal(motivoDeNaoVeicular({ effective_status: 'ARCHIVED' }, AGORA), 'campanha arquivada');
});

test('data ilegivel NAO encerra a campanha por engano', () => {
  // O pior caso aqui e uma sugestao a mais; o oposto seria uma campanha viva
  // sumindo da tela sem explicacao.
  assert.equal(emVeiculacao({ effective_status: 'ACTIVE', stop_time: 'qualquer coisa' }, AGORA), true);
});

test('aceita `status` quando `effective_status` nao veio', () => {
  assert.equal(emVeiculacao({ status: 'ACTIVE' }, AGORA), true);
  assert.equal(emVeiculacao({ status: 'PAUSED' }, AGORA), false);
});

test('campanha inexistente nao esta rodando', () => {
  assert.equal(emVeiculacao(null, AGORA), false);
  assert.equal(motivoDeNaoVeicular(null, AGORA), 'campanha não encontrada');
});

test('o limite e exato: um segundo depois do fim ja parou', () => {
  const fim = new Date(AGORA).toISOString();
  assert.equal(emVeiculacao({ effective_status: 'ACTIVE', stop_time: fim }, AGORA), false);
  assert.equal(emVeiculacao({ effective_status: 'ACTIVE', stop_time: fim }, AGORA - 1000), true);
});
