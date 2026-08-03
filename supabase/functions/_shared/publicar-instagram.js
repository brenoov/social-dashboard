// A PUBLICAÇÃO AUTOMÁTICA NO INSTAGRAM — implementada, e DESLIGADA.
//
// O interruptor `ESCOPOS_DE_PUBLICACAO_LIBERADOS` continua `false`, e continua
// sendo a única coisa que separa este arquivo de postar de verdade na conta do
// dono. Ele só vira `true` quando o App Review da Meta liberar
// `instagram_content_publish` — hoje a Meta recusa literalmente com
// `(#10) Requires instagram_content_publish permission to manage the object`
// (medido em 03/08/2026; ver docs/app-review-meta.md).
//
// POR QUE ESCREVER ANTES DA APROVAÇÃO: o pedido do App Review exige um vídeo da
// tela mostrando a publicação ACONTECENDO. Sem este código, o vídeo não pode
// ser gravado, e o pedido fica esperando a si mesmo. Escrever agora também
// separa o que é problema nosso do que é problema da Meta: quando a permissão
// sair, o que faltar aqui já vai estar aparecendo nos testes.
//
// COMO A META PUBLICA (dois passos, sempre):
//   POST /{ig-user-id}/media          → cria um "contêiner" e devolve o id
//   POST /{ig-user-id}/media_publish  → publica aquele contêiner
// Carrossel são três: um contêiner por foto (com `is_carousel_item`), um
// contêiner de álbum que aponta para os filhos, e o publish do álbum. Item de
// carrossel pode ser foto OU vídeo, mas nunca REELS.
//
// VÍDEO É ASSÍNCRONO, e é a parte que mais engana. O contêiner de vídeo nasce
// `IN_PROGRESS` e só pode ser publicado quando vira `FINISHED` — publicar antes
// dá erro. Esperamos por um tempo LIMITADO e, se não terminar, NÃO publicamos e
// NÃO marcamos como publicada: devolvemos `manual`, o sistema manda o aviso no
// celular e a pessoa posta. Um contêiner abandonado expira sozinho em 24h.
// A alternativa — esperar sem limite — travaria o cron, que roda de 5 em 5
// minutos e cuida de todas as peças da rodada.
//
// A IMAGEM PRECISA DE URL PÚBLICA. O bucket `conteudo` é privado, então quem
// chama passa uma função que assina uma URL temporária. A Meta baixa o arquivo
// pelo lado dela; não existe upload direto de bytes nesta API.

export const ESCOPOS_DE_PUBLICACAO_LIBERADOS = false;

export const VERSAO_DA_API = 'v22.0';
const GRAPH = `https://graph.facebook.com/${VERSAO_DA_API}`;

// Meia hora. Precisa durar o download da Meta (que pode demorar num vídeo
// grande) e não pode durar mais que o necessário: é uma URL sem senha, e quem
// tiver o link entra enquanto ela valer.
export const VALIDADE_DA_URL_SEGUNDOS = 30 * 60;

// ~30 segundos de espera por vídeo. O cron roda de 5 em 5 minutos e trata a
// rodada inteira; gastar minutos num vídeo só atrasaria o aviso de todos os
// outros. Quem não terminar a tempo vira aviso no celular, que é o que já
// acontece hoje com toda peça.
export const TENTATIVAS_DE_VIDEO = 10;
export const ESPERA_ENTRE_TENTATIVAS_MS = 3000;

// A Meta aceita de 2 a 10 itens num carrossel. Fora disso ela recusa, e é
// melhor descobrir aqui — com uma frase em português — do que na resposta dela.
export const MINIMO_DO_CARROSSEL = 2;
export const MAXIMO_DO_CARROSSEL = 10;

const MOTIVO_MANUAL =
  'O aplicativo da Meta ainda não tem permissão para publicar sozinho ' +
  '(instagram_content_publish). Enquanto isso o sistema avisa no celular ' +
  'com a arte e a legenda prontas.';

export function publicacaoAutomaticaLigada(conta) {
  // Os DOIS têm que ser verdade. A coluna sozinha não basta: se alguém ligar a
  // conta antes do App Review sair, a publicação falharia na Meta e a peça
  // ficaria num limbo — marcada como enviada sem ter sido.
  return ESCOPOS_DE_PUBLICACAO_LIBERADOS && conta?.publicacao_automatica === true;
}

// ─────────────────────────────────────────────────────────────────────────────
// AS PARTES PURAS. Sem rede, sem relógio — dá para testar sem tocar em conta
// nenhuma, e é onde moram as regras que a Meta cobra.

const texto = (v) => (typeof v === 'string' ? v.trim() : '');

// A LEGENDA QUE VAI PARA O INSTAGRAM = legenda + hashtags, na mesma ordem em
// que `casar-publicacao.js` monta o texto de referência. As duas TÊM que bater:
// é por esse texto que a Fase 3 reconhece o post publicado como sendo desta
// peça, e um espaço a mais de um lado quebraria o casamento.
export function legendaFinal(peca) {
  return [texto(peca?.legenda), texto(peca?.hashtags)].filter(Boolean).join(' ');
}

// Ordena os arquivos e descarta o que não dá para publicar. `ordem` é a coluna
// que a tela usa para o carrossel — confiar na ordem que o banco devolveu seria
// deixar a sequência das fotos ao acaso.
export function arquivosEmOrdem(arquivos) {
  return (Array.isArray(arquivos) ? arquivos : [])
    .filter((a) => a && texto(a.caminho) && (a.tipo === 'imagem' || a.tipo === 'video'))
    .slice()
    .sort((a, b) => (Number(a.ordem) || 0) - (Number(b.ordem) || 0));
}

// O QUE ESTA PEÇA PRECISA PARA SER PUBLICÁVEL — lista de frases, vazia quando
// dá. Frases e não códigos: elas vão para a trilha de eventos, que é lida por
// gente.
export function faltaParaPublicar(peca, arquivos) {
  const lista = arquivosEmOrdem(arquivos);
  const faltas = [];
  const formato = texto(peca?.formato);
  if (!lista.length) faltas.push('A peça não tem nenhum arquivo para publicar.');
  if (formato === 'carrossel') {
    if (lista.length && lista.length < MINIMO_DO_CARROSSEL) {
      faltas.push(`Carrossel precisa de pelo menos ${MINIMO_DO_CARROSSEL} arquivos — esta tem ${lista.length}.`);
    }
    if (lista.length > MAXIMO_DO_CARROSSEL) {
      faltas.push(`O Instagram aceita no máximo ${MAXIMO_DO_CARROSSEL} itens no carrossel — esta tem ${lista.length}.`);
    }
  } else if (lista.length > 1) {
    faltas.push(`Formato "${formato || 'feed'}" publica um arquivo só, e esta peça tem ${lista.length}.`);
  }
  if (formato === 'reels' && lista.some((a) => a.tipo !== 'video')) {
    faltas.push('Reels precisa ser vídeo.');
  }
  return faltas;
}

// OS PARÂMETROS DE UM CONTÊINER, em português da Meta.
//
// `ehFilho` é o item de dentro de um carrossel: ele leva `is_carousel_item` e
// NÃO leva legenda — a legenda é do álbum. Mandar legenda no filho não dá erro,
// e é justamente por isso que engana: ela simplesmente não aparece em lugar
// nenhum.
export function paramsDoContainer({ peca, arquivo, url, ehFilho = false }) {
  const formato = texto(peca?.formato);
  const params = {};
  if (arquivo?.tipo === 'video') params.video_url = url;
  else params.image_url = url;

  if (ehFilho) {
    params.is_carousel_item = 'true';
    // SEM `media_type` DE PROPÓSITO, e isto é regra da Meta, não gosto: item de
    // carrossel é foto ou vídeo comum, e REELS não é aceito ali (conferido na
    // documentação de Content Publishing, 03/08/2026). Mandar `media_type=REELS`
    // num filho faz a Meta recusar o carrossel inteiro.
    return params;
  }
  // `media_type` só existe para o que NÃO é foto no feed. Mandar
  // `media_type=IMAGE` é aceito, mas some do padrão da própria documentação —
  // e o feed é o caso mais comum, então fica sem.
  if (formato === 'reels') params.media_type = 'REELS';
  else if (formato === 'stories') params.media_type = 'STORIES';

  const legenda = legendaFinal(peca);
  // Stories não tem legenda no Instagram. Mandar uma seria mandar texto que
  // ninguém vai ver.
  if (legenda && formato !== 'stories') params.caption = legenda;
  return params;
}

export function paramsDoAlbum(peca, idsDosFilhos) {
  const params = { media_type: 'CAROUSEL', children: (idsDosFilhos || []).join(',') };
  const legenda = legendaFinal(peca);
  if (legenda) params.caption = legenda;
  return params;
}

// Precisa esperar o processamento? Só vídeo. Foto nasce pronta.
export const precisaEsperar = (arquivo) => arquivo?.tipo === 'video';

// ─────────────────────────────────────────────────────────────────────────────
// A PARTE QUE FALA COM A META.
//
// Tudo o que é de fora entra por `deps`: `fetch`, `esperar` e `urlAssinada`.
// Não é enfeite de arquitetura — é o que permite testar a sequência inteira
// (contêiner → espera → publish) sem uma conta de verdade e sem uma foto real.

const erroDaMeta = (d) => {
  const e = d && d.error;
  if (!e) return 'resposta sem id e sem erro';
  // SEM TRUNCAR: a explicação da Meta vive no fim, em `error_user_msg`, e cortar
  // a mensagem já escondeu a resposta várias vezes neste projeto.
  return [`code ${e.code}${e.error_subcode ? '/' + e.error_subcode : ''}`,
    e.message, e.error_user_title, e.error_user_msg].filter(Boolean).join(' · ');
};

async function chamar(deps, caminho, params, token) {
  const qs = new URLSearchParams({ ...params, access_token: token });
  const r = await deps.fetch(`${GRAPH}${caminho}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: qs.toString(),
  });
  const d = await r.json().catch(() => ({}));
  if (!d || !d.id) throw new Error(erroDaMeta(d));
  return d.id;
}

// Espera o vídeo terminar de processar, por um tempo LIMITADO.
// Devolve `true` se ficou pronto; `false` se o tempo acabou (e aí não se
// publica). `ERROR` e `EXPIRED` lançam: são estados finais, e continuar
// esperando por eles seria gastar o tempo de todas as outras peças da rodada.
async function esperarOVideo(deps, containerId, token) {
  for (let i = 0; i < TENTATIVAS_DE_VIDEO; i++) {
    const r = await deps.fetch(`${GRAPH}/${containerId}?fields=status_code&access_token=${encodeURIComponent(token)}`);
    const d = await r.json().catch(() => ({}));
    const estado = String(d?.status_code || '').toUpperCase();
    if (estado === 'FINISHED') return true;
    if (estado === 'ERROR' || estado === 'EXPIRED') {
      throw new Error(`o Instagram não conseguiu processar o vídeo (${estado})${d?.status ? ': ' + d.status : ''}`);
    }
    await deps.esperar(ESPERA_ENTRE_TENTATIVAS_MS);
  }
  return false;
}

const AINDA_PROCESSANDO =
  'O Instagram ainda estava processando o vídeo quando o tempo de espera acabou. '
  + 'Não publiquei para não arriscar publicar pela metade — a arte e a legenda '
  + 'estão prontas no aviso.';

export async function publicarPeca(peca, arquivos, conta, deps = {}) {
  if (!publicacaoAutomaticaLigada(conta)) {
    return { modo: 'manual', motivo: MOTIVO_MANUAL, ig_media_id: null };
  }

  const faltas = faltaParaPublicar(peca, arquivos);
  if (faltas.length) return { modo: 'manual', motivo: faltas.join(' '), ig_media_id: null };

  const igId = texto(conta?.instagram_id);
  const token = texto(conta?.access_token);
  if (!igId || !token) {
    return { modo: 'manual', motivo: 'Esta conta não tem Instagram ou token cadastrado.', ig_media_id: null };
  }
  const urlAssinada = deps.urlAssinada;
  if (typeof urlAssinada !== 'function') {
    throw new Error('publicarPeca precisa de deps.urlAssinada — o bucket é privado e a Meta baixa o arquivo por URL.');
  }
  const rede = { fetch: deps.fetch || globalThis.fetch, esperar: deps.esperar || ((ms) => new Promise((r) => setTimeout(r, ms))) };

  const lista = arquivosEmOrdem(arquivos);
  const carrossel = texto(peca?.formato) === 'carrossel';

  // ── 1. Um contêiner por arquivo ─────────────────────────────────────────
  const filhos = [];
  for (const arquivo of lista) {
    const url = await urlAssinada(arquivo.caminho, VALIDADE_DA_URL_SEGUNDOS);
    if (!url) throw new Error(`não consegui gerar a URL temporária de "${arquivo.caminho}"`);
    const id = await chamar(rede, `/${igId}/media`,
      paramsDoContainer({ peca, arquivo, url, ehFilho: carrossel }), token);
    if (precisaEsperar(arquivo)) {
      const pronto = await esperarOVideo(rede, id, token);
      if (!pronto) return { modo: 'manual', motivo: AINDA_PROCESSANDO, ig_media_id: null };
    }
    filhos.push(id);
  }

  // ── 2. O álbum, quando é carrossel ──────────────────────────────────────
  const containerFinal = carrossel
    ? await chamar(rede, `/${igId}/media`, paramsDoAlbum(peca, filhos), token)
    : filhos[0];

  // ── 3. Publica ──────────────────────────────────────────────────────────
  const mediaId = await chamar(rede, `/${igId}/media_publish`, { creation_id: containerFinal }, token);
  return { modo: 'automatico', motivo: null, ig_media_id: mediaId };
}
