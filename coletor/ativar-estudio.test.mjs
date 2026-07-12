import { test } from 'node:test';
import assert from 'node:assert/strict';
import { run, alvos } from './ativar-estudio.mjs';
import { estadoTerminalAtivar } from './fabrica-job-runner.mjs';

test('run() exportada', () => { assert.equal(typeof run, 'function'); });

test('run({dry:true}) não ativa e não faz nenhuma chamada ao Graph', async () => {
  const r = await run({ adIds: ['a'], adsetIds: ['s'], metaCampaignId: 'c', criouCampanha: true, dry: true });
  assert.deepEqual(r, { ativados: 0, total: 0, falhas: [] });
});

test('alvos(): existente = só ads; nova = ads+adsets+campaign', () => {
  assert.deepEqual(alvos({ adIds: ['a1', 'a2'], adsetIds: ['s1'], metaCampaignId: 'c', criouCampanha: false }), ['a1', 'a2']);
  assert.deepEqual(alvos({ adIds: ['a1'], adsetIds: ['s1'], metaCampaignId: 'c', criouCampanha: true }), ['a1', 's1', 'c']);
});

// --- run(): happy path e falha parcial, com `meta` injetado (mesma seam de subirCriativos) -----
test('run(): todos ativam com sucesso -> ativados===total, falhas vazio', async () => {
  const chamadas = [];
  const meta = async (path) => { chamadas.push(path); return { status: 200, d: { id: path } }; };
  const r = await run({ adIds: ['a1', 'a2'], adsetIds: [], metaCampaignId: 'c', criouCampanha: false, meta });
  assert.equal(r.ativados, 2);
  assert.equal(r.total, 2);
  assert.deepEqual(r.falhas, []);
  assert.deepEqual(chamadas, ['/a1', '/a2']);
});

test('run(): um id falha (status não-200) -> reportado em falhas, ativados < total', async () => {
  const meta = async (path) => {
    if (path === '/a2') return { status: 400, d: { error: { message: 'ad reprovado' } } };
    return { status: 200, d: { id: path } };
  };
  const r = await run({ adIds: ['a1', 'a2', 'a3'], adsetIds: [], metaCampaignId: 'c', criouCampanha: false, meta });
  assert.equal(r.ativados, 2);
  assert.equal(r.total, 3);
  assert.deepEqual(r.falhas, ['a2']);
});

// --- run(): meta() injetado que THROWS (ex.: rate-limit esgotou as 5 retries do meta() real) não
// pode abortar o loop — ads já ativados antes do throw já estão gastando (money-path); o id que
// throwou vira falha contada e o loop continua pros ids seguintes. -----------------------------
test('run(): um id lança erro (rate-limit esgotado) -> não propaga, id vai pra falhas, resto segue', async () => {
  const chamadas = [];
  const meta = async (path) => {
    chamadas.push(path);
    if (path === '/a2') throw new Error('code 17 request limit');
    return { status: 200, d: { id: path } };
  };
  const r = await run({ adIds: ['a1', 'a2', 'a3'], adsetIds: [], metaCampaignId: 'c', criouCampanha: false, meta });
  assert.equal(r.ativados, 2);
  assert.equal(r.total, 3);
  assert.deepEqual(r.falhas, ['a2']);
  assert.deepEqual(chamadas, ['/a1', '/a2', '/a3']);
});

// --- estadoTerminalAtivar(): mapeia o resultado de run() pro estado terminal do job -------------
test('estadoTerminalAtivar(): 100% ativado -> concluido', () => {
  assert.deepEqual(estadoTerminalAtivar({ ativados: 3, total: 3, falhas: [] }), { status: 'concluido' });
});

test('estadoTerminalAtivar(): ativação parcial -> erro, com contagem e aviso de já-ativos na mensagem', () => {
  const r = estadoTerminalAtivar({ ativados: 2, total: 3, falhas: ['a2'] });
  assert.equal(r.status, 'erro');
  assert.match(r.erro, /2 de 3/);
  assert.match(r.erro, /1 não ativaram/);
  assert.match(r.erro, /já estar ativos/);
});
