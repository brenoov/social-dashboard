// Regras de leitura do roteiro de uma ideia.
//
// PURO: sem Vue e sem banco, para dar para testar com `node --test`. Nenhum
// módulo daqui pode importar conectar-no-banco-de-dados.js — ele chama
// window.supabase no escopo do módulo e quebra o teste.

// O item de roteiro mudou de formato quando a ideia virou roteiro de verdade:
// antes era `{cena, fala}`, agora é `{cena, imagem, narracao, texto_na_tela}`.
// As ideias geradas antes disso continuam no banco e continuam boas — ler os
// dois nomes custa uma linha, e apagar histórico para padronizar custa caro.
export function falaDoTake(take) {
  const t = take || {};
  const v = typeof t.narracao === 'string' && t.narracao.trim()
    ? t.narracao
    : (typeof t.fala === 'string' ? t.fala : '');
  return v.trim();
}

// "take" só faz sentido em vídeo. Em carrossel são cards, em feed é uma imagem
// só. Chamar tudo de cena confunde quem vai executar.
export function rotuloDoPasso(quantos, formato) {
  if (formato === 'carrossel') return quantos === 1 ? 'card' : 'cards';
  if (formato === 'feed') return quantos === 1 ? 'imagem' : 'imagens';
  return quantos === 1 ? 'take' : 'takes';
}

export function duracaoTotalEmSegundos(roteiro) {
  return (Array.isArray(roteiro) ? roteiro : [])
    .reduce((soma, t) => soma + (Number(t?.duracao_s) || 0), 0);
}

function _limpo(v) {
  return (typeof v === 'string' ? v : '').trim();
}

// O texto que vai para a área de transferência.
//
// POR QUE ISTO EXISTE: quem grava não fica com o computador aberto do lado. O
// caminho real é copiar, colar no WhatsApp ou nas Notas e ler do celular
// enquanto filma. Se o texto copiado sair bagunçado, a tela bonita não serviu
// para nada.
export function montarRoteiroParaCopiar(ideia = {}) {
  const linhas = [];
  const titulo = _limpo(ideia.titulo);
  const formato = _limpo(ideia.formato);

  if (titulo) linhas.push(titulo.toUpperCase());
  if (formato) linhas.push(`Formato: ${formato}`);

  const gancho = _limpo(ideia.gancho);
  if (gancho) linhas.push('', 'OS 3 PRIMEIROS SEGUNDOS', gancho);

  const producao = _limpo(ideia.producao);
  if (producao) linhas.push('', 'ANTES DE GRAVAR', producao);

  const passos = Array.isArray(ideia.roteiro) ? ideia.roteiro : [];
  if (passos.length) {
    linhas.push('', rotuloDoPasso(passos.length, formato).toUpperCase());
    passos.forEach((t, i) => {
      const n = t?.cena ?? i + 1;
      const dur = Number(t?.duracao_s) || 0;
      linhas.push('', `${n}.${dur ? ` (${dur}s)` : ''}`);
      const imagem = _limpo(t?.imagem);
      if (imagem) linhas.push(`   Imagem: ${imagem}`);
      const fala = falaDoTake(t);
      if (fala) linhas.push(`   Fala: "${fala}"`);
      const naTela = _limpo(t?.texto_na_tela);
      if (naTela) linhas.push(`   Na tela: ${naTela}`);
    });
  }

  const legenda = _limpo(ideia.legenda_sugerida);
  const cta = _limpo(ideia.cta);
  const tags = _limpo(ideia.hashtags_sugeridas);
  if (legenda || cta || tags) {
    linhas.push('', 'PARA PUBLICAR');
    if (legenda) linhas.push(legenda);
    if (cta) linhas.push(`Chamada: ${cta}`);
    if (tags) linhas.push(tags);
  }

  return linhas.join('\n').trim();
}
