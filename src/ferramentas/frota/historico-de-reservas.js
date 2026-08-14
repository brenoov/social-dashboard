/* O HISTÓRICO DA ABA GESTÃO: o que foi reservado, o que foi retirado, e a prova.
 *
 * Desenho: docs/superpowers/specs/2026-08-13-frota-gestao-reservas-design.md
 *
 * POR QUE ISTO EXISTE. Medido no banco em 13/08/2026: existiam 2 reservas — uma
 * aprovada e uma recusada — e NENHUMA pendente. Como a aba Gestão só mostrava a
 * fila de aprovação, e a fila só lista pendentes, o resultado era uma tela
 * vazia com duas reservas invisíveis atrás dela. Não havia caminho nenhum na
 * tela para editar, cancelar ou revogar o que já tinha sido decidido.
 *
 * POR QUE A LISTA TRAZ RETIRADA, E NÃO SÓ RESERVA. No mesmo dia, no mesmo
 * banco: 5 retiradas reais e 2 reservas. Uma lista só de reservas mostraria
 * menos da metade do que aconteceu com os carros — e a tela nunca mente. Então
 * a lista é uma LINHA DO TEMPO: cada reserva, cada retirada, e o elo entre as
 * duas quando ele existe.
 *
 * A REGRA QUE MANDA NESTE ARQUIVO: nada aqui inventa elo. Quando não dá pra
 * afirmar que aquela retirada saiu daquela reserva, o par não é feito — e a
 * tela mostra as duas coisas separadas, que é a verdade. Casar por engano seria
 * pior do que não casar: o histórico passaria a afirmar que alguém pegou o
 * carro com uma autorização que nunca usou. */

import { SITUACOES, TOLERANCIA_RETIRADA_MS } from './requisicoes.js';

/* ── As situações, agora com 'revogada' ───────────────────────────────────── */

/**
 * 'revogada' entra aqui, e não em `SITUACOES` (requisicoes.js), porque aquele
 * arquivo é sobre PEDIR e DECIDIR. Encerrar uma reserva que já valia é outro
 * assunto, e mora com o histórico, que é onde ela aparece.
 *
 * A palavra é do dono (13/08/2026), e a diferença entre as duas é dele:
 *   cancelada — a reserva ainda não tinha começado. Desmarcou-se.
 *   revogada  — já estava valendo, e alguém tirou o direito no meio.
 */
export const SITUACOES_DO_HISTORICO = {
  ...SITUACOES,
  revogada: { rotulo: 'Revogada', cor: 'ruim' },
};

/** O rótulo em português de uma situação, sem nunca devolver vazio. */
export function rotuloDaSituacao(situacao) {
  return (SITUACOES_DO_HISTORICO[situacao] || {}).rotulo || String(situacao || 'sem situação');
}

const ms = (v) => { const t = Date.parse(v); return Number.isFinite(t) ? t : null; };
const texto = (v) => String(v ?? '').trim();
const mesmoNome = (a, b) => {
  const x = texto(a).toLowerCase(); const y = texto(b).toLowerCase();
  return !!x && x === y;
};

/**
 * O dia (AAAA-MM-DD) de um instante, no fuso de Brasília.
 *
 * Mesma conta que a tela usa pra `hoje`, e pelo mesmo motivo: `toISOString()`
 * puro dá a data em UTC, e depois das 21h no Brasil isso já é o dia seguinte —
 * a retirada das 22h procuraria a ficha de amanhã e nunca acharia.
 */
export function diaEmBrasilia(iso) {
  const t = ms(iso);
  if (t === null) return null;
  return new Date(t - 3 * 3600 * 1000).toISOString().slice(0, 10);
}

/* ── O que dá pra fazer com cada reserva ──────────────────────────────────── */

/**
 * As três ações do admin, e o motivo de cada uma quando não dá.
 *
 * CANCELAR E REVOGAR NUNCA APARECEM JUNTAS. Só uma das duas cabe em cada
 * momento — o que ainda não começou se cancela, o que já está valendo se
 * revoga —, e o padrão da casa manda uma ação principal por bloco. Dois botões
 * quase iguais lado a lado é o mesmo que nenhum: a pessoa para pra decidir
 * qual, e escolhe no chute.
 *
 * `pode:false` SEMPRE vem com `motivo`. Botão que some sem explicação faz quem
 * usa achar que a ferramenta quebrou — é regra escrita do padrão da central.
 */
export function acoesDaReserva({ requisicao, temPermissaoAprovar, agoraIso } = {}) {
  const r = requisicao || {};
  const agora = ms(agoraIso) ?? Date.now();
  const inicio = ms(r.retirada_prevista);
  // Sem hora de retirada não dá pra dizer se começou. Trata-se como "ainda não
  // começou": cancelar é a ação reversível das duas, e na dúvida a tela oferece
  // a menos grave.
  const jaComecou = inicio !== null && agora >= inicio;
  const viva = r.situacao === 'pendente' || r.situacao === 'aprovada';
  const virouViagem = !!r.uso_id;

  const negar = (motivo) => ({ pode: false, motivo });
  const semPermissao = () => negar('sem-permissao');

  let editar;
  if (!temPermissaoAprovar) editar = semPermissao();
  else if (!viva) editar = negar('ja-encerrada');
  else if (virouViagem) editar = negar('ja-virou-viagem');
  else editar = { pode: true, motivo: null };

  let cancelar;
  if (!temPermissaoAprovar) cancelar = semPermissao();
  else if (!viva) cancelar = negar('ja-encerrada');
  else if (virouViagem || jaComecou) cancelar = negar('ja-comecou');
  else cancelar = { pode: true, motivo: null };

  let revogar;
  if (!temPermissaoAprovar) revogar = semPermissao();
  else if (!viva) revogar = negar('ja-encerrada');
  else if (!virouViagem && !jaComecou) revogar = negar('ainda-nao-comecou');
  else revogar = { pode: true, motivo: null };

  return { editar, cancelar, revogar };
}

/** A frase que a tela mostra quando a ação não pode. */
export function porQueNaoDaEmPortugues(motivo, situacao) {
  switch (motivo) {
    case 'sem-permissao':
      return 'Você não altera reserva de veículo. Peça a quem aprova.';
    case 'ja-encerrada':
      return `Esta reserva já está ${rotuloDaSituacao(situacao).toLowerCase()}, e reserva encerrada não se mexe: `
        + 'o histórico tem de continuar dizendo o que foi combinado.';
    case 'ja-virou-viagem':
      return 'O carro já saiu com esta reserva. Mudar o pedido agora faria o registro discordar do que aconteceu.';
    case 'ja-comecou':
      return 'Esta reserva já está valendo. O caminho aqui é revogar, não cancelar.';
    case 'ainda-nao-comecou':
      return 'Esta reserva ainda não começou. O caminho aqui é cancelar, não revogar.';
    default:
      return '';
  }
}

/* ── A prova de uma retirada ──────────────────────────────────────────────── */

/**
 * Que prova ficou de uma retirada — e de quem ela é.
 *
 * ESTA É A FUNÇÃO QUE MOTIVOU A ENTREGA. O dono perguntou se a assinatura do
 * checklist já não valia como assinatura de retirada. A resposta saiu do banco:
 * no único dia em que houve ficha assinada, quem assinou foi Erick Martins e
 * quem pegou o carro foi Breno. As duas frases são diferentes —
 *   o checklist diz "o carro estava assim neste dia, e fulano viu";
 *   a retirada diz "eu, fulano, recebi este carro assim e respondo por ele" —
 * e só coincidem quando é a mesma pessoa. É exatamente isso que os cinco
 * estados abaixo separam, em vez de mostrar um "✔ assinado" que esconderia a
 * diferença.
 */
export function provaDaRetirada({ uso, fichas } = {}) {
  const u = uso || {};
  const dia = diaEmBrasilia(u.saida_em);
  const ficha = (fichas || []).find((f) => f && f.veiculo_id === u.veiculo_id && f.feita_em === dia) || null;

  // O aceite vem PRIMEIRO porque é a prova mais forte que pode existir aqui:
  // é a assinatura de quem pegou, feita na hora de pegar.
  if (u.aceite_em) {
    return {
      estado: 'aceite',
      ficha,
      quemAssinou: texto(u.aceite_nome) || texto(u.pessoa_nome) || 'quem pegou o carro',
      frase: `${texto(u.aceite_nome) || texto(u.pessoa_nome) || 'Quem pegou o carro'} assinou o aceite de retirada.`,
    };
  }

  if (!ficha) {
    return {
      estado: 'sem-ficha',
      ficha: null,
      quemAssinou: null,
      frase: 'Não houve checklist deste carro neste dia: não ficou prova nenhuma desta retirada.',
    };
  }

  if (!ficha.assinada_em) {
    return {
      estado: 'ficha-sem-assinatura',
      ficha,
      quemAssinou: null,
      frase: 'O checklist do dia foi preenchido, mas ninguém assinou.',
    };
  }

  const mesmaPessoa = (u.pessoa_id && ficha.pessoa_id && u.pessoa_id === ficha.pessoa_id)
    || mesmoNome(u.pessoa_nome, ficha.pessoa_nome);

  if (mesmaPessoa) {
    return {
      estado: 'assinada-por-quem-pegou',
      ficha,
      quemAssinou: texto(ficha.pessoa_nome) || texto(u.pessoa_nome) || 'quem pegou o carro',
      frase: `${texto(ficha.pessoa_nome) || 'Quem pegou o carro'} conferiu e assinou o checklist deste dia.`,
    };
  }

  return {
    estado: 'assinada-por-outra',
    ficha,
    quemAssinou: texto(ficha.pessoa_nome) || 'outra pessoa',
    frase: `O checklist deste dia foi assinado por ${texto(ficha.pessoa_nome) || 'outra pessoa'}, `
      + `e quem pegou o carro foi ${texto(u.pessoa_nome) || 'outra pessoa'}. `
      + 'Não ficou assinatura de quem pegou.',
  };
}

/* ── A cópia em PDF na pasta do Zoho ──────────────────────────────────────── */

/**
 * O que aconteceu com a cópia em PDF de UMA ficha.
 *
 * Segue a doutrina que `copias-no-zoho.js` já escreveu por extenso, e ela vale
 * aqui igual: **espera não é problema.** O robô sobe de 10 em 10 minutos, e uma
 * ficha assinada há dois minutos está esperando o relógio, não quebrada. E a
 * ficha continua valendo de qualquer jeito — o PDF é cópia; a prova mora no
 * banco desde o segundo em que foi assinada.
 */
export function copiaNoZoho({ checklistId, copias } = {}) {
  if (!checklistId) return { estado: 'sem-ficha', frase: '' };
  const c = (copias || []).find((x) => x && x.checklist_id === checklistId);
  if (!c) return { estado: 'sem-copia', frase: 'A cópia em PDF ainda não entrou na fila do Zoho.' };
  if (c.situacao === 'enviado') {
    return { estado: 'chegou', frase: 'A cópia em PDF chegou na pasta do Zoho.' };
  }
  if (c.situacao === 'falhou') {
    // O texto do robô sai como ele escreveu: ele já vem em português dizendo o
    // que FAZER ("Abra Acessos → Zoho e clique em conectar"). Resumir isso pra
    // "erro ao enviar" jogaria fora justamente a parte que resolve.
    return {
      estado: 'desistiu',
      frase: `A cópia em PDF não chegou no Zoho: ${texto(c.ultimo_erro) || 'o robô tentou 8 vezes e parou.'}`,
    };
  }
  if (texto(c.ultimo_erro)) {
    return {
      estado: 'tropecou',
      frase: `A cópia em PDF está atrasada, e o robô continua tentando: ${texto(c.ultimo_erro)}`,
    };
  }
  return { estado: 'esperando', frase: 'A cópia em PDF está na fila do Zoho, esperando a vez.' };
}

/* ── O elo entre reserva e retirada ───────────────────────────────────────── */

/**
 * A retirada que saiu desta reserva — ou nada.
 *
 * `uso_id` é a resposta certa quando existe. Ele SÓ passou a ser gravado em
 * 13/08/2026: até então nada na tela ligava a reserva à viagem, e por isso as
 * reservas antigas precisam do segundo caminho.
 *
 * O SEGUNDO CAMINHO USA A MESMA REGRA QUE AUTORIZA A RETIRADA — a janela de
 * `reservaParaPegar()` em requisicoes.js — e isso é de propósito: se aquela
 * regra deixou a pessoa pegar o carro por causa desta reserva, é esta reserva
 * que autorizou a saída. Duas respostas diferentes pra mesma pergunta é defeito
 * que esta central já pagou caro.
 *
 * E ele exige a MESMA PESSOA. Sem isso, a reserva do Felipe casaria com a saída
 * da Barbara no mesmo carro e no mesmo dia, e o histórico afirmaria uma coisa
 * que não aconteceu.
 */
export function retiradaDaReserva({ requisicao, usos } = {}) {
  const r = requisicao || {};
  if (!r.veiculo_id) return null;

  if (r.uso_id) return (usos || []).find((u) => u && u.id === r.uso_id) || null;

  const inicio = ms(r.retirada_prevista);
  if (inicio === null || r.situacao !== 'aprovada') return null;
  const fim = ms(r.devolucao_prevista) ?? inicio;

  const candidatas = (usos || []).filter((u) => {
    if (!u || u.veiculo_id !== r.veiculo_id) return false;
    const mesma = (u.pessoa_id && r.pessoa_id && u.pessoa_id === r.pessoa_id)
      || mesmoNome(u.pessoa_nome, r.pessoa_nome);
    if (!mesma) return false;
    const saiu = ms(u.saida_em);
    if (saiu === null) return false;
    return saiu >= inicio - TOLERANCIA_RETIRADA_MS && saiu <= fim + TOLERANCIA_RETIRADA_MS;
  });

  if (candidatas.length === 0) return null;
  // Mais de uma cabendo na janela: fica a que saiu mais perto da hora marcada.
  return candidatas.slice().sort((a, b) =>
    Math.abs(ms(a.saida_em) - inicio) - Math.abs(ms(b.saida_em) - inicio))[0];
}

/* ── A linha do tempo ─────────────────────────────────────────────────────── */

/**
 * Tudo o que aconteceu com os carros, do mais novo pro mais velho.
 *
 * Duas espécies de linha, e a diferença importa pra quem lê:
 *   'reserva'  — alguém pediu o carro. Pode ter virado retirada, ou não.
 *   'retirada' — alguém pegou o carro SEM reserva nenhuma atrás.
 *
 * A segunda espécie não é enfeite: em 13/08/2026 ela era a maioria (5 retiradas
 * contra 2 reservas). Uma lista só de reservas diria que quase nada aconteceu.
 */
export function linhaDoTempo({
  requisicoes, usos, veiculos, fichas, copias, temPermissaoAprovar, agoraIso,
} = {}) {
  const carros = new Map((veiculos || []).filter(Boolean).map((v) => [v.id, v]));
  const nomeDoCarro = (id) => (carros.get(id) || {}).nome || 'carro que saiu do cadastro';
  const placaDoCarro = (id) => (carros.get(id) || {}).placa || '';

  const usadas = new Set();
  const linhas = [];

  for (const r of (requisicoes || []).filter(Boolean)) {
    const uso = retiradaDaReserva({ requisicao: r, usos });
    if (uso) usadas.add(uso.id);
    const prova = uso ? provaDaRetirada({ uso, fichas }) : null;
    linhas.push({
      chave: `reserva:${r.id}`,
      tipo: 'reserva',
      quando: ms(uso ? uso.saida_em : r.retirada_prevista) ?? ms(r.criada_em) ?? 0,
      reserva: r,
      uso,
      prova,
      zoho: prova && prova.ficha ? copiaNoZoho({ checklistId: prova.ficha.id, copias }) : null,
      veiculoNome: nomeDoCarro(r.veiculo_id),
      veiculoPlaca: placaDoCarro(r.veiculo_id),
      situacao: r.situacao,
      acoes: acoesDaReserva({ requisicao: r, temPermissaoAprovar, agoraIso }),
    });
  }

  for (const u of (usos || []).filter(Boolean)) {
    if (usadas.has(u.id)) continue;
    const prova = provaDaRetirada({ uso: u, fichas });
    linhas.push({
      chave: `retirada:${u.id}`,
      tipo: 'retirada',
      quando: ms(u.saida_em) ?? 0,
      reserva: null,
      uso: u,
      prova,
      zoho: prova.ficha ? copiaNoZoho({ checklistId: prova.ficha.id, copias }) : null,
      veiculoNome: nomeDoCarro(u.veiculo_id),
      veiculoPlaca: placaDoCarro(u.veiculo_id),
      // Retirada sem reserva não tem situação de reserva. A palavra é essa
      // mesma, e não um 'aprovada' emprestado: o carro saiu sem pedido, e o
      // histórico tem de dizer isso.
      situacao: 'sem-reserva',
      acoes: null,
    });
  }

  return linhas.sort((a, b) => b.quando - a.quando);
}

/* ── O filtro ─────────────────────────────────────────────────────────────── */

/**
 * Os filtros da barra, na ordem em que aparecem.
 * 'tudo' primeiro porque é o que responde "o que andou acontecendo".
 */
export const FILTROS = [
  { chave: 'tudo', rotulo: 'Tudo' },
  { chave: 'pendente', rotulo: 'Aguardando' },
  { chave: 'aprovada', rotulo: 'Aprovadas' },
  { chave: 'encerrada', rotulo: 'Encerradas' },
  { chave: 'sem-reserva', rotulo: 'Sem reserva' },
  { chave: 'sem-assinatura', rotulo: 'Sem assinatura' },
];

/**
 * `sem-assinatura` é o filtro que o dono vai usar mais, e por isso ele existe:
 * é a resposta pra "está indo tudo pro Zoho?". Ele mostra o que saiu do pátio
 * sem prova de quem pegou — que em 13/08/2026 era TODAS as cinco retiradas.
 */
export function filtrar(linhas, filtro) {
  const L = linhas || [];
  switch (filtro) {
    case 'pendente':   return L.filter((l) => l.situacao === 'pendente');
    case 'aprovada':   return L.filter((l) => l.situacao === 'aprovada');
    case 'encerrada':  return L.filter((l) =>
      ['recusada', 'cancelada', 'revogada', 'usada'].includes(l.situacao));
    case 'sem-reserva': return L.filter((l) => l.tipo === 'retirada');
    case 'sem-assinatura': return L.filter((l) =>
      l.prova && ['sem-ficha', 'ficha-sem-assinatura', 'assinada-por-outra'].includes(l.prova.estado));
    default: return L.slice();
  }
}

/**
 * A frase de cima do quadro. Diz o tamanho do problema em vez de só contar
 * linhas: "38 movimentos" não ajuda ninguém a decidir o que fazer.
 */
export function resumoDoHistorico(linhas) {
  const L = linhas || [];
  if (!L.length) return 'Nenhuma reserva e nenhuma retirada registradas ainda.';
  const semProva = L.filter((l) =>
    l.prova && ['sem-ficha', 'ficha-sem-assinatura', 'assinada-por-outra'].includes(l.prova.estado)).length;
  const total = L.length;
  const inicio = total === 1 ? '1 movimento registrado' : `${total} movimentos registrados`;
  if (!semProva) return `${inicio}. Todas as retiradas têm assinatura de quem pegou o carro.`;
  return semProva === 1
    ? `${inicio}. 1 retirada ficou sem assinatura de quem pegou o carro.`
    : `${inicio}. ${semProva} retiradas ficaram sem assinatura de quem pegou o carro.`;
}
