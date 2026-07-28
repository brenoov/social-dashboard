// O ALVO de cada tipo de campanha: quanto o dono aceita pagar por um resultado,
// na unidade que faz sentido para aquele objetivo.
//
// A regra que amarra tudo: TODA meta aqui é "custo por resultado, MENOR É MELHOR".
// É isso que permite um semáforo só para a ferramenta inteira. Por isso vendas usa
// CAC (custo por compra) e não ROAS — ROAS é maior-é-melhor e precisaria de uma
// régua invertida, uma segunda régua para manter na cabeça.
//
// Engajamento é o único cujo "resultado" não é uma ação da Meta e sim o PONTO da
// métrica ponderada. Ou seja: a ponderada não é um bicho à parte, é o alvo deste
// balde. PURO: sem rede, sem tela.
import { faixaDoIndice } from './ponderada.js';

export const ALVOS = {
  engajamento: {
    metrica: 'ponderada', rotulo: 'Custo por ponto', unidade: 'R$',
    ajuda: 'Ponto é a nota que damos a cada interação conforme o quanto ela vale: curtir vale 1, salvar vale 30.',
  },
  reconhecimento: {
    metrica: 'cpm', rotulo: 'Custo por mil pessoas alcançadas', unidade: 'R$',
    ajuda: 'Campanha de reconhecimento existe para aparecer. O preço justo é por mil impressões.',
  },
  trafego: {
    metrica: 'custo_visita', rotulo: 'Custo por visita', unidade: 'R$',
    ajuda: 'Quanto você aceita pagar por cada pessoa que realmente chegou no destino.',
  },
  mensagens: {
    metrica: 'custo_conversa', rotulo: 'Custo por conversa iniciada', unidade: 'R$',
    ajuda: 'Cada conversa de WhatsApp aberta. É o resultado que essa campanha compra.',
  },
  leads: {
    metrica: 'custo_lead', rotulo: 'Custo por lead', unidade: 'R$',
    ajuda: 'Quanto você aceita pagar por cadastro recebido.',
  },
  vendas: {
    metrica: 'cac', rotulo: 'Custo por venda', unidade: 'R$',
    ajuda: 'Quanto custa trazer uma venda. Usamos custo por venda (e não ROAS) para toda a ferramenta ter uma régua só.',
  },
};

// Sem alvo definido devolve null — e null faz o veredito cair na leitura de saúde
// daquele objetivo, que é melhor do que inventar um alvo qualquer.
export function alvoDoBalde(balde) {
  return (balde && ALVOS[balde]) || null;
}

export function avaliarAlvo(entrada) {
  const e = entrada || {};
  const custo = Number(e.custo);
  const meta = Number(e.meta);
  const temCusto = e.custo != null && Number.isFinite(custo) && custo >= 0;
  const temMeta = Number.isFinite(meta) && meta > 0;
  const indice = (temCusto && temMeta) ? custo / meta : null;
  return { indice, faixa: faixaDoIndice(indice, e.limiares) };
}
