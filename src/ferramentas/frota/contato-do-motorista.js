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

/**
 * Compara dois nomes de um jeito tolerante: a ficha do carro guarda "Marcus"
 * e o colaborador é "Marcus Vinicius" — comparar a string inteira nunca
 * bateria. Aqui basta uma PALAVRA em comum, de 3 letras ou mais (pra não
 * confundir por causa de "de"/"da"/"e"). Nomes vazios nunca batem — sem essa
 * guarda, dois campos em branco (`''` === `''`) passariam como "é a mesma
 * pessoa".
 */
export function nomesBatem(a, b) {
  const na = normalizarNome(a);
  const nb = normalizarNome(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const palavrasA = na.split(/\s+/).filter((p) => p.length >= 3);
  const palavrasB = new Set(nb.split(/\s+/).filter((p) => p.length >= 3));
  return palavrasA.some((p) => palavrasB.has(p));
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
