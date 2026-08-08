import test from 'node:test';
import assert from 'node:assert/strict';
import { acharPasta, nomeComparavel, semPrefixo } from './pasta-do-zoho.js';

// A lista real que a central tem hoje (importada em 17/07/2026), reduzida ao
// que importa. Os nomes e o formato do external_id são os de verdade — o
// external_id longo em hexadecimal é WorkDrive; o formato com "!" é OneDrive,
// e não entra aqui.
const PASTAS = [
  { nome: '01. RBV and Company', external_id: 'wbp6sefe483fe7da14c6ebe53225105f1f389' },
  { nome: '01. Gestão de Serviços', external_id: 'b71f53e58f4d3383f4aebb9b3439c64851002' },
  { nome: '02. Comercial', external_id: 'aaa111' },
];

test('nomeComparavel tira acento, caixa e espaço sobrando', () => {
  assert.equal(nomeComparavel('  Gestão   de  Serviços '), 'gestao de servicos');
  assert.equal(nomeComparavel('01. Gestão de Serviços'), '01. gestao de servicos');
});

test('semPrefixo tira o número de ordenação em várias grafias', () => {
  assert.equal(semPrefixo('01. Gestão de Serviços'), 'gestao de servicos');
  assert.equal(semPrefixo('2 - Comercial'), 'comercial');
  assert.equal(semPrefixo('3) Financeiro'), 'financeiro');
});

test('semPrefixo NÃO esvazia um nome que é só número', () => {
  // "2026" é nome de pasta, não prefixo. Se virasse vazio, casaria com
  // qualquer outra pasta de nome vazio — casamento por acidente.
  assert.equal(semPrefixo('2026'), '2026');
});

test('acha a pasta mesmo procurando sem o prefixo numérico', () => {
  const r = acharPasta(PASTAS, 'Gestão de Serviços');
  assert.equal(r.erro, null);
  assert.equal(r.pasta.external_id, 'b71f53e58f4d3383f4aebb9b3439c64851002');
});

test('acha procurando COM o prefixo, e sem acento, e em caixa alta', () => {
  assert.equal(acharPasta(PASTAS, '01. Gestão de Serviços').pasta.external_id,
    'b71f53e58f4d3383f4aebb9b3439c64851002');
  assert.equal(acharPasta(PASTAS, 'GESTAO DE SERVICOS').pasta.external_id,
    'b71f53e58f4d3383f4aebb9b3439c64851002');
});

test('não achou: devolve erro dizendo o nome procurado e o que fazer', () => {
  const r = acharPasta(PASTAS, 'Gestão de Pessoas');
  assert.equal(r.pasta, null);
  assert.match(r.erro, /Gestão de Pessoas/);
  assert.match(r.erro, /Acessos/);
  // Diz quantas pastas conhecia — sem isso, "não achei" pode ser tanto pasta
  // renomeada quanto lista vazia, e o conserto é outro em cada caso.
  assert.match(r.erro, /3 pastas/);
});

test('lista vazia também é erro explicado, nunca sucesso silencioso', () => {
  const r = acharPasta([], 'Gestão de Serviços');
  assert.equal(r.pasta, null);
  assert.match(r.erro, /0 pastas/);
});

test('duas pastas com o mesmo nome: FALHA, não escolhe a primeira', () => {
  const duplicado = [
    { nome: '01. Gestão de Serviços', external_id: 'aaa' },
    { nome: 'Gestão de Serviços', external_id: 'bbb' },
  ];
  const r = acharPasta(duplicado, 'Gestão de Serviços');
  assert.equal(r.pasta, null);
  // As duas aparecem na frase: quem lê precisa saber QUAIS renomear.
  assert.match(r.erro, /01\. Gestão de Serviços/);
  assert.match(r.erro, /mais de uma/i);
});

test('não confunde pastas de nomes parecidos', () => {
  const r = acharPasta(PASTAS, 'Comercial');
  assert.equal(r.pasta.external_id, 'aaa111');
});

// As 16 pastas que a central tem gravadas HOJE (medidas em acessos_recursos,
// não inventadas). Este teste é a prova de que a busca por nome funciona
// contra a lista real, e de que nenhuma das 16 se confunde com outra.
const AS_DEZESSEIS = [
  '01. Gestão de Serviços', '01. RBV and Company', '02. Herculano', '03. Moto Easy',
  '04. Vessel Brasil', '05. Mantova', '06. Breno Vale @obrenovale',
  '07. Raissa Herculano @raissaherculano', '08. RB Builders', '09. RAH',
  '10. RBV & Co', '11. HLM Assessoria', 'Apresentacoes Palestras', 'Crachas',
  'Diagnósticos', 'MySQL',
].map((nome, i) => ({ nome, external_id: `id${i}` }));

test('contra as 16 pastas REAIS, acha a Gestão de Serviços de quatro grafias', () => {
  for (const alvo of ['Gestão de Serviços', '01. Gestão de Serviços',
    'GESTAO DE SERVICOS', 'Gestao de Servicos']) {
    const r = acharPasta(AS_DEZESSEIS, alvo);
    assert.equal(r.pasta && r.pasta.nome, '01. Gestão de Serviços', `falhou pra "${alvo}"`);
  }
});

test('nenhuma das 16 pastas reais se confunde com outra', () => {
  for (const p of AS_DEZESSEIS) {
    const r = acharPasta(AS_DEZESSEIS, p.nome);
    assert.equal(r.pasta && r.pasta.external_id, p.external_id,
      `"${p.nome}" casou com outra pasta`);
  }
});

test('entrada estragada não derruba nem inventa pasta', () => {
  assert.equal(acharPasta(null, 'Gestão de Serviços').pasta, null);
  assert.equal(acharPasta([{ nome: null }], 'Gestão de Serviços').pasta, null);
});
