// sugerir-publico-ia — a LEITURA da IA em cima dos números da conta.
//
// PEDIDO DO DONO (2026-08-03): "na parte do público quero que use IA para
// sugerir, principalmente em relação a interesses, localização e idade".
//
// O QUE ESTA FUNÇÃO NÃO FAZ: inventar número. Ela NÃO chama a Meta e NÃO calcula
// custo — a evidência chega pronta, calculada em `sugerir-publico.js`, que é
// puro e testado com os números reais da conta. Aqui a IA faz o que só ela faz:
// olhar o conjunto, dizer o que fazer e o porquê, e escolher entre os interesses
// que a conta já usou.
//
// É a régua que o dono deu: "senão conta de porcentagem eu mesmo fazia". A conta
// é do módulo puro; o julgamento é daqui.
//
// SEGURANÇA:
//  - verify_jwt + checagem da MESMA permissão do resto da Gestão de Tráfego
//    (admin OU 'meta.gestor'), porque isto gasta dinheiro da conta de IA;
//  - a chave vive em `segredos_de_cron` (RLS ligada, ZERO políticas: só o
//    service role entra) e é lida aqui. Ela NUNCA vai para o navegador.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// O modelo dos robôs de tráfego. Julgamento sobre dinheiro é onde vale o modelo
// bom — e a chamada é uma por clique, não uma por campanha.
const MODELO = 'claude-opus-4-5';
const MAX_TOKENS = 1200;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const auth = req.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) return json({ error: 'sem_credencial' }, 401);

  // QUEM ESTÁ PEDINDO. O cliente com o JWT da pessoa, para o RLS valer.
  const sbUsuario = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: auth } },
  });
  const { data: { user } } = await sbUsuario.auth.getUser();
  if (!user) return json({ error: 'nao_autenticado' }, 401);

  // A MESMA PERMISSÃO DO RESTO DA FERRAMENTA. Isto gasta dinheiro da conta de
  // IA: quem não pode mexer em tráfego não pode gastar aqui.
  const sbServico = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const { data: perfil } = await sbServico
    .from('profiles').select('role, is_superadmin, features').eq('id', user.id).single();
  const pode = !!perfil && (perfil.role === 'admin' || perfil.is_superadmin
    || (Array.isArray(perfil.features) && perfil.features.includes('meta.gestor')));
  if (!pode) return json({ error: 'sem_permissao' }, 403);

  let corpo: any = {};
  try { corpo = await req.json(); } catch { return json({ error: 'corpo_invalido' }, 400); }
  const evidencia = corpo && corpo.evidencia;
  if (!evidencia || typeof evidencia !== 'object') return json({ error: 'sem_evidencia' }, 400);

  const { data: seg } = await sbServico
    .from('segredos_de_cron').select('segredo').eq('nome', 'anthropic_api_key_trafego').single();
  const chave = seg?.segredo;
  if (!chave) {
    // FALHA EXPLICADA, e não genérica: quem lê isto precisa saber que o conserto
    // é rodar o robô "Guardar a chave da IA", e não mexer no código.
    return json({
      error: 'chave_nao_configurada',
      comoResolver: 'Rode uma vez o robô "Guardar a chave da IA onde o servidor alcança" nas Actions do repositório.',
    }, 503);
  }

  const prompt = montarPrompt(evidencia, corpo.marca, corpo.objetivo);

  let r: Response;
  try {
    r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': chave, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: MODELO,
        max_tokens: MAX_TOKENS,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
  } catch (e) {
    return json({ error: 'anthropic_inacessivel', detalhe: String(e) }, 502);
  }
  const d = await r.json().catch(() => ({}));
  if (!r.ok) {
    // A MENSAGEM INTEIRA da Anthropic vai junto. Truncar erro já custou três
    // investigações neste projeto.
    return json({ error: 'anthropic_recusou', status: r.status, detalhe: d?.error?.message || JSON.stringify(d).slice(0, 500) }, 502);
  }

  const texto = (d?.content || []).map((c: any) => c?.text || '').join('').trim();
  const lido = extrairJson(texto);
  if (!lido) return json({ error: 'resposta_ilegivel', bruto: texto.slice(0, 800) }, 502);

  return json({
    ok: true,
    leitura: String(lido.leitura || '').slice(0, 1200),
    // A IA escolhe ENTRE o que já existe. Ela não inventa id de interesse: id
    // inventado a Meta recusa, e o erro apareceria só na hora de criar.
    interesses: filtrarInteresses(lido.interesses, evidencia),
    cuidado: String(lido.cuidado || '').slice(0, 400),
    // Para o painel de custo saber o que foi gasto aqui.
    uso: d?.usage || null,
  });
});

function montarPrompt(ev: any, marca?: string, objetivo?: string) {
  return [
    'Você ajuda quem cuida de anúncios no Meta Ads de um negócio pequeno, e escreve em português do Brasil, direto, sem jargão.',
    marca ? `A marca é: ${marca}.` : '',
    objetivo ? `O tipo de campanha que está sendo criada: ${objetivo}.` : '',
    '',
    'Estes números são REAIS, medidos nos últimos 90 dias desta conta de anúncios. Não invente outros, não recalcule, não estime:',
    '```json',
    JSON.stringify(ev).slice(0, 6000),
    '```',
    '',
    'Sua tarefa:',
    '1. Escreva uma LEITURA de no máximo 4 frases dizendo o que estes números indicam sobre para quem anunciar — idade, onde e interesses. Cite os números que sustentam cada afirmação.',
    // ESCOLHER É DEIXAR DE FORA. Na primeira versão a IA escreveu que dois dos
    // interesses "parecem desconectados do produto" — e devolveu os quatro
    // mesmo assim. O botão "somar os que a IA escolheu" somaria justamente os
    // que ela acabara de criticar. Visto no primeiro teste ao vivo (03/08/2026).
    '2. Escolha os interesses que valem a pena manter, ENTRE OS QUE JÁ APARECEM na evidência. Não invente interesses novos nem ids.',
    '   ESCOLHER É DEIXAR DE FORA: devolva SÓ os que você recomenda de verdade. Se um não combina com a marca, não o inclua na lista — mesmo que ele venha dos conjuntos baratos. Explique na leitura por que o deixou de fora.',
    '   Se nenhum valer a pena, devolva a lista vazia.',
    '3. Escreva um CUIDADO de uma frase: o principal risco de seguir esta leitura (por exemplo, público pequeno demais, ou dado concentrado em poucos conjuntos).',
    '',
    'Se os números não sustentarem uma conclusão, diga isso na leitura em vez de inventar uma.',
    '',
    'Responda SÓ com JSON, neste formato:',
    '{"leitura":"...","interesses":[{"id":"...","nome":"..."}],"cuidado":"..."}',
  ].filter(Boolean).join('\n');
}

// A IA pode devolver o JSON cercado de texto. Pegar o primeiro bloco `{...}` é
// mais robusto que exigir resposta limpa — e mais barato que uma segunda volta.
function extrairJson(texto: string) {
  try { return JSON.parse(texto); } catch { /* segue */ }
  const i = texto.indexOf('{');
  const f = texto.lastIndexOf('}');
  if (i < 0 || f <= i) return null;
  try { return JSON.parse(texto.slice(i, f + 1)); } catch { return null; }
}

// SÓ OS QUE EXISTEM NA EVIDÊNCIA. A IA escolhe; ela não cria. Um id inventado
// seria recusado pela Meta lá na frente, e o erro pareceria defeito da tela.
function filtrarInteresses(escolhidos: any, ev: any) {
  const validos = new Map<string, string>();
  for (const i of (Array.isArray(ev?.interesses) ? ev.interesses : [])) {
    if (i && i.key != null) validos.set(String(i.key), String(i.nome || i.key));
  }
  const saida: Array<{ id: string; nome: string }> = [];
  for (const e of (Array.isArray(escolhidos) ? escolhidos : [])) {
    const id = String((e && e.id) || '');
    if (validos.has(id) && !saida.some((x) => x.id === id)) saida.push({ id, nome: validos.get(id)! });
  }
  return saida;
}
