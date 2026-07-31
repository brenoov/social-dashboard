// Motor LLM compartilhado do agente: chamada Anthropic com SAÍDA ESTRUTURADA (tool-use forçado) + retry.
// Modelos: SONNET (volume/barato) e OPUS (estratégico). Híbrido escolhido pelo dono.
export const SONNET = process.env.MODEL_SONNET || 'claude-sonnet-4-6';
export const OPUS = process.env.MODEL_OPUS || 'claude-opus-4-8';
const API = 'https://api.anthropic.com/v1/messages';
const KEY = process.env.ANTHROPIC_API_KEY;
const H = { 'x-api-key': KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' };
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── medição de custo (USD por 1M tokens, aprox.) ──
// Preço oficial US$/1M tokens. Opus 4.8: 5/25; Sonnet 4.6: 3/15.
const PRICE = { sonnet: { in: 3, out: 15 }, opus: { in: 5, out: 25 } };
const _u = { sonnet: { in: 0, out: 0, calls: 0 }, opus: { in: 0, out: 0, calls: 0 } };
function _track(model, usage) {
  const b = String(model).includes('opus') ? _u.opus : _u.sonnet;
  b.in += usage?.input_tokens || 0; b.out += usage?.output_tokens || 0; b.calls++;
}
export function usageSummary() {
  const cost = k => (_u[k].in / 1e6) * PRICE[k].in + (_u[k].out / 1e6) * PRICE[k].out;
  const usd = cost('sonnet') + cost('opus');
  const tin = _u.sonnet.in + _u.opus.in, tout = _u.sonnet.out + _u.opus.out;
  const text = `Sonnet ${_u.sonnet.calls}ch ${_u.sonnet.in}+${_u.sonnet.out}tok · Opus ${_u.opus.calls}ch ${_u.opus.in}+${_u.opus.out}tok · ~US$${usd.toFixed(2)}`;
  return { usd: Number(usd.toFixed(2)), tin, tout, calls: _u.sonnet.calls + _u.opus.calls, text };
}

// Retorna o input estruturado (objeto) que o modelo passou pro tool. Tenta N vezes em 429/5xx/rede.
export async function structured({ model, system, user, schema, toolName = 'responder', maxTokens = 4096, tentativas = 6 }) {
  if (!KEY) throw new Error('falta ANTHROPIC_API_KEY');
  const body = {
    model, max_tokens: maxTokens,
    system: system || undefined,
    messages: [{ role: 'user', content: user }],
    tools: [{ name: toolName, description: 'Responde de forma estruturada.', input_schema: schema }],
    tool_choice: { type: 'tool', name: toolName },
  };
  let lastErr = '';
  for (let t = 0; t < tentativas; t++) {
    try {
      const r = await fetch(API, { method: 'POST', headers: H, body: JSON.stringify(body) });
      if (r.status === 429 || r.status === 529 || r.status >= 500) { lastErr = r.status + ' ' + (await r.text()).slice(0, 160); await sleep(2000 * (t + 1)); continue; }
      if (!r.ok) throw new Error('Anthropic ' + r.status + ' ' + (await r.text()).slice(0, 200));
      const j = await r.json();
      const tu = (j.content || []).find(c => c.type === 'tool_use');
      if (!tu) { lastErr = 'sem tool_use'; await sleep(1500 * (t + 1)); continue; }
      _track(model, j.usage);

      // RESPOSTA CORTADA NO TETO NÃO É RESPOSTA.
      //
      // Quando a saída bate em `max_tokens`, a API devolve 200 e um tool_use com
      // o JSON pela metade — e nós devolvíamos esse pedaço como se fosse o
      // resultado. Aconteceu de verdade: o robô de pauta pediu 12 ideias com
      // roteiro completo, parou exatamente em 8192 tokens de saída, gravou ZERO
      // ideias e registrou a rodada como concluída. Custou US$0,22 e ninguém
      // ficou sabendo que tinha falhado.
      //
      // Estourar aqui é melhor que devolver dado pela metade — e não adianta
      // repetir, porque o teto é o mesmo em toda tentativa: o que precisa mudar
      // é `maxTokens` ou o tamanho do pedido.
      // NÃO REPETIR: o teto é o mesmo em toda tentativa, então repetir só
      // multiplicaria a conta (6 tentativas × o preço de uma resposta cheia)
      // para chegar no mesmo lugar. O que precisa mudar é maxTokens ou o
      // tamanho do pedido — e isso é decisão de quem chamou.
      if (j.stop_reason === 'max_tokens') {
        const fatal = new Error(
          `resposta cortada no teto de ${maxTokens} tokens de saída — o JSON veio pela metade. `
          + 'Aumente maxTokens ou peça menos itens de uma vez.',
        );
        fatal.naoRepetir = true;
        throw fatal;
      }
      return tu.input;
    } catch (e) {
      if (e?.naoRepetir) throw e;
      lastErr = String(e).slice(0, 160);
      await sleep(1500 * (t + 1));
    }
  }
  throw new Error('LLM falhou após ' + tentativas + ' tentativas: ' + lastErr);
}
