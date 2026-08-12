/* Um lançamento, várias trocas.
 *
 * Hoje, registrar 3 trocas no mesmo carro é preencher o formulário 3 vezes:
 * item, KM, data, oficina e custo — 15 campos pra 3 trocas, com KM, data e
 * oficina redigitados a cada rodada. O resultado medido em 12/08/2026: a
 * frota inteira tem 2 trocas registradas em 10 carros. O dono chamou isso de
 * "difícil por ter que fazer um a um" e pediu urgência. Este módulo é a conta
 * por trás de UM lançamento com N itens — km, data e oficina digitados uma vez
 * só, virando N linhas de `frota_revisoes`.
 *
 * Não toca banco nem DOM: só a aritmética e a validação, pra decisão dar pra
 * testar sem abrir navegador.
 *
 * Um jeito de a frota rodar sem quase nenhuma revisão registrada é um
 * lançamento sem KM: `ultimaRevisao()` (revisoes.js) só considera linha com
 * `Number.isInteger(km)`, então uma troca gravada sem KM fica invisível pro
 * alerta — o item continua "vencido" pra sempre, mesmo já trocado. Por isso o
 * KM aqui é obrigatório, e a mensagem tem que dizer essa consequência, não só
 * pedir o campo. */

// Acima disso, um salto de KM entre duas revisões é quase certamente número
// digitado errado (ex.: dígito extra) — nenhum carro da frota anda 200.000 km
// entre duas idas à oficina. Não bloqueia: só pede confirmação, do mesmo jeito
// que revisoes.js trata o `aCadaKm` fora da faixa (problemasDoItem).
export const SALTO_ABSURDO_KM = 200000;

const kmFmt = (n) => Math.abs(n).toLocaleString('pt-BR');
const reaisFmt = (centavos) =>
  (Math.abs(centavos) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Problemas de um lançamento de manutenção ANTES de gravar. Devolve avisos em
 * português; cada um traz `bloqueia`: true impede gravar, false é só um alerta.
 */
export function problemasDoLancamento({ km, itens, kmConhecido }) {
  const p = [];

  if (km === null || km === undefined || km === '') {
    p.push({
      bloqueia: true,
      texto: 'Informe o KM. Sem ele, esta troca não entra no alerta de revisão — '
        + 'o item continuaria aparecendo como vencido pra sempre, mesmo já trocado. '
        + 'Avisar sobre a próxima troca depende deste número.',
    });
  } else if (!Number.isInteger(km) || km < 0) {
    p.push({ bloqueia: true, texto: 'KM inválido — não pode ser negativo. Confira o número.' });
  } else if (Number.isInteger(kmConhecido)) {
    if (km < kmConhecido) {
      // Painel trocado na oficina zera o odômetro de verdade — mesmo
      // tratamento que o checklist já dá em hodometro_justificativa.
      p.push({
        bloqueia: false,
        texto: `O KM informado (${km.toLocaleString('pt-BR')}) é menor que o maior já conhecido `
          + `deste carro (${kmConhecido.toLocaleString('pt-BR')}). Isso é normal quando o painel foi `
          + 'trocado na oficina — confirme antes de gravar.',
      });
    } else if (km - kmConhecido > SALTO_ABSURDO_KM) {
      p.push({
        bloqueia: false,
        texto: `São ${kmFmt(km - kmConhecido)} km de salto desde o último KM conhecido `
          + `(${kmConhecido.toLocaleString('pt-BR')}). Confirme se o número está certo antes de gravar.`,
      });
    }
  }

  const lista = itens || [];
  if (!lista.length) {
    p.push({ bloqueia: true, texto: 'Marque pelo menos um item — o que foi trocado nesta visita à oficina?' });
  } else {
    // Duas linhas do mesmo item no mesmo serviço dariam dois alertas pra
    // mesma troca — o mesmo motivo que problemasDoItem() (revisoes.js) barra
    // nome repetido no plano.
    const vistos = new Set();
    for (const it of lista) {
      const nome = String((it && it.item) || '').trim().toLowerCase();
      if (nome && vistos.has(nome)) {
        p.push({
          bloqueia: true,
          texto: `"${it.item}" aparece duas vezes neste lançamento — junte numa linha só. `
            + 'Duas entradas do mesmo item dariam dois alertas para a mesma troca.',
        });
      }
      vistos.add(nome);
    }
  }

  return p;
}

/**
 * O total da nota raramente bate com a soma dos itens digitados — falta a
 * mão de obra, ou uma peça não entrou na lista. A decisão do dono: não
 * rateia o total pelos itens (inventaria um preço de peça que não existe) e
 * não repete o total em cada linha (somaria o total N vezes). A tela só
 * DIZ a diferença, em reais, e deixa gravar assim mesmo.
 *
 * Devolve `{ soma, diferenca, texto }`, ou `null` quando não há divergência
 * pra dizer: sem total, sem nenhum item com valor, ou soma exata.
 */
export function diferencaDeValores({ totalCentavos, itens }) {
  if (!Number.isInteger(totalCentavos)) return null;
  const comValor = (itens || []).filter((i) => i && Number.isInteger(i.valorCentavos));
  if (!comValor.length) return null;

  const soma = comValor.reduce((acc, i) => acc + i.valorCentavos, 0);
  const diferenca = totalCentavos - soma;
  if (diferenca === 0) return null;

  const texto = diferenca > 0
    ? `Os itens somam R$ ${reaisFmt(soma)}, mas o total informado é R$ ${reaisFmt(totalCentavos)} `
      + `— R$ ${reaisFmt(diferenca)} de diferença, provavelmente mão de obra ou uma peça que não `
      + 'entrou na lista. Isso não impede gravar.'
    : `Os itens somam R$ ${reaisFmt(soma)}, R$ ${reaisFmt(diferenca)} mais que o total informado `
      + `(R$ ${reaisFmt(totalCentavos)}). Confira os valores — mas isso não impede gravar.`;

  return { soma, diferenca, texto };
}

/**
 * As linhas de `frota_revisoes` que este lançamento grava — uma por item
 * marcado. KM, data e oficina do cabeçalho são digitados uma vez só, aqui e
 * repetidos em cada linha: é o que faz o alerta (`ultimaRevisao()`) funcionar
 * por item, e não redundância.
 */
export function linhasParaGravar({ manutencaoId, veiculoId, km, feitaEm, oficina, itens }) {
  return (itens || []).map((it) => ({
    manutencao_id: manutencaoId,
    veiculo_id: veiculoId,
    item: String((it && it.item) || '').trim(),
    km,
    // Data em branco grava nulo. Inventar a data de hoje seria a tela
    // mentindo sobre quando o serviço foi feito.
    feita_em: feitaEm ? feitaEm : null,
    oficina: oficina ? oficina : null,
    // Item sem valor grava nulo, não zero — zero diria "de graça".
    custo_centavos: Number.isInteger(it && it.valorCentavos) ? it.valorCentavos : null,
  }));
}
