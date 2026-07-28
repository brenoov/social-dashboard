// Duplicar campanha / conjunto de anúncios / anúncio no Meta.
//
// MÓDULO PURO: sem tela, sem rede. Só monta o plano e executa passo a passo
// chamando uma função `enviar` que quem usa entrega por fora. É isso que
// permite testar a cópia inteira — inclusive a falha no meio — sem nunca
// encostar numa conta de anúncios de verdade.
//
// POR QUE EM CASCATA (e não deep_copy=true): o `deep_copy` da Meta copia os
// filhos de uma vez, mas trava em 3 anúncios por chamada — justamente a
// campanha grande que o dono mais quer duplicar. Aqui a cópia é feita nível
// por nível: campanha vazia -> cada conjunto pra dentro dela -> cada anúncio
// pro conjunto novo. Sem teto, com progresso visível, e falha identificável.

export const SUFIXO_PADRAO = '· cópia';
const NIVEIS = ['campanha', 'conjunto', 'anuncio'];

// A Meta NÃO devolve um campo `id` na cópia — cada nível devolve o seu nome.
// Chutar `id` quebraria a cascata logo no primeiro passo.
const CAMPO_ID_NOVO = {
  campanha: 'copied_campaign_id',
  conjunto: 'copied_adset_id',
  anuncio: 'copied_ad_id',
};

function paramsDe(nivel, sufixo) {
  const params = { status_option: 'PAUSED' };
  // Explícito de propósito: o padrão da Meta hoje é PAUSED e deep_copy false,
  // mas padrão de terceiro muda sem avisar. O que protege a conta do dono vai
  // escrito na chamada.
  if (nivel !== 'anuncio') params.deep_copy = false;
  if (sufixo) {
    params.rename_options = JSON.stringify({
      rename_strategy: 'ONLY_TOP_LEVEL_RENAME',
      rename_suffix: ' ' + sufixo,
    });
  }
  return params;
}

function passo(id, nivel, origem, sufixo, paiPasso, paiCampo, copia) {
  return {
    id,
    nivel,
    origemId: String(origem.id),
    origemNome: origem.name || origem.nome || '(sem nome)',
    copia,
    paiPasso: paiPasso || null,
    paiCampo: paiCampo || null,
    params: paramsDe(nivel, sufixo),
  };
}

function limitarQuantidade(valor) {
  const n = Math.floor(Number(valor));
  if (!Number.isFinite(n)) return 1;
  return Math.min(Math.max(n, 1), 5);
}

// Monta a lista ordenada de passos. Não executa nada: recebe dados, devolve
// dados. Só o objeto que o dono mandou duplicar leva sufixo no nome — repetir
// "· cópia" em cada conjunto e anúncio dentro de uma campanha já renomeada só
// sujaria a lista.
export function planoDeCopia(alvo, opts = {}) {
  const nivel = alvo && alvo.nivel;
  if (!NIVEIS.includes(nivel)) return [];

  const campanha = alvo.campanha || null;
  const conjuntos = alvo.conjuntos || [];
  const anuncios = alvo.anuncios || [];
  const quantidade = limitarQuantidade(opts.quantidade);
  const base = String(opts.sufixo == null ? SUFIXO_PADRAO : opts.sufixo).trim() || SUFIXO_PADRAO;

  if (nivel === 'campanha' && !campanha) return [];
  if (nivel === 'conjunto' && !conjuntos.length) return [];
  if (nivel === 'anuncio' && !anuncios.length) return [];

  const passos = [];
  for (let c = 1; c <= quantidade; c++) {
    const sufixo = quantidade > 1 ? base + ' ' + c : base;

    if (nivel === 'campanha') {
      const raiz = 'c' + c + ':camp';
      passos.push(passo(raiz, 'campanha', campanha, sufixo, null, null, c));
      for (const cj of conjuntos) {
        const idCj = 'c' + c + ':cj:' + cj.id;
        passos.push(passo(idCj, 'conjunto', cj, null, raiz, 'campaign_id', c));
        for (const ad of anuncios.filter(a => String(a.adset_id) === String(cj.id))) {
          passos.push(passo('c' + c + ':ad:' + ad.id, 'anuncio', ad, null, idCj, 'adset_id', c));
        }
      }
    } else if (nivel === 'conjunto') {
      const cj = conjuntos[0];
      const raiz = 'c' + c + ':cj';
      passos.push(passo(raiz, 'conjunto', cj, sufixo, null, null, c));
      for (const ad of anuncios) {
        passos.push(passo('c' + c + ':ad:' + ad.id, 'anuncio', ad, null, raiz, 'adset_id', c));
      }
    } else {
      passos.push(passo('c' + c + ':ad', 'anuncio', anuncios[0], sufixo, null, null, c));
    }
  }
  return passos;
}

function idNovoDaResposta(nivel, resposta) {
  const campo = CAMPO_ID_NOVO[nivel];
  const valor = resposta && (resposta[campo] != null ? resposta[campo] : null);
  return valor == null ? null : String(valor);
}

// Percorre o plano chamando `enviar` passo a passo. `enviar` é injetada de
// fora: nos testes é uma Meta de mentira, na tela é o metaPost que já existe.
//
// FALHOU NO MEIO: para ali e devolve o relatório. NÃO desfaz nada — apagar
// campanha por conta própria pra "limpar" é pior que o problema: um engano
// apaga o objeto errado. Tudo que ficou está PAUSADO, então nada gasta.
export async function executarPlano(plano, opts = {}) {
  const { enviar, aoProgredir, feitos } = opts;
  const criados = Object.assign({}, feitos || {});
  const relatorio = { criados, concluidos: [], falhou: null };
  const passos = plano || [];

  for (const p of passos) {
    // Retomada: passo já concluído numa tentativa anterior não é refeito.
    if (criados[p.id]) { relatorio.concluidos.push(p.id); continue; }

    const params = Object.assign({}, p.params);
    if (p.paiPasso) {
      const idPai = criados[p.paiPasso];
      if (!idPai) {
        relatorio.falhou = { passo: p, motivo: 'O item onde esta cópia deveria entrar não foi criado.' };
        return relatorio;
      }
      params[p.paiCampo] = idPai;
    }

    try {
      const resposta = await enviar('/' + p.origemId + '/copies', params);
      const novoId = idNovoDaResposta(p.nivel, resposta);
      if (!novoId) throw new Error('A Meta não devolveu o número da cópia.');
      criados[p.id] = novoId;
      relatorio.concluidos.push(p.id);
      if (aoProgredir) {
        aoProgredir({ passo: p, novoId, feitos: relatorio.concluidos.length, total: passos.length });
      }
    } catch (e) {
      relatorio.falhou = { passo: p, motivo: String((e && e.message) || e) };
      return relatorio;
    }
  }
  return relatorio;
}
