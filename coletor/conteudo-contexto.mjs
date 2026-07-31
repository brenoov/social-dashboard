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

const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

// Datas que mexem com varejo. Não é calendário completo de propósito: é o que
// faz diferença para quem vende.
const DATAS_DO_MES = {
  1: 'volta às aulas, liquidação de verão',
  2: 'Carnaval',
  3: 'Dia do Consumidor (15), início do outono',
  4: 'Páscoa',
  5: 'Dia das Mães (2º domingo) — a data mais forte do varejo depois do Natal',
  6: 'Dia dos Namorados (12), festas juninas',
  7: 'férias escolares, liquidação de inverno',
  8: 'Dia dos Pais (2º domingo)',
  9: 'Dia do Cliente (15), início da primavera',
  10: 'Dia das Crianças (12)',
  11: 'Black Friday (última sexta)',
  12: 'Natal, retrospectiva do ano',
};

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
  const arroba = _txt(conta.username);
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

  if (concorrentes.length) {
    partes.push(
      '## O que o mercado está publicando\nPosts recentes de concorrentes. Sirva-se de inspiração, ' +
      'mas NÃO copie: a ideia tem que caber nesta marca.\n' +
      concorrentes.map(c => `- @${_txt(c.handle) || 'concorrente'}: ${_txt(c.legenda).slice(0, 140)}`).join('\n'),
    );
  }

  partes.push(
    `## Quando é\nHoje é ${hoje}, mês de ${MESES[mes - 1]}. ` +
    `Datas que importam: ${DATAS_DO_MES[mes] || 'nada marcante no calendário comercial'}.`,
  );

  return partes.join('\n\n');
}
