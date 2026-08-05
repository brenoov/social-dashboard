import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizarCodigo, pecaDaSerie, mesPorExtenso, dataPorExtenso,
  whatsappLimpo, whatsappValido,
} from '../public/verify/regras.js';

test('normalizarCodigo: maiusculas, sem espaco nem hifen', () => {
  assert.equal(normalizarCodigo(' k7m4-x9qp 2r '), 'K7M4X9QP2R');
});

test('normalizarCodigo: nao inventa letra que nao existe no alfabeto', () => {
  // O alfabeto do codigo nao tem O, 0, I nem 1. Se a cliente digitar um desses,
  // a funcao NAO adivinha o que ela quis dizer — so limpa e sobe. A busca nao
  // acha e a pagina mostra "nao conseguimos confirmar", que e o comportamento
  // certo: melhor dizer que nao confirmou do que confirmar a peca errada.
  assert.equal(normalizarCodigo('k7m4x9qp2r'), 'K7M4X9QP2R');
  assert.equal(normalizarCodigo('K7M4 X9QP-2R'), 'K7M4X9QP2R');
});

test('pecaDaSerie: sempre duas casas', () => {
  assert.equal(pecaDaSerie(7, 20), '07 de 20');
  assert.equal(pecaDaSerie(12, 200), '12 de 200');
});

test('mesPorExtenso: mes e ano, em portugues', () => {
  assert.equal(mesPorExtenso('2026-03-09'), 'março de 2026');
});

test('dataPorExtenso: dia, mes e ano', () => {
  assert.equal(dataPorExtenso('2028-08-04'), '4 de agosto de 2028');
});

test('dataPorExtenso: aguenta o timestamp que o banco devolve', () => {
  // registrado_em vem como timestamptz ("2026-03-12T18:22:05.123+00:00"), nao
  // como data pura. Sem o corte, o dia sairia grudado na hora.
  assert.equal(dataPorExtenso('2026-03-12T18:22:05.123+00:00'), '12 de março de 2026');
});

test('whatsappLimpo: so digitos', () => {
  assert.equal(whatsappLimpo('(19) 99123-4567'), '19991234567');
});

test('whatsappValido: aceita 10 e 11 digitos, recusa o resto', () => {
  assert.equal(whatsappValido('(19) 99123-4567'), true);
  assert.equal(whatsappValido('1991234567'), true);
  assert.equal(whatsappValido('991234567'), false);
  assert.equal(whatsappValido('199912345678'), false);
});
