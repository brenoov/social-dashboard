// Agrupa os criativos do Curar em seções por loja, com pares feed/story por look.
// Arte é 1 por SKU (dedup entre lojas): a loja vem de itens (SKU->depósito) x lojas
// (depósito->nome). SKU em 2 lojas aparece nas 2 seções. Pura (sem I/O), testável.
const FEED = '1080x1350';
const STORY = '1080x1920';

export function agruparPorLojaEPares(criativos, itens, lojas) {
  const nomePorDeposito = Object.fromEntries((lojas || []).map((l) => [l.deposito_id, l.nome]));
  // SKU -> conjunto de nomes de loja (via depósitos dos itens)
  const lojasPorSku = {};
  for (const it of itens || []) {
    const nome = nomePorDeposito[it.deposito];
    if (!nome) continue;
    (lojasPorSku[it.sku] = lojasPorSku[it.sku] || new Set()).add(nome);
  }
  // ordem estável das seções = ordem das lojas + "Outros" no fim
  const ordem = (lojas || []).map((l) => l.nome);
  const secoes = new Map(); // nomeLoja -> Map(chavePar -> par)
  const garante = (nome) => { if (!secoes.has(nome)) secoes.set(nome, new Map()); return secoes.get(nome); };
  const chave = (sku, variante) => `${sku}|${variante}`;

  for (const c of criativos || []) {
    const destinos = (c.sku && lojasPorSku[c.sku] && lojasPorSku[c.sku].size)
      ? [...lojasPorSku[c.sku]] : ['Outros'];
    for (const nome of destinos) {
      const mapa = garante(nome);
      const k = chave(c.sku, c.variante);
      const par = mapa.get(k) || { sku: c.sku, variante: c.variante, feed: null, story: null };
      if (c.formato === FEED) par.feed = c;
      else if (c.formato === STORY) par.story = c;
      else par.feed = par.feed || c; // formato inesperado cai no slot feed
      mapa.set(k, par);
    }
  }

  const nomesOrdenados = [...ordem.filter((n) => secoes.has(n)),
    ...[...secoes.keys()].filter((n) => n !== 'Outros' && !ordem.includes(n)),
    ...(secoes.has('Outros') ? ['Outros'] : [])];
  return nomesOrdenados.map((loja) => ({ loja, pares: [...secoes.get(loja).values()] }));
}
