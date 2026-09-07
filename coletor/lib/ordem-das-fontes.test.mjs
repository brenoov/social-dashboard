import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/* ⚠️⚠️ A ORDEM DAS FONTES DE FOTO — E POR QUE ELA ESTA INVERTIDA HOJE.
 *
 * O padrao era o Bling primeiro. Em 07/09/2026 o dono percebeu que varios
 * cadastros do Bling ainda tem foto de enquadramento ruim, enquanto a pasta do
 * Zoho ja tem a tratada. Conferido na mesma bolsa (Cerne Croco Preto): na do
 * Bling a alca esticada ocupa dois tercos da imagem.
 *
 * ISTO E PALIATIVO. O conserto de verdade e subir as fotos tratadas no Bling —
 * e a foto do Bling que aparece na loja, onde a cliente decide comprar. Este
 * teste existe para que a inversao nao vire permanente por esquecimento: ele
 * COBRA que o comentario explicando o porque e o "quando desfazer" continuem
 * la, junto do codigo. */

const ROBO = readFileSync(new URL('../fotos-do-selo-do-bling.mjs', import.meta.url), 'utf8');

test('o Zoho e consultado ANTES do Bling', () => {
  const zoho = ROBO.indexOf('fotosDoZohoParaSku(lote.sku)');
  const bling = ROBO.indexOf('imagensGrandesDoProduto(produto)');
  assert.ok(zoho > -1 && bling > -1, 'nao achei as duas fontes');
  assert.ok(zoho < bling, 'a ordem voltou a ser Bling primeiro');
});

test('o Bling continua sendo a queda — nunca se fica sem fonte', () => {
  assert.match(ROBO, /if \(!urls\.length\) \{\s*\n\s*urls = imagensGrandesDoProduto/,
    'sem a queda, produto sem pasta no Zoho ficaria sem foto mesmo tendo no Bling');
});

test('⚠️ o PORQUE da inversao esta escrito junto do codigo', () => {
  /* Sem isto, daqui a tres meses alguem le "Zoho primeiro" e conclui que o Zoho
   * e a fonte oficial — e o paliativo vira desenho. */
  assert.match(ROBO, /ORDEM INVERTIDA EM 07\/09\/2026, E ISTO E PALIATIVO/);
  assert.match(ROBO, /TEM DATA PARA MORRER/,
    'sumiu a instrucao de quando desfazer');
  assert.match(ROBO, /onde a\s*\n?\s*\/\/ cliente DECIDE COMPRAR|cliente DECIDE COMPRAR/,
    'sumiu o motivo de o Bling ser o certo no fim');
});

test('falha do Zoho NAO derruba a rodada — cai no Bling', () => {
  // O Zoho fora do ar nao pode significar nenhuma foto para ninguem.
  // Ancorado na CHAMADA, e nao no `import` — que aparece primeiro no arquivo e
  // fez este teste olhar para o lugar errado na primeira versao.
  const trecho = ROBO.slice(ROBO.indexOf('fotosDoZohoParaSku(lote.sku)'));
  assert.match(trecho.slice(0, 900), /catch \(e\)/);
  assert.match(trecho.slice(0, 900), /tentando o Bling/);
});

test('⚠️ `--refazer` existe, e o robo o usa nos DOIS lugares', () => {
  /* Quando a ordem das fontes muda, quem ja tem foto continua com a da fonte
   * antiga PARA SEMPRE — porque "ja tem foto" e a condicao de ser ignorado.
   * Sao dois filtros: o que escolhe os lotes e o que decide baixar a foto. Um
   * so nao basta, e foi assim que quase ficou. */
  assert.match(ROBO, /const REFAZER = process\.argv\.includes\('--refazer'\)/);
  assert.match(ROBO, /lotesParaOlhar\(lotes, \{ refazer: REFAZER \}\)/,
    'sem isto o lote com foto nem entra na lista');
  assert.match(ROBO, /if \(falta\.faltaFoto \|\| REFAZER\)/,
    'sem isto o lote entra na lista mas a foto nao e rebaixada');
});

test('refazer NAO e o padrao — rebaixar tudo todo dia gasta cota a toa', () => {
  assert.ok(!/const REFAZER = true/.test(ROBO));
});
