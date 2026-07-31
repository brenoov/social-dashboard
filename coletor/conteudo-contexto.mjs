// O que a IA precisa saber para sugerir pauta que preste.
//
// A DIFERENÇA ENTRE ESTE ROBÔ E UM CHATBOT: qualquer modelo escreve "poste um
// bastidor da loja". O que ele NÃO consegue adivinhar é o que funcionou NESTA
// marca, o que já está na fila e como esta marca fala. É isso que este arquivo
// monta — e é por isso que a Fase 4 veio depois da 3: sem métrica coletada, o
// melhor insumo do prompt não existe.
//
// PURO: sem rede e sem banco. O script busca os dados e passa pra cá, o que
// deixa o prompt inteiro testável sem gastar um centavo de API.

import { nomeDoMes, datasDoMes } from '../src/ferramentas/conteudo/datas-comerciais.js';

// Poucos e concretos. Uma lista de 20 pilares faz o modelo escolher pelo nome
// bonito; com 6, ele precisa encaixar a ideia em algo que a marca de fato faz.
export const PILARES = [
  'produto',      // o que se vende
  'bastidor',     // como se faz
  'prova social', // cliente usando, depoimento
  'educativo',    // ensina algo que a marca sabe
  'oferta',       // promoção, condição
  'tendência',    // o que está em alta agora
];

// Teto do que entra no prompt. Passar 200 posts não melhora a sugestão e faz o
// modelo perder o começo do contexto (onde está a instrução).
export const MAX_POSTS_NO_CONTEXTO = 20;

// As datas comerciais e os nomes dos meses vêm de um módulo COMPARTILHADO com a
// tela: o robô manda no briefing, o painel "A marca" mostra o que foi mandado.
// Duas cópias divergiriam em silêncio.
function _txt(v) {
  return (typeof v === 'string' ? v : '').trim();
}

function _normalizar(txt) {
  return _txt(txt)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Ordena do que mais rendeu para o que menos rendeu. Alcance é a régua: é a
// métrica que a Meta entrega de forma mais consistente entre formatos.
export function ordenarPeloQueFuncionou(posts) {
  const lista = Array.isArray(posts) ? [...posts] : [];
  return lista
    .sort((a, b) => {
      const va = a?.metrica?.alcance;
      const vb = b?.metrica?.alcance;
      // Sem medida vai para o fim: não dá para dizer que foi bem nem que foi mal.
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      return vb - va;
    })
    .slice(0, MAX_POSTS_NO_CONTEXTO);
}

// O que está na fila. Publicado NÃO entra: um tema que saiu há um mês pode
// voltar; o que está agendado para quinta, não.
export function temasJaAgendados(pecas) {
  const naFila = new Set(['rascunho', 'em_aprovacao', 'aprovada', 'agendada']);
  return (Array.isArray(pecas) ? pecas : [])
    .filter(p => naFila.has(p?.status))
    .map(p => _txt(p?.titulo))
    .filter(Boolean);
}

// Dice sobre palavras: duas ideias que compartilham a maior parte das palavras
// são a mesma ideia com outras palavras — que é exatamente o que um modelo
// devolve quando você pede "mais 10" pela terceira vez.
const LIMIAR_REPETIDA = 0.75;

export function ehRepetida(titulo, existentes) {
  const alvo = _normalizar(titulo);
  if (!alvo) return true;   // título vazio não vale gravar

  const palavrasAlvo = new Set(alvo.split(' ').filter(p => p.length > 2));
  if (!palavrasAlvo.size) return true;

  for (const outro of Array.isArray(existentes) ? existentes : []) {
    const n = _normalizar(outro);
    if (!n) continue;
    if (n === alvo) return true;

    const palavras = new Set(n.split(' ').filter(p => p.length > 2));
    if (!palavras.size) continue;
    let comuns = 0;
    for (const p of palavrasAlvo) if (palavras.has(p)) comuns++;
    if ((2 * comuns) / (palavrasAlvo.size + palavras.size) >= LIMIAR_REPETIDA) return true;
  }
  return false;
}

function _linhaDoPost(p) {
  const alcance = p?.metrica?.alcance;
  const curtidas = p?.metrica?.curtidas;
  const numeros = [
    alcance != null ? `${alcance} de alcance` : null,
    curtidas != null ? `${curtidas} curtidas` : null,
  ].filter(Boolean).join(', ');
  const titulo = _txt(p?.titulo) || '(sem título)';
  const formato = _txt(p?.formato) || 'post';
  return `- [${formato}] ${titulo}${numeros ? ` — ${numeros}` : ' — sem medição'}`;
}

// Monta o texto que vai no prompt. Em português, porque a marca fala português
// e o modelo escreve melhor no idioma em que recebe o contexto.
export function montarContextoDaMarca(dados = {}) {
  const conta = dados.conta || {};
  const nome = _txt(conta.name) || 'a marca';
  // O `username` vem do banco às vezes com @ e às vezes sem (o cadastro das 7
  // contas tem os dois jeitos). Sem tirar, o briefing saía "Breno Vale
  // (@@obrenovale)" — e o modelo copia o que vê.
  const arroba = _txt(conta.username).replace(/^@+/, '');
  const hoje = _txt(dados.hoje) || '';
  const mes = Number(hoje.slice(5, 7)) || 1;

  const publicados = ordenarPeloQueFuncionou(dados.publicados);
  const medidos = publicados.filter(p => p?.metrica?.alcance != null);
  const melhores = medidos.slice(0, 5);
  // Os piores saem do que SOBROU depois dos melhores, nunca por slice(-3) sobre
  // a lista inteira: com 7 posts medidos, os dois cortes se cruzam no quinto e
  // o mesmo post aparece como "dos melhores" E "dos que renderam menos".
  // (Aconteceu: o briefing saiu assim na primeira versão.)
  const piores = medidos.slice(5).slice(-3).reverse();
  const naFila = temasJaAgendados(dados.agendadas);
  const blocos = (Array.isArray(dados.blocos) ? dados.blocos : []).filter(b => _txt(b?.texto));

  // DUAS FONTES DE CONCORRENTE, E ELAS NÃO SE MISTURAM.
  //
  // `concorrentesDaMarca` é a lista cadastrada à mão para ESTA conta — quem de
  // fato disputa a mesma audiência. `concorrentes` vem do Portal de Notícias,
  // que cobre um nicho só (moda e calçado) e por isso só chega aqui quando a
  // marca é daquele nicho — quem decide é `accounts.conteudo_usa_portal`.
  //
  // Sem essa separação, a primeira pauta real do Breno Vale (marca pessoal)
  // citou "@Isla, @Santa Lolla e @Arezzo&Co" como concorrentes dele. Eram os
  // posts de sapato que o Portal tinha coletado para a Vessel.
  const doNicho = (Array.isArray(dados.concorrentesDaMarca) ? dados.concorrentesDaMarca : [])
    .filter(c => _txt(c?.nome) || _txt(c?.handle));
  const concorrentes = (Array.isArray(dados.concorrentes) ? dados.concorrentes : [])
    .filter(c => _txt(c?.legenda)).slice(0, 8);

  const partes = [];

  partes.push(`## A marca\n${nome}${arroba ? ` (@${arroba})` : ''} no Instagram.`);

  if (blocos.length) {
    partes.push(
      '## Como esta marca fala\nTextos que ela já usa — siga este tom, não invente outro:\n' +
      blocos.map(b => `- ${_txt(b.tipo) || 'texto'}: ${_txt(b.texto)}`).join('\n'),
    );
  }

  if (melhores.length) {
    partes.push(
      '## O que funcionou aqui\nOs posts de melhor alcance desta marca. Este é o dado mais ' +
      'importante deste briefing: é o que você não teria como adivinhar.\n' +
      melhores.map(_linhaDoPost).join('\n'),
    );
  }
  if (piores.length) {
    partes.push('## O que rendeu menos\n' + piores.map(_linhaDoPost).join('\n'));
  }
  if (!melhores.length && !piores.length) {
    partes.push(
      '## Histórico\nEsta marca ainda não tem posts medidos no sistema. Sugira pautas de ' +
      'começo: apresentação, bastidor, produto principal.',
    );
  }

  if (naFila.length) {
    partes.push(
      '## Já está na agenda — NÃO repita estes temas\n' + naFila.map(t => `- ${t}`).join('\n'),
    );
  }

  if (doNicho.length) {
    partes.push(
      '## Contra quem esta marca disputa\n' +
      'Quem briga pela mesma audiência. Serve para você entender o nicho e o nível da ' +
      'conversa — NÃO para citar.\n' +
      doNicho.map(c => {
        const quem = _txt(c.nome) || `@${_txt(c.handle)}`;
        const arroba = _txt(c.handle) && _txt(c.nome) ? ` (@${_txt(c.handle)})` : '';
        const obs = _txt(c.observacao);
        return `- ${quem}${arroba}${obs ? ` — ${obs}` : ''}`;
      }).join('\n'),
    );
  }

  if (concorrentes.length) {
    partes.push(
      '## O que o mercado está publicando\nPosts recentes de marcas do mesmo nicho. Sirva-se de ' +
      'inspiração, mas NÃO copie: a ideia tem que caber nesta marca.\n' +
      concorrentes.map(c => `- @${_txt(c.handle) || 'concorrente'}: ${_txt(c.legenda).slice(0, 140)}`).join('\n'),
    );
  }

  // A REGRA DA DISCRIÇÃO, sempre presente — inclusive quando não há concorrente
  // cadastrado, porque a marca pode ser citada de memória pelo modelo.
  //
  // Falar o nome do concorrente num post orgânico entrega audiência de graça,
  // convida comparação que a marca não escolheu e, dependendo do tom, vira
  // exposição indevida. O concorrente serve para calibrar a ideia, não para
  // virar assunto dela.
  partes.push(
    '## Regra sobre concorrentes\n' +
    'NUNCA escreva o nome nem o @ de um concorrente na legenda, no gancho, na narração ou em ' +
    'qualquer texto que vá ao ar. Nem para elogiar, nem para comparar, nem para alfinetar. ' +
    'Use o que sabe deles apenas para calibrar o assunto e o tom. Se a ideia só funciona ' +
    'citando alguém, ela não presta — troque a ideia.',
  );

  partes.push(
    `## Quando é\nHoje é ${hoje}, mês de ${nomeDoMes(mes)}. ` +
    `Datas que importam: ${datasDoMes(mes)}.`,
  );

  return partes.join('\n\n');
}

// ---------- O PEDIDO À IA ----------
// Esquema e instrucoes moram aqui, junto do briefing, e nao no script que
// chama a API: assim da para conferir o pedido inteiro com `node --test`,
// sem gastar um centavo. Foi o que permitiu comparar Sonnet x Opus usando
// exatamente o que roda em producao, em vez de uma copia que envelhece.
export const ESQUEMA = {
  type: 'object',
  properties: {
    ideias: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          titulo: { type: 'string', description: 'Curto e concreto, do jeito que a pessoa anotaria.' },
          formato: { type: 'string', enum: ['feed', 'carrossel', 'reels', 'stories'] },
          pilar: { type: 'string', enum: PILARES },
          porque_formato: {
            type: 'string',
            description: 'Uma frase: por que ESTE formato serve melhor a esta ideia que os outros três.',
          },
          gancho: {
            type: 'string',
            description:
              'OS 3 PRIMEIROS SEGUNDOS — exatamente o que se vê e se ouve na abertura. É o que '
              + 'decide se a pessoa fica. Frase falada de verdade, não descrição do que seria bom.',
          },
          roteiro: {
            type: 'array',
            description:
              'O passo a passo, SEMPRE preenchido, com significado por formato: reels e stories = '
              + 'um item por TAKE; carrossel = um item por CARD; feed = um único item, a imagem. '
              + 'Tem que ser gravável hoje, por uma pessoa, com celular.',
            items: {
              type: 'object',
              properties: {
                cena: { type: 'integer', description: 'A ordem: 1, 2, 3…' },
                imagem: {
                  type: 'string',
                  description:
                    'O QUE APARECE NA TELA: enquadramento, ação, onde é. Escreva para quem vai '
                    + 'segurar o celular. Ex.: "close na mão abrindo a caixa, luz da janela à esquerda".',
                },
                narracao: {
                  type: 'string',
                  description:
                    'O QUE SE FALA neste take, palavra por palavra, pronto para ler. Vazio se '
                    + 'o take não tem fala.',
                },
                texto_na_tela: {
                  type: 'string',
                  description: 'O que aparece ESCRITO na tela neste momento. Curto. Vazio se não houver.',
                },
                duracao_s: { type: 'integer', description: 'Segundos deste take (só em vídeo).' },
              },
              required: ['cena', 'imagem'],
            },
          },
          producao: {
            type: 'string',
            description:
              'O que precisa estar em mãos ANTES de gravar: lugar, objetos, roupa, quem aparece. '
              + 'Uma linha, concreta.',
          },
          legenda_sugerida: { type: 'string' },
          cta: { type: 'string', description: 'A chamada do fim: o que a pessoa faz agora.' },
          hashtags_sugeridas: { type: 'string' },
          por_que_agora: {
            type: 'string',
            description: 'Justifique com um DADO do briefing: uma data, um post que foi bem, o nicho.',
          },
        },
        required: ['titulo', 'formato', 'pilar', 'gancho', 'roteiro', 'por_que_agora'],
      },
    },
  },
  required: ['ideias'],
};

export const SISTEMA = `Você é o social media desta marca — não um consultor de fora.

Você não entrega sugestões: entrega ROTEIRO PRONTO PARA GRAVAR. Quem receber isto
tem que conseguir pegar o celular e fazer, sem precisar decidir mais nada.

Regras:
1. Toda ideia tem que ser gravável ou fotografável por UMA pessoa, com celular, esta semana. Nada que dependa de produção, ator ou orçamento.
2. "gancho" são OS 3 PRIMEIROS SEGUNDOS, escritos como se fala. Não descreva a abertura — escreva a abertura.
3. "roteiro" é sempre preenchido. Em "imagem" descreva o enquadramento para quem segura o celular; em "narracao" escreva a fala palavra por palavra, pronta para ler em voz alta. Nada de "falar sobre os benefícios" — escreva a frase.
4. "por_que_agora" precisa citar um dado concreto do briefing. Se você não consegue justificar com o que está ali, a ideia não presta — troque.
5. Varie os pilares e os formatos. Seis ideias de "produto" seguidas é uma ideia só repetida seis vezes.
6. Escreva como a marca escreve, no tom que os textos dela mostram.
7. Não repita nada que já esteja na agenda.
8. NUNCA cite o nome ou o @ de um concorrente em texto que vá ao ar. Eles servem para calibrar a ideia, não para virar assunto dela.
9. Português do Brasil, direto, sem jargão de marketing.`;
