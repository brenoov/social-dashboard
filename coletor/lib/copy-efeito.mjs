// coletor/lib/copy-efeito.mjs
// Gera "copy de efeito" (linha de impacto) por produto + uma pra promo guarda-
// chuva, via Claude (Opus). Chamador já carregou o .env (não importar
// carregar-env.mjs aqui — este lib fica em coletor/lib/, quem entra primeiro
// é o script/CLI que roda no topo).
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY_FABRICA || process.env.ANTHROPIC_API_KEY_GESTOR;
const MODEL = process.env.FABRICA_MODEL || 'claude-opus-4-8';

const FALLBACK_PRODUTO = 'Últimas peças · leve a sua hoje';
const FALLBACK_PROMO = 'A elegância que você merece — só agora';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Anthropic (retry em 429/5xx/rede) — mesmo padrão de coletor/gestor-comercial.mjs ──
async function anthropic(body, tentativas = 6) {
  for (let t = 0; t < tentativas; t++) {
    let r;
    try { r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' }, body: JSON.stringify(body) }); }
    catch (e) { console.log('  rede falhou; aguardando…'); await sleep(Math.min(60, 8 * (t + 1)) * 1000); continue; }
    if (r.ok) return r.json();
    if (r.status === 429 || r.status >= 500) { const ra = parseInt(r.headers.get('retry-after') || '0', 10); console.log('  rate/sobrecarga ' + r.status + '; aguardando…'); await sleep((ra > 0 ? ra : Math.min(60, 8 * (t + 1))) * 1000); continue; }
    throw new Error('Anthropic ' + r.status + ' ' + JSON.stringify(await r.json().catch(() => ({}))).slice(0, 300));
  }
  throw new Error('Anthropic: tentativas esgotadas');
}

// Voz de marca La Vessel: luxo europeu suave, feminino, atemporal, "sussurra
// sofisticação", lema "cada bolsa conta uma história". Contexto desta rodada:
// campanha de shopping (loja física em shopping) — tom puxa URGÊNCIA + EMOÇÃO,
// não preço puro.
const SYS_PRODUTO = 'Você escreve microcopy de campanha para a La Vessel, marca de bolsas de luxo europeu suave, feminino, atemporal — a marca "sussurra sofisticação", nunca grita. Lema: "cada bolsa conta uma história". '
  + 'Esta rodada é uma campanha de SHOPPING (loja física em shopping físico): o tom precisa puxar URGÊNCIA + EMOÇÃO, não preço puro. '
  + 'Regras invioláveis para cada linha de impacto: (1) português do Brasil; (2) CURTA, no máximo ~40 caracteres; (3) impactante, sem ser genérica; (4) NUNCA prometa algo falso ou exagerado (nada de "a melhor bolsa do mundo", "número 1", etc.); (5) SEM emoji; (6) SEM hashtag; (7) uma linha por produto, coerente com o nome/estilo daquele produto específico. '
  + 'Além da linha de impacto, gere também um NOME CURTO de exibição para cada produto: o nome completo do Bling (ex.: "Bolsa De Ombro Grande Viena Marinho") tem tipo/tamanho/cor misturados com uma palavra distintiva de CIDADE ou PAÍS (ex.: Viena, Belgrado, Genebra, Madrid). O nome curto deve ser SEMPRE no formato "Bolsa <Cidade/País>" — descarte tipo, tamanho e cor, mantenha só "Bolsa " + a cidade/país do nome original. '
  + 'Responda APENAS com um bloco de código ```json contendo um objeto {"<sku>": {"copy": "<linha de impacto>", "nome": "Bolsa <Cidade>"}, ...} — uma chave por SKU recebido, nada fora do bloco.';

const SYS_PROMO = 'Você escreve microcopy de campanha para a La Vessel, marca de bolsas de luxo europeu suave, feminino, atemporal — a marca "sussurra sofisticação", nunca grita. Lema: "cada bolsa conta uma história". '
  + 'Esta rodada é uma campanha de SHOPPING (loja física em shopping físico) para uma promoção guarda-chuva de desconto: o tom precisa puxar URGÊNCIA + EMOÇÃO, não preço puro. '
  + 'Escreva UMA única linha de impacto para a promoção inteira. Regras invioláveis: (1) português do Brasil; (2) CURTA, no máximo ~40 caracteres; (3) impactante; (4) NUNCA prometa algo falso ou exagerado; (5) SEM emoji; (6) SEM hashtag. '
  + 'Responda APENAS com a linha, sem aspas, sem explicação, sem markdown.';

function parseJsonFence(texto) {
  const m = texto.match(/```json\s*([\s\S]*?)```/i) || texto.match(/```\s*([\s\S]*?)```/);
  const raw = m ? m[1].trim() : texto.trim();
  return JSON.parse(raw);
}

const nomeCurtoFallback = (nome) => String(nome || '').trim().split(/\s+/).slice(0, 3).join(' ');

// Gera uma linha de impacto + nome curto de exibição por produto (batch, UMA
// chamada Anthropic).
// produtos: [{sku, nome}]; campanha: {desconto_pct}
// Retorna Map<sku, {copy, nome}>. NUNCA lança — em qualquer falha, cai no
// fallback padrão para todos os SKUs recebidos.
export async function gerarCopysProduto(produtos, campanha) {
  const out = new Map();
  try {
    if (!ANTHROPIC_API_KEY) throw new Error('sem ANTHROPIC_API_KEY_FABRICA/ANTHROPIC_API_KEY_GESTOR');
    if (!Array.isArray(produtos) || !produtos.length) return out;
    const lista = produtos.map((p) => `- SKU ${p.sku}: ${p.nome}`).join('\n');
    const user = 'Campanha atual: desconto de ' + (campanha?.desconto_pct ?? '?') + '% (shopping, urgência+emoção).\n\n'
      + 'Produtos (gere uma linha de impacto + nome curto por SKU):\n' + lista;
    const resp = await anthropic({ model: MODEL, max_tokens: 2000, system: SYS_PRODUTO, messages: [{ role: 'user', content: user }] });
    const texto = (resp.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
    const obj = parseJsonFence(texto);
    for (const p of produtos) {
      const item = obj?.[p.sku];
      const copy = typeof item?.copy === 'string' && item.copy.trim() ? item.copy.trim() : FALLBACK_PRODUTO;
      const nome = typeof item?.nome === 'string' && item.nome.trim() ? item.nome.trim() : nomeCurtoFallback(p.nome);
      out.set(p.sku, { copy, nome });
    }
    return out;
  } catch (e) {
    console.error('aviso copy-efeito (produto):', e.message);
    for (const p of (produtos || [])) out.set(p.sku, { copy: FALLBACK_PRODUTO, nome: nomeCurtoFallback(p.nome) });
    return out;
  }
}

// Gera a linha de impacto única para a promo guarda-chuva (ex.: 50% off).
// campanha: {desconto_pct}. NUNCA lança — em falha, cai no fallback padrão.
export async function gerarCopyPromo(campanha) {
  try {
    if (!ANTHROPIC_API_KEY) throw new Error('sem ANTHROPIC_API_KEY_FABRICA/ANTHROPIC_API_KEY_GESTOR');
    const user = 'Campanha: desconto de ' + (campanha?.desconto_pct ?? '?') + '% em toda a loja (shopping, urgência+emoção). Escreva a linha de impacto.';
    const resp = await anthropic({ model: MODEL, max_tokens: 200, system: SYS_PROMO, messages: [{ role: 'user', content: user }] });
    const texto = (resp.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
    const linha = texto.replace(/^["'“]|["'”]$/g, '').trim();
    return linha || FALLBACK_PROMO;
  } catch (e) {
    console.error('aviso copy-efeito (promo):', e.message);
    return FALLBACK_PROMO;
  }
}
