import { test } from 'node:test';
import assert from 'node:assert/strict';
import { montarPainelFunil } from './painel-funil.js';

const alvoFalso = () => ({ innerHTML: '', querySelectorAll: () => [] });
const monta = (o) => { const a = alvoFalso(); montarPainelFunil(a, o); return a.innerHTML; };
const camp = (balde, extra) => ({ balde, insight: { spend: '1000', reach: '10000', impressions: '20000', clicks: '400', actions: [], ...extra } });

test('um bloco por objetivo que a conta roda', () => {
  const html = monta({ campanhas: [camp('mensagens'), camp('trafego'), camp('engajamento')], contaNome: 'Vessel' });
  assert.equal((html.match(/class="gfn-bloco"/g) || []).length, 3);
  assert.match(html, /Mensagens/);
  assert.match(html, /Tráfego/);
  assert.match(html, /Vessel/);
});

test('funil e proporcao sao ditos com todas as letras', () => {
  // Sem isso alguem compara "12% de quem clicou" com "0,44 por pessoa" achando
  // que sao a mesma medida.
  const funil = monta({ campanhas: [camp('mensagens')] });
  assert.match(funil, /cada etapa vem depois da outra/);
  const prop = monta({ campanhas: [camp('engajamento')] });
  assert.match(prop, /não vem depois do clique/);
});

test('a barra do topo e sempre cheia; a do resultado em proporcao nao existe', () => {
  const prop = monta({ campanhas: [camp('engajamento', { actions: [{ action_type: 'post_engagement', value: '50000' }] })] });
  assert.match(prop, /width:100%/, 'alcance = barra cheia');
  assert.match(prop, /gfn-sem-barra/, 'o resultado nao vira degrau da pilha');
});

test('sem campanha no ar explica o que vai aparecer ali', () => {
  const html = monta({ campanhas: [] });
  assert.match(html, /Nenhuma campanha rodando agora/);
  assert.match(html, /assim que uma começar a veicular/i);
});

test('nome de conta e escapado', () => {
  const html = monta({ campanhas: [camp('mensagens')], contaNome: '<script>x</script>' });
  assert.ok(!html.includes('<script>x'));
});

test('tem como fechar', () => {
  assert.match(monta({ campanhas: [] }), /data-gfn-fechar/);
});
