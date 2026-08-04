/* Onde está cada carro, e o que fazer com ele.
 *
 * Esta é a tela que a empresa já olha hoje (a aba "Resumo Geral" da planilha).
 * A diferença do que existe: o KM atual NÃO é um campo que alguém digita — sai
 * da última devolução. Na planilha, a coluna "KM Atual" é preenchida à mão, e
 * é por isso que a aba "Alertas" nasceu vazia: o número que alimenta o alerta
 * nunca chega. */

export const NIVEIS_TANQUE = ['Reserva', '1/4', '2/4', '3/4', 'Cheio'];

/** O ponteiro do tanque como a pessoa lê no painel. */
export function rotuloDoTanque(quartos) {
  if (quartos === null || quartos === undefined || quartos === '') return '—';
  return NIVEIS_TANQUE[quartos] || '—';
}

/** Tanque em 1/4 ou menos pede combustível antes da próxima saída. */
export function precisaAbastecer(quartos) {
  return Number.isInteger(quartos) && quartos <= 1;
}

/** O uso ainda aberto de um veículo — o que está na rua agora. Nulo se não há. */
export function usoAberto(usos, veiculoId) {
  return (usos || []).find((u) => u && u.veiculo_id === veiculoId && !u.volta_em) || null;
}

/** O último uso ENCERRADO, que é de onde sai o KM atual. */
export function ultimoUsoFechado(usos, veiculoId) {
  const fechados = (usos || [])
    .filter((u) => u && u.veiculo_id === veiculoId && u.volta_em && Number.isInteger(u.km_volta));
  if (!fechados.length) return null;
  // Ordena pela VOLTA, não pela saída: quem devolveu por último é quem tem o
  // odômetro mais recente, mesmo que tenha saído antes de outro.
  return fechados.slice().sort((a, b) => String(b.volta_em).localeCompare(String(a.volta_em)))[0];
}

/**
 * Monta a linha da tela para um veículo: onde está, com quem, KM e tanque.
 * Não inventa nada: campo sem resposta volta nulo, e a tela mostra travessão.
 */
export function estadoDoVeiculo(veiculo, usos) {
  const aberto = usoAberto(usos, veiculo.id);
  const fechado = ultimoUsoFechado(usos, veiculo.id);
  // O KM mais alto que se conhece. Quando o carro está na rua, o KM de saída
  // pode ser mais recente que a última devolução.
  const kms = [fechado && fechado.km_volta, aberto && aberto.km_saida].filter(Number.isInteger);
  const km = kms.length ? Math.max(...kms) : null;
  // O tanque também vem do registro mais recente que tiver informado.
  const ultimo = aberto || fechado;
  const tanque = ultimo && Number.isInteger(ultimo.tanque_quartos) ? ultimo.tanque_quartos : null;

  return {
    veiculo,
    naRua: !!aberto,
    // Pessoa e local são SEPARADOS (decisão do dono): quem está com o carro
    // agora vence o responsável fixo; parado, mostra onde ele está.
    comQuem: aberto ? (aberto.pessoa_nome || null) : (veiculo.pessoa_nome || null),
    // Quem está com ele AGORA, por identificador. A área Motorista usa isto
    // pra separar "o meu carro" de "o carro de outra pessoa" — comparar por
    // nome quebraria com dois Gabriéis, e a empresa tem dois.
    usoAbertoPessoaId: aberto ? (aberto.pessoa_id || null) : null,
    ondeEsta: aberto ? null : (veiculo.local_texto || null),
    desde: aberto ? aberto.saida_em : (fechado ? fechado.volta_em : null),
    km,
    tanque,
    precisaAbastecer: precisaAbastecer(tanque),
    // LIVRE é só o carro que não está na rua E não tem responsável fixo.
    // Correção do dono: "os carros que têm nome atrelado não estão livres" —
    // o Volvo do Humberto não está esperando alguém pegar, ele é o carro do
    // Humberto. Oferecer esses como disponíveis convidava a pegar o carro de
    // outra pessoa.
    disponivel: !aberto && veiculo.situacao === 'ativo' && !veiculo.pessoa_id,
  };
}

/** A frase curta que resume a linha, pra quem só bate o olho. */
export function resumoDoEstado(e) {
  if (!e) return '';
  if (e.veiculo.situacao === 'em_manutencao') return 'Na oficina';
  if (e.veiculo.situacao === 'alienado') return 'Fora da frota';
  if (e.veiculo.situacao === 'inativo') return 'Parado';
  if (e.naRua) return e.comQuem ? `Na rua com ${e.comQuem}` : 'Na rua';
  // Carro com responsável NÃO é livre — e o texto tem que dizer isso. A
  // primeira versão escrevia "Livre, com Humberto", que se contradiz na mesma
  // frase e fazia a pessoa achar que podia pegar.
  if (e.comQuem) return `Com ${e.comQuem}`;
  if (e.ondeEsta) return `Livre, em ${e.ondeEsta}`;
  return 'Livre';
}

/** Ordena a lista do jeito que ajuda: o que está livre primeiro, sucata por último. */
export function ordenarEstados(estados) {
  const peso = (e) => {
    if (e.veiculo.situacao === 'alienado') return 4;
    if (e.veiculo.situacao === 'inativo') return 3;
    if (e.veiculo.situacao === 'em_manutencao') return 2;
    return e.naRua ? 1 : 0;
  };
  return (estados || []).slice().sort((a, b) =>
    peso(a) - peso(b) || String(a.veiculo.nome || '').localeCompare(String(b.veiculo.nome || '')));
}

/**
 * Valida uma devolução ANTES de gravar. Devolve a lista de problemas em
 * português; vazia significa que pode gravar.
 */
export function problemasDaDevolucao({ kmSaida, kmVolta }) {
  const p = [];
  if (!Number.isInteger(kmVolta) || kmVolta <= 0) {
    p.push('Informe o KM que está no painel agora.');
  } else if (Number.isInteger(kmSaida)) {
    if (kmVolta < kmSaida) {
      p.push(`O KM de volta (${kmVolta.toLocaleString('pt-BR')}) é menor que o da saída `
        + `(${kmSaida.toLocaleString('pt-BR')}). Confira o número no painel.`);
    } else if (kmVolta - kmSaida > 5000) {
      // Não impede: viagem longa existe. Mas 5.000 km numa saída é quase sempre
      // dedo errado, e é melhor perguntar do que gravar um odômetro falso que
      // depois dispara alerta de revisão sem motivo.
      p.push(`São ${(kmVolta - kmSaida).toLocaleString('pt-BR')} km nesta saída. `
        + 'Confirme se está certo antes de gravar.');
    }
  }
  return p;
}
