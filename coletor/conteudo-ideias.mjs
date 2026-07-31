// coletor/conteudo-ideias.mjs
//
// O robô de pauta: olha o histórico de uma marca e sugere o que postar.
//
// POR QUE AQUI E NÃO NUMA EDGE FUNCTION: Opus com um contexto grande leva mais
// tempo que o relógio de uma Edge permite. É a mesma razão de a Fábrica de
// Anúncios rodar por GitHub Actions — o `conteudo-trigger` só enfileira e
// dispara este script.
//
// O QUE FAZ ESTE ROBÔ VALER: o contexto, não o modelo. Qualquer LLM escreve
// "poste um bastidor da loja". O que ele não adivinha é o que funcionou NESTA
// marca, o que já está agendado e como ela fala — ver conteudo-contexto.mjs.
//
// Uso:
//   node conteudo-ideias.mjs --job <uuid>
//   node conteudo-ideias.mjs --conta <uuid> --quantas 12
//   node conteudo-ideias.mjs --conta <uuid> --seco     (não grava nada)
// SEM `import 'dotenv/config'`. Parece inofensivo e derrubou as duas primeiras
// rodadas de verdade: no GitHub Actions o pacote não existe (não é dependência
// do coletor, e o workflow instala com --omit=dev), então o script morria com
// ERR_MODULE_NOT_FOUND antes da primeira linha.
//
// Nenhum outro robô daqui usa dotenv — budget-ia, gestor-comercial e companhia
// leem `process.env` direto, porque no Actions as variáveis vêm do `env:` do
// workflow. Para rodar na sua máquina, use:
//   node --env-file=.env conteudo-ideias.mjs --conta <uuid>
import { OPUS, structured, usageSummary } from './lib-llm.mjs';
import { registrarExecucao } from './registrar-execucao.mjs';
import { ESQUEMA, SISTEMA, montarContextoDaMarca, ehRepetida } from './conteudo-contexto.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kounqtdoioootxqegkij.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

const arg = (nome, padrao = null) => {
  const i = process.argv.indexOf(`--${nome}`);
  return i > -1 ? (process.argv[i + 1] || true) : padrao;
};
const SECO = process.argv.includes('--seco');

async function sb(caminho, opcoes = {}) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${caminho}`, {
    ...opcoes,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      ...(opcoes.headers || {}),
    },
  });
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${(await r.text()).slice(0, 200)}`);

  // CORPO VAZIO NÃO É ERRO. Testar só `status === 204` não basta: com
  // `Prefer: return=minimal` o PostgREST responde **201 com corpo vazio** no
  // insert, e `r.json()` estoura com "Unexpected end of JSON input".
  //
  // Isso derrubou uma rodada que tinha dado certo — as 12 ideias já estavam
  // gravadas, e o script morreu na linha seguinte e marcou o pedido como
  // 'erro'. O pior tipo de defeito: o trabalho foi feito e o sistema disse que
  // não foi. Por isso a checagem é pelo conteúdo, não pelo código de status.
  const texto = await r.text();
  return texto ? JSON.parse(texto) : null;
}

async function carregarDadosDaMarca(accountId) {
  const [contas, blocos, pecas, ideiasExistentes, doNicho] = await Promise.all([
    sb(`accounts?id=eq.${accountId}&select=id,name,username,conteudo_usa_portal`),
    sb(`conteudo_blocos?account_id=eq.${accountId}&ativo=eq.true&select=tipo,nome,texto`),
    sb(`conteudo_pecas?account_id=eq.${accountId}&select=id,titulo,formato,status,publicado_em&order=publicado_em.desc&limit=60`),
    sb(`conteudo_ideias?or=(account_id.eq.${accountId},account_id.is.null)&situacao=in.(nova,favorita)&select=titulo`),
    sb(`conteudo_concorrentes?account_id=eq.${accountId}&ativo=eq.true&select=handle,nome,observacao`),
  ]);

  const publicadas = (pecas || []).filter(p => p.status === 'publicada');
  let publicados = publicadas;

  // As métricas de quem já publicou — o insumo que só existe por causa da Fase 3.
  if (publicadas.length) {
    const ids = publicadas.map(p => `"${p.id}"`).join(',');
    const metricas = await sb(
      `conteudo_metricas?peca_id=in.(${ids})&select=peca_id,capturado_em,alcance,curtidas&order=capturado_em.desc`,
    );
    const ultima = {};
    for (const m of metricas || []) if (!ultima[m.peca_id]) ultima[m.peca_id] = m;
    publicados = publicadas.map(p => ({ ...p, metrica: ultima[p.id] || null }));
  }

  const conta = (contas || [])[0] || {};

  // Concorrentes da rodada mais recente do Portal de Notícias.
  //
  // SÓ PARA QUEM É DO NICHO. O Portal cobre moda e calçado (Schutz, Anacapri,
  // Petite Jolie, Arezzo...). Antes eu puxava sem filtro, e a primeira pauta
  // real do Breno Vale — marca pessoal — citou "@Isla, @Santa Lolla e
  // @Arezzo&Co" como concorrentes dele. Quem manda é a coluna
  // `accounts.conteudo_usa_portal`, que nasce falsa.
  //
  // As colunas são `marca`, `titulo` e `resumo` — NÃO handle/legenda/curtidas.
  // (Escrevi errado na primeira versão e o try/catch abaixo engoliu: a seção de
  // concorrentes simplesmente não aparecia no prompt, sem erro nenhum. Se mexer
  // aqui, confira contra o schema antes.)
  //
  // Best-effort de propósito: sem o Portal, o briefing sai um pouco mais pobre,
  // mas a rodada não pode falhar por causa de uma seção acessória.
  let concorrentes = [];
  if (conta.conteudo_usa_portal) {
    try {
      const linhas = await sb(
        'noticias_concorrentes?select=marca,titulo,resumo,categoria&order=rodada.desc&limit=8',
      ) || [];
      concorrentes = linhas.map(l => ({
        handle: l.marca,
        legenda: [l.titulo, l.resumo].filter(Boolean).join(' — '),
      })).filter(c => c.legenda);
    } catch { concorrentes = []; }
  }

  return {
    conta,
    blocos: blocos || [],
    publicados,
    agendadas: pecas || [],
    concorrentes,
    concorrentesDaMarca: doNicho || [],
    hoje: new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }),
    jaExistem: (ideiasExistentes || []).map(i => i.titulo),
  };
}

async function main() {
  const jobId = arg('job');
  let accountId = arg('conta');
  const quantas = Number(arg('quantas', 12));
  const comecou = Date.now();

  if (!SERVICE_KEY) throw new Error('falta SUPABASE_SERVICE_KEY');

  // Veio pela fila: pega a conta do job e marca como rodando.
  if (jobId) {
    const jobs = await sb(`conteudo_jobs?id=eq.${jobId}&select=id,account_id,params`);
    const job = (jobs || [])[0];
    if (!job) throw new Error(`job ${jobId} não encontrado`);
    accountId = job.account_id;
    await sb(`conteudo_jobs?id=eq.${jobId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        status: 'rodando',
        github_run_id: process.env.GITHUB_RUN_ID || null,
        updated_at: new Date().toISOString(),
      }),
    });
  }
  if (!accountId) throw new Error('informe --conta <uuid> ou --job <uuid>');

  const dados = await carregarDadosDaMarca(accountId);
  const briefing = montarContextoDaMarca(dados);
  console.log(`marca: ${dados.conta.name} · ${dados.publicados.length} publicados · ${dados.jaExistem.length} ideias já no banco`);

  const resposta = await structured({
    model: OPUS,
    system: SISTEMA,
    user: `${briefing}\n\n## Sua tarefa\nSugira ${quantas} ideias de conteúdo para esta marca.`,
    schema: ESQUEMA,
    maxTokens: 8192,
  });

  const brutas = Array.isArray(resposta?.ideias) ? resposta.ideias : [];

  // DEDUPLICAÇÃO. Sem isto, "gerar mais ideias" pela terceira vez devolve a
  // mesma pauta com outras palavras, e o banco vira um depósito de repetição.
  // Compara contra o que já existe E contra as desta mesma rodada.
  const jaVistas = [...dados.jaExistem];
  const novas = [];
  let repetidas = 0;
  for (const ideia of brutas) {
    if (ehRepetida(ideia?.titulo, jaVistas)) { repetidas++; continue; }
    jaVistas.push(ideia.titulo);
    novas.push(ideia);
  }

  console.log(`${brutas.length} sugeridas · ${novas.length} novas · ${repetidas} repetidas (descartadas)`);

  if (SECO) {
    console.log(JSON.stringify(novas, null, 2));
  } else if (novas.length) {
    await sb('conteudo_ideias', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify(novas.map(i => ({
        account_id: accountId,
        titulo: i.titulo,
        gancho: i.gancho || null,
        formato: i.formato || null,
        pilar: i.pilar || null,
        roteiro: Array.isArray(i.roteiro) ? i.roteiro : [],
        producao: i.producao || null,
        porque_formato: i.porque_formato || null,
        cta: i.cta || null,
        legenda_sugerida: i.legenda_sugerida || null,
        hashtags_sugeridas: i.hashtags_sugeridas || null,
        por_que_agora: i.por_que_agora || null,
        origem: 'ia',
        modelo: OPUS,
        job_id: jobId || null,
      }))),
    });
  }

  const uso = usageSummary();
  console.log(uso.text);

  if (jobId && !SECO) {
    await sb(`conteudo_jobs?id=eq.${jobId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        status: 'concluido',
        resultado: { sugeridas: brutas.length, gravadas: novas.length, repetidas, usd: uso.usd },
        updated_at: new Date().toISOString(),
      }),
    });
  }

  // Telemetria: aparece sozinha no Painel de Status do Claude, sem tocar naquela tela.
  await registrarExecucao({
    robo: 'conteudo-ideias',
    acao: `gerar ideias de conteúdo · ${dados.conta.name || accountId}`,
    modelo: OPUS,
    inputTokens: uso.tin, outputTokens: uso.tout, chamadas: uso.calls,
    duracaoMs: Date.now() - comecou,
    itens: novas.length, unidade: 'ideias',
    status: 'ok',
    detalhe: repetidas ? `${repetidas} repetidas descartadas` : null,
  });
}

main().catch(async (e) => {
  console.error('ERRO:', e.message);
  const jobId = arg('job');
  if (jobId && SERVICE_KEY) {
    await sb(`conteudo_jobs?id=eq.${jobId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'erro', erro: String(e.message).slice(0, 500), updated_at: new Date().toISOString() }),
    }).catch(() => {});
  }
  await registrarExecucao({
    robo: 'conteudo-ideias', acao: 'gerar ideias de conteúdo',
    status: 'erro', detalhe: String(e.message).slice(0, 300),
  }).catch(() => {});
  process.exit(1);
});
