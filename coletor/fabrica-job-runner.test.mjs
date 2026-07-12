import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estadoTerminalSubir, statusCampanhaGerar } from './fabrica-job-runner.mjs';

test('subir 100% -> concluido + fecha', () => {
  assert.deepEqual(estadoTerminalSubir({ pendentes: 0, adIds: ['a'] }), { status: 'concluido', fecha: true });
});
test('subir parcial (rate limit) -> erro + não fecha', () => {
  const r = estadoTerminalSubir({ pendentes: 3, adIds: ['a'] });
  assert.equal(r.status, 'erro'); assert.equal(r.fecha, false);
});
test('statusCampanhaGerar: sucesso->pronta, falha->erro', () => {
  assert.equal(statusCampanhaGerar(true), 'pronta');
  assert.equal(statusCampanhaGerar(false), 'erro');
});
