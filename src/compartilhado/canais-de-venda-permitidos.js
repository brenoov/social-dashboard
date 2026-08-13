// DE QUAIS CANAIS DE VENDA EU VEJO O FATURAMENTO.
//
// PEDIDO DO DONO (12/08/2026): "pode mostrar os canais zerados para os outros
// usuários igual era... somente para quem é de time de venda mostre somente o
// resultado de sua loja".
//
// ─────────────────────────────────────────────────────────────────────────────
// POR QUE ISTO PRECISOU EXISTIR (medido em 12/08/2026)
//
// O banco JÁ recorta as vendas por time: `pode_ver_canal`
// (db/migrations/2026-08-04-escopo-em-vendas-e-estoque.sql) tranca
// `gc_vendas_item` por RLS, e foi medido com usuário descartável.
//
// SÓ QUE AS DUAS DASHBOARDS NÃO LEEM ESSA TABELA. Gestão à Vista e Análise de
// Vendas buscam os pedidos AO VIVO no Bling, pela edge `bling-proxy` — e essa
// edge foi lida linha a linha: ela confere PERMISSÃO (`sales`/`gestor`/admin) e
// devolve os pedidos de TODOS os canais. Não há filtro de canal nenhum lá.
//
// Ou seja: a vendedora limitada ao time via, nessas duas telas, o faturamento
// de todas as lojas. A trava do banco valia na Gestão Comercial e não valia
// aqui. É o que este módulo fecha.
//
// ⚠️ ISTO É UX, NÃO É TRANCA. O front é público (ver project_iamundi_seguranca):
// quem souber usar o console continua conseguindo pedir tudo ao `bling-proxy`.
// A tranca de verdade é filtrar a resposta dentro da própria edge. Enquanto
// isso não subir, o que existe aqui é o recorte da TELA.
//
// PURO de propósito: quem decide o que aparece na tela de faturamento é a coisa
// mais cara de errar aqui, e precisa poder ser provada sem navegador.

// `null` = vê TODOS os canais (é o estado dos 15 de 17 perfis de hoje).
// `[]`   = não vê canal nenhum — e isso é diferente de `null`, com todas as
//          letras: confundir os dois é o defeito que faz uma vendedora sem time
//          enxergar a empresa inteira.
export function canaisDoEscopo({ isSuperadmin, escopoPorEquipe, meuId, times, membros }) {
  if (isSuperadmin) return null;
  // `!== true` e não `=== false`: coluna ausente na consulta não pode virar
  // "vê tudo" por omissão. O default do banco é o fechado, e o da tela também.
  if (escopoPorEquipe !== true) return null;
  if (!meuId) return [];

  const meus = new Set(
    (membros || [])
      .filter((m) => String(m.profile_id) === String(meuId))
      .map((m) => String(m.equipe_id)),
  );
  const ids = [];
  for (const t of times || []) {
    if (!meus.has(String(t.id))) continue;
    // Time sem canal do Bling não some nem vira "vê tudo": ele simplesmente não
    // acrescenta canal. Quem está só nele fica com `[]`, e a tela diz o motivo.
    if (t.canal_loja_id === null || t.canal_loja_id === undefined || t.canal_loja_id === '') continue;
    ids.push(Number(t.canal_loja_id));
  }
  return [...new Set(ids)];
}

// Está limitada? Serve para a tela decidir se avisa, e se esconde o filtro de
// canal (filtro que oferece o que não se pode ver é promessa quebrada).
export function estaLimitada(canais) {
  return Array.isArray(canais);
}

// Os pedidos que ela pode ver. `null` devolve a lista INTACTA — é o caminho dos
// 15 perfis de hoje, e ele não pode nem reordenar nem copiar por engano.
export function filtrarPedidos(pedidos, canais) {
  if (!Array.isArray(canais)) return pedidos || [];
  const ok = new Set(canais.map(String));
  return (pedidos || []).filter((p) => ok.has(String(p && p.loja && p.loja.id)));
}

// O mapa `{loja_id: nome}` que as duas telas montam de `bling_lojas`, recortado.
// É ele que alimenta os seletores de canal — se ficasse inteiro, o filtro
// ofereceria lojas cujo faturamento a pessoa não pode ver.
export function filtrarMapaDeCanais(mapa, canais) {
  if (!Array.isArray(canais)) return mapa || {};
  const ok = new Set(canais.map(String));
  const out = {};
  for (const k of Object.keys(mapa || {})) if (ok.has(String(k))) out[k] = mapa[k];
  return out;
}

// A frase do recorte, para a tela não mentir por omissão: um total menor sem
// explicação parece dado errado, e é assim que nasce um chamado.
export function fraseDoRecorte(canais, mapa) {
  if (!Array.isArray(canais)) return '';
  if (!canais.length) {
    return 'Você não está em nenhum time com canal de venda ligado, então não há '
      + 'faturamento para mostrar. Peça para um administrador te colocar no time da sua loja.';
  }
  const nomes = canais.map((id) => (mapa || {})[id] || (mapa || {})[String(id)] || ('canal ' + id));
  return 'Mostrando só ' + (nomes.length === 1 ? 'o seu canal' : 'os seus canais') + ': ' + nomes.join(' · ') + '.';
}
