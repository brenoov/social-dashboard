#!/usr/bin/env node
// Agente coletor de notícias — roda no GitHub Actions (cron diário).
// Cérebro: Claude (Sonnet 4.6) com a ferramenta de web search — pesquisa,
// julga relevância/recência e resume por marca. Gravação: REST do Supabase.
// Observabilidade: grava início/fim na tabela public.coletor_log.
//
// Segredos (via env / GitHub Secrets): ANTHROPIC_API_KEY, SUPABASE_SERVICE_KEY.
// Sem dependências externas — usa fetch nativo (Node 18+).

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kounqtdoioootxqegkij.supabase.co';
const MODEL = process.env.COLETOR_MODEL || 'claude-sonnet-4-6';

if (!ANTHROPIC_API_KEY || !SUPABASE_SERVICE_KEY) {
  console.error('✗ Faltam ANTHROPIC_API_KEY e/ou SUPABASE_SERVICE_KEY no ambiente.');
  process.exit(1);
}

const MARCAS = ['Santa Lolla', 'Capodarte', 'Carmen Steffens', 'Dumond', 'Arezzo&Co', 'Chenson', 'SAAD', 'La Vessel', 'Mercado'];
const CATEGORIAS = ['Lançamento', 'Campanha', 'Preço/Promo', 'Faturamento', 'Expansão', 'Tendência', 'Estratégia', 'Marketing', 'Design', 'Moda'];
const HOJE = new Date().toISOString().slice(0, 10);
const REST = SUPABASE_URL + '/rest/v1';
const sbHeaders = {
  apikey: SUPABASE_SERVICE_KEY,
  Authorization: 'Bearer ' + SUPABASE_SERVICE_KEY,
  'Content-Type': 'application/json',
};

// ── Supabase REST ──
async function sbInsert(path, body, extraPrefer) {
  const headers = { ...sbHeaders };
  if (extraPrefer) headers.Prefer = extraPrefer;
  const r = await fetch(REST + path, { method: 'POST', headers, body: JSON.stringify(body) });
  if (!r.ok && r.status !== 201 && r.status !== 200 && r.status !== 204) {
    const t = await r.text();
    throw new Error('Supabase POST ' + path + ' -> ' + r.status + ' ' + t.slice(0, 300));
  }
  return r;
}
async function logColetor(fields) {
  try { await sbInsert('/coletor_log', fields, 'return=minimal'); }
  catch (e) { console.error('aviso: falha ao gravar coletor_log:', e.message); }
}

// ── Anthropic ──
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const baseHeaders = {
  'x-api-key': ANTHROPIC_API_KEY,
  'anthropic-version': '2023-06-01',
  'content-type': 'application/json',
};
async function anthropic(body) {
  const r = await fetch(ANTHROPIC_URL, { method: 'POST', headers: baseHeaders, body: JSON.stringify(body) });
  const j = await r.json();
  if (!r.ok) throw new Error('Anthropic ' + r.status + ' ' + JSON.stringify(j).slice(0, 400));
  return j;
}

const SCHEMA = {
  type: 'object',
  properties: {
    noticias: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          titulo: { type: 'string' },
          resumo: { type: 'string' },
          categoria: { type: 'string', enum: CATEGORIAS },
          url: { type: 'string' },
          fonte: { type: 'string' },
          data_publicacao: { type: 'string' },
          destaque: { type: 'boolean' },
        },
        required: ['titulo', 'resumo', 'categoria', 'url', 'fonte', 'data_publicacao', 'destaque'],
        additionalProperties: false,
      },
    },
  },
  required: ['noticias'],
  additionalProperties: false,
};

function promptPesquisa(marca) {
  const ehMercado = marca === 'Mercado';
  const alvo = ehMercado
    ? 'tendências do setor de moda/bolsas/calçados no Brasil: formatos, cores, design, materiais, dados de varejo/faturamento, comportamento de consumo e promoções'
    : 'a marca "' + marca + '" (moda/bolsas/calçados)';
  return 'Você é um analista de inteligência de concorrência da Vessel (bolsas femininas). '
    + 'Pesquise na web as notícias MAIS RECENTES (priorize os últimos 30 dias; depois o restante de 2026) sobre ' + alvo + '. '
    + 'Cubra: estratégia, tendências, marketing, design, moda, lançamentos, campanhas, preços/promoções, faturamento e expansão. '
    + 'Use a ferramenta de busca várias vezes com queries diferentes. Traga o MÁXIMO de matérias relevantes e recentes que encontrar. '
    + 'NUNCA invente — use só fontes reais com URL verificável. Quando terminar de pesquisar, resuma o que achou.';
}

function promptEstrutura(marca) {
  return 'Com base APENAS no que você pesquisou acima, gere a lista de notícias desta marca. '
    + 'Para cada notícia: titulo (curto, sem aspas duplas), resumo (1-2 frases com o INSIGHT competitivo para a Vessel), '
    + 'categoria (EXATAMENTE um de: ' + CATEGORIAS.join(', ') + '), url (link real da fonte), fonte (nome do veículo), '
    + 'data_publicacao (YYYY-MM-DD, a data real da matéria; se desconhecida, use a mais provável), '
    + 'destaque (true APENAS para a matéria mais importante/recente; false nas demais). '
    + 'Inclua só matérias com fonte e URL reais. Se não achou nada relevante, retorne lista vazia.';
}

// Roda o loop agêntico de pesquisa (lida com pause_turn dos server tools) e
// depois força a saída estruturada (JSON validado por schema).
async function coletarMarca(marca) {
  const messages = [{ role: 'user', content: promptPesquisa(marca) }];
  const tools = [{ type: 'web_search_20260209', name: 'web_search', max_uses: 6 }];

  for (let i = 0; i < 8; i++) {
    const resp = await anthropic({ model: MODEL, max_tokens: 4096, tools, messages });
    messages.push({ role: 'assistant', content: resp.content });
    if (resp.stop_reason === 'pause_turn') continue;       // server-tool loop pausou → reenvia
    if (resp.stop_reason === 'tool_use') continue;         // (defensivo) continua o loop
    break;                                                  // end_turn / max_tokens → pesquisa terminou
  }

  // Passo 2: estruturar em JSON validado (sem tools, com output_config.format)
  messages.push({ role: 'user', content: promptEstrutura(marca) });
  const estrut = await anthropic({
    model: MODEL,
    max_tokens: 8192,
    messages,
    output_config: { format: { type: 'json_schema', schema: SCHEMA } },
  });
  const txt = (estrut.content.find(b => b.type === 'text') || {}).text || '{"noticias":[]}';
  let parsed;
  try { parsed = JSON.parse(txt); } catch (e) { parsed = { noticias: [] }; }
  const lista = Array.isArray(parsed.noticias) ? parsed.noticias : [];

  // Sanitiza + injeta marca/rodada (não confia no modelo p/ esses campos)
  return lista
    .filter(n => n && n.titulo && n.url && CATEGORIAS.includes(n.categoria))
    .map(n => ({
      marca,
      titulo: String(n.titulo).slice(0, 300),
      resumo: n.resumo ? String(n.resumo).slice(0, 1200) : null,
      categoria: n.categoria,
      url: String(n.url).slice(0, 1000),
      fonte: n.fonte ? String(n.fonte).slice(0, 200) : null,
      data_publicacao: /^\d{4}-\d{2}-\d{2}$/.test(n.data_publicacao || '') ? n.data_publicacao : null,
      rodada: HOJE,
      destaque: !!n.destaque,
    }));
}

async function main() {
  console.log('== Coletor de notícias · rodada ' + HOJE + ' · modelo ' + MODEL + ' ==');
  await logColetor({ fase: 'inicio', detalhe: 'rodada ' + HOJE + ' (' + MODEL + ')' });

  let encontradas = 0, inseridas = 0;
  const resumo = [];
  for (const marca of MARCAS) {
    try {
      const lista = await coletarMarca(marca);
      encontradas += lista.length;
      if (lista.length) {
        await sbInsert('/noticias_concorrentes?on_conflict=marca,titulo,rodada', lista,
          'resolution=ignore-duplicates,return=minimal');
        inseridas += lista.length;
      }
      resumo.push(marca + ': ' + lista.length);
      console.log('  ' + marca + ' → ' + lista.length + ' notícia(s)');
    } catch (e) {
      resumo.push(marca + ': ERRO');
      console.error('  ' + marca + ' → ERRO: ' + e.message);
    }
  }

  console.log('== Total: ' + inseridas + ' enviadas (dedupe no banco) ==');
  await logColetor({ fase: 'fim', encontradas, inseridas, erro: null, detalhe: resumo.join(' · ') });
}

main().catch(async (e) => {
  console.error('FALHA GERAL:', e.message);
  await logColetor({ fase: 'fim', erro: e.message.slice(0, 500), detalhe: 'falha geral' });
  process.exit(1);
});
