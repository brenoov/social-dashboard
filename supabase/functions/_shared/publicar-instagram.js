// O PONTO DE EXTENSÃO DA PUBLICAÇÃO AUTOMÁTICA.
//
// Hoje esta função não publica nada — devolve `{ modo: 'manual' }`, e quem
// chama (conteudo-hora-h) manda o aviso no celular em vez de postar.
//
// POR QUE: o aplicativo da Meta da empresa não tem os escopos
// `instagram_content_publish` nem `pages_manage_posts`. O token atual só faz
// leitura (insights, media) e Ads. Conseguir esses escopos passa por App Review
// da Meta, que é processo deles e leva semanas.
//
// COMO LIGAR, quando sair a aprovação:
//   1. trocar ESCOPOS_DE_PUBLICACAO_LIBERADOS para true;
//   2. implementar publicarDeVerdade() com os dois passos da Graph API:
//        POST /{ig-user-id}/media          → devolve um "container"
//        POST /{ig-user-id}/media_publish  → publica o container
//      (carrossel: um container por item + um container de álbum);
//   3. ligar conta por conta em `accounts.publicacao_automatica` — começar por
//      UMA marca, nunca por todas.
//
// Nada mais no sistema precisa mudar: conteudo-hora-h só olha o `modo` que volta
// daqui. Foi por isso que essa decisão ficou isolada num arquivo só.
//
// ATENÇÃO PARA QUANDO CHEGAR A HORA: o bucket `conteudo` é PRIVADO, e a Graph
// API precisa baixar a imagem de uma URL pública. Vai ser preciso uma URL
// assinada (e conferir se o host dela está na allow-list do meta-proxy) ou uma
// cópia pública temporária que se apaga depois de publicar.

export const ESCOPOS_DE_PUBLICACAO_LIBERADOS = false;

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

export async function publicarPeca(peca, arquivos, conta) {
  if (!publicacaoAutomaticaLigada(conta)) {
    return { modo: 'manual', motivo: MOTIVO_MANUAL, ig_media_id: null };
  }
  // Inalcançável hoje. Fica como erro explícito, e não como um retorno vazio
  // que faria a peça ser marcada como publicada sem ter saído.
  throw new Error('publicarDeVerdade() ainda não foi implementada — ver o cabeçalho deste arquivo.');
}
