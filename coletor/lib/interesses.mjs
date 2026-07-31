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

// As cidades de uma loja, prontas pra entrar no pedido.
//
// FORMATO REAL DO BANCO: `fabrica_lojas.geo_cities` guarda CHAVES da Meta, não
// nomes — a migration 018 semeou '[267873,241913]' e a Fábrica lê a coluna assim
// (painel-subir.vue trata cada item como chave). Chave pelada NÃO é lixo: é o
// formato de verdade. Só que ela não tem nome pra escrever no pedido.
//
// Quem traduz chave → nome é quem tem rede: o robô pergunta à Meta antes de
// montar o pedido e entrega os itens já no formato { key, nome }. Por isso os
// DOIS formatos entram aqui:
//   { key, nome } → cidade resolvida, o nome vai pro pedido;
//   267873 / '267873' → chave crua (a Meta não respondeu, ou a cidade não voltou):
//     a loja entra no pedido sem geografia, em vez de entrar com "267873" — que
//     não diz nada pra IA e ainda parece um nome de cidade quebrado.
// Lixo de verdade (null, {}, '', tipo errado) também sai, pelo mesmo caminho.
function cidadesDaLoja(loja) {
  const saida = [];
  for (const c of lista(loja && loja.geo_cities)) {
    if (c == null) continue;
    // Chave crua (número ou texto): formato legítimo, mas sem nome pra mostrar.
    if (typeof c !== 'object') continue;
    const nome = limpo(c.nome);
    if (nome) saida.push(nome);
  }
  return saida;
}

// Troca as CHAVES de cidade de uma loja pelos NOMES que a Meta devolveu.
//
// Fica aqui, no arquivo puro, porque é decisão — não é rede: quem fala com a
// Meta é o robô, que passa o mapa { chave: nome } pronto. Assim a regra de "o
// que fazer com a chave que a Meta não reconheceu" tem teste, sem chamada paga.
//
// Chave sem nome fica COMO ESTÁ (crua). Não se inventa nome, e não se apaga a
// entrada: apagar esconderia que a loja tem cidade cadastrada, e inventar
// colocaria um número no lugar de um nome de cidade dentro do pedido.
export function comCidadesResolvidas(loja, nomes) {
  const mapa = (nomes && typeof nomes === 'object') ? nomes : {};
  return {
    ...loja,
    geo_cities: lista(loja && loja.geo_cities).map((c) => {
      if (c == null || typeof c === 'object') return c;   // já resolvida, ou lixo: não mexe
      const nome = limpo(mapa[String(c)]);
      return nome ? { key: String(c), nome } : c;
    }),
  };
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

// O que a IA devolveu, limpo. A resposta vem de `structured()`, que já garante
// a forma — mas garantir forma não garante conteúdo, então nome vazio, nome que
// não é texto e repetido saem aqui.
export function nomesPropostos(resposta) {
  const brutos = lista(resposta && resposta.interesses);
  const vistos = new Set();
  const saida = [];
  for (const b of brutos) {
    const nome = limpo(b);
    if (!nome || vistos.has(nome.toLowerCase())) continue;
    vistos.add(nome.toLowerCase());
    saida.push(nome);
  }
  return saida;
}

// A META DECIDE, NÃO A IA. O que a Meta não reconheceu é descartado aqui e
// nunca chega na tabela — sem isso a tela mostraria sugestões bonitas que
// dariam erro na hora de usar, que é pior do que não sugerir nada.
//
// Devolve também quantos foram propostos x quantos sobraram: se a taxa de
// aproveitamento vier baixa, o número aparece no log e o pedido é ajustado.
export function filtrarValidos(propostos, respostaMeta) {
  const linhas = lista(respostaMeta && respostaMeta.data);
  const vistos = new Set();
  const itens = [];
  for (const l of linhas) {
    if (!l || typeof l !== 'object') continue;   // item nulo ou lixo: pulado
    if (l.valid !== true) continue;              // a Meta não reconheceu
    if (l.id == null) continue;                  // sem id não dá pra usar
    // Só aceita id string ou número; qualquer outro tipo é garbage que não pode
    // ser um identificador de verdade (objeto, array, boolean viram identificadores
    // fake como "[object Object]" ou "true" se convertidos a string, e depois quebram
    // na tabela e na conta). NaN é typeof 'number' mas também é garbage: "NaN" string.
    if (typeof l.id !== 'string' && typeof l.id !== 'number') continue;
    if (Number.isNaN(l.id)) continue;
    const id = String(l.id);
    if (vistos.has(id)) continue;
    const nome = limpo(l.name);
    if (!nome) continue;
    vistos.add(id);
    // Tamanho do público: TRÊS nomes de campo possíveis, na ordem de preferência.
    // A Graph v22 (a versão que o meta-proxy usa) aposentou o `audience_size`
    // pelado nas buscas de segmentação em favor de `audience_size_lower_bound` /
    // `audience_size_upper_bound` — a mesma família de mudança que já mordeu este
    // projeto com `approximate_count` → `approximate_count_upper_bound` (a cicatriz
    // está anotada no painel-subir.vue). Ler só o nome antigo não daria ERRO: daria
    // tamanho nulo em TODO interesse, e a faixa apareceria sem número nenhum, que é
    // justamente o que ela tem de mais útil. Aceitar os três resolve nos dois mundos.
    // Ausente continua virando null (tamanho DESCONHECIDO), nunca 0.
    const bruto = l.audience_size ?? l.audience_size_upper_bound ?? l.audience_size_lower_bound;
    let audience_size = null;
    if (bruto != null) {
      const n = Number(bruto);
      if (Number.isFinite(n)) audience_size = n;
    }
    itens.push({
      id,
      nome,
      audience_size,
    });
  }
  return { itens, propostos: lista(propostos).length, validos: itens.length };
}
