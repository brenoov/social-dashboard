/* ACHAR A PASTA DO ZOHO PELO NOME — nunca pelo id escrito no código.
 *
 * Desenho: docs/superpowers/specs/2026-08-06-frota-checklist-assinatura-design.md (D23)
 *
 * POR QUE PELO NOME, E NÃO POR UM ID FIXO: o id da pasta "01. Gestão de
 * Serviços" no WorkDrive existe e está gravado em `acessos_recursos` desde a
 * importação de 17/07/2026 — mas ele veio de UMA importação, de UM dia. Se
 * alguém recriar a pasta (ou reorganizar a numeração), o id muda e um id
 * gravado no código continuaria apontando, CALADO, pro lugar errado. Mandar
 * 150 PDFs por mês pra pasta errada é pior do que não mandar nenhum: ninguém
 * percebe.
 *
 * POR QUE O PREFIXO NUMÉRICO É TOLERADO: a empresa numera as pastas ("01. ",
 * "02. ") pra controlar a ordem em que elas aparecem. Esse número MUDA quando
 * reorganizam — é ordenação, não identidade. Então "Gestão de Serviços" e
 * "01. Gestão de Serviços" são a mesma pasta pra esta busca.
 *
 * A REGRA QUE NÃO SE NEGOCIA: achou uma, usa. Achou nenhuma ou mais de uma, o
 * envio FALHA dizendo qual nome foi procurado e o que fazer — nunca escolhe a
 * primeira que apareceu. */

/**
 * O nome reduzido ao que importa pra comparar: sem acento, sem maiúscula, sem
 * espaço sobrando. NÃO tira o prefixo numérico — quem faz isso é `semPrefixo`,
 * porque as duas formas são comparadas.
 */
export function nomeComparavel(nome) {
  return String(nome ?? '')
    // NFD separa a letra do acento ("ã" vira "a" + til), e ̀-ͯ é
    // exatamente a faixa dos acentos soltos. Sem isto, "Gestao" e "Gestão"
    // seriam pastas diferentes — e o nome é digitado das duas formas
    // dependendo de quem criou a pasta.
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * O mesmo nome, sem o número de ordenação da frente ("01. ", "2 - ", "3) ").
 *
 * Só tira quando SOBRA alguma coisa depois: uma pasta chamada só "2026" tem
 * que continuar sendo "2026", senão viraria nome vazio e casaria com qualquer
 * outra pasta de nome vazio — casamento por acidente, que é o oposto do que
 * esta busca existe pra fazer.
 */
export function semPrefixo(nome) {
  const limpo = nomeComparavel(nome);
  const cortado = limpo.replace(/^\d+\s*[.\-)]?\s+/, '');
  return cortado || limpo;
}

// As duas formas do mesmo nome. Duas pastas casam quando QUALQUER forma de uma
// é igual a QUALQUER forma da outra — assim funciona tanto procurar
// "Gestão de Serviços" e achar "01. Gestão de Serviços" quanto o contrário.
const formas = (nome) => [nomeComparavel(nome), semPrefixo(nome)];

/**
 * Procura UMA pasta pelo nome dentro da lista que já está no banco
 * (`acessos_recursos`, provedor zoho, tipo workdrive, não arquivadas).
 *
 * `pastas` são linhas com { nome, external_id, caminho }.
 *
 * Devolve `{ pasta }` quando achou exatamente uma, ou `{ erro }` com a frase
 * pronta pra gravar em `ultimo_erro` — a frase diz o nome procurado, onde foi
 * procurado, e o que fazer. Erro que só diz "não achei" obriga quem lê a
 * adivinhar, e ninguém adivinha três semanas depois.
 */
export function acharPasta(pastas, nomeProcurado) {
  const alvo = formas(nomeProcurado);
  const lista = Array.isArray(pastas) ? pastas : [];
  const achadas = lista.filter((p) => {
    const minhas = formas(p && p.nome);
    return minhas.some((m) => m && alvo.includes(m));
  });

  if (achadas.length === 1) return { pasta: achadas[0], erro: null };

  if (achadas.length === 0) {
    return {
      pasta: null,
      erro: `Não achei a pasta "${nomeProcurado}" na lista de pastas do Zoho WorkDrive que a `
        + `central conhece (${lista.length} ${lista.length === 1 ? 'pasta' : 'pastas'} importadas). `
        + 'Abra Acessos → Pastas e clique em importar as pastas do WorkDrive de novo; se a pasta '
        + 'mudou de nome, avise quem administra a Frota para acertar o nome que o robô procura.',
    };
  }

  // MAIS DE UMA: parar é o certo. Escolher "a primeira" mandaria o documento
  // pra uma pasta que ninguém escolheu, e o erro só apareceria quando alguém
  // fosse procurar o papel de um checklist de meses atrás.
  const nomes = achadas.map((p) => `"${p.nome}"`).join(', ');
  return {
    pasta: null,
    erro: `Achei mais de uma pasta com o nome "${nomeProcurado}" no Zoho WorkDrive: ${nomes}. `
      + 'Não dá pra escolher sozinho sem arriscar arquivar no lugar errado. Renomeie uma delas no '
      + 'WorkDrive, reimporte as pastas em Acessos → Pastas, e o envio segue na próxima tentativa.',
  };
}
