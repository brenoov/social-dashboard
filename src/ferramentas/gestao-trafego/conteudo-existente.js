// O QUE JÁ ESTÁ PUBLICADO — para escolher o que impulsionar.
//
// PEDIDO DO DONO (2026-08-03): "o buscador de conteúdos existentes precisa ser
// melhor, mais detalhado, mostrar todo o histórico, mostrar os stories
// disponíveis para anunciar também".
//
// O QUE A META DÁ DE GRAÇA na própria lista (medido em 03/08/2026): legenda,
// data, tipo (Reels/Feed/Carrossel), miniatura, CURTIDAS e COMENTÁRIOS. Não
// precisa de uma chamada por publicação — o que já vem responde "qual delas o
// público gostou mais", que é a pergunta de quem escolhe o que impulsionar.
//
// STORIES SÃO OUTRA COISA, e a tela precisa dizer isso: eles vivem 24 horas e
// somem. Medido duas vezes no mesmo dia: zero stories ativos. Uma lista vazia
// aqui é o normal, não um defeito — e sem essa frase parece defeito.
//
// PURO: sem rede, sem tela.

const lista = (v) => (Array.isArray(v) ? v : []);
const texto = (v) => (typeof v === 'string' ? v.trim() : '');
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

// O TIPO, em português. `media_product_type` separa Reels de post de feed, e a
// distinção importa: "visualização de vídeo" só faz sentido em vídeo, e Reels é
// o que mais roda nesta conta.
export function rotuloDoTipo(m) {
  const produto = String((m && m.media_product_type) || '').toUpperCase();
  const tipo = String((m && m.media_type) || '').toUpperCase();
  if (produto === 'STORY') return 'Story';
  if (produto === 'REELS') return 'Reels';
  if (tipo === 'CAROUSEL_ALBUM') return 'Carrossel';
  if (tipo === 'VIDEO') return 'Vídeo';
  return 'Foto';
}

export const ehVideo = (m) => {
  const t = String((m && m.media_type) || '').toUpperCase();
  return t === 'VIDEO';
};

export function lerPublicacoes(resposta) {
  return lista(resposta)
    .filter((m) => m && m.id)
    .map((m) => ({
      id: String(m.id),
      legenda: texto(m.caption),
      tipo: rotuloDoTipo(m),
      video: ehVideo(m),
      // VÍDEO não tem `media_url` que sirva de capa (é o arquivo, pesado e às
      // vezes bloqueado); quem serve é `thumbnail_url`. Foto não tem thumbnail,
      // e aí o `media_url` é a própria imagem.
      miniatura: texto(m.thumbnail_url) || (ehVideo(m) ? '' : texto(m.media_url)),
      data: texto(m.timestamp),
      link: texto(m.permalink),
      curtidas: num(m.like_count),
      comentarios: num(m.comments_count),
      // Uma medida só para ordenar. Comentário vale mais que curtida porque
      // custa mais para quem faz — é a mesma lógica da régua do dono.
      engajamento: num(m.like_count) + num(m.comments_count) * 3,
    }));
}

// A BUSCA por texto da legenda. Sem acento e sem caixa: quem procura "sao
// paulo" tem que achar "São Paulo".
const simplificar = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function filtrar(publicacoes, termo, tipo) {
  const t = simplificar(termo);
  return lista(publicacoes).filter((p) => {
    if (tipo && tipo !== 'todos' && p.tipo !== tipo) return false;
    if (!t) return true;
    return simplificar(p.legenda).includes(t) || simplificar(p.tipo).includes(t);
  });
}

export const ORDENS = [
  { chave: 'recentes', rotulo: 'Mais recentes' },
  { chave: 'engajadas', rotulo: 'Mais engajadas' },
];

export function ordenar(publicacoes, ordem) {
  const copia = lista(publicacoes).slice();
  if (ordem === 'engajadas') return copia.sort((a, b) => b.engajamento - a.engajamento);
  return copia.sort((a, b) => String(b.data).localeCompare(String(a.data)));
}

// OS TIPOS QUE ESTA LISTA REALMENTE TEM. Um filtro que oferece "Story" numa
// conta sem stories é um botão que só decepciona.
export function tiposPresentes(publicacoes) {
  const vistos = [];
  for (const p of lista(publicacoes)) if (!vistos.includes(p.tipo)) vistos.push(p.tipo);
  return vistos;
}

const DOIS = (n) => String(n).padStart(2, '0');

// "27/07 · Reels · 84 curtidas, 16 comentários" — a linha que faz escolher.
export function descricaoDaPublicacao(p) {
  const partes = [];
  const d = p && p.data ? new Date(p.data) : null;
  if (d && !Number.isNaN(d.getTime())) partes.push(`${DOIS(d.getDate())}/${DOIS(d.getMonth() + 1)}`);
  if (p && p.tipo) partes.push(p.tipo);
  const eng = [];
  if (p && p.curtidas) eng.push(`${p.curtidas} ${p.curtidas === 1 ? 'curtida' : 'curtidas'}`);
  if (p && p.comentarios) eng.push(`${p.comentarios} ${p.comentarios === 1 ? 'comentário' : 'comentários'}`);
  if (eng.length) partes.push(eng.join(', '));
  return partes.join(' · ');
}

// A FRASE SOBRE STORIES. Ela existe porque a lista vazia é o caso NORMAL, e sem
// explicação parece defeito da ferramenta.
export const AVISO_STORIES =
  'Story vive 24 horas e depois some — então esta lista costuma estar vazia. '
  + 'Só dá para impulsionar um story enquanto ele está no ar.';
