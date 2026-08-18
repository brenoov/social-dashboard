import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  GRAFICO_POR_CARTAO,
  graficoDoCartao,
  opcoesDoGrafico,
} from './graficos-de-custo-diario.js';
import { cartoesDoBalde } from './cartoes-do-balde.js';

const BALDES = ['todos', 'seguidores', 'contatos', 'site', 'vendas'];

test('cada cartão de custo aponta para a coluna diária certa de campaign_insights', () => {
  assert.equal(graficoDoCartao('cpi').campo, 'post_engagement');
  assert.equal(graficoDoCartao('cpl').campo, 'likes');
  assert.equal(graficoDoCartao('custo_conversa').campo, 'conversas');
  assert.equal(graficoDoCartao('custo_cadastro').campo, 'cadastros');
  assert.equal(graficoDoCartao('custo_visita').campo, 'visitas');
  assert.equal(graficoDoCartao('custo_venda').campo, 'compras');
  assert.equal(graficoDoCartao('cpm').campo, 'impressions');
});

test('só o custo por mil impressões divide o denominador por mil', () => {
  assert.equal(graficoDoCartao('cpm').divisor, 1000);
  for (const id of Object.keys(GRAFICO_POR_CARTAO)) {
    if (id !== 'cpm') assert.equal(graficoDoCartao(id).divisor, 1);
  }
});

test('cartão que NÃO é custo por resultado não tem gráfico próprio aqui', () => {
  // O investimento e o custo por seguidor têm caminho próprio (série de barras do
  // gasto e série que divide pelos seguidores). Alcance, frequência e as
  // contagens não são custo nenhum.
  ['investimento', 'cps', 'alcance', 'frequencia', 'conversas', 'visitas', 'compras', 'inexistente'].forEach((id) => {
    assert.equal(graficoDoCartao(id), null, id);
  });
  assert.equal(graficoDoCartao(null), null);
  assert.equal(graficoDoCartao(undefined), null);
});

test('TODO cartão de custo de TODO balde tem gráfico — nenhum fica órfão', () => {
  // A guarda que importa: balde novo (ou cartão novo num balde) não pode nascer
  // com um cartão de custo sem gráfico e ninguém perceber.
  const semGrafico = [];
  BALDES.forEach((balde) => {
    cartoesDoBalde(balde, {}).forEach((c) => {
      if (!c.metaKey) return;                       // alcance, frequência, contagens
      if (c.id === 'investimento' || c.id === 'cps') return; // caminho próprio
      if (!graficoDoCartao(c.id)) semGrafico.push(balde + '/' + c.id);
    });
  });
  assert.deepEqual(semGrafico, []);
});

test('nenhum gráfico do catálogo sobra sem cartão que o use', () => {
  const usados = new Set();
  BALDES.forEach((balde) => cartoesDoBalde(balde, {}).forEach((c) => usados.add(c.id)));
  const orfaos = Object.keys(GRAFICO_POR_CARTAO).filter((id) => !usados.has(id));
  assert.deepEqual(orfaos, []);
});

test('as frases dizem o nome do indicador, nunca "resultado"', () => {
  const o = opcoesDoGrafico('custo_conversa', { temMeta: true, diasComCusto: 5 });
  assert.equal(o.titulo, 'Quanto custou cada conversa, dia a dia');
  assert.equal(o.rotuloValor, 'Custo por conversa no dia');
  assert.equal(o.rotuloMeta, 'Meta máxima');
  assert.ok(o.legendaBase.includes('investido no dia ÷ conversas do dia'));
  assert.ok(o.legendaBase.includes('a linha é a meta máxima'));
  assert.equal(o.textoSemDado['sem-coleta'], 'sem informação coletada neste dia');
  assert.equal(o.textoSemDado['sem-resultado'], 'nenhuma conversa neste dia — sem como calcular o custo');
});

test('sem meta a legenda não promete uma linha que não está desenhada', () => {
  const o = opcoesDoGrafico('custo_conversa', { temMeta: false, diasComCusto: 5 });
  assert.ok(!o.legendaBase.includes('meta máxima'));
  assert.ok(o.legendaBase.includes('sem meta definida'));
});

test('zero dia com custo: a frase é "nenhum dia", com o nome do indicador', () => {
  const o = opcoesDoGrafico('custo_conversa', { diasComCusto: 0 });
  assert.equal(o.textoVazio, 'Nenhum dia deste período teve investimento e conversa ao mesmo tempo — sem custo por conversa pra mostrar.');
});

test('UM dia só: a frase diz que foi um, não que não teve nenhum', () => {
  // "Nenhum dia" com um dia medido seria mentira — e a tela nunca mente.
  const o = opcoesDoGrafico('custo_venda', { diasComCusto: 1 });
  assert.ok(o.textoVazio.startsWith('Só um dia deste período teve investimento e venda ao mesmo tempo'));
  assert.ok(o.textoVazio.includes('um dia sozinho não mostra tendência'));
});

test('o custo por mil impressões fala em mil impressões, não em impressão avulsa', () => {
  const o = opcoesDoGrafico('cpm', { temMeta: true, diasComCusto: 9 });
  assert.equal(o.titulo, 'Quanto custou cada mil impressões, dia a dia');
  assert.equal(o.rotuloValor, 'Custo por mil impressões no dia');
  assert.ok(o.legendaBase.includes('investido no dia ÷ mil impressões do dia'));
  assert.equal(opcoesDoGrafico('cpm', { diasComCusto: 0 }).textoVazio,
    'Nenhum dia deste período teve investimento e impressão ao mesmo tempo — sem custo por mil impressões pra mostrar.');
});

test('o gênero da frase acompanha o indicador (nenhum cadastro, nenhuma visita)', () => {
  assert.equal(opcoesDoGrafico('custo_cadastro', {}).textoSemDado['sem-resultado'], 'nenhum cadastro neste dia — sem como calcular o custo');
  assert.equal(opcoesDoGrafico('custo_visita', {}).textoSemDado['sem-resultado'], 'nenhuma visita neste dia — sem como calcular o custo');
  assert.equal(opcoesDoGrafico('cpi', {}).textoSemDado['sem-resultado'], 'nenhuma interação neste dia — sem como calcular o custo');
  assert.equal(opcoesDoGrafico('cpl', {}).textoSemDado['sem-resultado'], 'nenhuma curtida neste dia — sem como calcular o custo');
});

test('a contagem de dias sem resultado da legenda concorda em número', () => {
  const o = opcoesDoGrafico('custo_conversa', {});
  assert.equal(o.rotuloDiasSemResultado(1), '1 dia sem conversa (não dá pra calcular o custo)');
  assert.equal(o.rotuloDiasSemResultado(4), '4 dias sem conversas (não dá pra calcular o custo)');
});

test('cartão sem gráfico não devolve opções (não há frase para inventar)', () => {
  assert.equal(opcoesDoGrafico('cps', {}), null);
  assert.equal(opcoesDoGrafico('alcance', {}), null);
  assert.equal(opcoesDoGrafico(null, {}), null);
});

test('opções aguentam ser chamadas sem o segundo argumento', () => {
  const o = opcoesDoGrafico('custo_venda');
  assert.ok(o.titulo);
  assert.ok(o.textoVazio.startsWith('Nenhum dia'));
});
