import { test } from 'node:test';
import assert from 'node:assert/strict';
import { capturaDoAgregado, capturaEstaNaJanela } from './captura-do-agregado.js';

// O CASO REAL QUE ORIGINOU ESTE MÓDULO (medido em produção, 17/08/2026):
// Breno Vale, período 7D (janela 10/08..17/08), tipo "Site e alcance". As
// campanhas desse tipo estão paradas desde junho, então a consulta — que só
// limita a data por cima — devolvia a captura de 08/06 como se fosse a semana.
const siteEAlcanceDoBrenoVale = [
  { campaign_id: '120210000000000001', captured_at: '2026-06-08', spend: '6.32', impressions: '488', clicks: '2', reach: '478' },
];
const janela7D = { inicio: '2026-08-10', fim: '2026-08-17' };

test('captura de 70 dias atrás NÃO vira a semana: nenhuma linha, e a data volta pro aviso', () => {
  const c = capturaDoAgregado(siteEAlcanceDoBrenoVale, janela7D);
  assert.equal(c.foraDaJanela, true);
  assert.deepEqual(c.linhas, [], 'sem linha não há soma — o cartão mostra "—"');
  assert.equal(c.data, '2026-06-08', 'a data continua vindo: é ela que a tela escreve no aviso');
});

test('captura de dentro da janela vale, e só ela — a anterior não entra na soma', () => {
  const linhas = [
    { campaign_id: '1', captured_at: '2026-08-17', spend: '100' },
    { campaign_id: '2', captured_at: '2026-08-17', spend: '50' },
    { campaign_id: '1', captured_at: '2026-08-16', spend: '90' },
  ];
  const c = capturaDoAgregado(linhas, janela7D);
  assert.equal(c.foraDaJanela, false);
  assert.equal(c.linhas.length, 2);
  assert.equal(c.linhas.reduce((s, r) => s + parseFloat(r.spend), 0), 150);
});

test('a captura do primeiro dia da janela ainda vale (a borda é inclusiva dos dois lados)', () => {
  assert.equal(capturaDoAgregado([{ captured_at: '2026-08-10' }], janela7D).foraDaJanela, false);
  assert.equal(capturaDoAgregado([{ captured_at: '2026-08-17' }], janela7D).foraDaJanela, false);
  assert.equal(capturaDoAgregado([{ captured_at: '2026-08-09' }], janela7D).foraDaJanela, true);
});

test('resposta vazia NÃO é captura velha: fora da janela fica falso e não há aviso a dar', () => {
  const c = capturaDoAgregado([], janela7D);
  assert.deepEqual(c, { data: null, foraDaJanela: false, linhas: [] });
});

test('entrada que não é lista (erro de leitura) devolve o mesmo vazio, sem quebrar', () => {
  assert.deepEqual(capturaDoAgregado(null, janela7D), { data: null, foraDaJanela: false, linhas: [] });
  assert.deepEqual(capturaDoAgregado(undefined, janela7D), { data: null, foraDaJanela: false, linhas: [] });
});

test('HOJE e 1D pedem um dia exato: janela de um dia só aceita aquele dia', () => {
  const umDia = { inicio: '2026-08-17', fim: '2026-08-17' };
  assert.equal(capturaEstaNaJanela('2026-08-17', umDia), true);
  assert.equal(capturaEstaNaJanela('2026-08-16', umDia), false);
  assert.equal(capturaEstaNaJanela('2026-08-18', umDia), false);
});

test('sem janela nenhuma, nada é recusado — o comportamento antigo continua alcançável', () => {
  assert.equal(capturaEstaNaJanela('2026-06-08', {}), true);
  assert.equal(capturaEstaNaJanela('2026-06-08', undefined), true);
});

test('data ausente nunca vale por si: sem data não há como provar que está na janela', () => {
  assert.equal(capturaEstaNaJanela(null, janela7D), false);
  assert.equal(capturaEstaNaJanela('', janela7D), false);
});
