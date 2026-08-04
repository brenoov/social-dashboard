// OS CAMPOS DO ANÚNCIO que faltavam: título, descrição, botão e — o pedido que
// gerou este arquivo — a SAUDAÇÃO do WhatsApp.
//
// PEDIDO DO DONO (03/08/2026): "quando for objetivo de whatsapp eu poder
// escolher a pré mensagem de saudação, pode editar mais campos relacionados ao
// anúncio".
//
// TUDO AQUI FOI MEDIDO nos 557 criativos que a conta Vessel já roda — nenhum
// campo veio da documentação. O que a medição mostrou:
//
//   botão     WHATSAPP_MESSAGE 238 · MESSAGE_PAGE 236 · VIEW_INSTAGRAM_PROFILE 54
//             LEARN_MORE 18 · SIGN_UP 5 · SHOP_NOW 3 · CONTACT_US 3
//   título    118 criativos (link_data.name / video_data.title)
//   descrição  16 criativos (link_data.description)
//   saudação  126 criativos (page_welcome_message)
//
// Ou seja: metade dos anúncios de WhatsApp da conta JÁ tem saudação, e a tela
// não deixava mexer nela. Era o buraco maior dos quatro.

// ── A SAUDAÇÃO DO WHATSAPP ──────────────────────────────────────────────────
//
// Ela NÃO é um texto solto. A Meta guarda em `page_welcome_message` um JSON
// inteiro, como STRING, dentro de `link_data`/`video_data`. Copiei a forma de um
// anúncio real em vez de inventar: um objeto `VISUAL_EDITOR` versão 2 com TRÊS
// formatos irmãos (texto, imagem, vídeo) que precisam existir juntos mesmo
// quando só o de texto é usado.
//
// São DOIS textos, e confundi-los é o erro fácil:
//   • `saudacao`  — o que a LOJA diz quando a conversa abre.
//   • `resposta`  — o que já vem DIGITADO no WhatsApp do cliente, pronto para
//                   ele só apertar enviar. É o que faz a conversa começar.
//
// Exemplos reais da conta, para deixar claro qual é qual:
//   saudacao: "Oi! Como podemos ajudar?"
//   resposta: "Olá! Posso ter mais informações sobre isso?"
export const SAUDACAO_PADRAO = 'Oi! Como podemos ajudar?';
export const RESPOSTA_PADRAO = 'Gostaria de obter mais informações';

function limpo(v) {
  return typeof v === 'string' ? v.trim() : '';
}

// Monta o JSON da saudação. Devolve null quando não há o que salvar — e null é
// resposta boa: sem o campo, a Meta usa a saudação padrão da página, que é o
// comportamento dos outros 112 anúncios de WhatsApp da conta.
export function montarSaudacao(entrada) {
  // `= {}` no destructuring NÃO cobre `null` — só `undefined`. E `null` é
  // justamente o que chega quando o rascunho reabre sem saudação salva.
  // Pego por teste (03/08/2026): estourava com TypeError.
  const { saudacao, resposta } = entrada || {};
  const s = limpo(saudacao);
  const r = limpo(resposta) || RESPOSTA_PADRAO;
  if (!s) return null;

  // Os três formatos repetem o mesmo texto de propósito: é assim que os
  // anúncios reais estão gravados. O `text_format` usa `autofill_message`
  // (a frase já digitada); os outros dois usam `quick_replies` (a frase vira
  // botão). Mantive os dois jeitos porque foi o que a conta mostrou.
  const respostaRapida = [{ title: r, content_type: 'text', response_type: null }];
  return JSON.stringify({
    type: 'VISUAL_EDITOR',
    version: 2,
    landing_screen_type: 'welcome_message',
    media_type: 'text',
    text_format: {
      customer_action_type: 'autofill_message',
      message: { autofill_message: { content: r }, text: s },
    },
    image_format: {
      customer_action_type: 'quick_replies',
      message: {
        attachment: { type: 'template', payload: { template_type: 'generic', elements: [{ title: '', buttons: [], image_hash: '' }] } },
        quick_replies: respostaRapida,
        text: s,
      },
    },
    video_format: {
      customer_action_type: 'quick_replies',
      message: {
        attachment: { type: 'video', payload: { attachment_id: '' } },
        quick_replies: respostaRapida,
        text: s,
      },
    },
    user_edit: true,
    surface: 'visual_editor_new',
  });
}

// O caminho de volta: de JSON gravado para os dois textos. Serve para mostrar na
// tela a saudação de uma campanha que já existe, e para o rascunho reabrir
// mostrando o que a pessoa tinha escrito.
export function lerSaudacao(bruto) {
  if (!bruto) return null;
  let o = bruto;
  if (typeof bruto === 'string') {
    try { o = JSON.parse(bruto); } catch { return null; }
  }
  if (!o || typeof o !== 'object') return null;
  const tf = o.text_format || {};
  const m = tf.message || {};
  const saudacao = limpo(m.text);
  // A resposta pode estar em `autofill_message` OU em `quick_replies` — os dois
  // aparecem nos anúncios medidos, e ler só um deixaria metade em branco.
  const rapidas = ((o.image_format || {}).message || {}).quick_replies || [];
  const resposta = limpo((m.autofill_message || {}).content) || limpo((rapidas[0] || {}).title);
  if (!saudacao && !resposta) return null;
  return { saudacao, resposta };
}

// ── O BOTÃO ─────────────────────────────────────────────────────────────────
//
// Lista fixa e em português, com a contagem do que a conta usa ao lado. Fixa
// porque uma conta nova não teria nenhum — e a lista precisa existir antes do
// primeiro anúncio.
//
// `so` amarra o botão ao destino: oferecer "Ver perfil" numa campanha de
// WhatsApp é oferecer um erro da Meta com dez minutos de atraso.
export const BOTOES = [
  { id: 'WHATSAPP_MESSAGE',      rotulo: 'Enviar mensagem no WhatsApp', so: 'whatsapp', usos: 238 },
  { id: 'MESSAGE_PAGE',          rotulo: 'Enviar mensagem',             so: 'mensagem', usos: 236 },
  { id: 'INSTAGRAM_MESSAGE',     rotulo: 'Chamar no Direct',            so: 'direct',   usos: 0 },
  { id: 'VIEW_INSTAGRAM_PROFILE',rotulo: 'Ver o perfil',                so: 'perfil',   usos: 54 },
  { id: 'LEARN_MORE',            rotulo: 'Saiba mais',                  so: 'link',     usos: 18 },
  { id: 'SHOP_NOW',              rotulo: 'Comprar agora',               so: 'link',     usos: 3 },
  { id: 'SIGN_UP',               rotulo: 'Cadastre-se',                 so: 'link',     usos: 5 },
  { id: 'CONTACT_US',            rotulo: 'Fale conosco',                so: 'link',     usos: 3 },
  { id: 'BOOK_TRAVEL',           rotulo: 'Reservar',                    so: 'link',     usos: 0 },
];

// Que botões cabem neste tipo de campanha, JÁ NA ORDEM certa. A ordem importa
// porque o primeiro da lista é o padrão de quem não escolheu — e filtrar a lista
// grande devolvia "Enviar mensagem" como padrão do Direct, só porque ele vem
// antes na lista geral. Pego por teste (03/08/2026), antes de virar um anúncio
// de Direct com o botão errado.
const POR_DESTINO = {
  WHATSAPP: ['WHATSAPP_MESSAGE'],
  INSTAGRAM_DIRECT: ['INSTAGRAM_MESSAGE', 'MESSAGE_PAGE'],
  MESSENGER: ['MESSAGE_PAGE', 'WHATSAPP_MESSAGE', 'INSTAGRAM_MESSAGE'],
  MESSAGING_APPS: ['MESSAGE_PAGE', 'WHATSAPP_MESSAGE', 'INSTAGRAM_MESSAGE'],
  INSTAGRAM_PROFILE: ['VIEW_INSTAGRAM_PROFILE'],
};
const DE_LINK = ['LEARN_MORE', 'SHOP_NOW', 'SIGN_UP', 'CONTACT_US', 'BOOK_TRAVEL'];

export function botoesDe(sub) {
  const dt = String((sub || {}).destination_type || '').toUpperCase();
  const ids = dt.includes('WHATSAPP') ? POR_DESTINO.WHATSAPP : (POR_DESTINO[dt] || DE_LINK);
  return ids.map((id) => BOTOES.find((b) => b.id === id)).filter(Boolean);
}

// O botão que vale: o escolhido, se ele couber neste destino; senão o primeiro
// da lista. Nunca devolve vazio — criativo sem botão a Meta recusa.
export function botaoEscolhido(sub, escolhido) {
  const lista = botoesDe(sub);
  const achou = lista.find((b) => b.id === escolhido);
  return (achou || lista[0] || BOTOES[0]).id;
}

// ── TÍTULO E DESCRIÇÃO ──────────────────────────────────────────────────────
//
// Os limites são da Meta, e são AVISO e não trava: ela aceita mais e corta na
// hora de mostrar. Avisar antes é melhor que a pessoa descobrir depois de
// publicar que o título sumiu no meio.
export const LIMITE_TITULO = 40;
export const LIMITE_DESCRICAO = 30;

export function avisoDeTamanho(campo, valor) {
  const t = limpo(valor);
  const limite = campo === 'titulo' ? LIMITE_TITULO : LIMITE_DESCRICAO;
  if (!t || t.length <= limite) return '';
  return `${t.length} caracteres — o Facebook costuma cortar depois de ${limite}.`;
}

// Os campos extras prontos para entrar no criativo. Fora daqui só entra o que
// foi preenchido: mandar `name: ''` faz o anúncio nascer com um título vazio
// ocupando espaço, em vez de nascer sem título.
export function extrasDoCriativo({ titulo, descricao, video } = {}) {
  const t = limpo(titulo);
  const d = limpo(descricao);
  const out = {};
  // `name` na imagem e `title` no vídeo — nomes diferentes para a MESMA coisa,
  // medido nos dois formatos. Trocar um pelo outro faz o título sumir sem erro.
  if (t) out[video ? 'title' : 'name'] = t;
  if (d) out.description = d;
  return out;
}
