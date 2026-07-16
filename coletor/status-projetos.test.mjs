import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analisarConteudo } from './status-projetos.mjs';

// Casos REAIS que a régua antiga errava. Cada um destes é um plano que aparecia
// no quadro como "Pronto e no ar" com 0% pronto.

test('"validar NO AR" no corpo NAO marca o plano como pronto', () => {
  const plano = `# Plano X\n\n## Passos\n- [ ] fazer a coisa\n- [ ] validar NO AR depois do deploy\n`;
  const r = analisarConteudo(plano);
  assert.equal(r.situacao, 'planejado');
  assert.equal(r.progresso, 0);
});

test('console.log("concluído") dentro de bloco de codigo NAO marca como pronto', () => {
  const plano = '# Plano Y\n\n## Passos\n- [ ] rodar\n\n```js\nfn().then(r => console.log("gerar concluído:", r));\n```\n';
  assert.equal(analisarConteudo(plano).situacao, 'planejado');
});

test('"NAO CONCLUIDO" no corpo NAO marca como pronto (CONCLUID casava dentro)', () => {
  const plano = `# Plano Z\n\n## Passos\n- [ ] item\n\nEste passo ainda NÃO CONCLUÍDO.\n`;
  assert.equal(analisarConteudo(plano).situacao, 'planejado');
});

// Os checkboxes, quando existem e ninguem declarou nada.

test('todos os passos feitos → pronto e no ar', () => {
  const r = analisarConteudo(`# P\n\n## Passos\n- [x] a\n- [x] b\n`);
  assert.equal(r.situacao, 'no-ar');
  assert.equal(r.progresso, 100);
});

test('alguns passos feitos → sendo construido', () => {
  const r = analisarConteudo(`# P\n\n## Passos\n- [x] a\n- [ ] b\n- [ ] c\n`);
  assert.equal(r.situacao, 'em-andamento');
  assert.equal(r.progresso, 33);
});

test('nenhum passo feito → ainda nao comecou', () => {
  assert.equal(analisarConteudo(`# P\n\n## Passos\n- [ ] a\n`).situacao, 'planejado');
});

test('sem checkbox e sem declaracao → ainda nao comecou (default honesto)', () => {
  assert.equal(analisarConteudo(`# P\n\nSó prosa, nenhum passo.\n`).situacao, 'planejado');
});

// A declaracao explicita no cabecalho: e a unica afirmacao deliberada, entao ganha.

test('**Status:** no ar no cabecalho ganha dos checkboxes desmarcados', () => {
  const plano = `# Plano\n**Status:** no ar\n\n## Passos\n- [ ] ninguem marcou\n- [ ] estas caixinhas\n`;
  const r = analisarConteudo(plano);
  assert.equal(r.situacao, 'no-ar', 'quem escreveu declarou; ninguem volta pra marcar checkbox');
  assert.equal(r.progresso, 0, 'mas o progresso continua honesto: 0 passos marcados');
});

test('**Status:** parado ganha de tudo', () => {
  const plano = `# Plano\n**Status:** parado — esperando o cliente\n\n## Passos\n- [x] a\n- [x] b\n`;
  assert.equal(analisarConteudo(plano).situacao, 'pausado');
});

test('**Status:** em andamento', () => {
  const plano = `# Plano\n**Status:** em andamento\n\n## Passos\n- [ ] a\n`;
  assert.equal(analisarConteudo(plano).situacao, 'em-andamento');
});

test('Status sem asteriscos tambem vale', () => {
  assert.equal(analisarConteudo(`# P\nStatus: no ar\n\n## Passos\n- [ ] a\n`).situacao, 'no-ar');
});

test('Status com valor que eu nao reconheco cai nos checkboxes', () => {
  const plano = `# P\n**Status:** abacaxi\n\n## Passos\n- [x] a\n- [x] b\n`;
  assert.equal(analisarConteudo(plano).situacao, 'no-ar', 'ignora a declaracao e conta os passos');
});

test('"Status" no CORPO (fora do cabecalho) nao vale', () => {
  const plano = `# P\n\n## Uma secao\nStatus: no ar\n\n- [ ] a\n`;
  assert.equal(analisarConteudo(plano).situacao, 'planejado');
});
