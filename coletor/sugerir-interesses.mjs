// Robô semanal: sugere interesses de segmentação por marca × objetivo.
//
// COMO FUNCIONA: lê as marcas ativas e as lojas de cada uma, pede ao modelo uma
// lista de interesses para cada objetivo, e VALIDA CADA NOME NA META antes de
// gravar. O que a Meta não reconhece é descartado — a IA propõe, a Meta decide.
//
// POR QUE PRÉ-CALCULADO E NÃO SOB CLIQUE: a sugestão já está na tela quando o
// dono abre o editor, o custo é fixo por semana em vez de crescer com o uso, e
// não se abre a porta de "IA respondendo a clique", que este produto não tem.
//
// Custo: ~6 gerações pequenas por semana com Sonnet. Anotado em ia_execucoes,
// então o valor real aparece no painel Status do Claude, em reais.
import { structured, SONNET, usageSummary } from './lib-llm.mjs';
import { registrarExecucao } from './registrar-execucao.mjs';
import { montarPedido, nomesPropostos, filtrarValidos, OBJETIVOS } from './lib/interesses.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kounqtdoioootxqegkij.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const REST = SUPABASE_URL + '/rest/v1';
const MODEL = process.env.INTERESSES_MODEL || SONNET;
const DRY = process.argv.includes('--dry');

const sbHeaders = { apikey: SERVICE_KEY, Authorization: 'Bearer ' + SERVICE_KEY, 'Content-Type': 'application/json' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function sbGet(path) {
  const r = await fetch(REST + path, { headers: sbHeaders });
  if (!r.ok) throw new Error(`GET ${path} ${r.status}`);
  return r.json();
}
async function sbPost(path, body, prefer) {
  const r = await fetch(REST + path, {
    method: 'POST',
    headers: { ...sbHeaders, Prefer: prefer || 'return=minimal' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`POST ${path} ${r.status} ${(await r.text()).slice(0, 200)}`);
}

// Fala com a Meta pela Edge meta-proxy, como o resto do projeto.
// Manda ARRAY, não texto: o proxy já faz JSON.stringify em valor que é objeto,
// e converter aqui converteria duas vezes.
async function validarNaMeta(accountId, nomes) {
  const r = await fetch(SUPABASE_URL + '/functions/v1/meta-proxy', {
    method: 'POST',
    headers: { ...sbHeaders, Authorization: 'Bearer ' + SERVICE_KEY },
    body: JSON.stringify({
      accountId,
      path: '/search',
      params: { type: 'adinterestvalid', interest_list: nomes },
      method: 'GET',
    }),
  });
  if (!r.ok) throw new Error('meta-proxy ' + r.status);
  return r.json();
}

const SCHEMA = {
  type: 'object',
  properties: {
    interesses: {
      type: 'array',
      items: { type: 'string' },
      description: 'Nomes de interesse do Meta, em português do Brasil, até 12.',
    },
  },
  required: ['interesses'],
};

export async function run() {
  const t0 = Date.now();
  if (!SERVICE_KEY) { console.error('falta SUPABASE_SERVICE_KEY'); process.exit(1); }

  const marcas = await sbGet('/fabrica_marcas?select=id,nome,account_id&ativo=eq.true');
  const lojas = await sbGet('/fabrica_lojas?select=nome,marca_id,geo_cities');

  let gravadas = 0, puladas = 0, totPropostos = 0, totValidos = 0;

  for (const marca of marcas) {
    const lojasDaMarca = lojas.filter((l) => l && l.marca_id === marca.id);
    for (const objetivo of OBJETIVOS) {
      const pedido = montarPedido({ marca, lojas: lojasDaMarca, objetivo });
      if (!pedido) { puladas++; continue; }

      let resposta;
      try {
        resposta = await structured({ model: MODEL, system: pedido.system, user: pedido.user, schema: SCHEMA, toolName: 'sugerir' });
      } catch (e) {
        console.log(`  ⚠ ${marca.nome} · ${objetivo}: IA falhou — ${String(e).slice(0, 120)}`);
        puladas++; continue;
      }

      const propostos = nomesPropostos(resposta);
      if (!propostos.length) { console.log(`  ⚠ ${marca.nome} · ${objetivo}: IA não propôs nada`); puladas++; continue; }

      let validacao;
      try {
        validacao = await validarNaMeta(marca.account_id, propostos);
      } catch (e) {
        // Sem validação NÃO grava: sugestão não conferida na Meta é pior que
        // sugestão nenhuma, porque dá erro só na hora de usar.
        console.log(`  ⚠ ${marca.nome} · ${objetivo}: validação falhou — ${String(e).slice(0, 120)}`);
        puladas++; continue;
      }

      const { itens, propostos: nProp, validos } = filtrarValidos(propostos, validacao);
      totPropostos += nProp; totValidos += validos;
      console.log(`  ${marca.nome} · ${objetivo}: ${validos}/${nProp} sobreviveram à validação`);

      if (!itens.length) { puladas++; continue; }
      if (DRY) { gravadas++; continue; }

      try {
        await sbPost('/interesses_sugeridos?on_conflict=marca_id,objetivo', {
          marca_id: marca.id, objetivo, itens, propostos: nProp, validos, modelo: MODEL,
          gerado_em: new Date().toISOString(),
        }, 'resolution=merge-duplicates,return=minimal');
      } catch (e) {
        // Uma marca não pode derrubar a rodada inteira: as outras marca×objetivo
        // ainda não processadas continuam valendo a pena tentar.
        console.log(`  ⚠ ${marca.nome} · ${objetivo}: gravar falhou — ${String(e).slice(0, 120)}`);
        puladas++; continue;
      }
      gravadas++;
      await sleep(500);
    }
  }

  const uso = usageSummary();
  const aproveitamento = totPropostos ? Math.round((totValidos / totPropostos) * 100) : 0;
  console.log(`\n${gravadas} gravadas, ${puladas} puladas, aproveitamento ${aproveitamento}%${DRY ? ' (dry)' : ''}`);

  // NOMES CONFERIDOS em lib-llm.mjs: usageSummary devolve { usd, tin, tout,
  // calls, text } — NÃO inputTokens/outputTokens/chamadas. Errar aqui faria o
  // custo aparecer como ZERO no painel Status do Claude.
  // E não se passa `usd`: quem calcula preço é o registrar-execucao.mjs, que é
  // a fonte de verdade (o lib-llm tem tabela própria que pode divergir).
  await registrarExecucao({
    robo: 'sugerir-interesses', acao: 'sugestão de interesses', modelo: MODEL,
    inputTokens: uso.tin || 0, outputTokens: uso.tout || 0, chamadas: uso.calls || 0,
    duracaoMs: Date.now() - t0, itens: gravadas, unidade: 'marca×objetivo',
    status: 'ok', detalhe: `${gravadas} gravadas, ${puladas} puladas, aproveitamento ${aproveitamento}%`,
  });
}

run().catch(async (e) => {
  console.error(e);
  await registrarExecucao({
    robo: 'sugerir-interesses', acao: 'sugestão de interesses', modelo: MODEL,
    status: 'erro', detalhe: String((e && e.message) || e).slice(0, 500),
  });
  process.exit(1);
});
