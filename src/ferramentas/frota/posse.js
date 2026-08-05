/* A POSSE DO CARRO — quem estava com ele, e quando.
 *
 * frota_uso guardava só VIAGEM: sai com tanto km, volta com tanto. Para quem
 * tem carro fixo isso não acontece nunca — ninguém "retira" e "devolve" o
 * próprio carro —, e por isso a tabela ficou vazia com 7 pessoas já tendo
 * acesso.
 *
 * Agora ela guarda também POSSE: uma linha aberta dizendo "este carro está com
 * esta pessoa desde esta data". O resultado é uma linha do tempo sem buraco, e
 * é ela que responde a pergunta que a multa faz — quem dirigia dia 14 às
 * 15h40. Foram R$ 1.301,60 perdidos por não ter essa resposta. */

const ehPosse = (u) => u && u.tipo === 'posse';

/** A posse aberta de um carro: com quem ele está agora. Nula se não há. */
export function posseAberta(usos, veiculoId) {
  return (usos || []).find((u) => ehPosse(u) && u.veiculo_id === veiculoId && !u.volta_em) || null;
}

/**
 * Passar o carro para outra pessoa. Devolve o que gravar:
 * `fechar` é o update na posse de quem estava, `abrir` é o insert da nova.
 * Qualquer um dos dois pode ser nulo — carro novo não tem o que fechar, e
 * devolver sem apontar ninguém não tem o que abrir.
 */
export function passarPara({ usos, veiculoId, para, quando }) {
  const atual = posseAberta(usos, veiculoId);
  return {
    fechar: atual ? { id: atual.id, volta_em: quando } : null,
    abrir: para ? {
      veiculo_id: veiculoId, tipo: 'posse',
      pessoa_id: para.id, pessoa_nome: para.nome, saida_em: quando,
    } : null,
  };
}

/**
 * Quem estava com o carro num instante. Nulo quando não se sabe — e "não sei"
 * é a resposta certa para antes de existir registro. Acusar alguém com dado
 * inventado é pior do que não responder.
 */
export function quemEstavaCom(usos, veiculoId, quando) {
  const t = String(quando);
  const valem = (usos || []).filter((u) =>
    u && u.veiculo_id === veiculoId
    && String(u.saida_em) <= t
    && (!u.volta_em || String(u.volta_em) >= t));
  if (!valem.length) return null;
  // VIAGEM VENCE POSSE: se alguém pegou o carro emprestado naquela hora, quem
  // estava dirigindo é essa pessoa, não o dono.
  const escolhida = valem.find((u) => (u.tipo || 'viagem') === 'viagem') || valem[0];
  return {
    pessoa_id: escolhida.pessoa_id || null,
    pessoa_nome: escolhida.pessoa_nome || null,
    uso: escolhida,
  };
}

/**
 * As posses que faltam abrir, na virada de chave: uma por carro ativo com dono
 * que ainda não tem posse aberta.
 *
 * A POSSE COMEÇA HOJE, NÃO NO PASSADO. Ninguém sabe desde quando cada carro
 * está com cada pessoa, e inventar essa data encheria a linha do tempo de
 * resposta falsa — a multa passaria a acusar alguém com um dado inventado.
 */
export function abrirPossesQueFaltam(veiculos, usos, agora) {
  return (veiculos || [])
    .filter((v) => v && v.pessoa_id && v.situacao === 'ativo' && !posseAberta(usos, v.id))
    .map((v) => ({ veiculo_id: v.id, tipo: 'posse', pessoa_id: v.pessoa_id, saida_em: agora }));
}
