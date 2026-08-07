/* De quem é este telefone, quando o cadastro do colaborador não tem um.
 *
 * O CASO REAL que motivou isto: o quadro "Checklist de hoje" só olhava
 * `acessos_pessoas` pra achar telefone, e dizia "sem telefone" pra Marcus e
 * pro Thiago Siqueira — que TÊM telefone, só que ele mora na ficha do carro
 * (`frota_veiculos.contato_nome`/`contato_telefone`), não no cadastro da
 * pessoa.
 *
 * A ARMADILHA: o contato do carro nem sempre é quem dirige. No Honda Fit (um
 * carro de rodízio, sem dono fixo) o contato é a Bárbara, que é supervisora
 * de lojas — puxar esse telefone cego mandaria "seu checklist está atrasado"
 * pra quem nunca pegou aquele carro. Por isso este módulo não devolve só um
 * telefone: devolve TAMBÉM de quem ele é, pra tela poder avisar quando não é
 * a pessoa que está sendo cobrada.
 */

import { telefoneDaCobranca } from '../../../supabase/functions/_shared/checklist.js';

/** Tira acento e caixa alta — "Bárbara" e "BARBARA" têm de bater. */
function normalizarNome(s) {
  return String(s || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/** As palavras que contam pra comparação: sem acento/caixa, e sem as curtas
 * demais ("de", "da", "e") pra elas nunca decidirem um "bate" sozinhas. */
function palavrasSignificativas(s) {
  return normalizarNome(s).split(/\s+/).filter((p) => p.length >= 3);
}

/**
 * Compara dois nomes de um jeito tolerante — mas SÓ tolerante de menos pra
 * mais, nunca de mais pra menos. A ficha do carro guarda "Marcus" e o
 * colaborador é "Marcus Vinicius" — comparar a string inteira nunca bateria,
 * então quando um dos dois nomes é UMA palavra só, basta ela aparecer no
 * outro (é como o campo é preenchido de verdade: um pedaço que já identifica
 * a pessoa entre quem mexe naquele carro).
 *
 * Mas quando OS DOIS nomes têm mais de uma palavra, uma palavra em comum não
 * basta — a base real tem 3 "Vieira" (Ana, Jeremias, Theo) e 2 "Clara"
 * (Beduschi, Marques), e a versão antiga desta função dava
 * `nomesBatem('Ana Vieira', 'Theo Vieira') === true`: duas pessoas
 * diferentes, casadas só por dividirem o sobrenome. Pra dois nomes de mais
 * de uma palavra, exige-se que TODAS as palavras do menor apareçam no maior
 * — "Ana Vieira" só bate com um nome que tenha "ana" E "vieira", nunca só
 * um dos dois.
 *
 * Isto também é a resposta pro caso ambíguo (revisão pediu pra decidir): a
 * função não conhece um diretório de pessoas, então não tem como saber que
 * "Vieira" sozinho é ambíguo entre três. O que ela garante é o lado seguro
 * do erro — quando a comparação é mais fraca que "todas as palavras batem",
 * ela devolve `false`, e `false` aqui vira `origem: 'carro_outra_pessoa'`
 * em contatoParaCobranca(): a tela MOSTRA o aviso de "pode não ser quem
 * dirige" em vez de apagá-lo. Nunca o contrário — falso positivo é que
 * apagaria o aviso calado, que é o defeito que esta função existe pra
 * evitar.
 *
 * Nomes vazios nunca batem — sem essa guarda, dois campos em branco
 * (`''` === `''`) passariam como "é a mesma pessoa".
 */
export function nomesBatem(a, b) {
  const palavrasA = palavrasSignificativas(a);
  const palavrasB = palavrasSignificativas(b);
  if (!palavrasA.length || !palavrasB.length) return false;

  const [menor, maior] = palavrasA.length <= palavrasB.length ? [palavrasA, palavrasB] : [palavrasB, palavrasA];
  const maiorSet = new Set(maior);

  // Uma palavra só do lado mais curto: o caso comum (Marcus, Siqueira,
  // Bárbara, Erick) — basta ela estar no outro nome.
  if (menor.length === 1) return maiorSet.has(menor[0]);

  // Duas palavras ou mais dos dois lados: TODAS as palavras do menor têm de
  // estar no maior. Um sobrenome sozinho em comum (só "vieira", só "clara")
  // não é o bastante.
  return menor.every((p) => maiorSet.has(p));
}

/**
 * Decide QUAL telefone usar pra cobrar o motorista, e de quem ele é —
 * decisão do dono, com três desfechos:
 *  - 'colaborador': o cadastro em Colaboradores e Acessos tem telefone. Caso
 *    comum, botão normal.
 *  - 'carro_mesma_pessoa': o cadastro está vazio, mas a ficha do carro tem
 *    contato e o nome bate com o do motorista — é o telefone dele mesmo,
 *    só que mora no lugar errado. Botão normal.
 *  - 'carro_outra_pessoa': a ficha do carro tem contato, mas o nome NÃO bate
 *    com o motorista (ex.: o Honda Fit é de rodízio e o contato é a
 *    supervisora). A tela tem de avisar que quem atende não é quem dirige.
 *  - 'nenhum': não há telefone em lugar nenhum. Continua dizendo que falta,
 *    como já fazia.
 */
export function contatoParaCobranca({ pessoa, veiculo }) {
  const telColaborador = telefoneDaCobranca(pessoa);
  if (telColaborador) {
    return { telefone: telColaborador, origem: 'colaborador', nomeContato: pessoa ? pessoa.nome : null };
  }

  const telCarro = veiculo && veiculo.contato_telefone;
  if (telCarro) {
    const mesmaPessoa = nomesBatem(veiculo.contato_nome, pessoa ? pessoa.nome : null);
    return {
      telefone: telCarro,
      origem: mesmaPessoa ? 'carro_mesma_pessoa' : 'carro_outra_pessoa',
      nomeContato: veiculo.contato_nome || null,
    };
  }

  return { telefone: null, origem: 'nenhum', nomeContato: null };
}

/**
 * Só oferece "copiar telefone pro cadastro" quando é seguro fazer isso:
 *  - o carro tem telefone E o nome do contato bate com o do colaborador (é o
 *    telefone dele mesmo, não de outra pessoa que atende por ele);
 *  - o colaborador está mesmo sem telefone (senão a cópia sobrescreveria algo
 *    que a pessoa já tinha digitado).
 * Nunca oferece pra 'carro_outra_pessoa': copiar o telefone da Bárbara pro
 * cadastro de quem pega o Honda Fit de rodízio gravaria um dado errado, não
 * devolveria o dado certo.
 */
export function podeCopiarTelefoneDoCarro({ pessoa, veiculo }) {
  if (!pessoa || telefoneDaCobranca(pessoa)) return false;
  const telCarro = veiculo && veiculo.contato_telefone;
  if (!telCarro) return false;
  return nomesBatem(veiculo.contato_nome, pessoa.nome);
}
