import { test } from 'node:test';
import assert from 'node:assert/strict';
import { janelaDoRecorte, alvosPendentes } from './janelas-de-backfill.mjs';

test('recorte 0 é o dia isolado', () => {
  assert.deepEqual(janelaDoRecorte('2026-08-14', 0), { since: '2026-08-14', until: '2026-08-14' });
});

test('recortes de N dias terminam no dia da captura e começam N dias antes', () => {
  // É a conta que coletarAdsPorCampanha faz: d = hoje; d.setDate(d.getDate() - dias).
  assert.deepEqual(janelaDoRecorte('2026-08-14', 7), { since: '2026-08-07', until: '2026-08-14' });
  assert.deepEqual(janelaDoRecorte('2026-08-14', 30), { since: '2026-07-15', until: '2026-08-14' });
  assert.deepEqual(janelaDoRecorte('2026-08-14', 1), { since: '2026-08-13', until: '2026-08-14' });
});

test('recorte 1 NÃO é o mesmo que o recorte 0', () => {
  assert.notDeepEqual(janelaDoRecorte('2026-08-14', 1), janelaDoRecorte('2026-08-14', 0));
});

test('recorte 99 é do primeiro dia do mês até o dia', () => {
  assert.deepEqual(janelaDoRecorte('2026-08-14', 99), { since: '2026-08-01', until: '2026-08-14' });
  assert.deepEqual(janelaDoRecorte('2026-03-03', 99), { since: '2026-03-01', until: '2026-03-03' });
});

test('a virada de mês e de ano não escorrega um dia', () => {
  assert.deepEqual(janelaDoRecorte('2026-03-01', 1), { since: '2026-02-28', until: '2026-03-01' });
  assert.deepEqual(janelaDoRecorte('2026-01-01', 30), { since: '2025-12-02', until: '2026-01-01' });
});

test('recorte desconhecido devolve null em vez de inventar janela', () => {
  assert.equal(janelaDoRecorte('2026-08-14', 3), null);
  assert.equal(janelaDoRecorte('2026-08-14', null), null);
});

test('alvos: uma chamada por conta+data+recorte, sem repetir campanha', () => {
  const linhas = [
    { account_id: 'A', captured_at: '2026-08-01', period_days: 30 },
    { account_id: 'A', captured_at: '2026-08-01', period_days: 30 },
    { account_id: 'A', captured_at: '2026-08-02', period_days: 30 },
    { account_id: 'B', captured_at: '2026-08-01', period_days: 0 },
  ];
  const alvos = alvosPendentes(linhas);
  assert.equal(alvos.length, 3);
});

test('alvos vêm do mais antigo para o mais novo', () => {
  const linhas = [
    { account_id: 'A', captured_at: '2026-08-09', period_days: 7 },
    { account_id: 'A', captured_at: '2026-05-19', period_days: 7 },
  ];
  // O mais antigo primeiro: se o limite da Meta interromper no meio, o que ficou
  // de fora é o mais recente — que é o que a próxima rodada do coletor cobre sozinha.
  assert.equal(alvosPendentes(linhas)[0].captured_at, '2026-05-19');
});

test('alvo de recorte desconhecido é descartado, não vira chamada', () => {
  assert.deepEqual(alvosPendentes([{ account_id: 'A', captured_at: '2026-08-01', period_days: 3 }]), []);
});
