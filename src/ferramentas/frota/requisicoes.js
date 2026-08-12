/* Requisição de uso: pedir o carro para uma data, e alguém aprovar.
 *
 * É o formulário de papel de hoje (Controle_Frota.pdf) virando tela. O manual
 * da planilha diz por que ele existe: "o ideal é fazer o pedido com 3 dias de
 * antecedência para não haver CONFLITO DE VIAGENS entre os departamentos".
 *
 * Esse conflito é justamente o que o papel não consegue ver — cada requisição
 * é uma folha solta, e ninguém compara as folhas. É a única coisa aqui que o
 * app faz e a pasta de PDFs nunca fez. */

export const SITUACOES = {
  pendente:  { rotulo: 'Aguardando aprovação', cor: 'espera' },
  aprovada:  { rotulo: 'Aprovada', cor: 'boa' },
  recusada:  { rotulo: 'Recusada', cor: 'ruim' },
  cancelada: { rotulo: 'Cancelada', cor: 'neutra' },
  usada:     { rotulo: 'Já usada', cor: 'neutra' },
};

export const ANTECEDENCIA_IDEAL_DIAS = 3;

const ms = (v) => { const t = Date.parse(v); return Number.isFinite(t) ? t : null; };
const DIA = 86400000;

/**
 * Duas reservas do MESMO veículo se atropelam?
 * Encostar não é conflito: quem devolve às 12h e quem pega às 12h passam a
 * chave na mão. Só cruzar conta.
 */
export function seAtropelam(a, b) {
  const ai = ms(a && a.retirada_prevista), af = ms(a && a.devolucao_prevista);
  const bi = ms(b && b.retirada_prevista), bf = ms(b && b.devolucao_prevista);
  if (ai === null || bi === null) return false;
  // Reserva sem hora de volta é tratada como o dia inteiro: quem não sabe
  // quando volta está ocupando o carro até o fim do dia, não por um instante.
  const fimA = af === null ? ai + DIA : af;
  const fimB = bf === null ? bi + DIA : bf;
  return ai < fimB && bi < fimA;
}

/** As reservas que disputam o carro com esta. Só pendente e aprovada disputam. */
export function conflitosDe(requisicao, todas) {
  if (!requisicao) return [];
  return (todas || []).filter((r) =>
    r && r.id !== requisicao.id
    && r.veiculo_id === requisicao.veiculo_id
    && (r.situacao === 'pendente' || r.situacao === 'aprovada')
    && seAtropelam(requisicao, r));
}

/**
 * Problemas de uma requisição ANTES de gravar. Devolve avisos em português.
 * Cada um traz `bloqueia`: true impede gravar, false é só um alerta.
 */
export function problemasDaRequisicao(req, todas, agoraIso) {
  const p = [];
  const agora = ms(agoraIso) ?? Date.now();
  const ini = ms(req && req.retirada_prevista);
  const fim = ms(req && req.devolucao_prevista);

  if (!req || !req.veiculo_id) p.push({ bloqueia: true, texto: 'Escolha o veículo.' });
  if (!req || !req.pessoa_id) p.push({ bloqueia: true, texto: 'Escolha quem vai dirigir.' });
  if (ini === null) {
    p.push({ bloqueia: true, texto: 'Informe quando você vai retirar o carro.' });
  } else {
    if (fim !== null && fim <= ini) {
      p.push({ bloqueia: true, texto: 'A devolução tem que ser depois da retirada.' });
    }
    if (ini < agora - DIA) {
      // Registrar viagem passada é legítimo (alguém esqueceu de pedir), mas
      // quase sempre é data digitada errada. Avisa e deixa seguir.
      p.push({ bloqueia: false, texto: 'Essa data já passou. Confirme se é isso mesmo.' });
    } else if (ini - agora < ANTECEDENCIA_IDEAL_DIAS * DIA) {
      p.push({
        bloqueia: false,
        texto: `O combinado é pedir com ${ANTECEDENCIA_IDEAL_DIAS} dias de antecedência, `
          + 'para não atropelar viagem de outro departamento. Dá pra pedir assim mesmo.',
      });
    }
  }
  if (!req || !String(req.destino || '').trim()) {
    p.push({ bloqueia: false, texto: 'Sem destino, quem aprova não sabe o que está aprovando.' });
  }

  for (const c of conflitosDe(req, todas)) {
    p.push({
      bloqueia: false,
      texto: `Esse carro já está reservado nesse horário${c.pessoa_nome ? ' por ' + c.pessoa_nome : ''}`
        + `${c.destino ? ' (' + c.destino + ')' : ''}. Escolha outro carro, outro horário, `
        + 'ou combine com quem pediu antes.',
    });
  }
  return p;
}

/** Só o que impede gravar. */
export function bloqueios(problemas) {
  return (problemas || []).filter((x) => x && x.bloqueia);
}

/**
 * Quem pode decidir esta requisição.
 *
 * ATÉ 12/08/2026 o solicitante ficava de fora, para a aprovação ser um segundo
 * par de olhos. O dono derrubou a regra, ciente do que se perde: com dois
 * aprovadores e a maior parte dos pedidos saindo dele mesmo, ela não produzia
 * revisão nenhuma — produzia requisição parada. Duas ficaram travadas desde
 * 11/08 sem saída nenhuma pela tela, e é isso que este `podeDecidir` conserta.
 *
 * O que NÃO se perde: `decidida_por` e `decidida_em` continuam gravando quem
 * decidiu. O rastro segue no banco; o que o dono dispensou foi o aviso na tela.
 */
export function podeDecidir({ requisicao, temPermissaoAprovar }) {
  if (!temPermissaoAprovar) return { pode: false, motivo: 'sem-permissao' };
  if (!requisicao || requisicao.situacao !== 'pendente') return { pode: false, motivo: 'ja-decidida' };
  return { pode: true, motivo: null };
}

/** A frase que a tela mostra quando não dá pra decidir.
 *
 * O caso 'propria' saiu junto com a regra que o produzia (12/08/2026). Não
 * ficou como resposta órfã de propósito: frase que a tela nunca mostra é frase
 * que alguém lê no código e acredita. */
export function motivoEmPortugues(motivo) {
  switch (motivo) {
    case 'ja-decidida': return 'Esta requisição já foi decidida.';
    case 'sem-permissao': return 'Você não aprova requisições de veículo.';
    default: return '';
  }
}

/** Ordena a fila de quem aprova: o que sai antes, primeiro. */
export function ordenarFila(reqs) {
  return (reqs || []).slice().sort((a, b) =>
    (ms(a.retirada_prevista) ?? Infinity) - (ms(b.retirada_prevista) ?? Infinity));
}

/** Data e hora do jeito que se lê em voz alta. */
export function quando(iso) {
  const t = ms(iso);
  if (t === null) return '—';
  const d = new Date(t);
  const data = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return `${data} às ${hora}`;
}

/**
 * Esta pessoa tem reserva APROVADA pra pegar este carro agora?
 *
 * De onde veio: até 12/08/2026 a aba Motorista tinha "Vou usar" ao lado de
 * "Reservar", e o dono mandou tirar o primeiro — com os dois lado a lado, quem
 * quisesse evitar o pedido bastava tocar no outro, e a aprovação virava enfeite.
 *
 * Mas tirar o botão sem mais nada abriria um buraco: aprovar NÃO cria o
 * registro de uso, então o carro nunca ficaria "na rua" e o "Devolver" nunca
 * apareceria. A saída escolhida pelo dono: o botão continua existindo, mas só
 * aparece no carro que JÁ FOI APROVADO pra aquela pessoa.
 *
 * A JANELA (`TOLERANCIA_RETIRADA_MS`) existe porque reserva não é hora marcada:
 * quem reservou pras 8h pega às 7h50 ou às 9h30, e a vida real não cabe no
 * minuto. Mas ela também não pode ser infinita — reserva de duas semanas atrás
 * não deve acender botão nenhum hoje.
 *
 * `usoJaAberto` é o que impede o botão de continuar aceso depois de a pessoa
 * pegar: com o carro já na rua, o que ela precisa é do "Devolver".
 */
export const TOLERANCIA_RETIRADA_MS = 12 * 60 * 60 * 1000;   // 12 horas

export function reservaParaPegar({ requisicoes, veiculoId, minhaPessoaId, agoraIso, usoJaAberto }) {
  if (!veiculoId || !minhaPessoaId || usoJaAberto) return null;
  const agora = ms(agoraIso) ?? Date.now();
  const minhas = (requisicoes || []).filter((r) =>
    r && r.veiculo_id === veiculoId
    && r.pessoa_id === minhaPessoaId
    && r.situacao === 'aprovada');

  for (const r of minhas) {
    const ini = ms(r.retirada_prevista);
    if (ini === null) continue;
    const fim = ms(r.devolucao_prevista);
    // Cedo demais: ainda não é hora de pegar. Tarde demais: passou da
    // devolução prevista (ou de 12h da retirada, quando não há devolução) e a
    // reserva não vale mais como autorização pra sair hoje.
    const limite = (fim === null ? ini : fim) + TOLERANCIA_RETIRADA_MS;
    if (agora >= ini - TOLERANCIA_RETIRADA_MS && agora <= limite) return r;
  }
  return null;
}
