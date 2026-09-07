import test from 'node:test';
import assert from 'node:assert/strict';
import { skuDaPasta, pastaDoSku, ehDesenhoAMao, fotosDaPasta } from './fotos-do-zoho.mjs';

/* A SEGUNDA FONTE DE FOTOS (07/09/2026).
 *
 * O Bling e o padrao. O Zoho so entra quando o produto NAO TEM foto no cadastro
 * do Bling — 18 lotes estavam assim. Regra do dono. */

test('skuDaPasta: tira o SKU do nome, em qualquer posicao', () => {
  assert.equal(skuDaPasta('Ravelle_Pequena_Jeans - SS0001SB.S1'), 'SS0001SB.S1');
  assert.equal(skuDaPasta('SS0002HB.B2 - Cerne'), 'SS0002HB.B2');
  assert.equal(skuDaPasta('ss0001hb.m1 minusculo'), 'SS0001HB.M1');
});

test('skuDaPasta: pasta sem SKU devolve nulo', () => {
  assert.equal(skuDaPasta('Hand_Pequena_Vermelha'), null);
  assert.equal(skuDaPasta(''), null);
  assert.equal(skuDaPasta(null), null);
});

test('⚠️ pastaDoSku NAO adivinha pelo nome parecido', () => {
  /* Adivinhar poria a foto de OUTRA bolsa num certificado de autenticidade — o
   * erro que destroi exatamente a coisa que o selo existe para provar. */
  const pastas = [
    { nome: 'Linear_Caramelo - SS0001HB.M1' },
    { nome: 'Linear_Chocolate' },           // mesmo modelo, SEM sku
    { nome: 'Hand_Pequena_Vermelha' },
  ];
  assert.equal(pastaDoSku(pastas, 'SS0001HB.M1').nome, 'Linear_Caramelo - SS0001HB.M1');
  // "Linear_Chocolate" e o par obvio de SS0001HB.M4 — e mesmo assim: nulo.
  assert.equal(pastaDoSku(pastas, 'SS0001HB.M4'), null);
  assert.equal(pastaDoSku(pastas, 'SS0010HB.S1'), null);
});

test('⚠️ DUAS pastas com o mesmo SKU devolvem nulo — ambiguidade vira foto errada', () => {
  const pastas = [{ nome: 'A - SS0001HB.M1' }, { nome: 'B - SS0001HB.M1' }];
  assert.equal(pastaDoSku(pastas, 'SS0001HB.M1'), null);
});

test('pastaDoSku: SKU malformado nao casa com nada', () => {
  const pastas = [{ nome: 'Linear - SS0001HB.M1' }];
  for (const ruim of ['', null, 'SS0001HB', 'qualquer coisa']) {
    assert.equal(pastaDoSku(pastas, ruim), null, `casou com "${ruim}"`);
  }
});

test('⚠️ o DESENHO A MAO da Raissa fica de fora — pedido explicito do dono', () => {
  /* Medido em cinco pastas: as fotos sao `Modelo_Cor_Angulo.png` e o desenho e
   * sempre o arquivo SOLTO, em maiusculas, sem sublinhado. */
  for (const desenho of ['LINEAR.jpeg', 'CERNE.jpeg', 'SOLENNE.jpeg', 'RAVELLE.jpg']) {
    assert.equal(ehDesenhoAMao(desenho), true, `deixou passar o desenho: ${desenho}`);
  }
});

test('a regra do desenho e por SUBLINHADO, e nao por extensao', () => {
  // `.jpeg` tambem aparece em foto de verdade em outras pastas; trocar a
  // extensao do desenho o traria de volta se a regra fosse essa.
  assert.equal(ehDesenhoAMao('Linear_Caramelo_Frente.jpeg'), false);
  assert.equal(ehDesenhoAMao('LINEAR.png'), true);
});

test('desenho nomeado com sublinhado tambem e barrado, pelo cinto e suspensorio', () => {
  assert.equal(ehDesenhoAMao('Linear_Desenho_Assinado.png'), true);
  assert.equal(ehDesenhoAMao('Croqui_Raissa.png'), true);
});

test('fotosDaPasta: so imagens, sem o desenho, e a FRENTE primeiro', () => {
  const arquivos = [
    { nome: 'LINEAR.jpeg' },
    { nome: 'LINEAR_Caramelo_Costas.png' },
    { nome: 'LINEAR_Caramelo_Frente.png' },
    { nome: 'LINEAR_Caramelo_Lateralizada.png' },
    { nome: 'leiame.txt' },
    { nome: 'subpasta', ehPasta: true },
  ];
  assert.deepEqual(fotosDaPasta(arquivos).map((a) => a.nome), [
    'LINEAR_Caramelo_Frente.png',
    'LINEAR_Caramelo_Lateralizada.png',
    'LINEAR_Caramelo_Costas.png',
  ]);
});

test('⚠️ a ordem e ESTAVEL — a foto 1 nao troca sozinha entre duas rodadas', () => {
  /* A foto 1 e a capa do certificado. Se a ordem dependesse da ordem que o Zoho
   * devolveu, a capa mudaria de uma rodada para outra sem ninguem mexer. */
  const a = [{ nome: 'X_Cor_Detalhe2.png' }, { nome: 'X_Cor_Detalhe1.png' }];
  assert.deepEqual(fotosDaPasta(a).map((f) => f.nome), fotosDaPasta(a.slice().reverse()).map((f) => f.nome));
});

test('pasta vazia ou so com desenho nao devolve foto nenhuma', () => {
  assert.deepEqual(fotosDaPasta([]), []);
  assert.deepEqual(fotosDaPasta([{ nome: 'LINEAR.jpeg' }]), []);
  assert.deepEqual(fotosDaPasta(null), []);
});
