// O HISTÓRICO das campanhas criadas por aqui: o que ficou pela metade, o que a
// Meta aceitou e o que ela recusou — com o motivo.
//
// POR QUE EXISTE (04/08/2026): o dono pediu "um histórico do que está em
// rascunho e enviado". A gravação foi feita (`gt_campanhas_rascunho`) e o
// assistente passou a oferecer retomar o último — mas a LISTA nunca foi
// desenhada. Pior: o aviso de retomar dizia "o rascunho continua guardado no
// histórico" e não havia histórico nenhum para abrir. A tela prometia uma coisa
// que não entregava; este arquivo é o que faltava.
//
// PURO no mesmo sentido de painel-fila.js: monta innerHTML e liga os cliques no
// elemento que recebe, mas não conhece banco, rede nem `window`. Quem busca o
// dado e quem apaga é a tela.
//
// As regras de LEITURA (o que cada linha diz, como a data é escrita, o que pode
// ser continuado) moram em rascunhos.js e já eram testadas — aqui só desenha.

// TEXTO DE FORA VAI TODO POR `esc`. Vale para o nome da campanha (digitado por
// gente) e principalmente para o MOTIVO DA RECUSA, que é texto vindo da Meta e
// que ninguém revisou antes de virar innerHTML.
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Cor e palavra de cada situação. "A Meta recusou" não é notícia boa nem ruim
// de verdade — é a que a pessoa mais precisa conseguir achar na lista, então
// ganha a cor de aviso e o motivo aberto embaixo.
const CORES = {
  rascunho: 'var(--accent)',
  criada: 'var(--green)',
  falhou: 'var(--orange)',
};

const VAZIO = 'Nenhuma campanha começada por aqui ainda. O que você criar (ou deixar pela metade) aparece nesta lista.';

export function montarPainelHistorico(alvo, opcoes) {
  const o = opcoes || {};
  const linhas = Array.isArray(o.linhas) ? o.linhas : [];

  if (o.carregando) {
    alvo.innerHTML = '<div class="gtw-ajuda" style="padding:14px 2px;">Buscando…</div>';
    return;
  }
  if (o.erro) {
    alvo.innerHTML = '<div class="gtw-falta" style="margin:8px 0;">Não consegui ler o histórico: ' + esc(o.erro) + '</div>';
    return;
  }
  if (!linhas.length) {
    alvo.innerHTML = '<div class="gtw-ajuda" style="padding:14px 2px;">' + esc(VAZIO) + '</div>';
    return;
  }

  const cartao = (l) => {
    const cor = CORES[l.status] || CORES.rascunho;
    // O SEGUNDO RENGLÃO junta o que dá para dizer numa linha só. `ondeParou` só
    // vem em rascunho; nos outros seria mentira ("parou no passo 5" numa
    // campanha que foi criada inteira).
    const detalhe = [l.tipo, l.quando, l.ondeParou].filter(Boolean).map(esc).join(' · ');
    return ''
      + '<div style="border:1px solid var(--border);border-left:3px solid ' + cor + ';border-radius:10px;'
      + 'padding:10px 12px;margin-bottom:8px;background:var(--surface2);">'
      +   '<div style="display:flex;gap:8px;align-items:baseline;flex-wrap:wrap;">'
      +     '<span style="font-weight:700;color:var(--text);">' + esc(l.nome) + '</span>'
      +     '<span style="color:' + cor + ';font-size:calc(9.5px*var(--gt-fs,1.3));font-weight:700;">' + esc(l.rotuloStatus) + '</span>'
      +   '</div>'
      +   (detalhe ? '<div class="gtw-ajuda" style="margin:3px 0 0;">' + detalhe + '</div>' : '')
      // O MOTIVO DA RECUSA é a informação mais valiosa desta lista, e a que some
      // se ninguém guardar: meses depois ninguém lembra por que aquela campanha
      // não foi. Fica aberto, sem precisar clicar.
      +   (l.motivo ? '<div style="margin-top:6px;color:var(--orange);">' + esc(l.motivo) + '</div>' : '')
      +   '<div style="display:flex;gap:7px;margin-top:8px;flex-wrap:wrap;">'
      +     (l.podeContinuar ? '<button type="button" class="gtw-b" data-continuar="' + esc(l.id) + '">Continuar</button>' : '')
      // APAGAR SÓ O QUE É SEU. A leitura é do time inteiro (é a memória da
      // conta), mas apagar o rascunho de outra pessoa não. Quem decide é a tela,
      // que sabe quem está logado — aqui só se obedece.
      +     (l.podeApagar ? '<button type="button" class="gtw-b secundario" data-apagar="' + esc(l.id) + '">Apagar</button>' : '')
      +   '</div>'
      + '</div>';
  };

  alvo.innerHTML = ''
    + '<p class="gtw-ajuda" style="margin:0 0 10px;">'
    +   'Tudo que foi começado nesta conta, do mais recente para o mais antigo. '
    +   'Rascunho aparece primeiro: é o único que ainda dá para continuar.'
    + '</p>'
    + linhas.map(cartao).join('');

  for (const b of alvo.querySelectorAll('[data-continuar]')) {
    b.onclick = () => o.aoContinuar && o.aoContinuar(b.getAttribute('data-continuar'));
  }
  for (const b of alvo.querySelectorAll('[data-apagar]')) {
    b.onclick = () => o.aoApagar && o.aoApagar(b.getAttribute('data-apagar'));
  }
}

// Quem pode apagar cada linha. Fica aqui, e não na tela, para a regra ficar
// testável sem navegador — e para não haver duas versões dela.
export function marcarQuemPodeApagar(linhas, linhasCruas, meuId) {
  const dono = {};
  for (const r of (linhasCruas || [])) if (r && r.id) dono[String(r.id)] = String(r.criado_por || '');
  return (linhas || []).map((l) => ({ ...l, podeApagar: !!meuId && dono[l.id] === String(meuId) }));
}
