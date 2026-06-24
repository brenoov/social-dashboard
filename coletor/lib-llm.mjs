// Motor LLM compartilhado do agente: chamada Anthropic com SAÍDA ESTRUTURADA (tool-use forçado) + retry.
// Modelos: SONNET (volume/barato) e OPUS (estratégico). Híbrido escolhido pelo dono.
export const SONNET = process.env.MODEL_SONNET || 'claude-sonnet-4-6';
export const OPUS = process.env.MODEL_OPUS || 'claude-opus-4-8';
const API = 'https://api.anthropic.com/v1/messages';
const KEY = process.env.ANTHROPIC_API_KEY;
const H = { 'x-api-key': KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' };
const sleep = ms => new Promise(r => setTimeout(r, ms));

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
      return tu.input;
    } catch (e) { lastErr = String(e).slice(0, 160); await sleep(1500 * (t + 1)); }
  }
  throw new Error('LLM falhou após ' + tentativas + ' tentativas: ' + lastErr);
}
