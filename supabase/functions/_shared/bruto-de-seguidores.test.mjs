import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lerBrutoDoDia, atrasoDoBruto, recadoDeAtraso, CARENCIA_DE_DIAS } from './bruto-de-seguidores.js';

// As respostas abaixo são REAIS: foram medidas em 2026-08-06 chamando a Graph API
// com o token de produção do perfil Breno Vale (ig 17841401284454639), o mesmo
// token e a mesma URL que o coletor usa. Não são inventadas.

// 02/08 — o último dia em que a Meta publicou o número.
const respostaCheia = {
  data: [{
    name: 'follows_and_unfollows',
    period: 'day',
    total_value: { breakdowns: [{ dimension_keys: ['follow_type'], results: [
      { dimension_values: ['FOLLOWER'], value: 14 },
      { dimension_values: ['NON_FOLLOWER'], value: 33 },
    ] }] },
  }],
};

// 03/08 em diante — ESTE É O BUG. HTTP 200, o dia vem, o detalhamento vem, e a
// lista de resultados dentro dele vem vazia. Repare que não há erro nenhum para
// um `catch` pegar: para o código antigo isto era indistinguível de zero.
const respostaVazia = {
  data: [{
    name: 'follows_and_unfollows',
    period: 'day',
    total_value: { breakdowns: [{ dimension_keys: ['follow_type'] }] },
  }],
};

test('o dia publicado é lido com os dois números', () => {
  assert.deepEqual(lerBrutoDoDia(respostaCheia), { publicado: true, gained: 14, lost: 33 });
});

test('o dia SEM publicação não vira zero — vira "não publicado"', () => {
  // ESTE É O CONSERTO. Antes esta resposta e "zero pessoa seguiu" saíam iguais
  // daqui, e o painel desenhava as duas como a mesma barra zerada.
  const lido = lerBrutoDoDia(respostaVazia);
  assert.equal(lido.publicado, false);
  assert.equal(lido.gained, undefined);
});

test('zero de verdade continua sendo zero, e continua publicado', () => {
  // O outro lado: perfil pequeno em que ninguém seguiu nem saiu. A Meta manda os
  // dois valores, explicitamente zerados. Isso É dado, e não pode virar alerta.
  const zeroReal = { data: [{ total_value: { breakdowns: [{ results: [
    { dimension_values: ['FOLLOWER'], value: 0 },
    { dimension_values: ['NON_FOLLOWER'], value: 0 },
  ] }] } }] };
  assert.deepEqual(lerBrutoDoDia(zeroReal), { publicado: true, gained: 0, lost: 0 });
});

test('resposta sem dia nenhum também é "não publicado"', () => {
  assert.equal(lerBrutoDoDia({ data: [] }).publicado, false);
  assert.equal(lerBrutoDoDia(null).publicado, false);
});

// ── o atraso: quando vale acordar alguém ──────────────────────────────────

// O caso real de 2026-08-06: 01 e 02/08 publicados, 03 a 06/08 no vazio.
const casoReal = [
  { dia: '2026-08-01', publicado: true },
  { dia: '2026-08-02', publicado: true },
  { dia: '2026-08-03', publicado: false },
  { dia: '2026-08-04', publicado: false },
  { dia: '2026-08-05', publicado: false },
  { dia: '2026-08-06', publicado: false },
];

test('o caso real de 06/08 acusa atraso desde 03/08', () => {
  const a = atrasoDoBruto(casoReal, '2026-08-06');
  assert.equal(a.atrasado, true);
  assert.equal(a.desde, '2026-08-03');
  // 03 e 04/08 estão fechados há tempo bastante; 05 (ontem) e 06 (hoje) não contam.
  assert.equal(a.quantos, 2);
});

test('hoje e ontem sem número NÃO são alerta', () => {
  // É o comportamento normal da Meta: ela consolida com cerca de 1 dia de atraso.
  // Reclamar aqui faria o alarme tocar quase todo dia — o defeito que estamos
  // justamente evitando repetir.
  const soRecentes = [
    { dia: '2026-08-05', publicado: false },
    { dia: '2026-08-06', publicado: false },
  ];
  assert.equal(atrasoDoBruto(soRecentes, '2026-08-06').atrasado, false);
});

test('anteontem sem número JÁ é alerta (a carência é de 2 dias)', () => {
  const a = atrasoDoBruto([{ dia: '2026-08-04', publicado: false }], '2026-08-06');
  assert.equal(CARENCIA_DE_DIAS, 2);
  assert.equal(a.atrasado, true);
  assert.equal(a.desde, '2026-08-04');
});

test('tudo publicado não gera recado nenhum', () => {
  const a = atrasoDoBruto([
    { dia: '2026-07-30', publicado: true },
    { dia: '2026-07-31', publicado: true },
  ], '2026-08-06');
  assert.equal(a.atrasado, false);
  assert.equal(recadoDeAtraso('Breno Vale', a), null);
});

test('a ordem em que os dias chegam não importa', () => {
  const embaralhado = [casoReal[3], casoReal[0], casoReal[2], casoReal[5], casoReal[1], casoReal[4]];
  assert.equal(atrasoDoBruto(embaralhado, '2026-08-06').desde, '2026-08-03');
});

test('o recado sai em português, com a data e a conta do sujeito', () => {
  const recado = recadoDeAtraso('Breno Vale', atrasoDoBruto(casoReal, '2026-08-06'));
  assert.equal(recado, 'Breno Vale: o Instagram não publica seguiram/deixaram desde 03/08 (2 dias sem número)');
});

test('um dia só sai no singular', () => {
  const recado = recadoDeAtraso('Vessel', atrasoDoBruto([{ dia: '2026-08-04', publicado: false }], '2026-08-06'));
  assert.match(recado, /\(1 dia sem número\)$/);
});
