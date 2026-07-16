import { test } from 'node:test';
import assert from 'node:assert/strict';
import { derivarFeatures } from './derivar-features.js';

test('chave simples (sem ponto) entra sozinha, sem inventar pai', () => {
  assert.deepEqual(derivarFeatures({ social: ['ver'] }), ['social']);
});

test('chave com ponto gera a própria chave E o módulo-pai', () => {
  assert.deepEqual(derivarFeatures({ 'meta.gestor': ['ver', 'editar'] }), ['meta', 'meta.gestor']);
});

test('claude.status NÃO gera o pai "claude" (não é módulo de verdade)', () => {
  assert.deepEqual(derivarFeatures({ 'claude.status': ['ver'] }), ['claude.status']);
});

test('permissão sem "ver" não entra — nem a chave, nem o pai', () => {
  assert.deepEqual(derivarFeatures({ 'meta.gestor': ['editar'] }), []);
});

test('objeto vazio devolve lista vazia', () => {
  assert.deepEqual(derivarFeatures({}), []);
});

test('o exemplo do controlador, conferido linha a linha no banco', () => {
  const permissions = {
    'meta.gestor': ['ver', 'editar'],
    social: ['ver'],
    'claude.status': ['ver'],
  };
  assert.deepEqual(derivarFeatures(permissions), ['claude.status', 'meta', 'meta.gestor', 'social']);
});

test('vários filhos do mesmo pai não repetem o pai', () => {
  const permissions = {
    'meta.gestor': ['ver'],
    'meta.campanha': ['ver', 'exportar'],
    'meta.fabrica': ['ver'],
  };
  assert.deepEqual(derivarFeatures(permissions), ['meta', 'meta.campanha', 'meta.fabrica', 'meta.gestor']);
});

test('mistura: só os que têm "ver" entram', () => {
  const permissions = {
    'sales.metas': ['ver', 'editar'],
    'sales.analise': ['exportar'], // sem 'ver' → fora, e não puxa o pai
    banco: ['ver', 'criar'],
  };
  assert.deepEqual(derivarFeatures(permissions), ['banco', 'sales', 'sales.metas']);
});

test('não quebra com null/undefined nem com ações fora do formato', () => {
  assert.deepEqual(derivarFeatures(null), []);
  assert.deepEqual(derivarFeatures(undefined), []);
  assert.deepEqual(derivarFeatures({ social: null, banco: 'ver' }), []);
});

/* ── Super-admin: devolve null = "não mexa no features[]" ────────────────── */

test('super-admin com permissions vazio devolve null (não zera o features)', () => {
  // Este é o caso perigoso: derivar daria [] e o save REMOVERIA o acesso.
  assert.equal(derivarFeatures({}, { ehSuperadmin: true }), null);
});

test('super-admin com permissions preenchido também devolve null', () => {
  const permissions = { 'meta.gestor': ['ver', 'editar'], social: ['ver'] };
  assert.equal(derivarFeatures(permissions, { ehSuperadmin: true }), null);
});

test('ehSuperadmin: false deriva normalmente', () => {
  assert.deepEqual(derivarFeatures({ social: ['ver'] }, { ehSuperadmin: false }), ['social']);
});

test('sem opções (ou opções vazias) deriva normalmente — o padrão é não-super-admin', () => {
  assert.deepEqual(derivarFeatures({ social: ['ver'] }), ['social']);
  assert.deepEqual(derivarFeatures({ social: ['ver'] }, {}), ['social']);
});
