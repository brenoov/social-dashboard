import { test } from 'node:test';
import assert from 'node:assert/strict';
import { orcamentoBase, reaisParaCentavos, validarOrcamento, orcamentoParaEnvio } from './orcamento-form.js';

test('orcamentoBase: ABO/diario/50,00 (= o de hoje)', () => {
  assert.deepEqual(orcamentoBase(), { modo: 'ABO', tipo: 'diario', valorReais: '50,00', inicio: '', fim: '' });
});

test('reaisParaCentavos: aceita virgula, ponto, inteiro', () => {
  assert.equal(reaisParaCentavos('50,00'), 5000);
  assert.equal(reaisParaCentavos('50.00'), 5000);
  assert.equal(reaisParaCentavos('50'), 5000);
  assert.equal(reaisParaCentavos('1.234,56'), 123456);
  assert.equal(reaisParaCentavos(''), null);
  assert.equal(reaisParaCentavos('abc'), null);
});

test('validarOrcamento: valor abaixo do minimo (R$5) reprova', () => {
  assert.deepEqual(validarOrcamento({ modo: 'ABO', tipo: 'diario', valorReais: '3,00' }), { ok: false, erro: 'Valor mínimo é R$ 5,00.' });
});

test('validarOrcamento: total sem datas reprova; fim antes do inicio reprova', () => {
  assert.equal(validarOrcamento({ modo: 'ABO', tipo: 'total', valorReais: '300,00', inicio: '', fim: '' }).ok, false);
  assert.equal(validarOrcamento({ modo: 'ABO', tipo: 'total', valorReais: '300,00', inicio: '2026-08-10', fim: '2026-08-01' }).ok, false);
  assert.equal(validarOrcamento({ modo: 'ABO', tipo: 'total', valorReais: '300,00', inicio: '2026-08-01', fim: '2026-08-10' }).ok, true);
});

test('orcamentoParaEnvio: diario -> centavos sem datas; total -> datas ISO -03:00', () => {
  assert.deepEqual(orcamentoParaEnvio({ modo: 'CBO', tipo: 'diario', valorReais: '80,00', inicio: '', fim: '' }),
    { modo: 'CBO', tipo: 'diario', valor: 8000 });
  assert.deepEqual(orcamentoParaEnvio({ modo: 'ABO', tipo: 'total', valorReais: '300,00', inicio: '2026-08-01', fim: '2026-08-10' }),
    { modo: 'ABO', tipo: 'total', valor: 30000, inicio: '2026-08-01T00:00:00-03:00', fim: '2026-08-10T23:59:59-03:00' });
});
