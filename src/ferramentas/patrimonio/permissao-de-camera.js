/* Por que a câmera não abriu, e o que a pessoa faz a respeito.
 *
 * Câmera no navegador falha de meia dúzia de jeitos diferentes, e cada um pede
 * uma ação diferente da pessoa. Tratar tudo como "não consegui abrir a câmera"
 * é o mesmo que não dizer nada — foi o que a primeira versão fez, e o dono
 * voltou dizendo que no Android não funcionava.
 *
 * Um caso é especialmente cruel: quem NEGA a permissão uma vez nunca mais vê o
 * aviso. O navegador passa a recusar calado, e não existe jeito de forçar o
 * aviso de novo por código — a pessoa PRECISA ir nos ajustes do site. Então o
 * mínimo que a tela deve fazer é dizer isso, com o caminho do botão. */

/** Qual navegador, só o suficiente pra dar o caminho certo dos ajustes. */
export function navegadorDe(ua) {
  const s = String(ua || '').toLowerCase();
  const iOS = /iphone|ipad|ipod/.test(s) || (/macintosh/.test(s) && /mobile/.test(s));
  // No iPhone TODO navegador é o motor do Safari por baixo — Chrome, Firefox e
  // Edge de iPhone usam o mesmo, e o caminho dos ajustes é o do Safari.
  if (iOS) return 'ios';
  if (/edg\//.test(s)) return 'edge';
  if (/firefox|fxios/.test(s)) return 'firefox';
  if (/samsungbrowser/.test(s)) return 'samsung';
  if (/android/.test(s)) return 'android';
  if (/chrome|chromium/.test(s)) return 'chrome';
  if (/safari/.test(s)) return 'safari';
  return 'outro';
}

/** O caminho, em português de gente, pra liberar a câmera naquele navegador. */
export function passosParaLiberar(ua) {
  switch (navegadorDe(ua)) {
    case 'ios':
      return [
        'Toque no "aA" na barra de endereço, em cima.',
        'Escolha "Ajustes do Site".',
        'Ligue a Câmera.',
        'Volte aqui e toque em "Tentar de novo".',
      ];
    case 'android':
    case 'chrome':
      return [
        'Toque no cadeado ao lado do endereço do site.',
        'Escolha "Permissões" e depois Câmera.',
        'Marque Permitir.',
        'Volte aqui e toque em "Tentar de novo".',
      ];
    case 'samsung':
      return [
        'Toque no cadeado ao lado do endereço do site.',
        'Escolha "Permissões" e ligue a Câmera.',
        'Volte aqui e toque em "Tentar de novo".',
      ];
    case 'firefox':
      return [
        'Toque no cadeado ao lado do endereço do site.',
        'Apague a permissão bloqueada da Câmera.',
        'Volte aqui e toque em "Tentar de novo" — o aviso vai aparecer outra vez.',
      ];
    default:
      return [
        'Abra os ajustes deste site no seu navegador (costuma ser o cadeado ao lado do endereço).',
        'Libere a Câmera.',
        'Volte aqui e toque em "Tentar de novo".',
      ];
  }
}

/**
 * Diagnostica o estado da câmera ANTES ou DEPOIS de tentar abrir.
 *
 * Entradas (todas opcionais, o que não vier é tratado como desconhecido):
 *   temMediaDevices — o navegador tem a função de abrir câmera?
 *   contextoSeguro  — a página está em HTTPS (ou localhost)?
 *   permissao       — 'granted' | 'prompt' | 'denied', da API de permissões
 *   erroNome        — o `name` do erro que getUserMedia devolveu
 *   ua              — o user agent, só pra escolher o caminho dos ajustes
 *
 * Devolve { estado, titulo, texto, passos, podeTentar }.
 * `podeTentar` diz se faz sentido mostrar o botão de tentar de novo.
 */
export function diagnosticar({ temMediaDevices, contextoSeguro, permissao, erroNome, ua } = {}) {
  // Ordem importa: a causa mais FUNDA primeiro. Não adianta mandar liberar a
  // permissão se o problema é que a página não está em HTTPS — ali nem existe
  // permissão pra liberar.
  if (contextoSeguro === false) {
    return {
      estado: 'sem-https',
      titulo: 'Este endereço não permite câmera',
      texto: 'O navegador só libera a câmera em endereços seguros (https). Abra o app pelo endereço '
        + 'oficial, não por um número de IP ou por http.',
      passos: [],
      podeTentar: false,
    };
  }
  if (temMediaDevices === false) {
    return {
      estado: 'sem-suporte',
      titulo: 'Este navegador não abre a câmera',
      texto: 'Ele não tem o recurso que o leitor precisa. Abra o app no Chrome (Android) ou no '
        + 'Safari (iPhone) e tente de novo — ou digite o número que está impresso embaixo do código.',
      passos: [],
      podeTentar: false,
    };
  }
  if (permissao === 'denied' || erroNome === 'NotAllowedError' || erroNome === 'PermissionDeniedError') {
    return {
      estado: 'negada',
      titulo: 'A câmera está bloqueada para este site',
      texto: 'Alguma vez a permissão foi negada aqui, e desde então o navegador recusa sem perguntar '
        + 'de novo. Dá pra liberar em dois toques:',
      passos: passosParaLiberar(ua),
      podeTentar: true,
    };
  }
  if (erroNome === 'NotFoundError' || erroNome === 'DevicesNotFoundError' || erroNome === 'OverconstrainedError') {
    return {
      estado: 'sem-camera',
      titulo: 'Não achei câmera neste aparelho',
      texto: 'Se for um computador sem webcam, use o celular — ou digite o número impresso embaixo do código.',
      passos: [],
      podeTentar: true,
    };
  }
  if (erroNome === 'NotReadableError' || erroNome === 'TrackStartError' || erroNome === 'AbortError') {
    return {
      estado: 'ocupada',
      titulo: 'A câmera está ocupada',
      texto: 'Outro aplicativo está usando a câmera agora. Feche o app de câmera (ou a chamada de vídeo) '
        + 'e toque em "Tentar de novo".',
      passos: [],
      podeTentar: true,
    };
  }
  if (erroNome) {
    return {
      estado: 'erro',
      titulo: 'Não consegui abrir a câmera',
      texto: 'Tente de novo. Se continuar, digite o número que está impresso embaixo do código de barras.',
      passos: [],
      podeTentar: true,
    };
  }
  // Sem erro e sem bloqueio: ou já está liberada, ou o aviso ainda vai aparecer.
  return {
    estado: permissao === 'granted' ? 'liberada' : 'vai-perguntar',
    titulo: 'Ler a etiqueta com a câmera',
    texto: permissao === 'granted'
      ? 'Aponte a câmera para o código de barras da etiqueta.'
      : 'O navegador vai pedir permissão para usar a câmera. Toque em Permitir — a imagem não sai do '
        + 'seu aparelho, é lida aqui mesmo.',
    passos: [],
    podeTentar: true,
  };
}
