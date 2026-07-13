// coletor/registrar-execucao.mjs
// Helper de telemetria do "Painel de Status do Claude". Grava UMA linha por
// execução de robô em ia_execucoes (custo/tokens/tempo/volume) via service key.
//
// Regra de ouro: telemetria NUNCA derruba um robô. Tudo em try/catch silencioso.
//
// Preço oficial (US$ por 1M tokens) — fonte de verdade única, reaproveitável:
//   Opus 4.8:  entrada US$5,  saída US$25
//   Sonnet 4.6: entrada US$3, saída US$15
// (o lib-llm.mjs tem uma tabela antiga com Opus 15/75 — NÃO usar para custo.)
export const PRECO = {
  opus:   { in: 5, out: 25 },
  sonnet: { in: 3, out: 15 },
};

// Calcula o custo em US$ a partir do modelo + tokens (usa PRECO centralizado).
export function calcularUsd(modelo, inputTokens = 0, outputTokens = 0) {
  const p = String(modelo || '').includes('opus') ? PRECO.opus : PRECO.sonnet;
  return (inputTokens / 1e6) * p.in + (outputTokens / 1e6) * p.out;
}

// Registra uma execução. `usd` é opcional: se vier undefined, calcula de modelo+tokens.
export async function registrarExecucao({
  robo, acao, modelo = null,
  inputTokens = 0, outputTokens = 0, chamadas = 0,
  usd, duracaoMs = null, itens = null, unidade = null,
  status = 'ok', detalhe = null,
}) {
  try {
    // Lê o env na hora da chamada (scripts como panorama populam o .env em runtime).
    const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kounqtdoioootxqegkij.supabase.co';
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
    if (!SERVICE_KEY) { console.error('aviso ia_execucoes: falta SUPABASE_SERVICE_KEY'); return; }
    const custo = (usd === undefined || usd === null)
      ? (modelo ? calcularUsd(modelo, inputTokens, outputTokens) : 0)
      : usd;
    const body = {
      robo, acao, modelo,
      input_tokens: inputTokens, output_tokens: outputTokens, chamadas,
      usd: Number(Number(custo).toFixed(4)),
      duracao_ms: duracaoMs, itens, unidade, status, detalhe,
      github_run_id: process.env.GITHUB_RUN_ID || null,
    };
    const r = await fetch(SUPABASE_URL + '/rest/v1/ia_execucoes', {
      method: 'POST',
      headers: {
        apikey: SERVICE_KEY,
        Authorization: 'Bearer ' + SERVICE_KEY,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(body),
    });
    if (!r.ok && ![200, 201, 204].includes(r.status)) {
      console.error('aviso ia_execucoes: POST -> ' + r.status + ' ' + (await r.text()).slice(0, 200));
    }
  } catch (e) {
    console.error('aviso ia_execucoes:', e.message);
  }
}
