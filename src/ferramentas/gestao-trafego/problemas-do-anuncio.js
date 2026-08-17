// O QUE A META RECLAMA DOS ANÚNCIOS — traduzido, agrupado e com o que fazer.
//
// PEDIDO DO DONO (12/08/2026): "os anúncios estão sendo barrados... a mensagem é
// políticas violadas".
//
// MEDIDO NO GRAPH no mesmo dia, e a medição contradiz a premissa: dos 517
// anúncios das 7 contas, NENHUM está `DISAPPROVED`, e as 7 contas estão ativas
// com `disable_reason: 0` — não há recusa por política nem restrição de conta
// visível na API agora. O que EXISTE são 13 problemas reais, todos operacionais,
// e nenhum deles aparecia em lugar nenhum da tela:
//
//   5 conjuntos da Raíssa PAUSADOS PELA META (público personalizado sumiu)
//   3 anúncios da Mantova que não rodam no Instagram (vídeo com menos de 500px)
//   2 anúncios que simplesmente não estão sendo veiculados
//   1 com Página divergente do objeto promovido
//   1 com cartão de imagem sem link de CTA
//
// `issues_info` é o MESMO campo onde uma recusa por política apareceria. Então
// mostrar isto resolve o que ele pediu quando a recusa voltar, e enquanto isso
// já mostra dinheiro parado que hoje ninguém vê.
//
// PURO: sem tela, sem rede.

// HARD_ERROR impede de rodar; SOFT_ERROR degrada (o anúncio roda, mas não em
// todo lugar). A diferença muda o que a pessoa faz agora, então não some.
const GRAVE = 'HARD_ERROR';

// O QUE FAZER, por código de erro. A Meta manda um texto bom, mas ele descreve
// o problema e não a saída — e "o que eu faço agora" é a pergunta real.
// Só entra código que apareceu de VERDADE na conta (medido em 12/08/2026);
// código novo cai no caso genérico em vez de ganhar conselho inventado.
const O_QUE_FAZER = {
  1359208: 'Abra o conjunto na Meta e tire o público personalizado que sumiu. Enquanto ele estiver lá, a Meta não deixa reativar.',
  2643046: 'Troque o vídeo por um com mais de 500 pixels de largura. Do jeito que está, ele não roda no Instagram.',
  1885029: 'A Página do anúncio é diferente da Página do post que ele promove. Escolha a mesma nos dois.',
  1443128: 'Falta o link do botão no cartão de imagem. Abra o anúncio e preencha o destino.',
  4469003: 'A Meta não está entregando este anúncio. Costuma ser público pequeno demais ou concorrência interna entre conjuntos — vale duplicar num conjunto com configuração diferente.',
};

const texto = (v) => (typeof v === 'string' ? v.trim() : '');

// QUAIS ANÚNCIOS TÊM O QUE MOSTRAR — e a resposta NÃO passa por estar ativo.
//
// O DEFEITO REAL (17/08/2026): este módulo nasceu em 12/08 para mostrar 13
// problemas medidos naquele dia, e nunca mostrou nenhum. A lista que o
// alimentava era filtrada por `effective_status === 'ACTIVE'` — filtro correto
// para o outro uso da mesma lista (criativos sem tração, que só fazem sentido
// rodando) e fatalmente errado para este.
//
// Medido no Graph em 17/08, nas 5 contas: dos 13 anúncios com `issues_info`,
// **zero** estão ACTIVE — 10 são WITH_ISSUES e 3 PAUSED. O filtro não escondia
// parte dos problemas: escondia todos, sempre. E faz sentido que seja assim —
// um problema GRAVE tira o anúncio do ar por definição, então exigir que ele
// esteja no ar para aparecer é pedir a contradição.
//
// A seleção mora aqui, e não dentro do `.vue`, porque lá ela não tem como
// quebrar teste nenhum: `node --test` não compila arquivo de tela.
export function anunciosComProblema(anuncios, contexto) {
  return (anuncios || [])
    .filter((a) => a && Array.isArray(a.issues_info) && a.issues_info.length)
    .map((a) => ({
      id: a.id,
      nome: a.name || a.id,
      issues_info: a.issues_info,
      ...(contexto || {}),
    }));
}

// Normaliza UM problema como a Meta manda.
export function lerProblema(bruto, contexto) {
  const b = bruto || {};
  const codigo = Number(b.error_code) || 0;
  return {
    codigo,
    // `error_summary` é o título curto; `error_message` repete o título e emenda
    // a explicação. Mostrar os dois inteiros escreve a mesma frase duas vezes.
    titulo: texto(b.error_summary) || 'Problema no anúncio',
    detalhe: tirarOTituloRepetido(texto(b.error_message), texto(b.error_summary)),
    grave: b.error_type === GRAVE,
    // AD ou AD_SET: muda ONDE a pessoa vai clicar pra resolver.
    nivel: b.level === 'AD_SET' ? 'conjunto' : 'anuncio',
    oQueFazer: O_QUE_FAZER[codigo] || '',
    ...(contexto || {}),
  };
}

// "Ativos ausentes: Ativos ausentes: o cartão precisa..." → tira a repetição.
function tirarOTituloRepetido(mensagem, titulo) {
  if (!mensagem) return '';
  if (!titulo) return mensagem;
  const prefixo = titulo + ':';
  return mensagem.startsWith(prefixo) ? mensagem.slice(prefixo.length).trim() : mensagem;
}

// AGRUPA POR PROBLEMA, não por anúncio.
//
// Medido: os 5 conjuntos da Raíssa têm o MESMO erro 1359208, e os 3 vídeos da
// Mantova o MESMO 2643046. Listar anúncio a anúncio daria 13 linhas dizendo
// cinco coisas — e a decisão é uma só por problema, não uma por anúncio. É a
// mesma razão pela qual os criativos sem tração já aparecem agrupados na fila.
export function agruparProblemas(anuncios) {
  const porCodigo = new Map();
  for (const a of anuncios || []) {
    if (!a) continue;
    for (const bruto of (a.issues_info || [])) {
      const p = lerProblema(bruto, { conta: a.conta_nome || '', campanha: a.campanha_nome || '' });
      const chave = `${p.codigo}::${p.nivel}`;
      if (!porCodigo.has(chave)) porCodigo.set(chave, { ...p, quantos: 0, onde: [] });
      const g = porCodigo.get(chave);
      g.quantos += 1;
      const rotulo = a.nome || a.id;
      if (rotulo && !g.onde.includes(rotulo)) g.onde.push(rotulo);
    }
  }
  // Grave primeiro, e dentro disso o que afeta mais anúncios.
  return [...porCodigo.values()].sort((x, y) => (Number(y.grave) - Number(x.grave)) || (y.quantos - x.quantos));
}

// A FRASE DO TOPO. Diz o tamanho do problema sem inflar: separa o que IMPEDE de
// rodar do que só atrapalha.
export function fraseDosProblemas(grupos) {
  const g = grupos || [];
  if (!g.length) return '';
  const graves = g.filter((x) => x.grave).reduce((s, x) => s + x.quantos, 0);
  const leves = g.reduce((s, x) => s + x.quantos, 0) - graves;
  const partes = [];
  if (graves) partes.push(`${graves} ${graves > 1 ? 'estão impedidos' : 'está impedido'} de rodar`);
  if (leves) partes.push(`${leves} ${leves > 1 ? 'rodam' : 'roda'} com limitação`);
  return `A Meta está reclamando de ${g.reduce((s, x) => s + x.quantos, 0)} item(ns): ${partes.join(' e ')}.`;
}
