import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizarGrupo, mesmoGrupo, gruposExistentes,
  agruparCanais, timePorCanal, contarSemGrupo,
} from './grupo-do-canal.js';

// Canais reais, medidos no banco em 20/08/2026.
const CANAIS = [
  { loja_id: 205451611, nome: 'Atacado Nuvem Shop', grupo: 'Atacado' },
  { loja_id: 205657609, nome: 'Loja Dom Pedro', grupo: 'Varejo' },
  { loja_id: 205834140, nome: "Loja Santa Bárbara d'Oeste", grupo: 'Varejo' },
  { loja_id: 205395333, nome: 'Atacado Fábrica', grupo: null },
  { loja_id: 205513124, nome: 'Varejo Fábrica', grupo: '' },
];

test('normalizar: tira espaço das pontas, junta espaço repetido, vazio vira nulo', () => {
  assert.equal(normalizarGrupo('  Atacado  '), 'Atacado');
  assert.equal(normalizarGrupo('Loja  de   Fábrica'), 'Loja de Fábrica');
  assert.equal(normalizarGrupo(''), null);
  assert.equal(normalizarGrupo('   '), null);
  assert.equal(normalizarGrupo(null), null);
  assert.equal(normalizarGrupo(undefined), null);
});

test('mesmoGrupo ignora maiúscula e espaço — senão nascem dois grupos que parecem um', () => {
  assert.ok(mesmoGrupo('Atacado', 'atacado'));
  assert.ok(mesmoGrupo(' Varejo ', 'VAREJO'));
  assert.ok(mesmoGrupo(null, ''));
  assert.ok(!mesmoGrupo('Atacado', 'Varejo'));
  assert.ok(!mesmoGrupo('Atacado', null));
});

test('gruposExistentes: sem repetir, em ordem, guardando a grafia da primeira vez', () => {
  const canais = [
    { loja_id: 1, nome: 'a', grupo: 'Varejo' },
    { loja_id: 2, nome: 'b', grupo: 'atacado' },
    { loja_id: 3, nome: 'c', grupo: 'VAREJO' },
    { loja_id: 4, nome: 'd', grupo: null },
  ];
  assert.deepEqual(gruposExistentes(canais), ['atacado', 'Varejo']);
});

test('gruposExistentes com lista vazia devolve lista vazia, não quebra', () => {
  assert.deepEqual(gruposExistentes([]), []);
  assert.deepEqual(gruposExistentes(null), []);
});

test('agruparCanais: um balde por grupo, e o SEM GRUPO por último', () => {
  const r = agruparCanais(CANAIS);
  assert.deepEqual(r.map((b) => b.grupo), ['Atacado', 'Varejo', null]);
  assert.deepEqual(r[0].canais.map((c) => c.nome), ['Atacado Nuvem Shop']);
  assert.equal(r[1].canais.length, 2);
  // Canal sem grupo NÃO some: sumir do seletor é o defeito que a Peça 2 evita.
  assert.deepEqual(r[2].canais.map((c) => c.nome), ['Atacado Fábrica', 'Varejo Fábrica']);
});

test('agruparCanais: sem nenhum canal agrupado, existe só o balde sem grupo', () => {
  const r = agruparCanais([{ loja_id: 1, nome: 'x', grupo: null }]);
  assert.equal(r.length, 1);
  assert.equal(r[0].grupo, null);
});

test('agruparCanais: todos agrupados, o balde sem grupo NÃO aparece vazio', () => {
  const r = agruparCanais([{ loja_id: 1, nome: 'x', grupo: 'Atacado' }]);
  assert.deepEqual(r.map((b) => b.grupo), ['Atacado']);
});

test('agruparCanais mantém a ordem dos canais dentro do balde', () => {
  const r = agruparCanais([
    { loja_id: 2, nome: 'B', grupo: 'Atacado' },
    { loja_id: 1, nome: 'A', grupo: 'Atacado' },
  ]);
  assert.deepEqual(r[0].canais.map((c) => c.nome), ['B', 'A']);
});

test('agruparCanais junta grafias diferentes do mesmo grupo num balde só', () => {
  const r = agruparCanais([
    { loja_id: 1, nome: 'A', grupo: 'Atacado' },
    { loja_id: 2, nome: 'B', grupo: 'atacado' },
  ]);
  assert.equal(r.length, 1);
  assert.equal(r[0].canais.length, 2);
});

test('timePorCanal casa o time pelo canal, e canal sem time não aparece', () => {
  const times = [
    { id: 't1', nome: 'Dom Pedro', canal_loja_id: 205657609 },
    { id: 't2', nome: 'Iguatemi Campinas', canal_loja_id: null },
  ];
  const mapa = timePorCanal(times);
  assert.equal(mapa.get('205657609').nome, 'Dom Pedro');
  assert.equal(mapa.get('205451611'), undefined);
  assert.equal(mapa.size, 1, 'time sem canal não entra no mapa');
});

test('timePorCanal acha o time mesmo quando o id vem como texto', () => {
  // O id vem number do banco e string do formulário — casar por texto evita o
  // de-para silencioso que faz a linha dizer "sem time" com o time ali.
  const mapa = timePorCanal([{ id: 't1', nome: 'Dom Pedro', canal_loja_id: '205657609' }]);
  assert.equal(mapa.get(String(205657609)).nome, 'Dom Pedro');
});

test('contarSemGrupo conta o que falta configurar', () => {
  assert.equal(contarSemGrupo(CANAIS), 2);
  assert.equal(contarSemGrupo([]), 0);
  assert.equal(contarSemGrupo(null), 0);
});
