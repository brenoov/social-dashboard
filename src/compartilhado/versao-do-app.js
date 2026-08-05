/* Saber que existe uma versão nova no ar.
 *
 * O problema, relatado pelo dono: o app fica aberto — no celular como atalho de
 * tela cheia, no computador numa aba que ninguém fecha — e nunca mais busca o
 * `index.html`. O deploy sai, e quem está com a tela aberta continua rodando o
 * pacote velho por dias.
 *
 * Não é cache de service worker: o `sw-push.js` desta central só trata
 * notificação, não intercepta requisição nenhuma. É a página carregada em
 * memória mesmo.
 *
 * Como se descobre: o Vite põe um HASH no nome do pacote a cada build
 * (`/assets/index-Cg7ER1SX.js`). Basta comparar o que está rodando agora com o
 * que o `index.html` do servidor manda hoje. Hash diferente = versão nova.
 *
 * Este arquivo não busca nada e não recarrega nada — só compara. É o que
 * permite testar a decisão sem navegador e sem rede. */

/** O nome do pacote principal dentro de um HTML. Null se não achar. */
export function pacoteDoHtml(html) {
  if (!html) return null;
  // O entry do Vite: <script type="module" crossorigin src="/assets/index-XXXX.js">
  const m = String(html).match(/\/assets\/(index-[A-Za-z0-9_-]+\.js)/);
  return m ? m[1] : null;
}

/** O pacote que ESTÁ rodando, lido das tags da própria página. */
export function pacoteEmUso(documento) {
  try {
    const tags = (documento || document).querySelectorAll('script[src*="/assets/index-"]');
    for (const t of tags) {
      const p = pacoteDoHtml(t.getAttribute('src'));
      if (p) return p;
    }
  } catch (e) { /* sem DOM (teste, servidor): segue sem */ }
  return null;
}

/**
 * Vale avisar que há versão nova?
 *
 * Só quando os DOIS lados são conhecidos e diferentes. Quando algum é nulo —
 * rede caiu, HTML veio estranho, build mudou de formato — a resposta é NÃO.
 * Avisar errado é pior que não avisar: a pessoa recarrega no meio de um
 * cadastro e perde o que digitou, e da segunda vez ignora o aviso.
 */
export function precisaAtualizar(emUso, noServidor) {
  if (!emUso || !noServidor) return false;
  return emUso !== noServidor;
}

/** De quanto em quanto tempo conferir, em milissegundos. */
export const INTERVALO_DE_CHECAGEM = 5 * 60 * 1000;

/**
 * O endereço a buscar. O `?v=` é o que impede o próprio navegador de responder
 * com a cópia velha do index.html — sem ele a checagem perguntaria pro cache e
 * receberia sempre a mesma resposta, que é exatamente o problema que se quer
 * resolver.
 */
export function enderecoDaChecagem(agoraMs) {
  return `/index.html?v=${agoraMs}`;
}

/** A frase do aviso. Curta: ela aparece por cima do trabalho da pessoa. */
export const AVISO = 'Tem uma versão nova do app.';
export const BOTAO = 'Atualizar';
