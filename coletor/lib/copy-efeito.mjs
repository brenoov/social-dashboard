// coletor/lib/copy-efeito.mjs
// Gera "copy de efeito" (linha de impacto) por produto + uma pra promo guarda-
// chuva, via Claude (Opus). Chamador já carregou o .env (não importar
// carregar-env.mjs aqui — este lib fica em coletor/lib/, quem entra primeiro
// é o script/CLI que roda no topo).
// Aceita ANTHROPIC_API_KEY (o nome que o workflow fabrica.yml injeta, vindo do
// secret ANTHROPIC_API_KEY_TRAFEGO) além das chaves dedicadas. Sem isto, no CI a
// chave não era encontrada e TODO copy/nome/legenda caía no fallback genérico
// (nome virava "Bolsa Executiva Grande" em vez de "Bolsa Pisa").
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY_FABRICA || process.env.ANTHROPIC_API_KEY_GESTOR || process.env.ANTHROPIC_API_KEY;
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

// Marca default quando campanha.marca não vem resolvida (mantém o prompt válido
// e multi-marca sem quebrar — não hardcoda mais "La Vessel").
const MARCA_DEFAULT = 'a marca';

// Regra de MATERIAL: as bolsas são de tecido/canvas — a IA cravava "couro" (falso).
// Proíbe couro e comparações não comprováveis; permite valorizar o têxtil com elegância.
const REGRA_MATERIAL = 'MATERIAL (regra crítica): estas bolsas são de TECIDO/CANVAS (com poucos detalhes em metal/ferragem) — NUNCA descreva o produto como "couro" nem "leather" (seria FALSO). Você PODE valorizar o material têxtil com elegância quando couber (leveza, textura, caimento, praticidade do dia a dia), mas NUNCA faça comparações falsas ou não comprováveis (ex.: "mais durável que couro", "melhor que couro"). ';

// Voz de marca (ex.: La Vessel): luxo europeu suave, feminino, atemporal,
// "sussurra sofisticação", lema "cada bolsa conta uma história". Contexto desta
// rodada: campanha de shopping (loja física em shopping) — tom puxa URGÊNCIA +
// EMOÇÃO, não preço puro. O nome da marca é parametrizado por campanha.marca.
const sysProduto = (marca) => 'Você escreve microcopy de campanha para ' + (marca || MARCA_DEFAULT) + ', marca de bolsas de luxo europeu suave, feminino, atemporal — a marca "sussurra sofisticação", nunca grita. Lema: "cada bolsa conta uma história". '
  + 'Esta rodada é uma campanha de SHOPPING (loja física em shopping físico), com o objetivo de gerar CONVERSAS no WhatsApp: o tom precisa puxar URGÊNCIA + EMOÇÃO, não preço puro. '
  + REGRA_MATERIAL
  + 'Para cada produto, gere TRÊS coisas: '
  + '(A) COPY — a linha de impacto da ARTE (texto sobre a imagem). Regras invioláveis: (1) português do Brasil; (2) CURTA, no máximo ~40 caracteres; (3) impactante, sem ser genérica; (4) NUNCA prometa algo falso ou exagerado (nada de "a melhor bolsa do mundo", "número 1", etc.); (5) SEM emoji; (6) SEM hashtag; (7) coerente com o nome/estilo daquele produto específico. '
  + '(B) NOME — um NOME CURTO de exibição: o nome completo do Bling (ex.: "Bolsa De Ombro Grande Viena Marinho") tem tipo/tamanho/cor misturados com uma palavra distintiva de CIDADE ou PAÍS (ex.: Viena, Belgrado, Genebra, Madrid). O nome curto deve ser SEMPRE no formato "Bolsa <Cidade/País>" — descarte tipo, tamanho e cor, mantenha só "Bolsa " + a cidade/país do nome original. '
  + '(C) LEGENDA — o texto do ANÚNCIO (o "message" que acompanha a imagem no feed do Meta), que é DIFERENTE e mais longo que a copy da arte. Regras invioláveis: (1) português do Brasil; (2) persuasiva e vendedora, com respiro criativo — de 1 a 2 frases (nunca uma palavra só); (3) mencione o produto (pelo nome curto/cidade) E o desconto informado para AQUELE SKU (não invente outro número); (4) termine com uma chamada de ação de WhatsApp (ex.: "Chame no WhatsApp", "Fale com a gente no WhatsApp", "Garanta a sua no WhatsApp"); (5) pode usar NO MÁXIMO 1 emoji, com elegância (ou nenhum); (6) SEM hashtag; (7) NUNCA prometa algo falso ou exagerado. '
  + 'Responda APENAS com um bloco de código ```json contendo um objeto {"<sku>": {"copy": "<linha de impacto>", "nome": "Bolsa <Cidade>", "legenda": "<texto persuasivo do anúncio com CTA de WhatsApp>"}, ...} — uma chave por SKU recebido, nada fora do bloco.';

const sysPromo = (marca) => 'Você escreve microcopy de campanha para ' + (marca || MARCA_DEFAULT) + ', marca de bolsas de luxo europeu suave, feminino, atemporal — a marca "sussurra sofisticação", nunca grita. Lema: "cada bolsa conta uma história". '
  + 'Esta rodada é uma campanha de SHOPPING (loja física em shopping físico) para uma promoção guarda-chuva de desconto: o tom precisa puxar URGÊNCIA + EMOÇÃO, não preço puro. '
  + REGRA_MATERIAL
  + 'Escreva UMA única linha de impacto para a promoção inteira. Regras invioláveis: (1) português do Brasil; (2) CURTA, no máximo ~40 caracteres; (3) impactante; (4) NUNCA prometa algo falso ou exagerado; (5) SEM emoji; (6) SEM hashtag. '
  + 'Responda APENAS com a linha, sem aspas, sem explicação, sem markdown.';

function parseJsonFence(texto) {
  const m = texto.match(/```json\s*([\s\S]*?)```/i) || texto.match(/```\s*([\s\S]*?)```/);
  const raw = m ? m[1].trim() : texto.trim();
  return JSON.parse(raw);
}

const nomeCurtoFallback = (nome) => String(nome || '').trim().split(/\s+/).slice(0, 3).join(' ');

// Gera, por produto (batch, UMA chamada Anthropic): a linha de impacto da arte
// (copy), o nome curto de exibição (nome) e a LEGENDA persuasiva do anúncio
// (legenda — o "message" do Meta, com CTA de WhatsApp).
// produtos: [{sku, nome}]; campanha: {desconto_pct, marca}
// Retorna Map<sku, {copy, nome, legenda}>. `legenda` é null quando o modelo não
// devolve uma (o gerar/subir caem na legenda de marca como fallback).
// NUNCA lança — em qualquer falha, cai no fallback padrão (legenda: null) para
// todos os SKUs recebidos.
export async function gerarCopysProduto(produtos, campanha) {
  const out = new Map();
  try {
    if (!ANTHROPIC_API_KEY) throw new Error('sem ANTHROPIC_API_KEY_FABRICA/ANTHROPIC_API_KEY_GESTOR');
    if (!Array.isArray(produtos) || !produtos.length) return out;
    // Cada produto tem seu PRÓPRIO desconto (pct por item) — a legenda tem de usar o desconto
    // DAQUELE SKU (a arte usa o mesmo), senão a legenda dizia o desconto da campanha e divergia.
    const lista = produtos.map((p) => {
      const pct = p.pct != null ? Math.round(Number(p.pct)) : (campanha?.desconto_pct != null ? Math.round(Number(campanha.desconto_pct)) : null);
      return `- SKU ${p.sku}: ${p.nome}${pct != null ? ` — desconto ${pct}%` : ''}`;
    }).join('\n');
    const user = 'Campanha de shopping (loja física, urgência+emoção, conversas no WhatsApp). '
      + 'Cada produto tem SEU PRÓPRIO desconto, informado por SKU abaixo — na legenda de cada um use o desconto DAQUELE SKU (não um desconto único da campanha).\n\n'
      + 'Produtos (gere copy + nome curto + legenda de anúncio por SKU):\n' + lista;
    const resp = await anthropic({ model: MODEL, max_tokens: 3000, system: sysProduto(campanha?.marca), messages: [{ role: 'user', content: user }] });
    const texto = (resp.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
    const obj = parseJsonFence(texto);
    for (const p of produtos) {
      const item = obj?.[p.sku];
      const copy = typeof item?.copy === 'string' && item.copy.trim() ? item.copy.trim() : FALLBACK_PRODUTO;
      const nome = typeof item?.nome === 'string' && item.nome.trim() ? item.nome.trim() : nomeCurtoFallback(p.nome);
      const legenda = typeof item?.legenda === 'string' && item.legenda.trim() ? item.legenda.trim() : null;
      out.set(p.sku, { copy, nome, legenda });
    }
    return out;
  } catch (e) {
    console.error('aviso copy-efeito (produto):', e.message);
    for (const p of (produtos || [])) out.set(p.sku, { copy: FALLBACK_PRODUTO, nome: nomeCurtoFallback(p.nome), legenda: null });
    return out;
  }
}

// Gera a linha de impacto única para a promo guarda-chuva (ex.: 50% off).
// campanha: {desconto_pct}. NUNCA lança — em falha, cai no fallback padrão.
export async function gerarCopyPromo(campanha) {
  try {
    if (!ANTHROPIC_API_KEY) throw new Error('sem ANTHROPIC_API_KEY_FABRICA/ANTHROPIC_API_KEY_GESTOR');
    const user = 'Campanha: desconto de ' + (campanha?.desconto_pct ?? '?') + '% em toda a loja (shopping, urgência+emoção). Escreva a linha de impacto.';
    const resp = await anthropic({ model: MODEL, max_tokens: 200, system: sysPromo(campanha?.marca), messages: [{ role: 'user', content: user }] });
    const texto = (resp.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
    const linha = texto.replace(/^["'“]|["'”]$/g, '').trim();
    return linha || FALLBACK_PROMO;
  } catch (e) {
    console.error('aviso copy-efeito (promo):', e.message);
    return FALLBACK_PROMO;
  }
}
