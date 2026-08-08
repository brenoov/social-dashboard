import test from 'node:test';
import assert from 'node:assert/strict';
import {
  bytesDeTexto, dataPorExtenso, horaDeBrasilia, linhasDoChecklist,
  montarPdf, nomeDoArquivo, pastasDoArquivo, pdfDoChecklist, tempoPorExtenso,
} from './pdf-do-checklist.js';

const VEICULO = { nome: 'FORD FIESTA SEDAN', placa: 'ERO3G55' };

const FICHA = {
  feita_em: '2026-08-07',
  pessoa_nome: 'Erick Martins',
  hodometro: 136172,
  cadencias: ['diario', 'semanal'],
  resultado: 'com_ressalvas',
  anomalias: 'Farol direito queimado',
  aberta_em: '2026-08-07T12:00:00.000Z',
  assinada_em: '2026-08-07T12:02:13.000Z',
  assinatura_hash: 'a'.repeat(64),
  assinatura_hash_anterior: 'b'.repeat(64),
};

const RESPOSTAS = [
  { item_texto: 'Pneus (aparência e calibragem)', estado: 'ok', observacao: null },
  { item_texto: 'Faróis, lanternas e setas', estado: 'nao_ok', observacao: 'Trocar hoje' },
  { item_texto: 'Extintor, quando aplicável', estado: 'na', observacao: null },
];

const papel = (mudanca = {}) => linhasDoChecklist({
  ficha: { ...FICHA, ...(mudanca.ficha || {}) },
  respostas: mudanca.respostas ?? RESPOSTAS,
  veiculo: VEICULO,
  // `in` e não `??`: um teste precisa passar nome NULO de propósito, e `??`
  // devolveria o padrão justamente no caso que o teste quer medir.
  donoNome: 'donoNome' in mudanca ? mudanca.donoNome : 'Marcus Vinicius',
  assinanteNome: 'assinanteNome' in mudanca ? mudanca.assinanteNome : 'Erick Martins',
});
const texto = (linhas) => linhas.map((l) => l.texto).join('\n');

/* ── O conteúdo congelado ─────────────────────────────────────────────────── */

test('o papel traz o texto do item COMO FOI GRAVADO na resposta', () => {
  // D13: a ficha é documento. O texto vem da RESPOSTA, não da lista de itens
  // de hoje — se o gestor renomear o item amanhã, este papel continua dizendo
  // o que foi realmente perguntado.
  const t = texto(papel());
  assert.match(t, /Pneus \(aparência e calibragem\)/);
  assert.match(t, /PROBLEMA — Faróis, lanternas e setas/);
  assert.match(t, /Não se aplica — Extintor, quando aplicável/);
  assert.match(t, /observação: Trocar hoje/);
});

test('conta os itens e não esconde ficha sem resposta nenhuma', () => {
  assert.match(texto(papel()), /O que foi conferido \(3 itens\)/);
  const vazia = texto(papel({ respostas: [] }));
  assert.match(vazia, /sem nenhum item respondido/);
});

/* ── Os nomes ─────────────────────────────────────────────────────────────── */

test('traz quem conferiu, de quem é o carro, e quem assinou', () => {
  // D21b: quem administra preenche a ficha de qualquer carro e assina com a
  // própria senha. Registrar só o dono sugeriria que ELE olhou o veículo.
  const t = texto(papel({ donoNome: 'Marcus Vinicius' }));
  assert.match(t, /Conferiu e preencheu: Erick Martins/);
  assert.match(t, /Carro de: Marcus Vinicius/);
  assert.match(t, /Assinada por: Erick Martins/);
});

test('nome que não veio sai como "não informado", nunca inventado', () => {
  const t = texto(papel({ donoNome: null, assinanteNome: null }));
  assert.match(t, /Carro de: não informado/);
  assert.match(t, /Assinada por: não informado/);
});

/* ── A hora do servidor: o papel não pode discordar do sistema ────────────── */

test('imprime o instante EXATO que foi assinado, além do horário de Brasília', () => {
  const t = texto(papel());
  assert.match(t, /Assinada em: 07\/08\/2026 às 09:02:13 \(horário de Brasília\)/);
  assert.match(t, /Instante exato registrado pelo servidor: 2026-08-07T12:02:13\.000Z/);
});

test('o instante do BANCO e o instante ENVIADO dão o MESMO papel', () => {
  // Este é o defeito que a F7a já pagou uma vez: o Postgres devolve
  // '2026-08-07T12:02:13+00:00' onde a tela mandou '...12:02:13.000Z'. Se o
  // papel formatasse o texto cru, dois documentos da mesma ficha sairiam
  // diferentes — e o instante impresso deixaria de ser o instante assinado.
  const comoOBanco = texto(papel({ ficha: { assinada_em: '2026-08-07T12:02:13+00:00' } }));
  const comoAEnviada = texto(papel());
  assert.equal(comoOBanco, comoAEnviada);
});

test('horaDeBrasilia não depende do fuso da máquina nem inventa hora', () => {
  assert.equal(horaDeBrasilia('2026-01-01T02:30:00.000Z'), '31/12/2025 às 23:30:00');
  assert.equal(horaDeBrasilia('não é data'), null);
});

test('dataPorExtenso lê o texto AAAA-MM-DD sem virar o dia', () => {
  // Passar por `new Date('2026-08-01')` daria 31/07 pra quem está em Brasília.
  assert.equal(dataPorExtenso('2026-08-01'), '01/08/2026');
  assert.equal(dataPorExtenso(null), '');
});

/* ── O tempo de preenchimento ─────────────────────────────────────────────── */

test('o tempo de preenchimento sai por extenso', () => {
  assert.match(texto(papel()), /Tempo de preenchimento: 2 minutos e 13 segundos/);
  assert.equal(tempoPorExtenso(45), '45 segundos');
  assert.equal(tempoPorExtenso(120), '2 minutos');
});

test('sem `aberta_em` o papel diz "não registrado" — nunca zero', () => {
  // Zero significaria "instantâneo", que é uma acusação. A ficha de quem não
  // tem login nasce sem `aberta_em` de propósito.
  const t = texto(papel({ ficha: { aberta_em: null } }));
  assert.match(t, /Tempo de preenchimento: não registrado nesta ficha/);
  assert.doesNotMatch(t, /Tempo de preenchimento: 0 /);
});

/* ── Os dois códigos ──────────────────────────────────────────────────────── */

test('traz o código desta ficha e o da anterior', () => {
  const t = texto(papel());
  assert.match(t, new RegExp('a'.repeat(64)));
  assert.match(t, new RegExp('b'.repeat(64)));
});

test('primeira ficha do carro: diz que não há anterior, sem deixar em branco', () => {
  const t = texto(papel({ ficha: { assinatura_hash_anterior: null } }));
  assert.match(t, /primeira ficha assinada deste carro/);
});

/* ── Ficha sem assinatura (D22) ───────────────────────────────────────────── */

test('ficha sem assinatura diz isso, com o motivo, e sem código nenhum', () => {
  const t = texto(papel({
    ficha: {
      assinada_em: null, assinada_por: null, assinatura_hash: null,
      assinatura_hash_anterior: null, sem_assinatura_motivo: 'sem_login',
    },
  }));
  assert.match(t, /Esta ficha NÃO foi assinada/);
  assert.match(t, /não tem login próprio no aplicativo/);
  assert.match(t, /a ficha não foi assinada — não há código/);
  // E não pode sugerir assinatura nenhuma.
  assert.doesNotMatch(t, /Assinada por:/);
  assert.doesNotMatch(t, /Assinada em:/);
  // A conferência VALE: o papel não pode fazer parecer que o carro não foi olhado.
  assert.match(t, /foi feita e vale/);
});

/* ── Onde o arquivo mora ──────────────────────────────────────────────────── */

test('a pasta é Frota / carro / AAAA-MM, com a placa junto do nome', () => {
  assert.deepEqual(pastasDoArquivo({ ficha: FICHA, veiculo: VEICULO }),
    ['Frota', 'FORD FIESTA SEDAN (ERO3G55)', '2026-08']);
});

test('nome de carro com barra não cria pasta a mais', () => {
  const p = pastasDoArquivo({ ficha: FICHA, veiculo: { nome: 'VW/GOL', placa: 'ABC1D23' } });
  assert.equal(p.length, 3);
  assert.equal(p[1], 'VW-GOL (ABC1D23)');
});

test('o nome do arquivo tem o dia e a placa', () => {
  assert.equal(nomeDoArquivo({ ficha: FICHA, veiculo: VEICULO }),
    'checklist-2026-08-07-ERO3G55.pdf');
});

test('sem data e sem placa continua gerando nome utilizável', () => {
  assert.equal(nomeDoArquivo({ ficha: {}, veiculo: {} }), 'checklist-sem-data-sem-placa.pdf');
  assert.deepEqual(pastasDoArquivo({ ficha: {}, veiculo: {} }),
    ['Frota', 'Carro sem nome', 'sem-data']);
});

/* ── Os bytes do PDF ──────────────────────────────────────────────────────── */

const comoTexto = (bytes) => Array.from(bytes, (b) => String.fromCharCode(b)).join('');

test('o arquivo é um PDF de verdade: cabeçalho, fim e tabela de posições', () => {
  const bytes = pdfDoChecklist({
    ficha: FICHA, respostas: RESPOSTAS, veiculo: VEICULO,
    donoNome: 'Marcus Vinicius', assinanteNome: 'Erick Martins',
  });
  const s = comoTexto(bytes);
  assert.ok(s.startsWith('%PDF-1.4\n'));
  assert.ok(s.endsWith('%%EOF\n'));
  assert.match(s, /\/Type \/Catalog/);
  assert.match(s, /\/BaseFont \/Helvetica/);
});

test('cada posição da tabela xref aponta MESMO para o início do objeto', () => {
  // Se um deslocamento errar por um byte, o leitor recusa o arquivo inteiro —
  // e a falha só apareceria quando alguém tentasse abrir o papel meses depois.
  const bytes = pdfDoChecklist({
    ficha: FICHA, respostas: RESPOSTAS, veiculo: VEICULO,
    donoNome: 'Marcus Vinicius', assinanteNome: 'Erick Martins',
  });
  const s = comoTexto(bytes);
  const inicio = Number(/startxref\n(\d+)\n/.exec(s)[1]);
  assert.equal(s.slice(inicio, inicio + 4), 'xref');
  const tabela = s.slice(inicio).split('\n');
  const total = Number(/0 (\d+)/.exec(tabela[1])[1]);
  for (let n = 1; n < total; n++) {
    const pos = Number(tabela[1 + n + 1].slice(0, 10));
    assert.equal(s.slice(pos, pos + String(n).length + 6), `${n} 0 obj`);
  }
});

test('parênteses e barra invertida no texto não estragam o arquivo', () => {
  // "Pneus (aparência...)" já tem parênteses. Sem escape, o PDF fecha a string
  // no meio e o documento inteiro deixa de abrir.
  assert.equal(comoTexto(bytesDeTexto('a(b)c\\d')), 'a\\(b\\)c\\\\d');
});

test('acento vira byte de WinAnsi, e caractere impossível vira "?" — nunca lixo', () => {
  assert.deepEqual(bytesDeTexto('ção'), [0xe7, 0xe3, 0x6f]);
  assert.deepEqual(bytesDeTexto('—'), [0x97]);
  assert.deepEqual(bytesDeTexto('😀'), [0x3f]);
});

test('ficha comprida vira mais de uma página em vez de sumir com o texto', () => {
  const muitas = Array.from({ length: 90 }, (_, i) => ({
    item_texto: `Item número ${i + 1} da lista`, estado: 'ok', observacao: null,
  }));
  const bytes = pdfDoChecklist({
    ficha: FICHA, respostas: muitas, veiculo: VEICULO,
    donoNome: 'Marcus Vinicius', assinanteNome: 'Erick Martins',
  });
  const s = comoTexto(bytes);
  const contagem = Number(/\/Count (\d+)/.exec(s)[1]);
  assert.ok(contagem > 1, `esperava mais de uma página, veio ${contagem}`);
  // O último item tem de estar no arquivo: página que estoura em silêncio
  // seria conteúdo perdido num documento que existe pra provar conteúdo.
  assert.match(s, /Item número 90 da lista/);
});

test('linha comprida demais é quebrada, não cortada', () => {
  const linhas = montarPdf([{ estilo: 'texto', texto: 'palavra '.repeat(60).trim() }]);
  const s = comoTexto(linhas);
  const desenhadas = s.match(/\) Tj/g) || [];
  assert.ok(desenhadas.length > 1, 'a linha comprida devia virar várias linhas desenhadas');
});
