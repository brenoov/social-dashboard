// Agrupa os criativos do Curar em seções por loja, um GRUPO por (SKU, variante).
// Cada grupo lista TODOS os formatos gerados (1:1, 4:5, 9:16, 16:9) em `itens` (ordenados),
// pra a tela mostrar tudo — não só feed+story. `feed`/`story` seguem preenchidos por
// retrocompat (testes/consumidores antigos). Arte é 1 por SKU (dedup entre lojas): a loja vem
// de itens (SKU->depósito) x lojas (depósito->nome). SKU em 2 lojas aparece nas 2 seções.
// Pura (sem I/O), testável.
const FEED = '1080x1350';
const STORY = '1080x1920';
// rótulo amigável + ordem de exibição por formato (os do motor Hero-IA + os looks de código)
const LABELS = { '1080x1350': 'Feed 4:5', '1080x1920': 'Story 9:16', '1080x1080': 'Feed 1:1', '1920x1080': 'YouTube 16:9' };
const ORDEM_FMT = ['1080x1350', '1080x1920', '1080x1080', '1920x1080'];

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
  const secoes = new Map(); // nomeLoja -> Map(chaveGrupo -> grupo)
  const garante = (nome) => { if (!secoes.has(nome)) secoes.set(nome, new Map()); return secoes.get(nome); };
  const chave = (sku, variante) => `${sku}|${variante}`;

  for (const c of criativos || []) {
    const destinos = (c.sku && lojasPorSku[c.sku] && lojasPorSku[c.sku].size)
      ? [...lojasPorSku[c.sku]] : ['Outros'];
    for (const nome of destinos) {
      const mapa = garante(nome);
      const k = chave(c.sku, c.variante);
      const g = mapa.get(k) || { sku: c.sku, variante: c.variante, feed: null, story: null, porFormato: {} };
      // retrocompat: mantém os slots feed/story
      if (c.formato === FEED) g.feed = c;
      else if (c.formato === STORY) g.story = c;
      else g.feed = g.feed || c;
      // NOVO: guarda TODOS os formatos (um por formato)
      g.porFormato[c.formato] = c;
      mapa.set(k, g);
    }
  }

  // monta `itens` (todos os formatos) ordenados: os conhecidos na ordem canônica + o resto no fim
  const montarItens = (porFormato) => {
    const conhecidos = ORDEM_FMT.filter((f) => porFormato[f]);
    const extras = Object.keys(porFormato).filter((f) => !ORDEM_FMT.includes(f));
    return [...conhecidos, ...extras].map((f) => ({ c: porFormato[f], label: LABELS[f] || f, formato: f }));
  };

  const nomesOrdenados = [...ordem.filter((n) => secoes.has(n)),
    ...[...secoes.keys()].filter((n) => n !== 'Outros' && !ordem.includes(n)),
    ...(secoes.has('Outros') ? ['Outros'] : [])];
  return nomesOrdenados.map((loja) => ({
    loja,
    pares: [...secoes.get(loja).values()].map((g) => ({
      sku: g.sku, variante: g.variante, feed: g.feed, story: g.story, itens: montarItens(g.porFormato),
    })),
  }));
}
