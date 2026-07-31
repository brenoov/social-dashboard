// Sugestão de interesses: a parte PURA.
//
// Monta o que a IA recebe e filtra o que a Meta devolve. Sem rede, sem banco —
// por isso dá pra testar a decisão inteira sem gastar um centavo de IA nem
// tocar numa conta de anúncios.
//
// REGRA QUE ATRAVESSA O ARQUIVO: toda lista que chega aqui vem de fora (banco,
// IA, Meta) e pode ter item nulo, item sem os campos esperados, ou campo do
// tipo errado. Item ruim é PULADO; nunca quebra e nunca vira texto lixo do tipo
// "undefined" no meio do pedido.

import { ALVOS } from '../../src/ferramentas/gestao-trafego/alvos.js';

// As chaves saem da régua, não são redigitadas: uma sétima nomenclatura aqui
// garantiria divergência com o resto da ferramenta.
export const OBJETIVOS = Object.keys(ALVOS);

// O nome do objetivo em português, para o pedido e para a tela.
// NÃO existe no projeto um mapa balde → nome: `alvos.js` guarda o rótulo da
// MÉTRICA de cada balde ('Custo por ponto'), e `baldes.js` traduz o objetivo da
// Meta para a chave do balde. Este mapa preenche essa lacuna, e há teste
// garantindo que ele cobre exatamente OBJETIVOS — nem a mais, nem a menos.
export const NOME_DO_OBJETIVO = {
  engajamento: 'Engajamento',
  reconhecimento: 'Reconhecimento de marca',
  trafego: 'Tráfego para o site',
  mensagens: 'Conversas no WhatsApp ou Direct',
  leads: 'Cadastros (leads)',
  vendas: 'Vendas',
};

const lista = (v) => (Array.isArray(v) ? v : []);
const texto = (v) => (typeof v === 'string' ? v.trim() : '');

// Tira o que poderia quebrar a estrutura do pedido: newlines criam novas seções,
// e um campo gigantesco domina a requisição. Preserva aspas e apóstrofos — legítimos
// em nomes (Casa D'Oro, Loja D'Água, Sant'Ana).
const limpo = (s) => texto(s).replace(/[\n\r\x00-\x1f]/g, ' ').replace(/\s{2,}/g, ' ').trim().substring(0, 200);

function cidadesDaLoja(loja) {
  return lista(loja && loja.geo_cities)
    .map((c) => limpo(c && c.nome))
    .filter((n) => n.length > 0);
}

function descreverLojas(lojas) {
  const linhas = [];
  for (const loja of lista(lojas)) {
    const nome = limpo(loja && loja.nome);
    if (!nome) continue;                      // loja nula ou sem nome: pulada
    const cidades = cidadesDaLoja(loja);
    linhas.push(cidades.length ? `- ${nome} (atende ${cidades.join(', ')})` : `- ${nome}`);
  }
  return linhas;
}

// O que a IA recebe. SÓ dado do cadastro — não existe campo de texto livre em
// lugar nenhum deste fluxo, e é isso que fecha a porta de injeção de instrução.
export function montarPedido({ marca, lojas, objetivo } = {}) {
  if (!OBJETIVOS.includes(objetivo)) return null;
  const nomeMarca = limpo(marca && marca.nome);
  if (!nomeMarca) return null;

  // ATENÇÃO: `ALVOS[x].rotulo` é o rótulo da MÉTRICA, não do objetivo —
  // engajamento tem rotulo 'Custo por ponto'. Dizer à IA "Objetivo da campanha:
  // Custo por ponto" seria absurdo. Por isso o nome do objetivo vem daqui, e o
  // `ajuda` de ALVOS entra só como contexto extra do que se está medindo.
  // Fallback: se a chave não está no mapa (divergência com ALVOS), usa a chave
  // mesmo. Nunca vira "undefined" no pedido.
  const nomeObjetivo = NOME_DO_OBJETIVO[objetivo] || objetivo;
  const ajuda = limpo((ALVOS[objetivo] || {}).ajuda);
  const linhasLojas = descreverLojas(lojas);

  const system =
    'Você sugere interesses de segmentação do Meta Ads para lojas brasileiras. ' +
    'Responda só com nomes de interesse que existam de verdade no Meta, em português do Brasil, ' +
    'do jeito que aparecem no Gerenciador de Anúncios. Nada de explicação, nada de invenção.';

  const user = [
    `Marca: ${nomeMarca}`,
    linhasLojas.length ? `Lojas:\n${linhasLojas.join('\n')}` : 'Lojas: não cadastradas',
    `Objetivo da campanha: ${nomeObjetivo}${ajuda ? ` (medido por: ${ajuda})` : ''}`,
    '',
    'Sugira até 12 interesses do Meta que façam sentido para ESTE objetivo desta marca.',
    'Prefira interesses que o Gerenciador de Anúncios realmente tenha; nomes inventados serão descartados.',
  ].join('\n');

  return { system, user };
}
